"""yfinance_source.py 단위 테스트 — ohlcv/line 변환·NaN 방어·중복 제거.

실행: uv run --python 3.12 --with pytest --with pandas --with yfinance pytest pipeline/tests/test_yfinance.py
"""

import os
import sys
from datetime import date
from unittest.mock import patch

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources import yfinance_source  # noqa: E402


def _history_df(rows: list[dict]) -> pd.DataFrame:
    """yf.Ticker().history() 반환 모사 — DatetimeIndex + 대문자 컬럼."""
    idx = pd.DatetimeIndex([r["date"] for r in rows])
    return pd.DataFrame(
        {
            "Open": [r.get("open") for r in rows],
            "High": [r.get("high") for r in rows],
            "Low": [r.get("low") for r in rows],
            "Close": [r.get("close") for r in rows],
            "Volume": [r.get("volume") for r in rows],
        },
        index=idx,
    )


def _mock_ticker(df: pd.DataFrame):
    class _Ticker:
        def __init__(self, symbol):
            self.symbol = symbol

        def history(self, start, end):
            return df

    return _Ticker


@patch("sources.yfinance_source.yf.Ticker")
def test_ohlcv_maps_columns_and_rounds(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-06", "open": 26534.661, "high": 26712.625, "low": 26478.014, "close": 26690.6152, "volume": 7207856000},
            ]
        )
    )
    out = yfinance_source.fetch("nasdaq", date(2026, 8, 1), date(2026, 8, 7))
    assert list(out.columns) == ["date", "open", "high", "low", "close", "volume"]
    assert out.iloc[0].tolist() == ["2026-08-06", 26534.66, 26712.62, 26478.01, 26690.62, 7207856000]


@patch("sources.yfinance_source.yf.Ticker")
def test_ohlcv_drops_nan_price_rows(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-05", "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": 10},
                {"date": "2026-08-06", "open": None, "high": None, "low": None, "close": None, "volume": None},  # 휴장일 NaN 행
            ]
        )
    )
    out = yfinance_source.fetch("nikkei", date(2026, 8, 1), date(2026, 8, 7))
    assert out["date"].tolist() == ["2026-08-05"]


@patch("sources.yfinance_source.yf.Ticker")
def test_ohlcv_volume_nan_becomes_zero_float(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-06", "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": None},
            ]
        )
    )
    out = yfinance_source.fetch("sp500", date(2026, 8, 1), date(2026, 8, 7))
    # int 캐스팅 없이 float 0.0 — 기존 ohlcv 파일 계약(float)·int32 오버플로 방지 (design.md §1-1)
    assert out["volume"].tolist() == [0.0]


@patch("sources.yfinance_source.yf.Ticker")
def test_ohlcv_deduplicates_dates(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-06", "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": 10},
                {"date": "2026-08-06", "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.7, "volume": 12},
            ]
        )
    )
    out = yfinance_source.fetch("dow", date(2026, 8, 1), date(2026, 8, 7))
    assert out["date"].tolist() == ["2026-08-06"]


@patch("sources.yfinance_source.yf.Ticker")
def test_line_contract_unchanged(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-06", "open": 1.15, "high": 1.16, "low": 1.15, "close": 1.15623, "volume": 0},
            ]
        )
    )
    out = yfinance_source.fetch("eurusd", date(2026, 8, 1), date(2026, 8, 7))
    assert list(out.columns) == ["date", "value"]
    assert out.iloc[0].tolist() == ["2026-08-06", 1.1562]


@patch("sources.yfinance_source.yf.Ticker")
def test_line_drops_nan_close_rows(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df(
            [
                {"date": "2026-08-05", "close": 63.5},
                {"date": "2026-08-06", "close": None},
            ]
        )
    )
    out = yfinance_source.fetch("wti", date(2026, 8, 1), date(2026, 8, 7))
    assert out["date"].tolist() == ["2026-08-05"]


@patch("sources.yfinance_source.yf.Ticker")
def test_empty_response_raises(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(pd.DataFrame())
    with pytest.raises(ValueError, match="빈 응답"):
        yfinance_source.fetch("gold", date(2026, 8, 1), date(2026, 8, 7))


@patch("sources.yfinance_source.yf.Ticker")
def test_all_nan_response_raises(mock_ticker):
    mock_ticker.side_effect = _mock_ticker(
        _history_df([{"date": "2026-08-06", "close": None}])
    )
    with pytest.raises(ValueError, match="유효 행 없음"):
        yfinance_source.fetch("usdkrw", date(2026, 8, 1), date(2026, 8, 7))
