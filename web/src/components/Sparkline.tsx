import type { JSX } from 'react'

/**
 * 요약 시계열 미니 라인 차트(순수 SVG). IndicatorCard 내부 함수였다가
 * 홈 테이블 전환(home-table-view) 때 공용 컴포넌트로 승격 — 로직 무변경.
 */
export default function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}): JSX.Element | null {
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
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
