"""FinanceDataReader — 코스피·코스닥 지수, 삼성전자·SK하이닉스.

Stage 1 스파이크(로컬+GitHub Actions)에서 접근성 확인 완료.
FDR 0.9.110+는 KRX 데이터를 자체 GitHub 캐시에서 읽음(로그인 불필요) — 상세는 docs/data-rights.md.
"""

from __future__ import annotations

from datetime import date

import FinanceDataReader as fdr
import pandas as pd

_SYMBOL = {
    "kospi": "KS11",
    "kosdaq": "KQ11",
    "samsung": "005930",
    "skhynix": "000660",
}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, open, high, low, close, volume."""
    symbol = _SYMBOL[indicator_id]
    df = fdr.DataReader(symbol, start.isoformat(), end.isoformat())
    if df.empty:
        raise ValueError(f"fdr fetch({indicator_id}): 빈 응답")
    df = df.rename(columns=str.lower)
    out = df[["open", "high", "low", "close", "volume"]].copy()
    out.insert(0, "date", df.index.strftime("%Y-%m-%d"))
    return out.reset_index(drop=True)
