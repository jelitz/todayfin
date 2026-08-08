import type { FlowsRow } from '../types';

/** 수급 누적 모드 계산 — docs/specs/chart-usability/design.md §4. */

export interface CumulativePoint {
  date: string;
  sum: number;
}

/** 시계열 시작점을 0 기준으로 columnIndex 값을 누적 합산한다. rows는 date 오름차순 가정. */
export function toCumulative(rows: FlowsRow[], columnIndex: 1 | 2 | 3): CumulativePoint[] {
  const out: CumulativePoint[] = [];
  let sum = 0;
  for (const row of rows) {
    sum += row[columnIndex];
    out.push({ date: row[0], sum });
  }
  return out;
}

export interface CumulativeSummary {
  /** 전체 기간 누적 순매수 */
  total: number;
  /** 마지막 일자의 일별 순매수 */
  today: number;
  /** 직전 일자의 일별 순매수 (1행뿐이면 null) */
  prev: number | null;
}

/** 요약 값(누적·오늘·직전일). 빈 배열이면 null. */
export function cumulativeSummary(rows: FlowsRow[], columnIndex: 1 | 2 | 3): CumulativeSummary | null {
  if (rows.length === 0) return null;
  let total = 0;
  for (const row of rows) total += row[columnIndex];
  return {
    total,
    today: rows[rows.length - 1][columnIndex],
    prev: rows.length >= 2 ? rows[rows.length - 2][columnIndex] : null,
  };
}
