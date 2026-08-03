"""youtube_rss.py 파싱 단위 테스트.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_youtube_rss.py
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources.youtube_rss import parse_feed  # noqa: E402

_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "youtube_rss.xml")


def _fixture_text() -> str:
    with open(_FIXTURE, "r", encoding="utf-8") as f:
        return f.read()


def test_parse_feed_extracts_channel_name():
    result = parse_feed(_fixture_text())
    assert result["channel_name"] == "알상무"


def test_parse_feed_returns_videos():
    result = parse_feed(_fixture_text())
    assert len(result["videos"]) > 0


def test_parse_feed_video_has_required_fields():
    video = parse_feed(_fixture_text())["videos"][0]
    assert video["video_id"]
    assert video["title"]
    assert video["published_at"]
    assert video["watch_url"] == f"https://www.youtube.com/watch?v={video['video_id']}"


def test_parse_feed_videos_sorted_newest_first():
    videos = parse_feed(_fixture_text())["videos"]
    published = [v["published_at"] for v in videos]
    assert published == sorted(published, reverse=True)


def test_parse_feed_empty_feed_returns_empty_videos():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <yt:channelId>UCtest</yt:channelId>
 <title>빈 채널</title>
</feed>"""
    result = parse_feed(xml)
    assert result["channel_name"] == "빈 채널"
    assert result["videos"] == []


def test_parse_feed_invalid_xml_raises():
    with pytest.raises(ValueError, match="파싱 실패"):
        parse_feed("not xml at all <<<")


def test_parse_feed_missing_thumbnail_yields_none():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <title>채널</title>
 <entry>
  <yt:videoId>abc123</yt:videoId>
  <title>썸네일 없는 영상</title>
  <published>2026-08-01T00:00:00+00:00</published>
 </entry>
</feed>"""
    video = parse_feed(xml)["videos"][0]
    assert video["thumbnail_url"] is None
    assert video["video_id"] == "abc123"
