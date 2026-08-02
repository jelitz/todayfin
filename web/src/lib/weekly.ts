import type { FlowsRow } from '../types';
import { sma } from './ma';

export interface WeeklyPoint {
  weekStart: string;
  sum: number;
}

/** "YYYY-MM-DD" 문자열을 UTC 자정 기준 Date로 파싱한다 (타임존 영향 배제). */
function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 해당 날짜가 속한 ISO 주(월요일 시작)의 월요일 날짜를 "YYYY-MM-DD"로 반환한다. */
function mondayOf(iso: string): string {
  const date = parseUtcDate(iso);
  const day = date.getUTCDay(); // 0=일 ... 6=토
  const offset = (day + 6) % 7; // 월요일로부터 며칠 지났는지 (월=0, 화=1, ..., 일=6)
  date.setUTCDate(date.getUTCDate() - offset);
  return toIsoDate(date);
}

/**
 * ISO 주(월요일 시작) 단위로 columnIndex 위치의 값을 합산한다.
 * rows는 date 오름차순으로 정렬되어 있다고 가정한다.
 */
export function toWeekly(rows: FlowsRow[], columnIndex: number): WeeklyPoint[] {
  const weeks = new Map<string, number>();

  for (const row of rows) {
    const weekStart = mondayOf(row[0]);
    const value = row[columnIndex] as number;
    weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + value);
  }

  return Array.from(weeks, ([weekStart, sum]) => ({ weekStart, sum }));
}

/** 주간 합산값에 대한 4주 이동평균. */
export function fourWeekMA(weekly: WeeklyPoint[]): (number | null)[] {
  return sma(
    weekly.map((w) => w.sum),
    4
  );
}
