"""yfinance — 원/달러, 달러/엔 시장환율, WTI 최근월 선물.

Stooq가 2026년 도입한 봇 방지(proof-of-work JS 챌린지)로 완전 차단되어(로컬+Actions 확인)
원래 폴백이던 이 소스를 1순위로 승격함. Stage 1 스파이크에서 GitHub Actions 러너 접근 확인 완료.
알려진 리스크: yfinance는 클라우드 IP에서 간헐적 429 이력이 있음 — Stage 4 운영 관찰로 재확인 예정.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import yfinance as yf

_SYMBOL = {"usdkrw": "KRW=X", "usdjpy": "JPY=X", "wti": "CL=F"}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, value."""
    symbol = _SYMBOL[indicator_id]
    # yfinance의 end 파라미터는 배타적(exclusive)이므로 +1일
    df = yf.Ticker(symbol).history(
        start=start.isoformat(), end=(end + timedelta(days=1)).isoformat()
    )
    if df.empty:
        raise ValueError(f"yfinance fetch({indicator_id}): 빈 응답")
    out = pd.DataFrame(
        {
            "date": df.index.strftime("%Y-%m-%d"),
            "value": df["Close"].round(4).values,
        }
    )
    return out.drop_duplicates(subset="date").reset_index(drop=True)
