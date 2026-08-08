/**
 * NewsHeadlines 렌더 테스트 — docs/specs/news-headlines/design.md.
 * 표시 여부 판단(부재·stale)은 Home 소관이라 여기서는 행 렌더만 검증한다.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import NewsHeadlines from './NewsHeadlines'
import type { NewsItem } from '../types'

function item(n: number, overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: `헤드라인 ${n}`,
    url: `https://news.google.com/rss/articles/item-${n}`,
    source: `언론사${n}`,
    published_at: '2026-08-08T02:14:00+00:00',
    ...overrides,
  }
}

describe('NewsHeadlines', () => {
  it('아이템 수만큼 행을 그리고 제목·출처를 표시한다', () => {
    const items = [1, 2, 3, 4, 5].map((n) => item(n))
    const html = renderToStaticMarkup(<NewsHeadlines items={items} />)
    expect(html.match(/news-item/g)).toHaveLength(5)
    expect(html).toContain('헤드라인 1')
    expect(html).toContain('언론사5')
  })

  it('링크는 새 탭 + noopener·noreferrer로 연다', () => {
    const html = renderToStaticMarkup(<NewsHeadlines items={[item(1)]} />)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('href="https://news.google.com/rss/articles/item-1"')
  })

  it('source가 null이면 출처 span을 생략한다', () => {
    const html = renderToStaticMarkup(<NewsHeadlines items={[item(1, { source: null })]} />)
    expect(html).not.toContain('news-source')
  })
})
