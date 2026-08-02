/**
 * 지표 값을 unit에 맞춰 사람이 읽는 문자열로 포맷한다.
 */
export function formatValue(value: number, unit: string): string {
  switch (unit) {
    case '억원': {
      if (Math.abs(value) >= 10000) {
        const jo = value / 10000;
        return `${jo.toLocaleString('ko-KR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}조원`;
      }
      return `${Math.round(value).toLocaleString('ko-KR')}억원`;
    }
    case 'pt':
      return value.toLocaleString('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case '원':
      return `${Math.round(value).toLocaleString('ko-KR')}원`;
    case '%':
      return `${value.toFixed(2)}%`;
    case 'KRW':
    case 'JPY':
      return value.toLocaleString('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case 'USD/bbl':
      return `${value.toFixed(2)} USD/bbl`;
    default:
      return `${value.toLocaleString('ko-KR')}${unit}`;
  }
}

/** 등락률을 항상 부호를 붙여 소수점 2자리로 포맷한다. null이면 "-". */
export function formatPct(pct: number | null): string {
  if (pct === null) return '-';
  if (pct === 0) return '0.00%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** "YYYY-MM-DD" -> "YYYY.MM.DD" */
export function formatDate(iso: string): string {
  return iso.replace(/-/g, '.');
}
