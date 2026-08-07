/**
 * IndicatorTable 렌더 테스트 — jsdom 없이 react-dom/server의 정적 마크업으로 검증
 * (docs/specs/home-table-view/design.md 테스트 전략).
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IndicatorTable from './IndicatorTable'
import type { HomeSection, Summary, SummaryIndicator } from '../types'

const noop = () => {}

function indicator(overrides: Partial<SummaryIndicator>): SummaryIndicator {
  return {
    id: 'kospi',
    name: '코스피',
    unit: 'pt',
    type: 'ohlcv',
    latest: 3100.5,
    prev: 3150.0,
    change_pct: -1.57,
    change_abs: null,
    observed_last: '2026-08-06',
    stale: false,
    spark: [1, 2, 3],
    ...overrides,
  }
}

const sections: HomeSection[] = [
  { title: '테스트 섹션', anchor: 'section-test', ids: ['kospi', 'investor_kospi', 'vkospi'] },
]

const summary: Summary = {
  generated_at: '2026-08-08T00:00:00+00:00',
  indicators: [
    indicator({}),
    indicator({
      id: 'investor_kospi',
      name: '주체별 순매수 (코스피)',
      unit: '억원',
      type: 'flows',
      latest: 1234,
      change_pct: null,
      change_abs: 2341,
    }),
    indicator({ id: 'vkospi', name: 'VKOSPI', latest: null, change_pct: null }),
  ],
}

describe('IndicatorTable', () => {
  it('일반 지표는 등락률(%), flows는 절대 증감액으로 표기한다', () => {
    const html = renderToStaticMarkup(
      <IndicatorTable sections={sections} summary={summary} onSelect={noop} />,
    )
    expect(html).toContain('-1.57%')
    expect(html).toContain('+2,341억원')
  })

  it('행마다 상세 앵커(#/i/{id})가 있다', () => {
    const html = renderToStaticMarkup(
      <IndicatorTable sections={sections} summary={summary} onSelect={noop} />,
    )
    expect(html).toContain('href="#/i/kospi"')
    expect(html).toContain('href="#/i/investor_kospi"')
    expect(html).toContain('href="#/i/vkospi"')
    expect(html).toContain('상세')
  })

  it('값이 null이면 —로 표시하고 등락은 보합(muted) 처리한다', () => {
    const html = renderToStaticMarkup(
      <IndicatorTable sections={sections} summary={summary} onSelect={noop} />,
    )
    expect(html).toContain('—')
    expect(html).toContain('class="itable-change muted"')
  })

  it('summary가 null이면 지표 수만큼 스켈레톤 행을 그린다', () => {
    const html = renderToStaticMarkup(
      <IndicatorTable sections={sections} summary={null} onSelect={noop} />,
    )
    expect(html.match(/itable-skeleton-row/g)).toHaveLength(3)
  })

  it('summary에 없는 id는 행을 건너뛴다', () => {
    const partial: Summary = { ...summary, indicators: [summary.indicators[0]] }
    const html = renderToStaticMarkup(
      <IndicatorTable sections={sections} summary={partial} onSelect={noop} />,
    )
    expect(html).toContain('href="#/i/kospi"')
    expect(html).not.toContain('href="#/i/vkospi"')
  })

  it('섹션·소그룹 헤더 행을 렌더하고 anchor id를 보존한다', () => {
    const withSub: HomeSection[] = [
      {
        title: '거시',
        anchor: 'section-macro',
        subsections: [{ title: '환율', ids: ['kospi'] }],
      },
    ]
    const html = renderToStaticMarkup(
      <IndicatorTable sections={withSub} summary={summary} onSelect={noop} />,
    )
    expect(html).toContain('id="section-macro"')
    expect(html).toContain('환율')
  })
})
