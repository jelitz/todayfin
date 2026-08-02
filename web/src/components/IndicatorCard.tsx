import type { JSX } from 'react'
import type { SummaryIndicator } from '../types'
import { formatValue, formatPct, formatDate } from '../lib/format'
import { daysSince } from '../lib/stale'
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
  const { id, name, latest, unit, change_pct, spark, observed_last, stale } = indicator

  const changeClass = change_pct == null || change_pct === 0 ? 'muted' : change_pct > 0 ? 'up' : 'down'
  const arrow = change_pct == null || change_pct === 0 ? '' : change_pct > 0 ? '▲' : '▼'

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
      <div className="indicator-card-name">{name}</div>
      <div className="indicator-card-value">{latest === null ? '—' : formatValue(latest, unit)}</div>
      <div className={`indicator-card-change ${changeClass}`}>
        {arrow ? `${arrow} ` : ''}
        {formatPct(change_pct)}
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
