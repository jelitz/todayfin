"""ECOS(한국은행) Open API — 국고채 3년.

통계표 817Y002(시장금리·일별), 항목코드 010200000(국고채 3년 추정)은 Stage 1 스파이크가
ECOS_API_KEY 부재로 실응답 검증을 못 해 잠정치임. 키 발급 후 실응답으로 항목코드·단위를
재확인할 것 — docs/specs/dashboard-mvp/implemented.md 미결 항목 참조.
"""

from __future__ import annotations

import os
from datetime import date

import pandas as pd
import requests

_STAT_CODE = "817Y002"
_ITEM_CODE = "010200000"  # 국고채 3년 추정 — 미검증


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, value (%)."""
    key = os.environ.get("ECOS_API_KEY")
    if not key:
        raise RuntimeError("ECOS_API_KEY 미설정")

    url = (
        f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/1000/"
        f"{_STAT_CODE}/D/{start.strftime('%Y%m%d')}/{end.strftime('%Y%m%d')}/{_ITEM_CODE}"
    )
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    body = r.json()
    if "StatisticSearch" not in body:
        err = body.get("RESULT", {}).get("MESSAGE", body)
        raise ValueError(f"ecos fetch: {err}")

    rows = body["StatisticSearch"]["row"]
    out = pd.DataFrame(
        {
            "date": [f"{row['TIME'][:4]}-{row['TIME'][4:6]}-{row['TIME'][6:8]}" for row in rows],
            "value": [float(row["DATA_VALUE"]) for row in rows],
        }
    )
    return out.sort_values("date").drop_duplicates(subset="date").reset_index(drop=True)
