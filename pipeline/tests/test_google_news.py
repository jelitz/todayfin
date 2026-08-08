"""google_news.py 파싱 단위 테스트 — 픽스처 XML 기반.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_google_news.py
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources import google_news  # noqa: E402


def _item(title: str, link: str = "https://news.google.com/rss/articles/x", pub: str = "Sat, 08 Aug 2026 02:14:00 GMT", source: str | None = "연합뉴스TV") -> str:
    source_tag = f'<source url="https://example.com">{source}</source>' if source else ""
    return f"<item><title>{title}</title><link>{link}</link><pubDate>{pub}</pubDate>{source_tag}</item>"


def _feed(items: str) -> bytes:
    return f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>{items}</channel></rss>'.encode()


def test_parses_title_source_and_iso_time():
    xml = _feed(_item("뉴욕 증시 상승 - 연합뉴스TV"))
    items = google_news.parse_feed(xml, 5)
    assert items == [
        {
            "title": "뉴욕 증시 상승",
            "url": "https://news.google.com/rss/articles/x",
            "source": "연합뉴스TV",
            "published_at": "2026-08-08T02:14:00+00:00",
        }
    ]


def test_keeps_title_when_suffix_differs_from_source():
    # 제목 안의 " - "는 접미사가 source와 정확히 일치할 때만 제거된다
    xml = _feed(_item("금리 - 환율 상관관계 분석 - 다른신문", source="연합뉴스TV"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["title"] == "금리 - 환율 상관관계 분석 - 다른신문"


def test_missing_source_tag_gives_null_source():
    xml = _feed(_item("제목만 있는 기사", source=None))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["source"] is None
    assert items[0]["title"] == "제목만 있는 기사"


def test_filters_before_truncating_to_limit():
    # 불량 item(빈 링크·깨진 pubDate)이 상위에 섞여 있어도 유효 5건을 확보한다(검증 반영)
    bad = _item("링크 없음", link="") + _item("날짜 깨짐", pub="not-a-date")
    good = "".join(_item(f"기사 {i}") for i in range(7))
    items = google_news.parse_feed(_feed(bad + good), 5)
    assert len(items) == 5
    assert [i["title"] for i in items] == [f"기사 {i}" for i in range(5)]


def test_naive_minus_0000_offset_gets_utc():
    # RFC 2822 "-0000"은 naive datetime으로 파싱됨 — UTC를 부여해야 프런트 KST 변환이 정확
    xml = _feed(_item("타임존 불명 기사", pub="Sat, 08 Aug 2026 02:14:00 -0000"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["published_at"] == "2026-08-08T02:14:00+00:00"


def test_kst_offset_preserved():
    xml = _feed(_item("한국 시각 기사", pub="Sat, 8 Aug 2026 10:32:24 +0900"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["published_at"] == "2026-08-08T10:32:24+09:00"


def test_domain_source_mapped_to_press_name():
    xml = _feed(_item("금값 상승 - mk.co.kr", source="mk.co.kr"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["source"] == "매일경제"
    assert items[0]["title"] == "금값 상승"


def test_double_suffix_stripped_when_source_mapped():
    # 실측 표본: 제목에 "… - 조선비즈 - Chosunbiz"처럼 매핑 전후 이름이 이중으로 붙는 경우
    xml = _feed(_item("강남 증여 셈법 - 조선비즈 - Chosunbiz", source="Chosunbiz"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["source"] == "조선비즈"
    assert items[0]["title"] == "강남 증여 셈법"


def test_unmapped_source_passthrough():
    xml = _feed(_item("기사 - 오피니언뉴스", source="오피니언뉴스"))
    items = google_news.parse_feed(xml, 5)
    assert items[0]["source"] == "오피니언뉴스"
    assert items[0]["title"] == "기사"


def test_no_valid_items_raises():
    with pytest.raises(ValueError):
        google_news.parse_feed(_feed(_item("링크 없음", link="")), 5)
    with pytest.raises(ValueError):
        google_news.parse_feed(_feed(""), 5)
