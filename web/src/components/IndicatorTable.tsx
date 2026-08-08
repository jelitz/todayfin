import type { JSX } from 'react'
import type { HomeBlock, Summary, SummaryIndicator } from '../types'
import { formatValue, formatPct, formatChangeAbs } from '../lib/format'
import { daysSince } from '../lib/stale'
import { isIntraday } from '../lib/realtime'
import Sparkline from './Sparkline'
import './IndicatorTable.css'

export interface IndicatorTableProps {
  blocks: HomeBlock[]
  summary: Summary | null
  onSelect: (id: string) => void
}

const COLUMN_COUNT = 5

function IndicatorRow({
  indicator,
  onSelect,
}: {
  indicator: SummaryIndicator
  onSelect: (id: string) => void
}): JSX.Element {
  const { id, name, latest, unit, type, change_pct, change_abs, spark, observed_last, stale } = indicator

  // flows(수급)는 유량 데이터라 %가 아니라 전일 대비 절대 증감액으로 표시(사용자 피드백 2026-08-03)
  const change = type === 'flows' ? change_abs : change_pct
  const changeText = type === 'flows' ? formatChangeAbs(change_abs, unit) : formatPct(change_pct)
  const changeClass = change == null || change === 0 ? 'muted' : change > 0 ? 'up' : 'down'
  const arrow = change == null || change === 0 ? '' : change > 0 ? '▲' : '▼'
  const intraday = isIntraday(id, observed_last)

  return (
    <tr className="itable-row" onClick={() => onSelect(id)}>
      <td className="itable-name">
        {name}
        {intraday && (
          <span className="itable-live" aria-label="장중 갱신 중">
            <span className="itable-live-dot" aria-hidden="true" />
            장중
          </span>
        )}
        {stale && observed_last && <span className="itable-badge">{daysSince(observed_last)}일 전 데이터</span>}
      </td>
      <td className="itable-value">{latest === null ? '—' : formatValue(latest, unit)}</td>
      <td className={`itable-change ${changeClass}`}>
        {arrow ? `${arrow} ` : ''}
        {changeText}
      </td>
      <td className="itable-spark-cell">
        <Sparkline values={spark} className="itable-spark" />
      </td>
      <td className="itable-detail-cell">
        {/* 행 클릭과 별개의 진짜 앵커 — 키보드 Tab→Enter 진입과 링크 의미론 확보(R2·R7).
            해시 대입은 앵커 기본 동작이 수행하므로 행 onClick 중복 실행만 막는다 */}
        <a
          className="itable-detail-link"
          href={`#/i/${id}`}
          aria-label={`${name} 상세`}
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden="true">↗</span>
        </a>
      </td>
    </tr>
  )
}

function SkeletonRow(): JSX.Element {
  return (
    <tr className="itable-skeleton-row" aria-hidden="true">
      <td colSpan={COLUMN_COUNT}>
        <div className="itable-skeleton-bar" />
      </td>
    </tr>
  )
}

export default function IndicatorTable({ blocks, summary, onSelect }: IndicatorTableProps): JSX.Element {
  const renderRows = (ids: string[]): JSX.Element[] =>
    summary === null
      ? ids.map((id) => <SkeletonRow key={id} />)
      : ids
          .map((id) => summary.indicators.find((ind) => ind.id === id))
          .filter((ind): ind is SummaryIndicator => ind != null)
          .map((ind) => <IndicatorRow key={ind.id} indicator={ind} onSelect={onSelect} />)

  return (
    <div className="itable-grid">
      {blocks.map((block) => (
        <section key={block.anchor} className="itable-block" aria-labelledby={block.anchor}>
          <h2 id={block.anchor} className="itable-block-title">
            {block.title}
          </h2>
          <table className="itable">
            <colgroup>
              <col className="itable-col-name" />
              <col className="itable-col-value" />
              <col className="itable-col-change" />
              <col className="itable-col-spark" />
              <col className="itable-col-detail" />
            </colgroup>
            <thead>
              <tr className="itable-head-row">
                <th scope="col">지표</th>
                <th scope="col" className="itable-th-num">
                  현재값
                </th>
                <th scope="col" className="itable-th-num">
                  등락
                </th>
                <th scope="col" className="itable-th-spark">
                  추세
                </th>
                <th scope="col" aria-label="상세" />
              </tr>
            </thead>
            {block.groups.map((group, gi) => (
              <tbody key={group.title ?? gi}>
                {group.title && (
                  <tr className="itable-subgroup-row">
                    <th colSpan={COLUMN_COUNT} className="itable-subgroup-title">
                      {group.title}
                    </th>
                  </tr>
                )}
                {renderRows(group.ids)}
              </tbody>
            ))}
          </table>
        </section>
      ))}
    </div>
  )
}
