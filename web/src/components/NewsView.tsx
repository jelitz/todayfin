import { useState } from 'react'
import type { JSX } from 'react'
import type { NewsItem } from '../types'
import NewsHeadlines from './NewsHeadlines'
import { sortByPublishedDesc } from '../lib/news'
import { formatNewsRelativeTime } from '../lib/format'
import './News.css'

export type NewsTab = 'major' | 'latest'

const TABS: { key: NewsTab; label: string }[] = [
  { key: 'major', label: '주요뉴스' },
  { key: 'latest', label: '최신뉴스' },
]

/**
 * 뉴스 페이지 프레젠테이션 — docs/specs/news-page/design.md.
 * 주요뉴스 = 랭킹순(고정 5건 제외 6번째부터), 최신뉴스 = 전체 발행 시각 내림차순.
 * initialTab은 테스트 주입용(정적 렌더 전략 — 클릭 시뮬레이션 없이 두 상태를 각각 검증).
 */
export default function NewsView({
  items,
  initialTab = 'major',
}: {
  items: NewsItem[]
  initialTab?: NewsTab
}): JSX.Element {
  const [tab, setTab] = useState<NewsTab>(initialTab)
  const feedItems = tab === 'major' ? items.slice(5) : sortByPublishedDesc(items)

  return (
    <div className="news-page">
      <h1 className="sr-only">뉴스</h1>
      <NewsHeadlines items={items.slice(0, 5)} className="news-pinned" />

      <div className="news-tabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={tab === key ? 'news-tab news-tab-active' : 'news-tab'}
            onClick={() => setTab(key)}
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
            const time = formatNewsRelativeTime(item.published_at)
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
    </div>
  )
}
