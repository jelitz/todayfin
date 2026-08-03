import type { JSX } from 'react'
import type { Summary } from '../types'
import { formatValue, formatPct, formatChangeAbs, formatDateTimeKST } from '../lib/format'
import './TickerBar.css'

export interface TickerBarProps {
  summary: Summary | null
  onSelect: (id: string) => void
}

/**
 * GNB 아래 얇은 가로 바 — 전 지표를 우→좌로 무한 스크롤(증권방송 시세 티커 느낌).
 * 실시간 데이터가 아니라 하루 2회 배치 수집 결과이므로 기준 시각을 좌측에 고정 표기한다.
 */
export default function TickerBar({ summary, onSelect }: TickerBarProps): JSX.Element | null {
  if (!summary || summary.indicators.length === 0) return null

  const items = summary.indicators

  const renderItem = (indicator: (typeof items)[number], key: string) => {
    const isFlows = indicator.type === 'flows'
    const change = isFlows ? indicator.change_abs : indicator.change_pct
    const changeText = isFlows
      ? formatChangeAbs(indicator.change_abs, indicator.unit)
      : formatPct(indicator.change_pct)
    const changeClass = change == null || change === 0 ? 'muted' : change > 0 ? 'up' : 'down'
    const arrow = change == null || change === 0 ? '' : change > 0 ? '▲' : '▼'

    return (
      <button key={key} type="button" className="ticker-item" onClick={() => onSelect(indicator.id)}>
        <span className="ticker-item-name">{indicator.name}</span>
        <span className="ticker-item-value">
          {indicator.latest === null ? '—' : formatValue(indicator.latest, indicator.unit)}
        </span>
        <span className={`ticker-item-change ${changeClass}`}>
          {arrow ? `${arrow} ` : ''}
          {changeText}
        </span>
      </button>
    )
  }

  return (
    <div className="ticker-bar">
      <span className="ticker-label muted">{formatDateTimeKST(summary.generated_at)} 기준</span>
      <div className="ticker-track">
        {items.map((i) => renderItem(i, `a-${i.id}`))}
        {items.map((i) => renderItem(i, `b-${i.id}`))}
      </div>
    </div>
  )
}
