"""FRED API — DGS10 (미국채 10년). ust10y의 검증·보정용 폴백(1영업일+ 지연, 1순위 아님)."""

from __future__ import annotations

import os
from datetime import date

import pandas as pd
import requests


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, value (%)."""
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY 미설정")

    url = (
        "https://api.stlouisfed.org/fred/series/observations"
        f"?series_id=DGS10&api_key={key}&file_type=json"
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
