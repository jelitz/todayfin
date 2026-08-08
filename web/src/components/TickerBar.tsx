import type { JSX } from 'react'
import type { Summary } from '../types'
import { formatValue, formatPct, formatChangeAbs, formatDateTimeKST } from '../lib/format'
import { isIntraday } from '../lib/realtime'
import './TickerBar.css'

export interface TickerBarProps {
  summary: Summary | null
  onSelect: (id: string) => void
}

/**
 * GNB 아래 얇은 가로 바 — 전 지표를 우→좌로 무한 스크롤(증권방송 시세 티커 느낌).
 * 지표 대부분은 하루 2회 배치 수집이지만, 일부(수급·코스피·니케이·환율·금 등 13종)는 정규장 중
 * 30분 간격으로 갱신되어 장중에는 "장중" 배지가 붙는다 — docs/specs/near-realtime-updates 참조.
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
    const intraday = isIntraday(indicator.id, indicator.observed_last)

    return (
      <button key={key} type="button" className="ticker-item" onClick={() => onSelect(indicator.id)}>
        {intraday && <span className="ticker-item-live-dot" aria-label="장중 갱신 중" />}
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
      <div className="ticker-viewport">
        <div className="ticker-track">
          {items.map((i) => renderItem(i, `a-${i.id}`))}
          {items.map((i) => renderItem(i, `b-${i.id}`))}
        </div>
      </div>
    </div>
  )
}
