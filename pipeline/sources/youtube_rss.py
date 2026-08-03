"""유튜브 채널 RSS — 알상무 미디어 게시판용 최신 영상 목록.

유튜브가 공식 제공하는 Atom 피드(https://www.youtube.com/feeds/videos.xml?channel_id=...)로,
인증·API 키가 필요 없고 최신 15개 영상을 최신순으로 준다(2026-08-03 실응답 확인).

주의: 커뮤니티 게시글(텍스트·투표)은 이 피드에도 공식 API에도 없어 영상만 다룬다.
브라우저에서 직접 fetch할 수 없으므로(CORS 헤더 없음) 반드시 서버 사이드에서 호출할 것 —
docs/specs/content-pages/requirements.md R4 참조.

기존 지표 어댑터(fetch(indicator_id, start, end) -> DataFrame)와 시그니처가 다른 것은 의도적이다.
미디어는 시계열이 아니라 목록이라 pandas가 불필요하고 collect.py의 지표 레지스트리에도 등록되지 않는다.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

import requests
from defusedxml.ElementTree import fromstring as safe_fromstring

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}

_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
_CHANNEL_URL = "https://www.youtube.com/channel/{channel_id}"
_WATCH_URL = "https://www.youtube.com/watch?v={video_id}"
_TIMEOUT = 20

# 이 엔드포인트는 짧은 간격으로 반복 호출하면 404/500을 간헐적으로 돌려준다(2026-08-03 실측:
# UA 유무와 무관하게 동일 시점에 같은 코드가 나옴 — 404, 200, 404 순으로 교대). 수십 초 쉬면
# 복구되므로 재시도 백오프로 대응한다(collect_media._RETRY_DELAYS). UA는 다른 소스 어댑터
# (treasury.py·naver.py)와의 일관성을 위해 붙여둔 것이고 404 회피 효과는 확인되지 않았다.
_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}


def _text(element, path: str) -> str | None:
    found = element.find(path, _NS)
    return found.text if found is not None else None


def parse_feed(xml_text: str) -> dict:
    """Atom 피드 문자열을 파싱한다. 반환: {channel_name, videos}.

    defusedxml을 쓰는 이유: 표준 xml.etree는 billion-laughs(엔티티 폭탄) 등
    XML 폭탄 공격에 취약하다. 지금 입력은 유튜브 공식 HTTPS 엔드포인트라 실질
    위험은 낮지만, 외부에서 받은 XML을 파싱하는 지점이므로 방어적으로 처리한다.
    """
    try:
        root = safe_fromstring(xml_text)
    except ET.ParseError as e:
        raise ValueError(f"youtube_rss 파싱 실패: {e}") from e

    channel_name = _text(root, "atom:title") or ""

    videos = []
    for entry in root.findall("atom:entry", _NS):
        video_id = _text(entry, "yt:videoId")
        title = _text(entry, "atom:title")
        published_at = _text(entry, "atom:published")
        if not (video_id and title and published_at):
            continue

        thumbnail = entry.find("media:group/media:thumbnail", _NS)
        thumbnail_url = thumbnail.get("url") if thumbnail is not None else None

        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "published_at": published_at,
                "thumbnail_url": thumbnail_url,
                "watch_url": _WATCH_URL.format(video_id=video_id),
            }
        )

    videos.sort(key=lambda v: v["published_at"], reverse=True)
    return {"channel_name": channel_name, "videos": videos}


def fetch(channel_id: str) -> dict:
    """채널 RSS를 가져와 파싱한다. 반환: {channel_name, channel_url, videos}."""
    r = requests.get(_FEED_URL.format(channel_id=channel_id), headers=_UA, timeout=_TIMEOUT)
    r.raise_for_status()
    parsed = parse_feed(r.text)
    return {
        "channel_name": parsed["channel_name"],
        "channel_url": _CHANNEL_URL.format(channel_id=channel_id),
        "videos": parsed["videos"],
    }
