"""collect_news.py 단위 테스트 — 실패 시 기존 파일 보존·stale 경고 검증.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_collect_news.py
"""

import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import collect_news  # noqa: E402

_SAMPLE = [
    {
        "title": "뉴욕 증시 상승",
        "url": "https://news.google.com/rss/articles/x",
        "source": "연합뉴스TV",
        "published_at": "2026-08-08T02:14:00+00:00",
    }
]


def test_collect_writes_json(tmp_path):
    with patch("collect_news.google_news.fetch", return_value=_SAMPLE):
        code = collect_news.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "news.json", encoding="utf-8") as f:
        data = json.load(f)
    assert data["items"] == _SAMPLE
    assert "generated_at" in data


def test_collect_preserves_existing_file_on_fetch_failure(tmp_path, capsys):
    existing = {"generated_at": "2026-08-08T00:00:00+00:00", "items": _SAMPLE}
    with open(tmp_path / "news.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    with (
        patch("collect_news.google_news.fetch", side_effect=RuntimeError("네트워크 오류")),
        patch("collect_news.time.sleep"),
    ):
        code = collect_news.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "news.json", encoding="utf-8") as f:
        assert json.load(f)["items"] == _SAMPLE


def test_stale_warning_when_existing_file_older_than_24h(tmp_path, capsys):
    old = {"generated_at": "2026-08-01T00:00:00+00:00", "items": _SAMPLE}
    with open(tmp_path / "news.json", "w", encoding="utf-8") as f:
        json.dump(old, f, ensure_ascii=False)

    with (
        patch("collect_news.google_news.fetch", side_effect=RuntimeError("차단")),
        patch("collect_news.time.sleep"),
    ):
        code = collect_news.collect(str(tmp_path))

    assert code == 0  # 경고만 — 같은 잡의 유튜브 수집을 막지 않는다
    assert "::warning::" in capsys.readouterr().out


def test_no_warning_when_file_absent(tmp_path, capsys):
    with (
        patch("collect_news.google_news.fetch", side_effect=RuntimeError("첫 도입 실패")),
        patch("collect_news.time.sleep"),
    ):
        code = collect_news.collect(str(tmp_path))

    assert code == 0
    assert "::warning::" not in capsys.readouterr().out
    assert not os.path.exists(tmp_path / "news.json")


def test_collect_rejects_item_missing_required_field(tmp_path):
    broken = [{"title": "", "url": "u", "published_at": "t"}]
    with patch("collect_news.google_news.fetch", return_value=broken):
        code = collect_news.collect(str(tmp_path))

    assert code == 0
    assert not os.path.exists(tmp_path / "news.json")
