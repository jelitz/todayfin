"""Stage 1 데이터 소스 스파이크 — 소스별 실제 접근성·응답 포맷 검증.

로컬(Windows, 한국 IP)과 GitHub Actions(해외 IP) 양쪽에서 실행해 결과를 비교한다.
사용:
    uv run --python 3.12 --with finance-datareader --with requests --with pandas --with lxml spike.py
ECOS 검증은 환경 변수 ECOS_API_KEY 가 있을 때만 실행된다.
"""

import io
import json
import os
import sys
import time
from datetime import date, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import requests

sys.stdout.reconfigure(encoding="utf-8")

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
}
RESULTS: dict[str, dict] = {}


def last_weekday_kst(back_from_days: int = 1) -> date:
    d = date.today() if os.environ.get("CI") is None else None
    now_kst = pd.Timestamp.now(tz=ZoneInfo("Asia/Seoul")).date()
    d = now_kst - timedelta(days=back_from_days)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def run(name: str, fn):
    t0 = time.time()
    try:
        detail = fn() or {}
        RESULTS[name] = {"ok": True, "sec": round(time.time() - t0, 1), **detail}
        print(f"[OK]   {name} ({RESULTS[name]['sec']}s) {detail.get('note', '')}")
    except Exception as e:
        RESULTS[name] = {"ok": False, "sec": round(time.time() - t0, 1), "error": f"{type(e).__name__}: {e}"}
        print(f"[FAIL] {name}: {RESULTS[name]['error']}")


# ── 1) 네이버 수급 (investorDealTrendDay) ──────────────────────────────────
def naver_flows(sosok: str):
    def _fn():
        bizdate = last_weekday_kst().strftime("%Y%m%d")
        url = (
            "https://finance.naver.com/sise/investorDealTrendDay.naver"
            f"?bizdate={bizdate}&sosok={sosok}&page=1"
        )
        r = requests.get(url, headers=UA, timeout=20)
        r.raise_for_status()
        tables = pd.read_html(io.StringIO(r.text))
        df = max(tables, key=len).dropna(how="all")
        head = df.head(4).to_dict("split")
        return {
            "note": f"bizdate={bizdate} rows={len(df)}",
            "columns": [str(c) for c in df.columns.tolist()],
            "sample": json.loads(json.dumps(head, default=str, ensure_ascii=False)),
        }

    return _fn


# ── 2) FinanceDataReader ───────────────────────────────────────────────────
def fdr_fetch(symbol: str):
    def _fn():
        import FinanceDataReader as fdr

        start = (date.today() - timedelta(days=20)).isoformat()
        df = fdr.DataReader(symbol, start)
        if df.empty:
            raise ValueError("empty dataframe")
        tail = df.tail(3)
        return {
            "note": f"rows={len(df)} last={df.index[-1].date()}",
            "columns": df.columns.tolist(),
            "sample": json.loads(tail.to_json(orient="split", date_format="iso")),
        }

    return _fn


# ── 3) Stooq CSV (2026-08 확인: 봇 방지 JS 챌린지로 완전 차단됨 — 참고용으로 유지) ──
def stooq_fetch(symbol: str):
    def _fn():
        d1 = (date.today() - timedelta(days=20)).strftime("%Y%m%d")
        d2 = date.today().strftime("%Y%m%d")
        url = f"https://stooq.com/q/d/l/?s={symbol}&d1={d1}&d2={d2}&i=d"
        r = requests.get(url, headers=UA, timeout=20)
        r.raise_for_status()
        text = r.text.strip()
        if not text.startswith("Date") or len(text.splitlines()) < 2:
            raise ValueError(f"unexpected body: {text[:120]!r}")
        df = pd.read_csv(io.StringIO(text))
        return {
            "note": f"rows={len(df)} last={df.iloc[-1]['Date']}",
            "columns": df.columns.tolist(),
            "sample": df.tail(3).to_dict("records"),
        }

    return _fn


# ── 3b) yfinance (Stooq 대체 후보) ──────────────────────────────────────────
def yfinance_fetch(symbol: str):
    def _fn():
        import yfinance as yf

        df = yf.Ticker(symbol).history(period="10d")
        if df.empty:
            raise ValueError("empty dataframe")
        tail = df.tail(3)[["Open", "High", "Low", "Close"]]
        return {
            "note": f"rows={len(df)} last={df.index[-1].date()}",
            "sample": json.loads(tail.to_json(orient="split", date_format="iso")),
        }

    return _fn


# ── 4) 미 재무부 Daily Par Yield ────────────────────────────────────────────
def treasury_fetch():
    year = date.today().year
    url = (
        "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
        f"daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve"
        f"&field_tdr_date_value={year}&page&_format=csv"
    )
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    col10 = [c for c in df.columns if "10 Yr" in c]
    if not col10:
        raise ValueError(f"'10 Yr' column not found in {df.columns.tolist()}")
    sub = df[["Date", col10[0]]].head(3)
    return {
        "note": f"rows={len(df)} latest={df.iloc[0]['Date']}",
        "columns": df.columns.tolist()[:8],
        "sample": sub.to_dict("records"),
    }


# ── 5b) KRX Open API (키 있을 때만) ──────────────────────────────────────────
def krx_fetch(name: str, path: str, filter_code: str | None = None):
    def _fn():
        key = os.environ.get("KRX_API_KEY")
        if not key:
            return {"note": "skipped (no KRX_API_KEY)"}
        results = {}
        for back in (1, 2, 3, 5):
            bas_dd = last_weekday_kst(back).strftime("%Y%m%d")
            url = f"http://data-dbg.krx.co.kr/svc/apis/{path}"
            r = requests.get(url, params={"basDd": bas_dd}, headers={"AUTH_KEY": key}, timeout=20)
            body_preview = r.text[:300]
            try:
                body = r.json()
            except ValueError:
                results[f"back{back}({bas_dd})"] = f"status={r.status_code} non-json body={body_preview!r}"
                continue
            if "OutBlock_1" not in body:
                results[f"back{back}({bas_dd})"] = f"status={r.status_code} body={json.dumps(body, ensure_ascii=False)[:300]}"
                continue
            rows = body["OutBlock_1"]
            if filter_code:
                rows = [row for row in rows if row.get("ISU_CD") == filter_code or row.get("ISU_SRT_CD") == filter_code]
            results[f"back{back}({bas_dd})"] = f"rows={len(rows)} sample={rows[:1]}"
        return {"note": f"{name} basDd별 결과", "sample": results}

    return _fn


# ── 5c) KRX 파생상품지수 — VKOSPI(코스피 200 변동성지수) 포함 여부 확인 ─────
def krx_drvprod():
    def _fn():
        key = os.environ.get("KRX_API_KEY")
        if not key:
            return {"note": "skipped (no KRX_API_KEY)"}
        url = "http://data-dbg.krx.co.kr/svc/apis/idx/drvprod_dd_trd"
        for back in (1, 2, 3, 5):
            bas_dd = last_weekday_kst(back).strftime("%Y%m%d")
            r = requests.get(url, params={"basDd": bas_dd}, headers={"AUTH_KEY": key}, timeout=20)
            try:
                body = r.json()
            except ValueError:
                raise ValueError(f"status={r.status_code} non-json body={r.text[:300]!r}")
            if "OutBlock_1" not in body:
                raise ValueError(f"status={r.status_code} body={json.dumps(body, ensure_ascii=False)[:300]}")
            rows = body["OutBlock_1"]
            if not rows:
                continue  # T+1 공표 전이면 다음 소급일 시도
            vol = [row for row in rows if "변동성" in row.get("IDX_NM", "")]
            return {
                "note": f"basDd={bas_dd} rows={len(rows)} vol_rows={len(vol)}",
                "idx_names": [row.get("IDX_NM") for row in rows],
                "sample": vol if vol else rows[:2],
            }
        raise ValueError("모든 소급일에서 rows=0")

    return _fn


# ── 6) 뉴스 RSS (news-headlines 기능 후보 소스 — 러너 IP 차단 여부 확인) ────
def news_rss_fetch(url: str):
    def _fn():
        import xml.etree.ElementTree as ET

        r = requests.get(url, headers=UA, timeout=20)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        items = root.findall(".//item")
        if not items:
            raise ValueError(f"item 0건 body={r.text[:200]!r}")
        sample = []
        for it in items[:3]:
            src = it.find("source")
            sample.append(
                {
                    "title": (it.findtext("title") or "").strip()[:80],
                    "pubDate": (it.findtext("pubDate") or "").strip(),
                    "source": src.text if src is not None else None,
                }
            )
        return {"note": f"items={len(items)}", "sample": sample}

    return _fn


# ── 5) ECOS (키 있을 때만) ──────────────────────────────────────────────────
def ecos_fetch():
    key = os.environ.get("ECOS_API_KEY")
    if not key:
        return {"note": "skipped (no ECOS_API_KEY)"}
    end = last_weekday_kst().strftime("%Y%m%d")
    start = (last_weekday_kst() - timedelta(days=15)).strftime("%Y%m%d")
    # 817Y002: 시장금리(일별) — 항목코드는 응답으로 확인 (010200000: 국고채 3년 추정)
    url = (
        f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/20/"
        f"817Y002/D/{start}/{end}/010200000"
    )
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    body = r.json()
    if "StatisticSearch" not in body:
        raise ValueError(f"unexpected: {json.dumps(body, ensure_ascii=False)[:200]}")
    rows = body["StatisticSearch"]["row"]
    return {
        "note": f"rows={len(rows)} last={rows[-1]['TIME']} value={rows[-1]['DATA_VALUE']}",
        "sample": rows[-3:],
    }


def main():
    print(f"=== todayfin source spike === (UTC {pd.Timestamp.utcnow()}, CI={os.environ.get('CI', 'no')})")
    run("naver_flows_sosok(kospi?)", naver_flows(""))
    run("naver_flows_sosok01", naver_flows("01"))
    run("naver_flows_sosok02", naver_flows("02"))
    run("fdr_KS11", fdr_fetch("KS11"))
    run("fdr_KQ11", fdr_fetch("KQ11"))
    run("fdr_005930", fdr_fetch("005930"))
    run("fdr_000660", fdr_fetch("000660"))
    run("stooq_usdkrw", stooq_fetch("usdkrw"))
    run("stooq_usdjpy", stooq_fetch("usdjpy"))
    run("stooq_cl.f", stooq_fetch("cl.f"))
    run("stooq_10usy.b", stooq_fetch("10usy.b"))
    run("yfinance_KRW=X", yfinance_fetch("KRW=X"))
    run("yfinance_JPY=X", yfinance_fetch("JPY=X"))
    run("yfinance_CL=F", yfinance_fetch("CL=F"))
    run("treasury_10y", treasury_fetch)
    run("ecos_ktb3y", ecos_fetch)
    run("krx_kospi_index", krx_fetch("krx_kospi_index", "idx/kospi_dd_trd"))
    run("krx_kosdaq_index", krx_fetch("krx_kosdaq_index", "idx/kosdaq_dd_trd"))
    run("krx_samsung", krx_fetch("krx_samsung", "sto/stk_bydd_trd", filter_code="005930"))
    run("krx_skhynix", krx_fetch("krx_skhynix", "sto/stk_bydd_trd", filter_code="000660"))
    run("krx_drvprod_vkospi", krx_drvprod())
    run(
        "news_gnews_topic_business",
        news_rss_fetch("https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko"),
    )
    run(
        "news_gnews_search_jeungsi",
        news_rss_fetch("https://news.google.com/rss/search?q=%EC%A6%9D%EC%8B%9C%20when:1d&hl=ko&gl=KR&ceid=KR:ko"),
    )
    run("news_yna_economy", news_rss_fetch("https://www.yna.co.kr/rss/economy.xml"))
    run("news_mk_headline", news_rss_fetch("https://www.mk.co.kr/rss/30000001/"))

    ok = sum(1 for v in RESULTS.values() if v["ok"])
    print(f"\n=== summary: {ok}/{len(RESULTS)} ok ===")
    out = os.path.join(os.path.dirname(__file__), "spike-result.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2, default=str)
    print(f"saved: {out}")


if __name__ == "__main__":
    main()
