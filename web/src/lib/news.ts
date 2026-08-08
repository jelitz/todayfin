import type { NewsFeed, NewsItem } from '../types'

/** generated_at이 이보다 오래되면 stale — 홈은 블록 숨김, 뉴스 페이지는 안내 문구
 * (docs/specs/news-page/requirements.md R5. 원래 Home.tsx 내부에 있던 것을 공용화) */
export const NEWS_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function isFreshNews(feed: NewsFeed | null, now: number = Date.now()): feed is NewsFeed {
  if (!feed || !feed.items || feed.items.length === 0) return false
  const generated = new Date(feed.generated_at).getTime()
  return !Number.isNaN(generated) && now - generated <= NEWS_MAX_AGE_MS
}

export type NewsPageState = 'loading' | 'unavailable' | 'ready'

/** 뉴스 페이지 3-상태 분기(R5) — usePolledJson의 {data, error}를 그대로 받는다.
 * 로딩을 실패로 오판하면 진입 때마다 오류 문구가 플래시된다(적대적 검증 반영). */
export function newsPageState(data: NewsFeed | null, error: boolean, now: number = Date.now()): NewsPageState {
  if (data === null && !error) return 'loading'
  if (error || !isFreshNews(data, now)) return 'unavailable'
  return 'ready'
}

/** 최신뉴스 탭 정렬. sort는 ES2019+ 안정 정렬 — 동일 시각은 원래(랭킹) 순서 유지 */
export function sortByPublishedDesc(items: NewsItem[]): NewsItem[] {
  const time = (item: NewsItem) => {
    const t = new Date(item.published_at).getTime()
    return Number.isNaN(t) ? -Infinity : t // 파싱 불능은 맨 뒤
  }
  return [...items].sort((a, b) => time(b) - time(a))
}
