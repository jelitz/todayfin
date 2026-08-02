"""FRED API — 미국채 2/10/30년. ust2y/ust10y/ust30y의 검증·보정용 폴백(1영업일+ 지연, 1순위 아님)."""

from __future__ import annotations

import os
from datetime import date

import pandas as pd
import requests

_SERIES_BY_ID = {
    "ust2y": "DGS2",
    "ust10y": "DGS10",
    "ust30y": "DGS30",
}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, value (%)."""
    series_id = _SERIES_BY_ID.get(indicator_id)
    if series_id is None:
        raise ValueError(f"fred fetch: 알 수 없는 indicator_id {indicator_id!r}")

    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY 미설정")

    url = (
        "https://api.stlouisfed.org/fred/series/observations"
        f"?series_id={series_id}&api_key={key}&file_type=json"
        f"&observation_start={start.isoformat()}&observation_end={end.isoformat()}"
    )
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    obs = r.json().get("observations", [])
    rows = [(o["date"], float(o["value"])) for o in obs if o["value"] != "."]
    if not rows:
        raise ValueError("fred fetch: 유효 관측치 없음")
    out = pd.DataFrame(rows, columns=["date", "value"])
    return out.sort_values("date").reset_index(drop=True)
