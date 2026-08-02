"""미 재무부 Daily Treasury Par Yield Curve Rates — 2년/10년/30년물.

미 연방정부 공식 발표 자료(퍼블릭 도메인) — Stage 1 스파이크에서 접근성 확인 완료.
동일 CSV에 2/3/5/7/10/20/30년 컬럼이 모두 있어(2026-08 실응답 확인) 만기별로 하나의
어댑터를 재사용한다.
"""

from __future__ import annotations

import io
from datetime import date

import pandas as pd
import requests

_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}

_COLUMN_BY_ID = {
    "ust2y": "2 Yr",
    "ust10y": "10 Yr",
    "ust30y": "30 Yr",
}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, value (%)."""
    target_col = _COLUMN_BY_ID.get(indicator_id)
    if target_col is None:
        raise ValueError(f"treasury fetch: 알 수 없는 indicator_id {indicator_id!r}")

    frames = []
    for year in range(start.year, end.year + 1):
        url = (
            "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
            f"daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve"
            f"&field_tdr_date_value={year}&page&_format=csv"
        )
        r = requests.get(url, headers=_UA, timeout=30)
        r.raise_for_status()
        frames.append(pd.read_csv(io.StringIO(r.text)))
    raw = pd.concat(frames, ignore_index=True)

    col = next((c for c in raw.columns if target_col in c), None)
    if col is None:
        raise ValueError(
            f"treasury fetch({indicator_id}): '{target_col}' 컬럼 없음 (columns={raw.columns.tolist()})"
        )

    raw["date"] = pd.to_datetime(raw["Date"], format="%m/%d/%Y").dt.strftime("%Y-%m-%d")
    out = raw[["date", col]].rename(columns={col: "value"}).dropna()
    out = out[(out["date"] >= start.isoformat()) & (out["date"] <= end.isoformat())]
    return out.sort_values("date").drop_duplicates(subset="date").reset_index(drop=True)
