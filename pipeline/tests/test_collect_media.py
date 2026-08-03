"""collect_media.py 단위 테스트 — 실패 시 기존 파일 보존 동작 검증.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_collect_media.py
"""

import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import collect_media  # noqa: E402

_SAMPLE = {
    "channel_name": "알상무",
    "channel_url": "https://www.youtube.com/channel/UCiDmfbYvuMEVbRxPmFP4sng",
    "videos": [
        {
            "video_id": "abc123",
            "title": "당일전략",
            "published_at": "2026-08-02T23:49:20+00:00",
            "thumbnail_url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
            "watch_url": "https://www.youtube.com/watch?v=abc123",
        }
    ],
}


def test_collect_writes_json(tmp_path):
    with patch("collect_media.youtube_rss.fetch", return_value=_SAMPLE):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        data = json.load(f)
    assert data["channel_name"] == "알상무"
    assert data["videos"][0]["video_id"] == "abc123"
    assert "generated_at" in data


def test_collect_preserves_existing_file_on_fetch_failure(tmp_path):
    existing = {"channel_name": "기존", "channel_url": "x", "generated_at": "old", "videos": []}
    with open(tmp_path / "youtube.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    with patch("collect_media.youtube_rss.fetch", side_effect=RuntimeError("네트워크 오류")):
        code = collect_media.collect(str(tmp_path))

    # 실패해도 exit 0 — 영상 미업로드·일시적 RSS 장애는 정상 범주(requirements.md R5)
    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        assert json.load(f)["channel_name"] == "기존"


def test_collect_rejects_empty_video_list(tmp_path):
    existing = {"channel_name": "기존", "channel_url": "x", "generated_at": "old", "videos": []}
    with open(tmp_path / "youtube.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    empty = {"channel_name": "알상무", "channel_url": "u", "videos": []}
    with patch("collect_media.youtube_rss.fetch", return_value=empty):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        assert json.load(f)["channel_name"] == "기존"


def test_collect_rejects_video_missing_required_field(tmp_path):
    broken = {
        "channel_name": "알상무",
        "channel_url": "u",
        "videos": [{"video_id": "", "title": "제목", "watch_url": "w"}],
    }
    with patch("collect_media.youtube_rss.fetch", return_value=broken):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    assert not os.path.exists(tmp_path / "youtube.json")
