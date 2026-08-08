import { describe, expect, it } from 'vitest';
import type { FlowsRow } from '../types';
import { toCumulative, cumulativeSummary } from './flows';

const ROWS: FlowsRow[] = [
  ['2026-08-03', 100, -300, 200],
  ['2026-08-04', -50, 140, -90],
  ['2026-08-05', 10, -330, 320],
];

describe('toCumulative', () => {
  it('시작점부터 지정 컬럼을 누적 합산한다', () => {
    expect(toCumulative(ROWS, 2)).toEqual([
      { date: '2026-08-03', sum: -300 },
      { date: '2026-08-04', sum: -160 },
      { date: '2026-08-05', sum: -490 },
    ]);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(toCumulative([], 2)).toEqual([]);
  });
});

describe('cumulativeSummary', () => {
  it('누적 합계·오늘·직전일 값을 낸다', () => {
    expect(cumulativeSummary(ROWS, 2)).toEqual({ total: -490, today: -330, prev: 140 });
  });

  it('1행뿐이면 prev는 null', () => {
    expect(cumulativeSummary(ROWS.slice(0, 1), 2)).toEqual({ total: -300, today: -300, prev: null });
  });

  it('빈 배열이면 null', () => {
    expect(cumulativeSummary([], 2)).toBeNull();
  });
});
