import { describe, expect, it } from 'vitest';
import { formatChangeAbs, formatHeaderValue, formatNewsTime, formatPct, formatValue } from './format';

describe('formatValue', () => {
  it('formats 억원 under 10000 with comma and sign', () => {
    expect(formatValue(1234, '억원')).toBe('1,234억원');
    expect(formatValue(-1234, '억원')).toBe('-1,234억원');
    expect(formatValue(0, '억원')).toBe('0억원');
  });

  it('formats 억원 at or above 10000 as 조원 with 1 decimal', () => {
    expect(formatValue(12345, '억원')).toBe('1.2조원');
    expect(formatValue(-12345, '억원')).toBe('-1.2조원');
    expect(formatValue(10000, '억원')).toBe('1.0조원');
  });

  it('formats pt (index) with 2 decimals and comma', () => {
    expect(formatValue(2650.12, 'pt')).toBe('2,650.12');
    expect(formatValue(2650, 'pt')).toBe('2,650.00');
  });

  it('formats 원 (price) as an integer with comma', () => {
    expect(formatValue(262500, '원')).toBe('262,500원');
    expect(formatValue(262500.6, '원')).toBe('262,501원');
  });

  it('formats % with 2 decimals', () => {
    expect(formatValue(4.75, '%')).toBe('4.75%');
    expect(formatValue(-4.75, '%')).toBe('-4.75%');
    expect(formatValue(0, '%')).toBe('0.00%');
  });

  it('formats KRW/JPY with 2 decimals and comma', () => {
    expect(formatValue(1436.6, 'KRW')).toBe('1,436.60');
    expect(formatValue(9.123, 'JPY')).toBe('9.12');
  });

  it('formats USD/bbl with 2 decimals and unit suffix', () => {
    expect(formatValue(72.3, 'USD/bbl')).toBe('72.30 USD/bbl');
  });

  it('formats USD (eurusd) with 4 decimals — 2자리면 1.16으로 뭉개짐 (global-indicators R4)', () => {
    expect(formatValue(1.1562, 'USD')).toBe('1.1562');
    expect(formatValue(1.15, 'USD')).toBe('1.1500');
  });

  it('formats USD/oz (gold) with comma and 2 decimals', () => {
    expect(formatValue(4401.2998, 'USD/oz')).toBe('4,401.30 USD/oz');
  });

  it('falls back to comma format + unit suffix for unknown units', () => {
    expect(formatValue(1234, 'bp')).toBe('1,234bp');
  });
});

describe('formatHeaderValue', () => {
  it('USD는 4자리, 단위 문자열 없이 숫자만', () => {
    expect(formatHeaderValue(1.1562, 'USD')).toBe('1.1562');
  });

  it('원·억원은 정수 반올림', () => {
    expect(formatHeaderValue(262500.6, '원')).toBe('262,501');
    expect(formatHeaderValue(-3300, '억원')).toBe('-3,300');
  });

  it('그 외는 소수 2자리 고정 — 끝자리 0 유지', () => {
    expect(formatHeaderValue(4401.2998, 'USD/oz')).toBe('4,401.30');
    expect(formatHeaderValue(2650, 'pt')).toBe('2,650.00');
  });
});

describe('formatPct', () => {
  it('returns "-" for null', () => {
    expect(formatPct(null)).toBe('-');
  });

  it('adds a leading + for positive values', () => {
    expect(formatPct(1.234)).toBe('+1.23%');
  });

  it('keeps the leading - for negative values', () => {
    expect(formatPct(-1.234)).toBe('-1.23%');
  });

  it('formats zero as 0.00% with no sign', () => {
    expect(formatPct(0)).toBe('0.00%');
    expect(formatPct(-0)).toBe('0.00%');
  });

  it('always shows 2 decimal places', () => {
    expect(formatPct(5)).toBe('+5.00%');
  });
});

describe('formatChangeAbs', () => {
  it('returns "-" for null', () => {
    expect(formatChangeAbs(null, '억원')).toBe('-');
  });

  it('adds a leading + for positive values', () => {
    expect(formatChangeAbs(59130, '억원')).toBe('+5.9조원');
  });

  it('keeps the leading - for negative values (formatValue already includes it)', () => {
    expect(formatChangeAbs(-1234, '억원')).toBe('-1,234억원');
  });

  it('formats zero without a sign', () => {
    expect(formatChangeAbs(0, '억원')).toBe('0억원');
  });
});

describe('formatNewsTime', () => {
  // now = 2026-08-08 12:00 KST (03:00 UTC)
  const now = new Date('2026-08-08T03:00:00Z');

  it('KST 기준 오늘이면 HH:MM만', () => {
    expect(formatNewsTime('2026-08-08T02:14:00+00:00', now)).toBe('11:14');
  });

  it('오늘이 아니면 MM.DD HH:MM', () => {
    expect(formatNewsTime('2026-08-07T10:00:00+00:00', now)).toBe('08.07 19:00');
    expect(formatNewsTime('2026-08-06T02:00:00+00:00', now)).toBe('08.06 11:00');
  });

  it('자정 경계: UTC로는 어제라도 KST로 오늘이면 HH:MM', () => {
    // 2026-08-07 23:30 UTC = 2026-08-08 08:30 KST → 오늘
    expect(formatNewsTime('2026-08-07T23:30:00+00:00', now)).toBe('08:30');
  });

  it('파싱 불가 입력은 빈 문자열', () => {
    expect(formatNewsTime('not-a-date', now)).toBe('');
  });
});
