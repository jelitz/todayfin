import { describe, expect, it } from 'vitest';
import { periodRange, snapRestoredRange } from './chartRange';

const DATES = ['2021-08-09', '2024-02-01', '2026-08-06', '2026-08-07'];

describe('periodRange', () => {
  it('마지막 데이터일 기준으로 days만큼 거슬러 범위를 만든다', () => {
    expect(periodRange(DATES, 365)).toEqual({ from: '2025-08-07', to: '2026-08-07' });
  });

  it('days가 시리즈 길이를 넘으면 from을 첫 데이터일로 클램프한다', () => {
    expect(periodRange(DATES, 365 * 10)).toEqual({ from: '2021-08-09', to: '2026-08-07' });
  });

  it('days null(전체) 또는 빈 시리즈면 null — 호출부 fitContent 처리', () => {
    expect(periodRange(DATES, null)).toBeNull();
    expect(periodRange([], 365)).toBeNull();
  });
});

describe('snapRestoredRange', () => {
  it('to가 마지막 데이터일로부터 7일 이내면 마지막 날짜로 스냅한다(주간→일별 후퇴 보정)', () => {
    expect(snapRestoredRange({ from: '2026-05-01', to: '2026-08-03' }, '2026-08-07')).toEqual({
      from: '2026-05-01',
      to: '2026-08-07',
    });
  });

  it('to가 과거 구간을 보고 있었다면(7일 초과) 그대로 둔다', () => {
    const saved = { from: '2024-01-01', to: '2024-06-30' };
    expect(snapRestoredRange(saved, '2026-08-07')).toEqual(saved);
  });

  it('to가 마지막 데이터일과 같으면 그대로다', () => {
    const saved = { from: '2026-05-01', to: '2026-08-07' };
    expect(snapRestoredRange(saved, '2026-08-07')).toEqual(saved);
  });
});
