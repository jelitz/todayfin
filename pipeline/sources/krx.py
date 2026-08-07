"""KRX Open API — 코스피/코스닥 지수, 삼성전자·SK하이닉스, VKOSPI.

한국거래소 공식 무료 API. 인증키(AUTH_KEY 헤더) 발급과 별개로 API마다 개별
이용신청 후 관리자 승인이 필요한 구조 — 2026-08-03 승인 완료 후 GitHub
Actions 실응답(run 30780627544)으로 필드명·지수명 매칭(IDX_NM="코스피"/
"코스닥") 검증 완료. 만약 소스 구조가 바뀌어 필드가 어긋나면 KeyError로
실패하고 fdr_source로 자동 폴백된다(indicators.py).

VKOSPI(코스피200 변동성지수)는 파생상품지수 API(drvprod_dd_trd)에서 받는다 —
2026-08-08 Actions 실응답(spike run 31209393183)으로 승인·지수명 검증 완료.
동일 정의 대안 소스가 없어 폴백 없이 실패 시 stale 유지된다
(docs/specs/vkospi-indicator/ 참조).

수급(투자자별 매매동향)은 KRX Open API 서비스 목록에 없어 전환 대상 아님 —
naver 소스 유지.
"""

from __future__ import annotations

import os
import time
from datetime import date, timedelta

import pandas as pd
import requests

_BASE = "http://data-dbg.krx.co.kr/svc/apis"
_TIMEOUT = 20

# (엔드포인트, KOSPI/KOSDAQ 시리즈 응답 내 대상 지수의 IDX_NM)
_INDEX_ENDPOINT = {
    "kospi": ("idx/kospi_dd_trd", "코스피"),
    "kosdaq": ("idx/kosdaq_dd_trd", "코스닥"),
}
_STOCK_PATH = "sto/stk_bydd_trd"
_STOCK_CODE = {
    "samsung": "005930",
    "skhynix": "000660",
}
_DRVPROD_PATH = "idx/drvprod_dd_trd"
# IDX_NM은 공백 제거 후 비교 — 실측 표기는 "코스피 200 변동성지수"지만 표기 변형 방어
_DRVPROD_INDEX = {
    "vkospi": "코스피200변동성지수",
}

# basDd 단일 날짜 API라 백필은 영업일당 1회 호출 — 대량 백필에서만 호출 간
# 예의 지연을 둔다(KRX 호출량 제한 정책은 미공개). 일상 증분(7일)에는 미적용.
_THROTTLE_MIN_DAYS = 30
_THROTTLE_SLEEP_SEC = 0.15


def _num(s: str) -> float:
    return float(str(s).replace(",", "") or 0)


def _get_rows(path: str, bas_dd: str) -> list[dict]:
    key = os.environ.get("KRX_API_KEY")
    if not key:
        raise RuntimeError("KRX_API_KEY 미설정")
    r = requests.get(
        f"{_BASE}/{path}",
        params={"basDd": bas_dd},
        headers={"AUTH_KEY": key},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    body = r.json()
    if "OutBlock_1" not in body:
        raise ValueError(f"krx fetch({path}, {bas_dd}): {body}")
    return body["OutBlock_1"]


def _business_days(start: date, end: date) -> list[date]:
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def _index_row(d: date, path: str, idx_name: str) -> dict | None:
    matched = [row for row in _get_rows(path, d.strftime("%Y%m%d")) if row.get("IDX_NM") == idx_name]
    if not matched:
        return None
    row = matched[0]
    return {
        "date": d.isoformat(),
        "open": _num(row["OPNPRC_IDX"]),
        "high": _num(row["HGPRC_IDX"]),
        "low": _num(row["LWPRC_IDX"]),
        "close": _num(row["CLSPRC_IDX"]),
        "volume": _num(row["ACC_TRDVOL"]),
    }


def _stock_row(d: date, code: str) -> dict | None:
    matched = [
        row
        for row in _get_rows(_STOCK_PATH, d.strftime("%Y%m%d"))
        if row.get("ISU_SRT_CD") == code or row.get("ISU_CD") == code
    ]
    if not matched:
        return None
    row = matched[0]
    return {
        "date": d.isoformat(),
        "open": _num(row["TDD_OPNPRC"]),
        "high": _num(row["TDD_HGPRC"]),
        "low": _num(row["TDD_LWPRC"]),
        "close": _num(row["TDD_CLSPRC"]),
        "volume": _num(row["ACC_TRDVOL"]),
    }


def _drvprod_row(d: date, idx_name_nospace: str) -> dict | None:
    matched = [
        row
        for row in _get_rows(_DRVPROD_PATH, d.strftime("%Y%m%d"))
        if str(row.get("IDX_NM", "")).replace(" ", "") == idx_name_nospace
    ]
    if not matched:
        return None
    # 같은 응답의 일부 지수는 CLSPRC_IDX가 빈 문자열로 온다(2026-08-08 실측) —
    # _num("")은 0을 돌려주므로 방어 없이는 "0으로 폭락"한 오염 값이 저장된다
    close = str(matched[0].get("CLSPRC_IDX", "")).strip()
    if not close:
        return None
    return {"date": d.isoformat(), "value": _num(close)}


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: 지수·종목은 date/open/high/low/close/volume, 파생상품지수(vkospi)는 date/value.

    basDd(단일 기준일자)만 지원하는 API라 영업일별로 반복 호출한다. 일별 증분
    수집(최근 7일 재조회)에서는 호출 수가 적고, 백필(30일 초과)에서는 호출 간
    지연을 둔다 — 5년 백필 약 1,240회 기준 15분 내외.
    """
    if indicator_id in _INDEX_ENDPOINT:
        path, idx_name = _INDEX_ENDPOINT[indicator_id]

        def row_fn(d: date) -> dict | None:
            return _index_row(d, path, idx_name)

    elif indicator_id in _STOCK_CODE:
        code = _STOCK_CODE[indicator_id]

        def row_fn(d: date) -> dict | None:
            return _stock_row(d, code)

    elif indicator_id in _DRVPROD_INDEX:
        idx_name_nospace = _DRVPROD_INDEX[indicator_id]

        def row_fn(d: date) -> dict | None:
            return _drvprod_row(d, idx_name_nospace)

    else:
        raise ValueError(f"krx fetch: 지원하지 않는 indicator_id {indicator_id!r}")

    days = _business_days(start, end)
    throttle = len(days) > _THROTTLE_MIN_DAYS
    rows = []
    for d in days:
        row = row_fn(d)
        if row is not None:
            rows.append(row)
        if throttle:
            time.sleep(_THROTTLE_SLEEP_SEC)

    if not rows:
        raise ValueError(f"krx fetch({indicator_id}): 빈 응답 (start={start} end={end})")
    df = pd.DataFrame(rows)
    return df.sort_values("date").drop_duplicates(subset="date").reset_index(drop=True)
