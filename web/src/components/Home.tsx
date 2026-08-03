import type { JSX } from 'react'
import type { Summary, SummaryIndicator } from '../types'
import { SECTIONS } from '../types'
import IndicatorCard from './IndicatorCard'
import './Home.css'

export interface HomeProps {
  summary: Summary | null
  error: string | null
  onSelect: (id: string) => void
}

function IndicatorGrid({
  ids,
  summary,
  onSelect,
}: {
  ids: string[]
  summary: Summary | null
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div className="home-grid">
      {summary === null
        ? ids.map((id) => <div key={id} className="home-skeleton-card" aria-hidden="true" />)
        : ids
            .map((id) => summary.indicators.find((ind) => ind.id === id))
            .filter((ind): ind is SummaryIndicator => ind != null)
            .map((ind) => <IndicatorCard key={ind.id} indicator={ind} onClick={onSelect} />)}
    </div>
  )
}

export default function Home({ summary, error, onSelect }: HomeProps): JSX.Element {
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
      <p className="home-intro">
        이 사이트는 유튜브 채널 <strong>알상무</strong>가 강조해 온 &ldquo;매일 지표를 확인하는 투자
        습관&rdquo;에서 출발했습니다. 시황에 따라 말이 바뀌는 코멘트 대신, 기관 투자자들이 매일 아침 확인하는
        핵심 지표를 스스로 살펴보며 자신만의 판단 기준을 세울 수 있도록 돕습니다. 종목을 추천하는 곳이 아니라,
        데이터를 매일 루틴하게 확인하는 훈련을 통해 시장을 읽는 감각을 기르는 것이 목표입니다.
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title} id={section.anchor} className="home-section">
          <h2 className="home-section-title">{section.title}</h2>
          {section.subsections ? (
            section.subsections.map((sub) => (
              <div key={sub.title} className="home-subsection">
                <h3 className="home-subsection-title">{sub.title}</h3>
                <IndicatorGrid ids={sub.ids} summary={summary} onSelect={onSelect} />
              </div>
            ))
          ) : (
            <IndicatorGrid ids={section.ids ?? []} summary={summary} onSelect={onSelect} />
          )}
        </section>
      ))}
    </div>
  )
}
