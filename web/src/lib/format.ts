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
    // eurusd 전용 — 1.15 수준의 값이라 2자리면 정보가 뭉개져 4자리 고정
    case 'USD':
      return value.toLocaleString('ko-KR', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
    case 'USD/bbl':
      return `${value.toFixed(2)} USD/bbl`;
    // 금 선물 — 4천 달러대라 천 단위 구분 포함
    case 'USD/oz':
      return `${value.toLocaleString('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} USD/oz`;
    default:
      return `${value.toLocaleString('ko-KR')}${unit}`;
  }
}

/**
 * 상세 헤더의 숫자 부분 — 단위 표기는 별도 요소로 붙으므로 숫자만, unit별 소수 자리를 맞춘다.
 * (formatValue는 일부 unit에서 단위 문자열까지 포함해 헤더에 쓰면 단위가 중복 표기됨)
 */
export function formatHeaderValue(value: number, unit: string): string {
  if (unit === 'USD') {
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  if (unit === '원' || unit === '억원') {
    return Math.round(value).toLocaleString('ko-KR');
  }
  return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/**
 * 뉴스 발행 시각 — KST 기준 오늘이면 "HH:MM", 아니면 "MM.DD HH:MM".
 * formatToParts로 조립해 로케일 출력 문자열 포맷을 가정하지 않고, 뷰어 로컬 타임존과
 * 무관하게 KST로 고정한다. now는 테스트 주입용.
 */
export function formatNewsTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const kstParts = (d: Date) => {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hm: `${get('hour')}:${get('minute')}`, md: `${get('month')}.${get('day')}` };
  };
  const target = kstParts(date);
  const today = kstParts(now);
  return target.ymd === today.ymd ? target.hm : `${target.md} ${target.hm}`;
}

/**
 * 뉴스 피드 행의 상대 시각(토스식). 헤드라인 블록의 KST 절대 시각(formatNewsTime)과 달리
 * 뷰어 시계 기준 diff. 미래 시각(수집·클라 시계 오차)은 "방금 전" 가드, 7일 이상은
 * 절대 시각으로 위임. now는 테스트 주입용.
 */
export function formatNewsRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 1000) return '방금 전'; // 미래 시각 포함
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 7) return `${days}일 전`;
  return formatNewsTime(iso, now);
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
