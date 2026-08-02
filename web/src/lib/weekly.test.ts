import { describe, expect, it } from 'vitest';
import type { FlowsRow } from '../types';
import { fourWeekMA, toWeekly } from './weekly';

describe('toWeekly', () => {
  it('sums same-week rows (Mon-Sun) into a single point keyed by Monday', () => {
    const rows: FlowsRow[] = [
      ['2026-08-03', 10, 0, 0], // Mon
      ['2026-08-04', 20, 0, 0], // Tue
      ['2026-08-05', -5, 0, 0], // Wed
    ];
    expect(toWeekly(rows, 1)).toEqual([{ weekStart: '2026-08-03', sum: 25 }]);
  });

  it('splits rows into separate weeks in chronological order', () => {
    const rows: FlowsRow[] = [
      ['2026-08-01', 100, 0, 0], // Sat, week of 2026-07-27
      ['2026-08-02', 50, 0, 0], // Sun, same week
      ['2026-08-03', 10, 0, 0], // Mon, new week
    ];
    expect(toWeekly(rows, 1)).toEqual([
      { weekStart: '2026-07-27', sum: 150 },
      { weekStart: '2026-08-03', sum: 10 },
    ]);
  });

  it('groups a week that spans a year boundary under the Monday of that week', () => {
    const rows: FlowsRow[] = [
      ['2025-12-29', 1, 0, 0], // Mon
      ['2025-12-31', 2, 0, 0], // Wed
      ['2026-01-01', 3, 0, 0], // Thu, still same ISO week
    ];
    expect(toWeekly(rows, 1)).toEqual([{ weekStart: '2025-12-29', sum: 6 }]);
  });

  it('sums the requested column only (foreign / institution)', () => {
    const rows: FlowsRow[] = [
      ['2026-08-03', 10, 100, 1000],
      ['2026-08-04', 20, 200, 2000],
    ];
    expect(toWeekly(rows, 2)).toEqual([{ weekStart: '2026-08-03', sum: 300 }]);
    expect(toWeekly(rows, 3)).toEqual([{ weekStart: '2026-08-03', sum: 3000 }]);
  });

  it('returns an empty array for empty input', () => {
    expect(toWeekly([], 1)).toEqual([]);
  });
});

describe('fourWeekMA', () => {
  it('is null until 4 weeks of data have accumulated', () => {
    const weekly = [
      { weekStart: '2026-07-06', sum: 10 },
      { weekStart: '2026-07-13', sum: 20 },
      { weekStart: '2026-07-20', sum: 30 },
    ];
    expect(fourWeekMA(weekly)).toEqual([null, null, null]);
  });

  it('averages the trailing 4 weeks once available', () => {
    const weekly = [
      { weekStart: '2026-07-06', sum: 10 },
      { weekStart: '2026-07-13', sum: 20 },
      { weekStart: '2026-07-20', sum: 30 },
      { weekStart: '2026-07-27', sum: 40 },
      { weekStart: '2026-08-03', sum: 100 },
    ];
    // index3: (10+20+30+40)/4 = 25
    // index4: (20+30+40+100)/4 = 47.5
    expect(fourWeekMA(weekly)).toEqual([null, null, null, 25, 47.5]);
  });

  it('handles an empty weekly array', () => {
    expect(fourWeekMA([])).toEqual([]);
  });
});
