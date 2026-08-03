import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { FlowsRow, IndicatorRecord, LineRow, OhlcvRow, SeriesRow } from '../types'
import PriceChart from '../components/PriceChart'
import FlowsChart from '../components/FlowsChart'
import { isStale, daysSince } from '../lib/stale'
import './Detail.css'

export interface DetailProps {
  id: string
  onBack: () => void
}

type PeriodKey = '3M' | '6M' | '1Y' | '3Y' | '5Y'

const PERIOD_PRESETS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 182 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: '3Y', label: '3Y', days: 365 * 3 },
  { key: '5Y', label: '5Y', days: 365 * 5 },
]

/** ohlcv(캔들) 지표 전용 MA 기간. line 지표(환율·국채·WTI)는 2026-08-03 사용자 피드백으로 제외. */
const MA_PERIODS = [20, 60, 120] as const

/** requirements.md R1: 캔들+거래량이 필요한 지표(코스피/코스닥은 캔들만). */
const VOLUME_INDICATOR_IDS = new Set(['samsung', 'skhynix'])

/** 20/60/120일 MA → design.md ma-1/ma-2/ma-3 색상 매핑용 키 (lib/chartTheme.ts의 실제 색상과 대응) */
const MA_COLOR_KEY: Record<number, 1 | 2 | 3> = { 20: 1, 60: 2, 120: 3 }

/** 지표 유형별 시리즈 마지막 행에서 대표값을 뽑는다: ohlcv=close(4), flows=foreign(2), line=value(1) */
function getLatestValue(record: IndicatorRecord): number | null {
  const rows = record.series
  if (rows.length === 0) return null
  const last = rows[rows.length - 1]
  switch (record.type) {
    case 'ohlcv':
      return (last as OhlcvRow)[4]
    case 'flows':
      return (last as FlowsRow)[2]
    case 'line':
      return (last as LineRow)[1]
    default:
      return null
  }
}

function formatValue(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 오늘 기준 역산한 days일 이내로 시리즈를 필터링 */
function filterByDays(series: SeriesRow[], days: number): SeriesRow[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = toLocalISODate(cutoff)
  return series.filter((row) => row[0] >= cutoffStr)
}

const INITIAL_MA_CHECKED: Record<number, boolean> = Object.fromEntries(MA_PERIODS.map((p) => [p, true]))

export default function Detail({ id, onBack }: DetailProps): JSX.Element {
  const [record, setRecord] = useState<IndicatorRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [period, setPeriod] = useState<PeriodKey>('1Y')
  const [maChecked, setMaChecked] = useState<Record<number, boolean>>(INITIAL_MA_CHECKED)
  const [flowsWeekly, setFlowsWeekly] = useState(true)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(false)
    setRecord(null)
    setPeriod('1Y')
    setMaChecked(INITIAL_MA_CHECKED)
    setFlowsWeekly(true)

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

  const periodDays = PERIOD_PRESETS.find((p) => p.key === period)?.days ?? 365
  const filteredSeries = useMemo(
    () => (record ? filterByDays(record.series, periodDays) : []),
    [record, periodDays],
  )
  const maPeriods = useMemo<number[]>(() => {
    if (!record || record.type !== 'ohlcv') return []
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
  const stale = isStale(record.observed_last)
  const showVolume = VOLUME_INDICATOR_IDS.has(id)

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
          <span className="detail-latest-value">{latestValue !== null ? formatValue(latestValue) : '-'}</span>
          <span className="detail-unit">{record.unit}</span>
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
              className={period === p.key ? 'pill-btn pill-btn-active' : 'pill-btn'}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {record.type === 'ohlcv' && (
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
            <label className="detail-ma-option">
              <input type="checkbox" checked={flowsWeekly} onChange={() => setFlowsWeekly((v) => !v)} />
              주간집계
            </label>
          </div>
        )}
      </div>

      <div className="detail-chart">
        {record.type === 'flows' ? (
          <FlowsChart
            rows={filteredSeries as FlowsRow[]}
            mode={flowsWeekly ? 'weekly' : 'daily'}
            height={460}
          />
        ) : (
          <PriceChart
            type={record.type}
            rows={filteredSeries as (OhlcvRow | LineRow)[]}
            fullRows={record.series as (OhlcvRow | LineRow)[]}
            maPeriods={maPeriods}
            showVolume={showVolume}
            height={460}
          />
        )}
      </div>
    </div>
  )
}
