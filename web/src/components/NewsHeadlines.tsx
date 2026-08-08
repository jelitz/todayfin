import type { JSX } from 'react'
import type { NewsItem } from '../types'
import { formatNewsTime } from '../lib/format'
import './NewsHeadlines.css'

export interface NewsHeadlinesProps {
  items: NewsItem[]
  /** section 클래스에 병합 — 뉴스 페이지 고정 블록의 --surface 배경용(news-pinned) */
  className?: string
  /** 전달 시 제목 행 우측 "더보기 →" — 홈에서만 전달(뉴스 페이지 자기 링크 방지) */
  moreHref?: string
}

/**
 * 홈 상단 주요 뉴스 헤드라인 — docs/specs/news-headlines/design.md.
 * 항상 최대 5행, 행 = 시각(KST) + 출처명 + 제목 링크(새 탭 원문).
 * 표시 여부(부재·빈 목록·24h stale 숨김)는 Home이 판단한다.
 */
export default function NewsHeadlines({ items, className, moreHref }: NewsHeadlinesProps): JSX.Element {
  return (
    <section className={className ? `news ${className}` : 'news'} aria-label="주요 뉴스">
      <div className="news-title-row">
        <h2 className="news-title">주요 뉴스</h2>
        {moreHref && (
          <a className="news-more" href={moreHref}>
            더보기 →
          </a>
        )}
      </div>
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
