import { useRef, useState } from 'react'
import type { JSX } from 'react'
import type { NewsItem } from '../types'
import NewsHeadlines from './NewsHeadlines'
import { sortByPublishedDesc } from '../lib/news'
import { formatNewsTime } from '../lib/format'
import './News.css'

export type NewsTab = 'major' | 'latest'

const TABS: { key: NewsTab; label: string }[] = [
  { key: 'major', label: '주요뉴스' },
  { key: 'latest', label: '최신뉴스' },
]

/** 피드 페이지당 건수 — 2026-08-08 사용자 피드백(전체 나열 대신 20건 + 페이지 버튼) */
const PAGE_SIZE = 20

/**
 * 뉴스 페이지 프레젠테이션 — docs/specs/news-page/design.md.
 * 주요뉴스 = 랭킹순(고정 5건 제외 6번째부터), 최신뉴스 = 전체 발행 시각 내림차순.
 * initialTab·initialPage는 테스트 주입용(정적 렌더 전략 — 클릭 시뮬레이션 없이
 * 각 상태를 렌더로 검증).
 */
export default function NewsView({
  items,
  initialTab = 'major',
  initialPage = 1,
}: {
  items: NewsItem[]
  initialTab?: NewsTab
  initialPage?: number
}): JSX.Element {
  const [tab, setTab] = useState<NewsTab>(initialTab)
  const [page, setPage] = useState(initialPage)
  const tabsRef = useRef<HTMLDivElement>(null)

  const allFeedItems = tab === 'major' ? items.slice(5) : sortByPublishedDesc(items)
  const pageCount = Math.max(1, Math.ceil(allFeedItems.length / PAGE_SIZE))
  const current = Math.min(Math.max(page, 1), pageCount)
  const feedItems = allFeedItems.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const selectTab = (key: NewsTab) => {
    setTab(key)
    setPage(1) // 탭 전환 시 1페이지로 — 이전 탭의 페이지 위치를 이어받지 않는다
  }

  const selectPage = (n: number) => {
    setPage(n)
    // 목록 하단의 버튼으로 전환하므로 목록 상단으로 시선 복귀
    tabsRef.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="news-page">
      <h1 className="sr-only">뉴스</h1>
      <NewsHeadlines items={items.slice(0, 5)} className="news-pinned" />

      <div className="news-tabs" ref={tabsRef}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={tab === key ? 'news-tab news-tab-active' : 'news-tab'}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {feedItems.length === 0 ? (
        <p className="news-feed-empty muted">더 표시할 뉴스가 없습니다</p>
      ) : (
        <ol className="news-feed">
          {feedItems.map((item) => {
            const time = formatNewsTime(item.published_at)
            return (
              <li key={item.url} className="news-feed-item">
                <a className="news-feed-link" href={item.url} target="_blank" rel="noopener noreferrer">
                  <span className="news-feed-meta">
                    {item.source}
                    {item.source && time ? ' · ' : ''}
                    {time}
                  </span>
                  <span className="news-feed-title">{item.title}</span>
                </a>
              </li>
            )
          })}
        </ol>
      )}

      {pageCount > 1 && (
        <nav className="news-pages" aria-label="뉴스 페이지">
          <button
            type="button"
            className="news-page-btn"
            onClick={() => selectPage(current - 1)}
            disabled={current === 1}
            aria-label="이전 페이지"
          >
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={n === current ? 'news-page-btn news-page-btn-active' : 'news-page-btn'}
              aria-current={n === current ? 'page' : undefined}
              onClick={() => selectPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="news-page-btn"
            onClick={() => selectPage(current + 1)}
            disabled={current === pageCount}
            aria-label="다음 페이지"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  )
}
