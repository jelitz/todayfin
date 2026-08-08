"""Google News RSS — 한국판 비즈니스 토픽 주요 헤드라인.

hl/gl/ceid를 한국판으로 고정하면 러너(해외 IP)에서도 한국어 랭킹 기사가 그대로 온다
(2026-08-08 spike run 31238546959에서 실측 — 70건, 제목·출처·pubDate 정상).

item의 <link>는 news.google.com/rss/articles/... 형식의 구글 경유 URL이다. 서버측
리다이렉트가 아니라 JS 인터스티셜이라 브라우저에서만 원문으로 넘어가며, 구글이 포맷을
바꾸면 링크가 깨질 수 있는 비보장 경로다(원문 URL은 피드에 없어 대안이 없음 —
docs/specs/news-headlines/design.md).

collect_news.py는 이 모듈의 fetch(limit)만 호출한다.
"""

from __future__ import annotations

from email.utils import parsedate_to_datetime
from datetime import timezone

import requests
from defusedxml import ElementTree  # 외부 XML은 시스템 경계 — XXE·entity 폭탄 방어

FEED_URL = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko"
_TIMEOUT = 20
_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
}


def _clean_title(title: str, source: str | None) -> str:
    """구글 피드 제목 말미의 " - 출처명" 접미사를 제거한다(출처는 별도 필드로 표시)."""
    title = title.strip()
    if source and title.endswith(f" - {source}"):
        title = title[: -len(f" - {source}")].rstrip()
    return title


def parse_feed(xml_bytes: bytes, limit: int) -> list[dict]:
    """RSS 바이트에서 헤드라인 목록을 추출한다(순수 함수 — 테스트 진입점).

    전체 item을 파싱·필터한 뒤 앞에서 limit건을 자른다 — 절단 후 필터면 불량 item 탓에
    limit 미만이 되는 불필요한 손실이 생긴다(적대적 검증 반영).
    """
    root = ElementTree.fromstring(xml_bytes)
    items = []
    for item in root.findall(".//item"):
        title_raw = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        source = source_el.text.strip() if source_el is not None and source_el.text else None

        if not title_raw or not url:
            continue
        try:
            dt = parsedate_to_datetime(pub_date)
        except (TypeError, ValueError):
            continue  # 잘못된 1건이 전체를 죽이지 않게 스킵
        if dt.tzinfo is None:
            # RFC 2822의 "-0000"은 naive로 반환됨 — 프런트가 로컬 시간으로 오해석하지 않게 UTC 부여
            dt = dt.replace(tzinfo=timezone.utc)

        items.append(
            {
                "title": _clean_title(title_raw, source),
                "url": url,
                "source": source,
                "published_at": dt.isoformat(),
            }
        )

    if not items:
        raise ValueError("google_news: 유효한 item이 없음 (빈 응답 또는 차단 의심)")
    return items[:limit]


def fetch(limit: int = 5) -> list[dict]:
    """비즈니스 토픽 상위 헤드라인을 가져온다. 반환: [{title, url, source, published_at}]."""
    r = requests.get(FEED_URL, headers=_UA, timeout=_TIMEOUT)
    r.raise_for_status()
    return parse_feed(r.content, limit)
