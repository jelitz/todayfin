"""네이버 금융 investorDealTrendDay — 주체별(개인/외국인/기관) 순매수, 코스피·코스닥.

Stage 1 스파이크(로컬+GitHub Actions)에서 접근성 확인 완료.
sosok 확정: ''/'01' = 코스피, '02' = 코스닥 (실 응답 비교로 확인).
비공식 스크래핑 경로 — docs/data-rights.md 게이트 대상.
"""

from __future__ import annotations

import io
import time
from datetime import date

import pandas as pd
import requests

_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}
_SOSOK = {"investor_kospi": "01", "investor_kosdaq": "02"}
_MAX_PAGES = 400  # 5년 영업일(~1250일) / 페이지당 10행 기준 여유 상한
_PAGE_DELAY_SEC = 0.3


def _parse_bizdate(s: str) -> date:
    yy, mm, dd = str(s).split(".")
    return date(2000 + int(yy), int(mm), int(dd))


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, individual, foreign, institution (억원)."""
    sosok = _SOSOK[indicator_id]
    bizdate = end.strftime("%Y%m%d")
    rows: list[dict] = []
    seen: set[date] = set()

    for page in range(1, _MAX_PAGES + 1):
        url = (
            "https://finance.naver.com/sise/investorDealTrendDay.naver"
            f"?bizdate={bizdate}&sosok={sosok}&page={page}"
        )
        resp = requests.get(url, headers=_UA, timeout=20)
        resp.raise_for_status()
        tables = pd.read_html(io.StringIO(resp.text))
        df = max(tables, key=len).dropna(how="all")
        if df.empty:
            break

        page_dates: list[date] = []
        for _, r in df.iterrows():
            try:
                d = _parse_bizdate(r.iloc[0])
            except Exception:
                continue
            if d in seen:
                continue
            seen.add(d)
            page_dates.append(d)
            rows.append(
                {
                    "date": d.isoformat(),
                    "individual": float(r.iloc[1]),
                    "foreign": float(r.iloc[2]),
                    "institution": float(r.iloc[3]),
                }
            )

        if not page_dates or min(page_dates) <= start:
            break
        time.sleep(_PAGE_DELAY_SEC)
    else:
        raise RuntimeError(f"naver fetch({indicator_id}): {_MAX_PAGES}페이지 내에 {start} 도달 못함")

    if not rows:
        raise ValueError(f"naver fetch({indicator_id}): 응답 없음")

    out = pd.DataFrame(rows).drop_duplicates(subset="date").sort_values("date")
    out = out[(out["date"] >= start.isoformat()) & (out["date"] <= end.isoformat())]
    return out.reset_index(drop=True)
