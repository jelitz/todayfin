/**
 * 지표 stale 판정 — pipeline/collect.py의 _is_stale/_business_days_between와 동일한 규칙
 * (3영업일 초과 시 stale, requirements.md R2). 프론트 여러 곳(홈 카드·상세)에서 값이
 * 어긋나지 않도록 이 한 곳에서만 계산한다.
 */

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** observedLast(YYYY-MM-DD) 이후 오늘까지의 영업일(월~금) 수. */
export function businessDaysSince(observedLast: string, reference: Date = new Date()): number {
  const observed = startOfDay(new Date(`${observedLast}T00:00:00`));
  const today = startOfDay(reference);
  let count = 0;
  const cursor = new Date(observed);
  while (cursor.getTime() < today.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/** 3영업일 초과면 stale. */
export function isStale(observedLast: string, reference: Date = new Date()): boolean {
  return businessDaysSince(observedLast, reference) > 3;
}

/** 관측일로부터 오늘까지 경과 달력일 수 (배지 표시용 — "N일 전 데이터"). */
export function daysSince(observedLast: string, reference: Date = new Date()): number {
  const then = startOfDay(new Date(`${observedLast}T00:00:00`)).getTime();
  const today = startOfDay(reference).getTime();
  return Math.max(0, Math.round((today - then) / 86400000));
}
