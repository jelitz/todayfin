import type { JSX } from 'react'
import type { SummaryIndicator } from '../types'
import { formatValue, formatPct, formatChangeAbs, formatDate } from '../lib/format'
import { daysSince } from '../lib/stale'
import { isIntraday } from '../lib/realtime'
import './IndicatorCard.css'

export interface IndicatorCardProps {
  indicator: SummaryIndicator
  onClick: (id: string) => void
}

function Sparkline({ values }: { values: number[] }): JSX.Element | null {
  if (values.length < 2) return null

  const width = 100
  const height = 30
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      className="indicator-card-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function IndicatorCard({ indicator, onClick }: IndicatorCardProps): JSX.Element {
  const { id, name, latest, unit, type, change_pct, change_abs, spark, observed_last, stale } = indicator

  // flows(수급)는 유량 데이터라 %가 아니라 전일 대비 절대 증감액으로 표시(사용자 피드백 2026-08-03)
  const change = type === 'flows' ? change_abs : change_pct
  const changeText = type === 'flows' ? formatChangeAbs(change_abs, unit) : formatPct(change_pct)
  const changeClass = change == null || change === 0 ? 'muted' : change > 0 ? 'up' : 'down'
  const arrow = change == null || change === 0 ? '' : change > 0 ? '▲' : '▼'
  const intraday = isIntraday(id, observed_last)

  const handleActivate = () => onClick(id)

  return (
    <div
      className="indicator-card"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleActivate()
        }
      }}
    >
      <span className="indicator-card-expand" aria-hidden="true">
        ↗
      </span>
      <div className="indicator-card-name">
        {name}
        {intraday && (
          <span className="indicator-card-live" aria-label="장중 갱신 중">
            <span className="indicator-card-live-dot" aria-hidden="true" />
            장중
          </span>
        )}
      </div>
      <div className="indicator-card-value">{latest === null ? '—' : formatValue(latest, unit)}</div>
      <div className={`indicator-card-change ${changeClass}`}>
        {arrow ? `${arrow} ` : ''}
        {changeText}
      </div>
      <Sparkline values={spark} />
      <div className="indicator-card-footer">
        <span className="indicator-card-date muted">{formatDate(observed_last ?? '')}</span>
        {stale && observed_last && (
          <span className="indicator-card-badge">{daysSince(observed_last)}일 전 데이터</span>
        )}
      </div>
    </div>
  )
}
