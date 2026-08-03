"""youtube_api.py 단위 테스트 — playlistItems 응답 파싱.

실행: uv run --python 3.12 --with pytest --with requests pytest pipeline/tests/test_youtube_api.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources.youtube_api import parse_playlist_items  # noqa: E402


def _item(video_id: str, title: str, published: str, thumbs: dict | None = None) -> dict:
    return {
        "snippet": {
            "title": title,
            "publishedAt": published,
            "resourceId": {"videoId": video_id},
            "thumbnails": thumbs if thumbs is not None else {},
        },
        "contentDetails": {"videoId": video_id, "videoPublishedAt": published},
    }


def test_parse_maps_required_fields():
    body = {"items": [_item("abc123", "당일전략", "2026-08-02T23:49:20Z")]}
    video = parse_playlist_items(body)[0]
    assert video["video_id"] == "abc123"
    assert video["title"] == "당일전략"
    assert video["published_at"] == "2026-08-02T23:49:20Z"
    assert video["watch_url"] == "https://www.youtube.com/watch?v=abc123"


def test_parse_sorts_newest_first():
    body = {
        "items": [
            _item("old", "오래된 영상", "2026-08-01T00:00:00Z"),
            _item("new", "최신 영상", "2026-08-03T00:00:00Z"),
        ]
    }
    videos = parse_playlist_items(body)
    assert [v["video_id"] for v in videos] == ["new", "old"]


def test_parse_prefers_highest_resolution_thumbnail():
    body = {
        "items": [
            _item(
                "abc",
                "제목",
                "2026-08-01T00:00:00Z",
                thumbs={
                    "default": {"url": "https://i.ytimg.com/default.jpg"},
                    "high": {"url": "https://i.ytimg.com/high.jpg"},
                    "maxres": {"url": "https://i.ytimg.com/maxres.jpg"},
                },
            )
        ]
    }
    assert parse_playlist_items(body)[0]["thumbnail_url"] == "https://i.ytimg.com/maxres.jpg"


def test_parse_falls_back_to_lower_resolution_thumbnail():
    body = {
        "items": [
            _item(
                "abc",
                "제목",
                "2026-08-01T00:00:00Z",
                thumbs={"medium": {"url": "https://i.ytimg.com/medium.jpg"}},
            )
        ]
    }
    assert parse_playlist_items(body)[0]["thumbnail_url"] == "https://i.ytimg.com/medium.jpg"


def test_parse_missing_thumbnail_yields_none():
    body = {"items": [_item("abc", "제목", "2026-08-01T00:00:00Z")]}
    assert parse_playlist_items(body)[0]["thumbnail_url"] is None


def test_parse_skips_private_and_deleted_videos():
    body = {
        "items": [
            _item("v1", "정상 영상", "2026-08-03T00:00:00Z"),
            _item("v2", "Private video", "2026-08-02T00:00:00Z"),
            _item("v3", "Deleted video", "2026-08-01T00:00:00Z"),
        ]
    }
    assert [v["video_id"] for v in parse_playlist_items(body)] == ["v1"]


def test_parse_uses_video_published_at_over_snippet_published_at():
    """플레이리스트 추가 시각이 아니라 실제 영상 공개 시각을 써야 한다."""
    body = {
        "items": [
            {
                "snippet": {
                    "title": "제목",
                    "publishedAt": "2026-08-03T00:00:00Z",  # 플레이리스트 추가 시각
                    "resourceId": {"videoId": "abc"},
                    "thumbnails": {},
                },
                "contentDetails": {
                    "videoId": "abc",
                    "videoPublishedAt": "2026-07-01T00:00:00Z",  # 실제 공개 시각
                },
            }
        ]
    }
    assert parse_playlist_items(body)[0]["published_at"] == "2026-07-01T00:00:00Z"


def test_parse_empty_items_returns_empty_list():
    assert parse_playlist_items({"items": []}) == []
    assert parse_playlist_items({}) == []
