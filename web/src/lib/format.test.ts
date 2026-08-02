import { describe, expect, it } from 'vitest';
import { formatDate, formatPct, formatValue } from './format';

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

  it('falls back to comma format + unit suffix for unknown units', () => {
    expect(formatValue(1234, 'bp')).toBe('1,234bp');
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

describe('formatDate', () => {
  it('converts hyphen-separated ISO date to dot-separated', () => {
    expect(formatDate('2026-08-01')).toBe('2026.08.01');
  });

  it('handles single-digit month/day already zero-padded', () => {
    expect(formatDate('2026-01-05')).toBe('2026.01.05');
  });
});
