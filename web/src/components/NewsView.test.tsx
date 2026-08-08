/**
 * NewsView 렌더 테스트 — docs/specs/news-page/design.md.
 * jsdom 없이 정적 마크업 검증(repo 전략) — 탭 전환 클릭 대신 initialTab 주입으로
 * 두 상태를 각각 렌더한다. fetch·상태 분기는 News(컨테이너) 소관.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import NewsView from './NewsView'
import type { NewsItem } from '../types'

function item(n: number, publishedAt: string, overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: `기사 ${n}`,
    url: `https://news.google.com/rss/articles/item-${n}`,
    source: `언론사${n}`,
    published_at: publishedAt,
    ...overrides,
  }
}

// 랭킹순 8건 — 발행 시각은 랭킹과 어긋나게(7번이 가장 최신) 구성해 정렬 검증
const items: NewsItem[] = [
  item(1, '2026-08-08T05:00:00+00:00'),
  item(2, '2026-08-08T04:00:00+00:00'),
  item(3, '2026-08-08T03:00:00+00:00'),
  item(4, '2026-08-08T02:00:00+00:00'),
  item(5, '2026-08-08T01:00:00+00:00'),
  item(6, '2026-08-08T00:00:00+00:00'),
  item(7, '2026-08-08T06:00:00+00:00'),
  item(8, '2026-08-07T23:00:00+00:00'),
]

describe('NewsView', () => {
  it('상단 고정 블록에 1~5위, 주요뉴스 탭(기본)에 6번째부터 랭킹순', () => {
    const html = renderToStaticMarkup(<NewsView items={items} />)
    expect(html.match(/news-item/g)).toHaveLength(5) // 고정 블록 5행
    expect(html.match(/news-feed-item/g)).toHaveLength(3) // 피드 6·7·8
    expect(html.indexOf('기사 6')).toBeLessThan(html.indexOf('기사 7'))
    expect(html).toContain('news-pinned') // 구분감 배경 클래스
  })

  it('initialTab=latest면 전체를 발행 시각 내림차순으로', () => {
    const html = renderToStaticMarkup(<NewsView items={items} initialTab="latest" />)
    expect(html.match(/news-feed-item/g)).toHaveLength(8)
    // 고정 블록(기사 1~5가 먼저 렌더됨)을 제외한 피드 영역에서만 순서 비교
    const feed = html.slice(html.indexOf('news-feed'))
    expect(feed.indexOf('기사 7')).toBeLessThan(feed.indexOf('기사 1')) // 7번이 최신
  })

  it('활성 탭만 aria-pressed=true', () => {
    const html = renderToStaticMarkup(<NewsView items={items} />)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('news-tab-active')
  })

  it('피드 링크는 새 탭 + noopener·noreferrer', () => {
    const html = renderToStaticMarkup(<NewsView items={items} />)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('피드 메타에 날짜+시간(KST MM.DD HH:MM)을 표기한다', () => {
    const html = renderToStaticMarkup(<NewsView items={items} />)
    expect(html).toContain('08.08 09:00') // 기사 6 = 00:00Z → KST 09:00
  })

  it('source가 null이면 구분점 없이 시각만', () => {
    // 피드에는 null source 1건만 — 구분점 '·'은 피드 메타에서만 쓰이므로(고정 블록은
    // 별도 span 문법) 문서 전체에 '·'가 없어야 한다
    const nullSource = [item(6, '2026-08-08T05:00:00+00:00', { source: null })]
    const html = renderToStaticMarkup(
      <NewsView items={[...items.slice(0, 5), ...nullSource]} />,
    )
    expect(html).not.toContain('·') // 고아 구분점 없음
  })

  it('items 5건 이하면 주요뉴스 탭은 빈 문구', () => {
    const html = renderToStaticMarkup(<NewsView items={items.slice(0, 5)} />)
    expect(html).toContain('더 표시할 뉴스가 없습니다')
    expect(html).not.toContain('news-feed-item')
  })

  describe('페이지네이션 (2026-08-08 사용자 피드백: 20건/페이지)', () => {
    // 랭킹순 70건 — 주요뉴스 탭 피드는 65건(6~70위) = 4페이지(20·20·20·5)
    const many: NewsItem[] = Array.from({ length: 70 }, (_, i) =>
      item(i + 1, '2026-08-08T01:00:00+00:00'),
    )

    it('한 페이지에 20건만 렌더하고 페이지 버튼 1~4를 그린다', () => {
      const html = renderToStaticMarkup(<NewsView items={many} />)
      expect(html.match(/news-feed-item/g)).toHaveLength(20)
      expect(html.indexOf('기사 6')).toBeLessThan(html.indexOf('기사 7')) // 6위부터
      expect(html).not.toContain('기사 26') // 21번째 피드 항목(=26위)은 2페이지
      expect(html.match(/news-page-btn/g)?.length).toBeGreaterThanOrEqual(4)
      expect(html).toContain('aria-current="page"')
    })

    it('initialPage=4면 마지막 페이지의 잔여 5건만 렌더한다', () => {
      const html = renderToStaticMarkup(<NewsView items={many} initialPage={4} />)
      expect(html.match(/news-feed-item/g)).toHaveLength(5)
      expect(html).toContain('기사 66')
      expect(html).toContain('기사 70')
    })

    it('한 페이지 이하면 페이지 버튼을 그리지 않는다', () => {
      const html = renderToStaticMarkup(<NewsView items={items} />)
      expect(html).not.toContain('news-pages')
    })
  })
})
