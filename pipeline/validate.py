"""수집 응답 검증 — 스키마·불변식. 실패 시 예외 raise, 호출자(collect.py)가 catch해 skip 처리."""

from __future__ import annotations

import pandas as pd

_MAX_DAILY_CHANGE_PCT = 30.0  # 전일 대비 이 이상 변동 시 경고(에러 아님, 배당락·급등락 등 정상 케이스 존재)


def _check_date_order(df: pd.DataFrame) -> None:
    if df["date"].duplicated().any():
        raise ValueError("날짜 중복")
    if not df["date"].is_monotonic_increasing:
        raise ValueError("날짜가 오름차순이 아님")


def validate_ohlcv(df: pd.DataFrame) -> list[str]:
    required = {"date", "open", "high", "low", "close", "volume"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"OHLCV 컬럼 누락: {missing}")
    _check_date_order(df)

    bad = df[
        (df["low"] > df[["open", "close"]].min(axis=1))
        | (df["high"] < df[["open", "close"]].max(axis=1))
        | (df["low"] > df["high"])
    ]
    if not bad.empty:
        raise ValueError(f"OHLC 불변식 위반: {bad['date'].tolist()}")
    if (df[["open", "high", "low", "close"]] <= 0).any().any():
        raise ValueError("가격에 0 이하 값 존재")

    pct = df["close"].pct_change().abs() * 100
    spikes = df.loc[pct > _MAX_DAILY_CHANGE_PCT, "date"].tolist()
    return [f"전일 대비 {_MAX_DAILY_CHANGE_PCT}% 이상 변동: {spikes}"] if spikes else []


def validate_line(df: pd.DataFrame) -> list[str]:
    required = {"date", "value"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"line 컬럼 누락: {missing}")
    _check_date_order(df)
    if df["value"].isna().any():
        raise ValueError("결측값 존재")

    pct = df["value"].pct_change().abs() * 100
    spikes = df.loc[pct > _MAX_DAILY_CHANGE_PCT, "date"].tolist()
    return [f"전일 대비 {_MAX_DAILY_CHANGE_PCT}% 이상 변동: {spikes}"] if spikes else []


def validate_flows(df: pd.DataFrame, columns: list[str]) -> list[str]:
    required = {"date", *columns}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"flows 컬럼 누락: {missing}")
    _check_date_order(df)
    if df[columns].isna().any().any():
        raise ValueError("결측값 존재")
    return []


def validate(indicator_type: str, df: pd.DataFrame, columns: list[str] | None = None) -> list[str]:
    if df.empty:
        raise ValueError("빈 데이터프레임")
    if indicator_type == "ohlcv":
        return validate_ohlcv(df)
    if indicator_type == "line":
        return validate_line(df)
    if indicator_type == "flows":
        return validate_flows(df, columns or [])
    raise ValueError(f"알 수 없는 지표 타입: {indicator_type}")
