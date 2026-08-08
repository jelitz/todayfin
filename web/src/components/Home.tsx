import type { JSX } from 'react'
import type { NewsFeed, Summary } from '../types'
import { HOME_BLOCKS } from '../types'
import IndicatorTable from './IndicatorTable'
import NewsHeadlines from './NewsHeadlines'
import { usePolledJson } from '../lib/usePolledJson'
import './Home.css'

export interface HomeProps {
  summary: Summary | null
  /** 한 번도 로드에 성공하지 못한 경우에만 true — 문구는 Home이 자체 렌더하므로 boolean으로 충분 */
  error: boolean
  onSelect: (id: string) => void
}

/** 뉴스 폴링 주기 — 수집이 매시간이라 summary와 같은 5분이면 충분 */
const NEWS_POLL_INTERVAL_MS = 5 * 60 * 1000
/** generated_at이 이보다 오래되면 뉴스 블록을 숨긴다 — 수집 장기 실패 시 며칠 지난
 * 기사가 "주요 뉴스"로 계속 노출되는 것 방지(docs/specs/news-headlines R5) */
const NEWS_MAX_AGE_MS = 24 * 60 * 60 * 1000

function isFreshNews(feed: NewsFeed | null): feed is NewsFeed {
  if (!feed || !feed.items || feed.items.length === 0) return false
  const generated = new Date(feed.generated_at).getTime()
  return !Number.isNaN(generated) && Date.now() - generated <= NEWS_MAX_AGE_MS
}

export default function Home({ summary, error, onSelect }: HomeProps): JSX.Element {
  // 실패·부재 시 조용히 숨김(R4) — error는 사용하지 않는다
  const { data: news } = usePolledJson<NewsFeed>(
    `${import.meta.env.BASE_URL}data/news.json`,
    NEWS_POLL_INTERVAL_MS,
  )

  if (error) {
    return (
      <div className="home">
        <div className="home-error">
          <p className="home-error-message">데이터를 불러오지 못했습니다.</p>
          <p className="home-error-hint muted">잠시 후 새로고침해 다시 시도해 주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      {/* 블록 제목(h2)들의 상위 heading — 시각적으로는 GNB 로고가 그 역할 */}
      <h1 className="sr-only">todayfin — 데일리 투자 지표 대시보드</h1>
      <p className="home-intro">
        시황에 따라 말이 바뀌는 코멘트 대신, 기관 투자자들이 매일 아침 확인하는 핵심 지표를 스스로
        살펴보며 자신만의 판단 기준을 세울 수 있도록 돕습니다. 종목을 추천하는 곳이 아니라, 데이터를
        매일 루틴하게 확인하는 훈련을 통해 시장을 읽는 감각을 기르는 것이 목표입니다.
      </p>
      {isFreshNews(news) && <NewsHeadlines items={news.items.slice(0, 5)} />}
      <IndicatorTable blocks={HOME_BLOCKS} summary={summary} onSelect={onSelect} />
    </div>
  )
}
