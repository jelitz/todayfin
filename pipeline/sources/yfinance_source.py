"""yfinance — 환율(원/달러·달러/엔·유로/달러)·달러인덱스·원자재(WTI·금)는 line,
해외 지수(나스닥·S&P 500·다우존스·니케이 225)는 ohlcv.

Stooq가 2026년 도입한 봇 방지(proof-of-work JS 챌린지)로 완전 차단되어(로컬+Actions 확인)
원래 폴백이던 이 소스를 1순위로 승격함. Stage 1 스파이크에서 GitHub Actions 러너 접근 확인 완료.
알려진 리스크: yfinance는 클라우드 IP에서 간헐적 429 이력이 있음 — 재시도(collect.py)로 수용.
2026-08-08: 지표 7종 추가로 ohlcv 지원 확장 — docs/specs/global-indicators/design.md §1-1.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import yfinance as yf

_LINE_SYMBOL = {
    "usdkrw": "KRW=X",
    "usdjpy": "JPY=X",
    "wti": "CL=F",
    "eurusd": "EURUSD=X",
    "dxy": "DX-Y.NYB",
    "gold": "GC=F",
}
_OHLCV_SYMBOL = {
    "nasdaq": "^IXIC",
    "sp500": "^GSPC",
    "dow": "^DJI",
    "nikkei": "^N225",
}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: line → date, value / ohlcv → date, open, high, low, close, volume (fdr_source와 동일 계약)."""
    is_ohlcv = indicator_id in _OHLCV_SYMBOL
    symbol = _OHLCV_SYMBOL[indicator_id] if is_ohlcv else _LINE_SYMBOL[indicator_id]
    # yfinance의 end 파라미터는 배타적(exclusive)이므로 +1일
    df = yf.Ticker(symbol).history(
        start=start.isoformat(), end=(end + timedelta(days=1)).isoformat()
    )
    if df.empty:
        raise ValueError(f"yfinance fetch({indicator_id}): 빈 응답")

    # 휴장일·부분 데이터에 섞이는 NaN 행 방어 — validate의 결측·불변식 검사에서
    # 지표 전체가 failed 처리되는 것을 막는다.
    df = df.dropna(subset=["Open", "High", "Low", "Close"] if is_ohlcv else ["Close"])
    if df.empty:
        raise ValueError(f"yfinance fetch({indicator_id}): 유효 행 없음(전부 결측)")

    if is_ohlcv:
        out = pd.DataFrame(
            {
                "date": df.index.strftime("%Y-%m-%d"),
                "open": df["Open"].round(2).values,
                "high": df["High"].round(2).values,
                "low": df["Low"].round(2).values,
                "close": df["Close"].round(2).values,
                # volume만 NaN인 행은 0으로(지수 거래량은 화면 미사용). int 캐스팅 금지 —
                # 기존 ohlcv 파일 계약이 float이고 int32 환경에선 나스닥 거래량(7e9)이 오버플로.
                "volume": df["Volume"].fillna(0).values,
            }
        )
    else:
        out = pd.DataFrame(
            {
                "date": df.index.strftime("%Y-%m-%d"),
                "value": df["Close"].round(4).values,
            }
        )
    return out.drop_duplicates(subset="date").reset_index(drop=True)
