import type { JSX } from 'react'
import type { NewsItem } from '../types'
import { formatNewsTime } from '../lib/format'
import './NewsHeadlines.css'

/**
 * 홈 상단 주요 뉴스 헤드라인 — docs/specs/news-headlines/design.md.
 * 항상 최대 5행, 행 = 시각(KST) + 출처명 + 제목 링크(새 탭 원문).
 * 표시 여부(부재·빈 목록·24h stale 숨김)는 Home이 판단한다.
 */
export default function NewsHeadlines({ items }: { items: NewsItem[] }): JSX.Element {
  return (
    <section className="news" aria-label="주요 뉴스">
      <h2 className="news-title">주요 뉴스</h2>
      <ol className="news-list">
        {items.map((item) => (
          <li key={item.url} className="news-item">
            <span className="news-time">{formatNewsTime(item.published_at)}</span>
            {item.source && <span className="news-source">{item.source}</span>}
            <a className="news-link" href={item.url} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
