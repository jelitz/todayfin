import { describe, expect, it } from 'vitest';
import { sma } from './ma';

describe('sma', () => {
  it('returns nulls while there is not enough data (period-1 index)', () => {
    const result = sma([1, 2, 3], 5);
    expect(result).toEqual([null, null, null]);
  });

  it('computes a simple moving average once enough data is available', () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });

  it('propagates null when the window includes a null value', () => {
    const result = sma([1, 2, null, 4, 5], 3);
    // window at index 2 = [1,2,null] -> null
    // window at index 3 = [2,null,4] -> null
    // window at index 4 = [null,4,5] -> null
    expect(result).toEqual([null, null, null, null, null]);
  });

  it('recovers once the null value leaves the window', () => {
    const result = sma([1, 2, null, 4, 5, 6], 2);
    // index0: n/a(period-1) -> null
    // index1: [1,2] -> 1.5
    // index2: [2,null] -> null
    // index3: [null,4] -> null
    // index4: [4,5] -> 4.5
    // index5: [5,6] -> 5.5
    expect(result).toEqual([null, 1.5, null, null, 4.5, 5.5]);
  });

  it('handles negative numbers and zero', () => {
    const result = sma([-2, 0, 2, -4], 2);
    expect(result).toEqual([null, -1, 1, -1]);
  });

  it('returns an array of the same length as the input', () => {
    const values = [1, 2, 3, 4, 5, 6, 7];
    expect(sma(values, 4)).toHaveLength(values.length);
  });
});
