import type { JSX } from 'react'
import type { Summary } from '../types'
import { SECTIONS } from '../types'
import IndicatorTable from './IndicatorTable'
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
      <p className="home-intro">
        시황에 따라 말이 바뀌는 코멘트 대신, 기관 투자자들이 매일 아침 확인하는 핵심 지표를 스스로
        살펴보며 자신만의 판단 기준을 세울 수 있도록 돕습니다. 종목을 추천하는 곳이 아니라, 데이터를
        매일 루틴하게 확인하는 훈련을 통해 시장을 읽는 감각을 기르는 것이 목표입니다.
      </p>
      <IndicatorTable sections={SECTIONS} summary={summary} onSelect={onSelect} />
    </div>
  )
}
