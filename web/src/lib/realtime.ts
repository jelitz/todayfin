/**
 * 장중 준실시간(near-realtime) 갱신 대상 판정 — 순수 함수.
 * docs/specs/near-realtime-updates/design.md 참조. 백엔드 스키마 변경 없이
 * observed_last(YYYY-MM-DD)가 오늘(KST)과 같고 대상 지표 집합에 속하면 "장중"으로 간주한다.
 */

/** pipeline/indicators.py PROFILES["market_hours"]와 동일 목록 — 국채 4종은 하루 1회 고시값이라 제외. */
export const REALTIME_ELIGIBLE_IDS = new Set([
  'investor_kospi',
  'investor_kosdaq',
  'kospi',
  'kosdaq',
  'samsung',
  'skhynix',
  'usdkrw',
  'usdjpy',
  'wti',
]);

/** 현재 시각을 "YYYY-MM-DD"(Asia/Seoul 기준)로 반환한다. */
export function todayKST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 지표가 지금 "장중 갱신 중"으로 표시되어야 하는지 판정한다. */
export function isIntraday(id: string, observedLast: string | null, now: Date = new Date()): boolean {
  if (!observedLast || !REALTIME_ELIGIBLE_IDS.has(id)) return false;
  return observedLast === todayKST(now);
}
