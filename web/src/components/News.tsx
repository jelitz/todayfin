import type { JSX } from 'react'
import type { NewsFeed } from '../types'
import NewsView from './NewsView'
import { newsPageState } from '../lib/news'
import { usePolledJson } from '../lib/usePolledJson'
import './News.css'

/** 뉴스 폴링 주기 — 수집이 매시간이라 홈과 같은 5분이면 충분 */
const NEWS_POLL_INTERVAL_MS = 5 * 60 * 1000

/**
 * 뉴스 페이지 컨테이너 — fetch와 3-상태 분기(docs/specs/news-page R5)만 담당.
 * 첫 성공 이후 일시 실패는 usePolledJson이 기존 값을 유지하므로 unavailable로 떨어지지 않는다.
 */
export default function News(): JSX.Element | null {
  const { data, error } = usePolledJson<NewsFeed>(
    `${import.meta.env.BASE_URL}data/news.json`,
    NEWS_POLL_INTERVAL_MS,
  )

  const state = newsPageState(data, error)
  if (state === 'loading') return null

  if (state === 'unavailable') {
    return (
      <div className="news-page">
        <div className="news-page-error">
          <p className="news-page-error-message">뉴스를 불러오지 못했습니다.</p>
          <p className="news-page-error-hint muted">잠시 후 새로고침해 다시 시도해 주세요.</p>
        </div>
      </div>
    )
  }

  // state === 'ready' — newsPageState가 isFreshNews를 통과시켰으므로 data는 non-null
  return <NewsView items={(data as NewsFeed).items} />
}
