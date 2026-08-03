"""네이버 금융 실시간 시세 폴링 API — 코스피/코스닥/삼성전자/SK하이닉스 장중 스냅샷.

네이버 자체 위젯이 쓰는 비공식 엔드포인트(pollingInterval: 7000ms 명시 — 사실상 실시간).
과거 확정 일봉은 fdr_source가 담당하고, 이 모듈은 "오늘 하루치" 단일 스냅샷만 반환한다.
docs/specs/near-realtime-updates/design.md 참조. 비공식 소스 — docs/data-rights.md 게이트 대상.
"""

from __future__ import annotations

import re
from datetime import date

import requests

_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}

# (endpoint 종류, 코드) — kospi/kosdaq은 지수, samsung/skhynix는 종목
_ENDPOINT: dict[str, tuple[str, str]] = {
    "kospi": ("index", "KOSPI"),
    "kosdaq": ("index", "KOSDAQ"),
    "samsung": ("stock", "005930"),
    "skhynix": ("stock", "000660"),
}

_NUMERIC_RE = re.compile(r"[^\d.\-]")


def _num(s: str) -> float:
    """'242,000' / '6,358.27' / '117,375천주' 등에서 콤마·단위 접미사를 제거하고 float로 변환.
    파싱 실패 시 0.0(지수 거래량처럼 화면에 쓰이지 않는 값의 방어적 폴백)."""
    cleaned = _NUMERIC_RE.sub("", s)
    return float(cleaned) if cleaned else 0.0


def fetch_today(indicator_id: str) -> dict:
    """반환: {date, open, high, low, close, volume} — 오늘 날짜의 장중 스냅샷 1건."""
    kind, code = _ENDPOINT[indicator_id]
    url = f"https://polling.finance.naver.com/api/realtime/domestic/{kind}/{code}"
    resp = requests.get(url, headers=_UA, timeout=10)
    resp.raise_for_status()
    payload = resp.json()
    datas = payload.get("datas") or []
    if not datas:
        raise ValueError(f"naver_realtime fetch_today({indicator_id}): 응답 없음")
    d = datas[0]

    return {
        "date": date.today().isoformat(),
        "open": _num(d["openPrice"]),
        "high": _num(d["highPrice"]),
        "low": _num(d["lowPrice"]),
        "close": _num(d["closePrice"]),  # 필드명과 달리 "현재가"(실시간 최근 체결가)
        "volume": _num(d["accumulatedTradingVolume"]),
    }
