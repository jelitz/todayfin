"""YouTube Data API v3 — 알상무 채널 최신 영상 목록.

RSS 피드 방식을 대체한다(구현은 커밋 917f886에 보존). RSS는 GitHub Actions 러너 IP에서 일관되게 404를
돌려줘 CI에서 쓸 수 없었다(2026-08-03 run 30791734425: 3분에 걸친 5회 시도 전부 404,
같은 시각 로컬 한국 IP에서는 200. UA·재시도로는 해결 불가한 IP 기반 차단).
공식 API는 데이터센터 IP에서도 정상 동작한다.

할당량: channels.list 1 + playlistItems.list 1 + videos.list(status) 1 = 실행당 3유닛.
매시간 실행해도 하루 72유닛으로, 무료 한도 10,000유닛/일에 여유가 크다.

videos.list part=status는 embeddable(소유자가 임베드를 허용했는지)을 주며, 인라인
플레이어(alsangmoo-player)가 깨진 임베드를 미리 피하는 데 쓴다. 이 호출이 실패해도
목록 수집은 성공 처리한다 — embeddable은 선택 필드고, 프론트는 누락을 true로 취급.

collect_media.py는 이 모듈의 fetch(channel_id)만 호출한다.
"""

from __future__ import annotations

import os

import requests

_API_BASE = "https://www.googleapis.com/youtube/v3"
_CHANNEL_URL = "https://www.youtube.com/channel/{channel_id}"
_WATCH_URL = "https://www.youtube.com/watch?v={video_id}"
_TIMEOUT = 20
_MAX_RESULTS = 15  # RSS 피드가 주던 개수와 맞춤

# 큰 것부터 — 해상도가 높을수록 카드 썸네일이 선명하다. RSS는 high(480x360)를 줬다.
_THUMBNAIL_PREFERENCE = ("maxres", "standard", "high", "medium", "default")


def _api_key() -> str:
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY 미설정")
    return key


def _get(path: str, params: dict) -> dict:
    r = requests.get(f"{_API_BASE}/{path}", params={**params, "key": _api_key()}, timeout=_TIMEOUT)
    r.raise_for_status()
    return r.json()


def _pick_thumbnail(thumbnails: dict) -> str | None:
    for size in _THUMBNAIL_PREFERENCE:
        url = thumbnails.get(size, {}).get("url")
        if url:
            return url
    return None


def parse_playlist_items(body: dict) -> list[dict]:
    """playlistItems.list 응답에서 영상 목록을 추출한다(순수 함수 — 테스트 진입점).

    게시일은 snippet.publishedAt(플레이리스트 추가 시각)이 아니라
    contentDetails.videoPublishedAt(실제 영상 공개 시각)을 쓴다. 업로드 플레이리스트에서는
    보통 같지만, 비공개→공개 전환 등에서 어긋날 수 있다.
    """
    videos = []
    for item in body.get("items", []):
        snippet = item.get("snippet") or {}
        content_details = item.get("contentDetails") or {}

        video_id = content_details.get("videoId") or snippet.get("resourceId", {}).get("videoId")
        title = snippet.get("title")
        published_at = content_details.get("videoPublishedAt") or snippet.get("publishedAt")
        if not (video_id and title and published_at):
            continue

        # 비공개·삭제된 영상은 제목이 자리표시자로 바뀌고 재생이 안 되므로 제외한다
        if title in ("Private video", "Deleted video"):
            continue

        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "published_at": published_at,
                "thumbnail_url": _pick_thumbnail(snippet.get("thumbnails") or {}),
                "watch_url": _WATCH_URL.format(video_id=video_id),
            }
        )

    videos.sort(key=lambda v: v["published_at"], reverse=True)
    return videos


def merge_embeddable(videos: list[dict], status_body: dict) -> list[dict]:
    """videos.list part=status 응답의 embeddable을 video_id 기준으로 병합(순수 함수 — 테스트 진입점).

    응답에 없는 id는 필드를 넣지 않는다 — 프론트가 누락을 true(임베드 시도)로 취급하므로
    부분 실패가 기능 저하로만 끝난다.
    """
    embeddable_by_id: dict[str, bool] = {}
    for item in status_body.get("items", []):
        video_id = item.get("id")
        embeddable = (item.get("status") or {}).get("embeddable")
        if video_id and isinstance(embeddable, bool):
            embeddable_by_id[video_id] = embeddable

    return [
        {**video, "embeddable": embeddable_by_id[video["video_id"]]}
        if video["video_id"] in embeddable_by_id
        else dict(video)
        for video in videos
    ]


def fetch(channel_id: str) -> dict:
    """채널의 최신 영상 목록을 가져온다. 반환: {channel_name, channel_url, videos}."""
    channels = _get("channels", {"part": "snippet,contentDetails", "id": channel_id})
    items = channels.get("items") or []
    if not items:
        raise ValueError(f"youtube_api: 채널을 찾을 수 없음 (channel_id={channel_id})")

    channel = items[0]
    channel_name = channel.get("snippet", {}).get("title", "")
    uploads_playlist_id = (
        channel.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    )
    if not uploads_playlist_id:
        raise ValueError(f"youtube_api: uploads 플레이리스트 없음 (channel_id={channel_id})")

    playlist = _get(
        "playlistItems",
        {
            "part": "snippet,contentDetails",
            "playlistId": uploads_playlist_id,
            "maxResults": _MAX_RESULTS,
        },
    )
    videos = parse_playlist_items(playlist)

    if videos:
        try:
            status = _get("videos", {"part": "status", "id": ",".join(v["video_id"] for v in videos)})
            videos = merge_embeddable(videos, status)
        except Exception as e:  # noqa: BLE001 — embeddable은 선택 정보라 목록 수집을 실패시키지 않는다
            print(f"[경고] videos.list(status) 실패 — embeddable 없이 진행: {e}")

    return {
        "channel_name": channel_name,
        "channel_url": _CHANNEL_URL.format(channel_id=channel_id),
        "videos": videos,
    }
