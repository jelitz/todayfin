"""미디어 수집 — 알상무 유튜브 채널 최신 영상 목록을 data/youtube.json으로 저장.

주가 데이터 파이프라인(collect.py)과 완전히 분리돼 있다. 스케줄·장애를 독립시켜
미디어 수집 실패가 대시보드 배포에 영향을 주지 않게 하기 위함 —
docs/specs/content-pages/design.md 참조.

소스는 YouTube Data API v3(sources/youtube_api.py). RSS 피드는 GitHub Actions 러너 IP에서
차단돼 CI에서 쓸 수 없었다 — 경위는 youtube_api.py 상단 주석 참조.

사용:
    YOUTUBE_API_KEY=... python collect_media.py [--data-dir ../data]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import youtube_api  # noqa: E402

_CHANNEL_ID = "UCiDmfbYvuMEVbRxPmFP4sng"  # 알상무
_RETRIES = 2
_RETRY_DELAYS = [5, 15]
_REQUIRED_VIDEO_FIELDS = ("video_id", "title", "watch_url")


def _staging_dir() -> str:
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".staging")
    os.makedirs(d, exist_ok=True)
    return d


def _fetch_with_retry(channel_id: str) -> dict:
    last_err: Exception | None = None
    for attempt in range(_RETRIES + 1):
        try:
            return youtube_api.fetch(channel_id)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < _RETRIES:
                time.sleep(_RETRY_DELAYS[attempt])
    assert last_err is not None
    raise last_err


def _validate(payload: dict) -> None:
    videos = payload.get("videos") or []
    if not videos:
        raise ValueError("영상 목록이 비어 있음")
    for video in videos:
        missing = [f for f in _REQUIRED_VIDEO_FIELDS if not video.get(f)]
        if missing:
            raise ValueError(f"영상 필수 필드 누락: {missing} (video={video})")


def collect(data_dir: str) -> int:
    """수집·검증 후 원자적 교체. 실패해도 기존 파일을 유지하고 항상 0을 반환한다.

    영상이 며칠 안 올라오거나 RSS가 일시적으로 죽는 것은 정상 범주라 워크플로우를
    실패시키지 않는다(주가 지표의 stale 실패 승격과 다른 정책 — requirements.md R5).
    """
    os.makedirs(data_dir, exist_ok=True)

    try:
        payload = _fetch_with_retry(_CHANNEL_ID)
        _validate(payload)
    except Exception as e:  # noqa: BLE001
        print(f"[유지] 미디어 수집 실패 — 기존 data/youtube.json 유지: {e}")
        return 0

    record = {
        "channel_name": payload["channel_name"],
        "channel_url": payload["channel_url"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "videos": payload["videos"],
    }

    staging_path = os.path.join(_staging_dir(), "youtube.json")
    with open(staging_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(staging_path, os.path.join(data_dir, "youtube.json"))  # 원자적 교체

    print(f"[ok] 영상 {len(record['videos'])}건 저장 (최신: {record['videos'][0]['title']})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    )
    args = parser.parse_args()
    return collect(os.path.abspath(args.data_dir))


if __name__ == "__main__":
    sys.exit(main())
