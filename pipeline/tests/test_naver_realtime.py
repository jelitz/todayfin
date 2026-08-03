"""naver_realtime.py 숫자 파싱 단위 테스트.

실행: uv run --python 3.12 --with pytest pytest pipeline/tests/test_naver_realtime.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources.naver_realtime import _num  # noqa: E402


def test_num_plain_integer_with_comma():
    assert _num("242,000") == 242000.0


def test_num_decimal_index_value():
    assert _num("6,358.27") == 6358.27


def test_num_volume_with_unit_suffix():
    assert _num("117,375천주") == 117375.0


def test_num_negative_value():
    assert _num("-322.23") == -322.23


def test_num_empty_string_falls_back_to_zero():
    assert _num("") == 0.0
