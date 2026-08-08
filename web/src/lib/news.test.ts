import { describe, expect, it } from 'vitest'
import { isFreshNews, NEWS_MAX_AGE_MS, newsPageState, sortByPublishedDesc } from './news'
import type { NewsFeed, NewsItem } from '../types'

const NOW = new Date('2026-08-08T12:00:00+00:00').getTime()

function feedAt(generatedAt: string, itemCount = 1): NewsFeed {
  return {
    generated_at: generatedAt,
    items: Array.from({ length: itemCount }, (_, i) => item(i)),
  }
}

function item(n: number, publishedAt = '2026-08-08T02:00:00+00:00'): NewsItem {
  return { title: `기사 ${n}`, url: `https://example.com/${n}`, source: `언론사${n}`, published_at: publishedAt }
}

describe('isFreshNews', () => {
  it('null·빈 items는 false', () => {
    expect(isFreshNews(null, NOW)).toBe(false)
    expect(isFreshNews(feedAt('2026-08-08T11:00:00+00:00', 0), NOW)).toBe(false)
  })

  it('24시간 이내는 true, 정확히 24시간 경계 포함', () => {
    expect(isFreshNews(feedAt('2026-08-08T11:00:00+00:00'), NOW)).toBe(true)
    expect(isFreshNews(feedAt(new Date(NOW - NEWS_MAX_AGE_MS).toISOString()), NOW)).toBe(true)
  })

  it('24시간 초과·generated_at 파싱 불능은 false', () => {
    expect(isFreshNews(feedAt(new Date(NOW - NEWS_MAX_AGE_MS - 1).toISOString()), NOW)).toBe(false)
    expect(isFreshNews(feedAt('not-a-date'), NOW)).toBe(false)
  })
})

describe('sortByPublishedDesc', () => {
  it('발행 시각 내림차순으로 정렬한 새 배열을 반환하고 원본은 불변', () => {
    const older = item(1, '2026-08-08T01:00:00+00:00')
    const newer = item(2, '2026-08-08T03:00:00+00:00')
    const input = [older, newer]
    const sorted = sortByPublishedDesc(input)
    expect(sorted.map((i) => i.title)).toEqual(['기사 2', '기사 1'])
    expect(input.map((i) => i.title)).toEqual(['기사 1', '기사 2'])
  })

  it('동일 시각은 원래(랭킹) 순서 유지 — 안정 정렬', () => {
    const a = item(1, '2026-08-08T02:00:00+00:00')
    const b = item(2, '2026-08-08T02:00:00+00:00')
    expect(sortByPublishedDesc([a, b]).map((i) => i.title)).toEqual(['기사 1', '기사 2'])
  })

  it('파싱 불능 시각은 맨 뒤로 보낸다', () => {
    const bad = item(1, 'not-a-date')
    const good = item(2, '2026-08-08T02:00:00+00:00')
    expect(sortByPublishedDesc([bad, good]).map((i) => i.title)).toEqual(['기사 2', '기사 1'])
  })
})

describe('newsPageState', () => {
  const fresh = feedAt('2026-08-08T11:00:00+00:00')
  const stale = feedAt('2026-08-06T11:00:00+00:00')

  it('첫 응답 전(data null, error false)은 loading — 오류 문구 플래시 방지', () => {
    expect(newsPageState(null, false, NOW)).toBe('loading')
  })

  it('한 번도 성공 못 함(error) 또는 24h stale은 unavailable', () => {
    expect(newsPageState(null, true, NOW)).toBe('unavailable')
    expect(newsPageState(stale, false, NOW)).toBe('unavailable')
  })

  it('fresh 데이터는 ready', () => {
    expect(newsPageState(fresh, false, NOW)).toBe('ready')
  })
})
