"""validate.py 단위 테스트 — 스키마·불변식 검증 로직.

실행: uv run --python 3.12 --with pytest --with pandas pytest pipeline/tests/test_validate.py
"""

import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import validate  # noqa: E402


def _ohlcv(rows):
    return pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])


def test_ohlcv_valid_passes_no_warning():
    df = _ohlcv(
        [
            ["2026-08-01", 100, 105, 99, 103, 1000],
            ["2026-08-02", 103, 106, 101, 104, 1100],
        ]
    )
    assert validate.validate("ohlcv", df) == []


def test_ohlcv_low_above_close_raises():
    df = _ohlcv([["2026-08-01", 100, 105, 104, 103, 1000]])  # low(104) > close(103)
    with pytest.raises(ValueError, match="불변식"):
        validate.validate("ohlcv", df)


def test_ohlcv_duplicate_date_raises():
    df = _ohlcv(
        [
            ["2026-08-01", 100, 105, 99, 103, 1000],
            ["2026-08-01", 100, 105, 99, 103, 1000],
        ]
    )
    with pytest.raises(ValueError, match="중복"):
        validate.validate("ohlcv", df)


def test_ohlcv_non_monotonic_date_raises():
    df = _ohlcv(
        [
            ["2026-08-02", 100, 105, 99, 103, 1000],
            ["2026-08-01", 100, 105, 99, 103, 1000],
        ]
    )
    with pytest.raises(ValueError, match="오름차순"):
        validate.validate("ohlcv", df)


def test_ohlcv_zero_price_raises():
    # OHLC 관계 자체는 성립(모두 0)하도록 만들어 "0 이하 값" 검사를 단독으로 트리거
    df = _ohlcv([["2026-08-01", 0, 0, 0, 0, 1000]])
    with pytest.raises(ValueError, match="0 이하"):
        validate.validate("ohlcv", df)


def test_ohlcv_spike_warns_but_does_not_raise():
    df = _ohlcv(
        [
            ["2026-08-01", 100, 105, 99, 100, 1000],
            ["2026-08-02", 150, 155, 149, 150, 1000],  # +50% (전일 대비)
        ]
    )
    warnings = validate.validate("ohlcv", df)
    assert len(warnings) == 1
    assert "30.0%" in warnings[0]


def test_line_missing_value_column_raises():
    df = pd.DataFrame([["2026-08-01"]], columns=["date"])
    with pytest.raises(ValueError, match="컬럼 누락"):
        validate.validate("line", df)


def test_line_nan_value_raises():
    df = pd.DataFrame([["2026-08-01", None]], columns=["date", "value"])
    with pytest.raises(ValueError, match="결측값"):
        validate.validate("line", df)


def test_flows_valid_passes():
    df = pd.DataFrame(
        [["2026-08-01", -100.0, 200.0, -100.0]],
        columns=["date", "individual", "foreign", "institution"],
    )
    assert validate.validate("flows", df, columns=["individual", "foreign", "institution"]) == []


def test_flows_missing_column_raises():
    df = pd.DataFrame([["2026-08-01", -100.0]], columns=["date", "individual"])
    with pytest.raises(ValueError, match="컬럼 누락"):
        validate.validate("flows", df, columns=["individual", "foreign", "institution"])


def test_empty_dataframe_raises():
    with pytest.raises(ValueError, match="빈 데이터프레임"):
        validate.validate("ohlcv", _ohlcv([]))


def test_unknown_type_raises():
    df = _ohlcv([["2026-08-01", 100, 105, 99, 103, 1000]])
    with pytest.raises(ValueError, match="알 수 없는"):
        validate.validate("unknown_type", df)


def test_headline_index_ohlcv_is_close_not_volume():
    import collect

    spec = {"type": "ohlcv"}
    idx = collect._headline_index(spec)
    row = ["2026-08-01", 100, 105, 99, 103, 999999999]  # date,o,h,l,close=103,volume=999999999
    assert row[idx] == 103


def test_headline_index_flows_is_foreign():
    import collect

    spec = {"type": "flows", "columns": ["individual", "foreign", "institution"]}
    idx = collect._headline_index(spec)
    row = ["2026-08-01", -100.0, 250.0, -150.0]  # foreign=250.0
    assert row[idx] == 250.0


def test_headline_index_line_is_value():
    import collect

    spec = {"type": "line"}
    idx = collect._headline_index(spec)
    row = ["2026-08-01", 1436.6]
    assert row[idx] == 1436.6
