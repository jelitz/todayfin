"""뉴스 수집 — Google News 비즈니스 헤드라인 상위 70건을 data/news.json으로 저장.

collect_media.py와 동일 골격(의도적 대칭 — 한쪽을 보면 다른 쪽이 보인다):
재시도 → 검증 → 스테이징 → 원자적 교체, 실패 시 기존 파일 유지 + exit 0.
매시간 media-collect.yml에서 유튜브 수집과 함께 실행된다.

뉴스 전용 추가 정책(docs/specs/news-headlines/design.md): 수집이 실패했고 기존
news.json의 generated_at이 24시간을 넘었으면 ::warning 어노테이션을 남긴다 —
연속 실패가 무알림으로 묻히는 것 방지. exit 1 승격은 하지 않는다(같은 잡의 유튜브
수집·커밋을 막지 않기 위함이고, 최종 방어는 프런트의 24h 초과 숨김).

사용:
    python collect_news.py [--data-dir ../data]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import google_news  # noqa: E402

_LIMIT = 70
_RETRIES = 2
_RETRY_DELAYS = [5, 15]
_STALE_WARNING_AGE = timedelta(hours=24)
_REQUIRED_FIELDS = ("title", "url", "published_at")


def _staging_dir() -> str:
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".staging")
    os.makedirs(d, exist_ok=True)
    return d


def _fetch_with_retry() -> list[dict]:
    last_err: Exception | None = None
    for attempt in range(_RETRIES + 1):
        try:
            return google_news.fetch(_LIMIT)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < _RETRIES:
                time.sleep(_RETRY_DELAYS[attempt])
    assert last_err is not None
    raise last_err


def _validate(items: list[dict]) -> None:
    if not items:
        raise ValueError("헤드라인 목록이 비어 있음")
    for item in items:
        missing = [f for f in _REQUIRED_FIELDS if not item.get(f)]
        if missing:
            raise ValueError(f"헤드라인 필수 필드 누락: {missing} (item={item})")


def _warn_if_stale(path: str) -> None:
    """기존 파일이 24시간 넘게 갱신되지 못했으면 Actions 어노테이션으로 알린다."""
    try:
        with open(path, encoding="utf-8") as f:
            generated_at = datetime.fromisoformat(json.load(f)["generated_at"])
        age = datetime.now(timezone.utc) - generated_at
        if age > _STALE_WARNING_AGE:
            print(f"::warning::뉴스 수집이 {age}째 실패 중 — news.json이 stale (프런트는 24h 초과 시 숨김)")
    except Exception:  # noqa: BLE001 — 파일 부재·구조 이상이면 알림 없이 넘어간다(첫 도입 직후 등)
        pass


def collect(data_dir: str) -> int:
    """수집·검증 후 원자적 교체. 실패해도 기존 파일을 유지하고 항상 0을 반환한다."""
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, "news.json")

    try:
        items = _fetch_with_retry()
        _validate(items)
    except Exception as e:  # noqa: BLE001
        print(f"[유지] 뉴스 수집 실패 — 기존 data/news.json 유지: {e}")
        _warn_if_stale(out_path)
        return 0

    record = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": items,
    }

    staging_path = os.path.join(_staging_dir(), "news.json")
    with open(staging_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(staging_path, out_path)  # 원자적 교체

    print(f"[ok] 헤드라인 {len(items)}건 저장 (최신: {items[0]['title']})")
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
