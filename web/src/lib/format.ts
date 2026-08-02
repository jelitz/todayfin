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

/**
 * 절대 증감액을 항상 부호를 붙여 포맷한다(flows/수급 카드 전용 — 유량 데이터는 %가 의미 없어
 * "전일 대비 몇 억원" 형태로 표시). null이면 "-".
 */
export function formatChangeAbs(value: number | null, unit: string): string {
  if (value === null) return '-';
  if (value === 0) return `0${unit === '억원' ? '억원' : unit}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatValue(value, unit)}`;
}

/** "YYYY-MM-DD" -> "YYYY.MM.DD" */
export function formatDate(iso: string): string {
  return iso.replace(/-/g, '.');
}

/** ISO 문자열(UTC)을 "YYYY.MM.DD HH:MM" (KST)로 포맷한다. */
export function formatDateTimeKST(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}
