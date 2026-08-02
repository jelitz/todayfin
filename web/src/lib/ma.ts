/**
 * 단순 이동평균(SMA) 계산.
 * index < period-1 이거나 해당 구간에 null이 하나라도 포함되면 그 위치는 null.
 */
export function sma(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;

    let sum = 0;
    let hasNull = false;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) {
        hasNull = true;
        break;
      }
      sum += v;
    }

    result[i] = hasNull ? null : sum / period;
  }

  return result;
}
