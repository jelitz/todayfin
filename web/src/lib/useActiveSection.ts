/**
 * GNB 활성 탭 추적. IntersectionObserver로 각 anchorId(document.getElementById)를 관찰해
 * 뷰포트 상단에 가장 가까운(교차 중인) 섹션의 id를 반환한다.
 * rootMargin 상단 -100px은 고정 GNB+티커바 높이를 보정하고, 하단 -70%는 뷰포트 상단부에
 * 걸친 섹션을 우선 활성화하기 위함 — 하단까지 넓게 잡으면 스크롤 중 여러 섹션이 동시에
 * "교차 중"으로 잡혀 활성 탭이 튀는 문제가 생긴다.
 */
import { useEffect, useState } from "react";

export function useActiveSection(anchorIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const key = anchorIds.join(",");

  useEffect(() => {
    const elements = anchorIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) {
      setActiveId(null);
      return;
    }

    const visible = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry);
          } else {
            visible.delete(entry.target.id);
          }
        }

        if (visible.size === 0) return;

        let closest: IntersectionObserverEntry | null = null;
        for (const entry of visible.values()) {
          if (!closest || entry.boundingClientRect.top < closest.boundingClientRect.top) {
            closest = entry;
          }
        }
        if (closest) setActiveId(closest.target.id);
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // anchorIds 배열의 참조가 아니라 내용(key)이 바뀔 때만 재구독한다.
  }, [key]);

  return activeId;
}
