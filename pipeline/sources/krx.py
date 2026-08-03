"""KRX Open API — 코스피/코스닥 지수, 삼성전자·SK하이닉스.

한국거래소 공식 무료 API. 인증키(AUTH_KEY 헤더) 발급과 별개로 API마다 개별
이용신청 후 관리자 승인이 필요한 구조 — 2026-08-03 스파이크(GitHub Actions, 키
등록 직후)에서 지수·종목 API 4종 전부 401 Unauthorized 확인. 승인 대기 중이라
아래 필드명·지수명 매칭(IDX_NM)은 공식 문서·커뮤니티 예제 기반 미검증 값이며,
승인 후 실응답으로 재확인 필요 — docs/specs/dashboard-mvp/implemented.md 참조.
실패 시 fdr_source로 자동 폴백되므로(indicators.py) 미승인 상태에서도 데이터
끊김 없이 안전하게 배포 가능.

수급(투자자별 매매동향)은 KRX Open API 서비스 목록에 없어 전환 대상 아님 —
naver 소스 유지.
"""

from __future__ import annotations

import os
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


def _index_row(bas_dd: str, path: str, idx_name: str) -> dict | None:
    matched = [row for row in _get_rows(path, bas_dd) if row.get("IDX_NM") == idx_name]
    if not matched:
        return None
    row = matched[0]
    return {
        "date": bas_dd,
        "open": _num(row["OPNPRC_IDX"]),
        "high": _num(row["HGPRC_IDX"]),
        "low": _num(row["LWPRC_IDX"]),
        "close": _num(row["CLSPRC_IDX"]),
        "volume": _num(row["ACC_TRDVOL"]),
    }


def _stock_row(bas_dd: str, code: str) -> dict | None:
    matched = [
        row
        for row in _get_rows(_STOCK_PATH, bas_dd)
        if row.get("ISU_SRT_CD") == code or row.get("ISU_CD") == code
    ]
    if not matched:
        return None
    row = matched[0]
    return {
        "date": bas_dd,
        "open": _num(row["TDD_OPNPRC"]),
        "high": _num(row["TDD_HGPRC"]),
        "low": _num(row["TDD_LWPRC"]),
        "close": _num(row["TDD_CLSPRC"]),
        "volume": _num(row["ACC_TRDVOL"]),
    }


def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date, open, high, low, close, volume.

    basDd(단일 기준일자)만 지원하는 API라 영업일별로 반복 호출한다. 일별 증분
    수집(최근 7일 재조회)에서는 호출 수가 적어 문제없지만, 대량 백필에는
    부적합 — collect.py는 기존 시계열이 있으면 최근 _REVISION_LOOKBACK_DAYS만
    재조회하므로 실사용 경로에서는 안전하다.
    """
    if indicator_id in _INDEX_ENDPOINT:
        path, idx_name = _INDEX_ENDPOINT[indicator_id]
        rows = [
            row
            for row in (_index_row(d.strftime("%Y%m%d"), path, idx_name) for d in _business_days(start, end))
            if row is not None
        ]
    elif indicator_id in _STOCK_CODE:
        code = _STOCK_CODE[indicator_id]
        rows = [
            row
            for row in (_stock_row(d.strftime("%Y%m%d"), code) for d in _business_days(start, end))
            if row is not None
        ]
    else:
        raise ValueError(f"krx fetch: 지원하지 않는 indicator_id {indicator_id!r}")

    if not rows:
        raise ValueError(f"krx fetch({indicator_id}): 빈 응답 (start={start} end={end})")
    df = pd.DataFrame(rows)
    return df.sort_values("date").drop_duplicates(subset="date").reset_index(drop=True)
