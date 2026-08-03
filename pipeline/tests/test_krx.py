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
