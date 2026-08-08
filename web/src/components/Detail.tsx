import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { FlowsRow, IndicatorRecord, LineRow, OhlcvRow } from '../types'
import PriceChart from '../components/PriceChart'
import FlowsChart, { type FlowsMode, type FlowsSubjectKey } from '../components/FlowsChart'
import { formatHeaderValue, formatPct, formatChangeAbs } from '../lib/format'
import { isStale, daysSince } from '../lib/stale'
import './Detail.css'

export interface DetailProps {
  id: string
  onBack: () => void
}

type PeriodKey = '3M' | '6M' | '1Y' | '3Y' | '5Y'

/** days는 보이는 범위 폭 — 데이터를 자르지 않는다(chart-usability R1). null = 전체(fitContent). */
const PERIOD_PRESETS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 182 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: '3Y', label: '3Y', days: 365 * 3 },
  { key: '5Y', label: '5Y', days: null },
]

/** MA 기간 — ohlcv는 기본 전부 켜짐, line은 기본 꺼짐(옵트인, chart-usability R4). */
const MA_PERIODS = [20, 60, 120] as const

/** requirements.md R1: 캔들+거래량이 필요한 지표(코스피/코스닥은 캔들만). */
const VOLUME_INDICATOR_IDS = new Set(['samsung', 'skhynix'])

/** 20/60/120일 MA → design.md ma-1/ma-2/ma-3 색상 매핑용 키 (lib/chartTheme.ts의 실제 색상과 대응) */
const MA_COLOR_KEY: Record<number, 1 | 2 | 3> = { 20: 1, 60: 2, 120: 3 }

const MA_ALL_ON: Record<number, boolean> = Object.fromEntries(MA_PERIODS.map((p) => [p, true]))
const MA_ALL_OFF: Record<number, boolean> = Object.fromEntries(MA_PERIODS.map((p) => [p, false]))

const DEFAULT_CUM_SUBJECTS: Record<FlowsSubjectKey, boolean> = {
  individual: false,
  foreign: true,
  institution: false,
}

/** 지표 유형별 시리즈 행에서 대표값 컬럼 인덱스: ohlcv=close(4), flows=foreign(2), line=value(1) */
function headlineIndex(type: IndicatorRecord['type']): number {
  if (type === 'ohlcv') return 4
  if (type === 'flows') return 2
  return 1
}

function getLatestValue(record: IndicatorRecord): number | null {
  const rows = record.series
  if (rows.length === 0) return null
  return rows[rows.length - 1][headlineIndex(record.type)] as number
}

interface HeaderChange {
  text: string
  cls: 'up' | 'down' | 'muted'
  arrow: string
}

/** 헤더 등락(R6) — summary·홈 테이블과 동일 규칙: flows는 절대 증감액, 그 외 등락률 %. */
function computeChange(record: IndicatorRecord): HeaderChange | null {
  const rows = record.series
  if (rows.length < 2) return null
  const idx = headlineIndex(record.type)
  const last = rows[rows.length - 1][idx] as number
  const prev = rows[rows.length - 2][idx] as number

  let value: number
  let text: string
  if (record.type === 'flows') {
    value = Math.round((last - prev) * 100) / 100
    text = formatChangeAbs(value, record.unit)
  } else {
    if (prev === 0) return null
    value = Math.round(((last - prev) / prev) * 100 * 100) / 100
    text = formatPct(value)
  }
  return {
    text,
    cls: value === 0 ? 'muted' : value > 0 ? 'up' : 'down',
    arrow: value === 0 ? '' : value > 0 ? '▲' : '▼',
  }
}

export default function Detail({ id, onBack }: DetailProps): JSX.Element {
  const [record, setRecord] = useState<IndicatorRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // seq는 같은 버튼 재클릭도 점프시키기 위한 카운터 — 차트는 seq 변화만 보고 범위를 전환한다
  const [period, setPeriod] = useState<{ key: PeriodKey; seq: number }>({ key: '1Y', seq: 0 })
  const [maChecked, setMaChecked] = useState<Record<number, boolean>>(MA_ALL_ON)
  const [flowsMode, setFlowsMode] = useState<FlowsMode>('weekly')
  const [cumSubjects, setCumSubjects] = useState<Record<FlowsSubjectKey, boolean>>(DEFAULT_CUM_SUBJECTS)
  const [cumMA, setCumMA] = useState(true)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(false)
    setRecord(null)
    setPeriod({ key: '1Y', seq: 0 })
    setFlowsMode('weekly')
    setCumSubjects(DEFAULT_CUM_SUBJECTS)
    setCumMA(true)

    // 캐시 버스팅 — App.tsx의 summary.json 폴링과 동일한 이유(GitHub Pages CDN·브라우저 캐시로
    // 장중 준실시간 갱신분이 가려지는 것 방지)
    fetch(`${import.meta.env.BASE_URL}data/${id}.json?_=${Date.now()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<IndicatorRecord>
      })
      .then((data) => {
        if (!cancelled) {
          setRecord(data)
          // MA 기본값은 타입을 알아야 정해진다(fetch 시작 시점엔 모름) — ohlcv 켜짐/line 꺼짐
          setMaChecked(data.type === 'ohlcv' ? MA_ALL_ON : MA_ALL_OFF)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const periodDays = PERIOD_PRESETS.find((p) => p.key === period.key)?.days ?? 365
  const maPeriods = useMemo<number[]>(() => {
    if (!record || record.type === 'flows') return []
    return MA_PERIODS.filter((p) => maChecked[p])
  }, [record, maChecked])

  if (loading) {
    return (
      <div className="detail">
        <button type="button" className="detail-back-link" onClick={onBack}>
          ← 홈으로
        </button>
        <p className="detail-loading-text">불러오는 중…</p>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="detail">
        <button type="button" className="detail-back-link" onClick={onBack}>
          ← 홈으로
        </button>
        <div className="detail-error">
          <p className="detail-error-text">데이터를 불러오지 못했습니다</p>
          <button type="button" className="pill-btn" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const latestValue = getLatestValue(record)
  const change = computeChange(record)
  const stale = isStale(record.observed_last)
  const showVolume = VOLUME_INDICATOR_IDS.has(id)
  // eurusd(unit USD)만 소수 4자리 — 상세 헤더·차트 y축·툴팁 정밀도(global-indicators §2-3)
  const precision = record.unit === 'USD' ? 4 : 2
  const periodRequest = { days: periodDays, seq: period.seq }

  return (
    <div className="detail">
      <button type="button" className="detail-back-link" onClick={onBack}>
        ← 홈으로
      </button>

      <header className="detail-header">
        <div className="detail-title-row">
          <h1 className="detail-name">{record.name}</h1>
          {stale && (
            <span className="detail-stale-badge">{daysSince(record.observed_last)}일 전 데이터</span>
          )}
        </div>
        <div className="detail-value-row">
          <span className="detail-latest-value">
            {latestValue !== null ? formatHeaderValue(latestValue, record.unit) : '-'}
          </span>
          <span className="detail-unit">{record.unit}</span>
          {change && (
            <span className={`detail-change ${change.cls}`}>
              {change.arrow ? `${change.arrow} ` : ''}
              {change.text}
            </span>
          )}
        </div>
        <div className="detail-meta-row">
          <span className="detail-observed">기준일 {record.observed_last}</span>
          <span className="detail-source">출처: {record.source_name}</span>
        </div>
      </header>

      <div className="detail-controls">
        <div className="detail-period-group" role="group" aria-label="기간 선택">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={period.key === p.key ? 'pill-btn pill-btn-active' : 'pill-btn'}
              onClick={() => setPeriod((prev) => ({ key: p.key, seq: prev.seq + 1 }))}
            >
              {p.label}
            </button>
          ))}
        </div>

        {record.type !== 'flows' && (
          <div className="detail-ma-group" role="group" aria-label="이동평균선">
            {MA_PERIODS.map((p) => (
              <label key={p} className="detail-ma-option">
                <input
                  type="checkbox"
                  checked={maChecked[p]}
                  onChange={() => setMaChecked((prev) => ({ ...prev, [p]: !prev[p] }))}
                />
                <span className={`detail-ma-dot detail-ma-dot-${MA_COLOR_KEY[p]}`} />
                {p}일
              </label>
            ))}
          </div>
        )}

        {record.type === 'flows' && (
          <div className="detail-ma-group" role="group" aria-label="집계 방식">
            {(
              [
                { mode: 'daily', label: '일별' },
                { mode: 'weekly', label: '주간' },
                { mode: 'cumulative', label: '누적' },
              ] as { mode: FlowsMode; label: string }[]
            ).map((m) => (
              <button
                key={m.mode}
                type="button"
                className={flowsMode === m.mode ? 'pill-btn pill-btn-active' : 'pill-btn'}
                onClick={() => setFlowsMode(m.mode)}
              >
                {m.label}
              </button>
            ))}
            {flowsMode === 'cumulative' && (
              <label className="detail-ma-option">
                <input type="checkbox" checked={cumMA} onChange={() => setCumMA((v) => !v)} />
                4주 평활
              </label>
            )}
          </div>
        )}
      </div>

      <div className="detail-chart">
        {record.type === 'flows' ? (
          <FlowsChart
            rows={record.series as FlowsRow[]}
            mode={flowsMode}
            period={periodRequest}
            cumSubjects={cumSubjects}
            onToggleSubject={(key) => setCumSubjects((prev) => ({ ...prev, [key]: !prev[key] }))}
            cumMA={cumMA}
            height={460}
          />
        ) : (
          <PriceChart
            type={record.type}
            rows={record.series as (OhlcvRow | LineRow)[]}
            maPeriods={maPeriods}
            showVolume={showVolume}
            period={periodRequest}
            precision={precision}
            height={460}
          />
        )}
      </div>
    </div>
  )
}
