"""krx.py 단위 테스트 — 숫자 파싱·영업일 계산·응답 필드 매핑.

실행: uv run --python 3.12 --with pytest --with pandas --with requests pytest pipeline/tests/test_krx.py
"""

import os
import sys
from datetime import date
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources import krx  # noqa: E402


def test_num_plain_integer_with_comma():
    assert krx._num("2,655.30") == 2655.30


def test_num_empty_string_falls_back_to_zero():
    assert krx._num("") == 0.0


def test_business_days_excludes_weekend():
    days = krx._business_days(date(2026, 8, 1), date(2026, 8, 4))  # 토(8/1)~화(8/4)
    assert [d.isoformat() for d in days] == ["2026-08-03", "2026-08-04"]


def _mock_response(json_body, status=200):
    class _Resp:
        def raise_for_status(self):
            if status >= 400:
                import requests

                raise requests.HTTPError(f"status={status}")

        def json(self):
            return json_body

    return _Resp()


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_index_maps_fields_and_filters_by_name(mock_get):
    mock_get.return_value = _mock_response(
        {
            "OutBlock_1": [
                {
                    "IDX_NM": "코스피 200",
                    "OPNPRC_IDX": "300.00",
                    "HGPRC_IDX": "301.00",
                    "LWPRC_IDX": "299.00",
                    "CLSPRC_IDX": "300.50",
                    "ACC_TRDVOL": "1,000",
                },
                {
                    "IDX_NM": "코스피",
                    "OPNPRC_IDX": "2,650.10",
                    "HGPRC_IDX": "2,661.00",
                    "LWPRC_IDX": "2,640.20",
                    "CLSPRC_IDX": "2,655.30",
                    "ACC_TRDVOL": "450,000,000",
                },
            ]
        }
    )

    df = krx.fetch("kospi", date(2026, 8, 3), date(2026, 8, 3))

    assert len(df) == 1
    row = df.iloc[0]
    assert row["date"] == "2026-08-03"
    assert row["close"] == 2655.30
    assert row["volume"] == 450000000.0


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_stock_filters_by_code(mock_get):
    mock_get.return_value = _mock_response(
        {
            "OutBlock_1": [
                {
                    "ISU_SRT_CD": "000660",
                    "TDD_OPNPRC": "200000",
                    "TDD_HGPRC": "205000",
                    "TDD_LWPRC": "199000",
                    "TDD_CLSPRC": "203000",
                    "ACC_TRDVOL": "5,000,000",
                },
                {
                    "ISU_SRT_CD": "005930",
                    "TDD_OPNPRC": "70000",
                    "TDD_HGPRC": "71000",
                    "TDD_LWPRC": "69500",
                    "TDD_CLSPRC": "70500",
                    "ACC_TRDVOL": "10,000,000",
                },
            ]
        }
    )

    df = krx.fetch("samsung", date(2026, 8, 3), date(2026, 8, 3))

    assert len(df) == 1
    assert df.iloc[0]["close"] == 70500.0


@patch.dict(os.environ, {}, clear=True)
def test_fetch_without_api_key_raises():
    with pytest.raises(RuntimeError, match="KRX_API_KEY"):
        krx.fetch("kospi", date(2026, 8, 3), date(2026, 8, 3))


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_unauthorized_raises_httperror(mock_get):
    import requests

    mock_get.return_value = _mock_response({"respMsg": "Unauthorized API Call", "respCode": "401"}, status=401)

    with pytest.raises(requests.HTTPError):
        krx.fetch("kospi", date(2026, 8, 3), date(2026, 8, 3))


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_empty_result_raises_valueerror(mock_get):
    mock_get.return_value = _mock_response({"OutBlock_1": []})

    with pytest.raises(ValueError, match="빈 응답"):
        krx.fetch("kospi", date(2026, 8, 3), date(2026, 8, 3))


# ── VKOSPI (파생상품지수 drvprod_dd_trd) ────────────────────────────────────

# 2026-08-08 Actions 실응답(spike run 31209393183) 기반 축약 픽스처
_DRVPROD_BODY = {
    "OutBlock_1": [
        {
            "IDX_CLSS": "옵션지수",
            "IDX_NM": "코스피 200 변동성지수",
            "CLSPRC_IDX": "77.17",
            "OPNPRC_IDX": "76.96",
            "HGPRC_IDX": "77.30",
            "LWPRC_IDX": "76.67",
        },
        {
            "IDX_CLSS": "전략지수",
            "IDX_NM": "KRX 최소변동성지수",
            "CLSPRC_IDX": "11,999.22",
            "OPNPRC_IDX": "12,104.26",
            "HGPRC_IDX": "12,211.71",
            "LWPRC_IDX": "11,789.29",
        },
        # 일부 지수는 종가가 빈 문자열로 온다(kospi 계열 실측과 동일 현상)
        {
            "IDX_CLSS": "KOSPI",
            "IDX_NM": "코스피 (외국주포함)",
            "CLSPRC_IDX": "",
            "OPNPRC_IDX": "",
            "HGPRC_IDX": "",
            "LWPRC_IDX": "",
        },
    ]
}


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_vkospi_matches_name_ignoring_spaces(mock_get):
    mock_get.return_value = _mock_response(_DRVPROD_BODY)

    df = krx.fetch("vkospi", date(2026, 8, 6), date(2026, 8, 6))

    assert list(df.columns) == ["date", "value"]
    assert len(df) == 1
    assert df.iloc[0]["date"] == "2026-08-06"
    assert df.iloc[0]["value"] == 77.17


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_vkospi_name_without_spaces_still_matches(mock_get):
    body = {"OutBlock_1": [{"IDX_NM": "코스피200변동성지수", "CLSPRC_IDX": "80.00"}]}
    mock_get.return_value = _mock_response(body)

    df = krx.fetch("vkospi", date(2026, 8, 6), date(2026, 8, 6))

    assert df.iloc[0]["value"] == 80.00


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_vkospi_empty_close_is_skipped_not_zero(mock_get):
    body = {"OutBlock_1": [{"IDX_NM": "코스피 200 변동성지수", "CLSPRC_IDX": ""}]}
    mock_get.return_value = _mock_response(body)

    with pytest.raises(ValueError, match="빈 응답"):
        krx.fetch("vkospi", date(2026, 8, 6), date(2026, 8, 6))


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.requests.get")
def test_fetch_vkospi_missing_row_raises(mock_get):
    body = {"OutBlock_1": [{"IDX_NM": "코스피 200 선물지수", "CLSPRC_IDX": "400.00"}]}
    mock_get.return_value = _mock_response(body)

    with pytest.raises(ValueError, match="빈 응답"):
        krx.fetch("vkospi", date(2026, 8, 6), date(2026, 8, 6))


@patch.dict(os.environ, {"KRX_API_KEY": "dummy"})
@patch("sources.krx.time.sleep")
@patch("sources.krx.requests.get")
def test_fetch_throttles_only_on_bulk_ranges(mock_get, mock_sleep):
    mock_get.return_value = _mock_response(_DRVPROD_BODY)

    # 증분 범위(영업일 ≤ 30): 스로틀 없음
    krx.fetch("vkospi", date(2026, 8, 3), date(2026, 8, 7))
    assert mock_sleep.call_count == 0

    # 백필 범위(영업일 > 30): 호출마다 지연
    krx.fetch("vkospi", date(2026, 6, 1), date(2026, 8, 7))
    assert mock_sleep.call_count > 30
