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
      {SECTIONS.map((section) => (
        <section key={section.title} className="home-section">
          <h2 className="home-section-title">{section.title}</h2>
          <div className="home-grid">
            {summary === null
              ? section.ids.map((id) => (
                  <div key={id} className="home-skeleton-card" aria-hidden="true" />
                ))
              : section.ids
                  .map((id) => summary.indicators.find((ind) => ind.id === id))
                  .filter((ind): ind is SummaryIndicator => ind != null)
                  .map((ind) => <IndicatorCard key={ind.id} indicator={ind} onClick={onSelect} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
