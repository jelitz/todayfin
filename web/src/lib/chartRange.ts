import type { IChartApi, Time } from 'lightweight-charts';

/**
 * 상세 차트 보이는 범위(visible range) 관리 — docs/specs/chart-usability/design.md §1.
 * 전체 시계열을 로드해 두고 기간 버튼·옵션 변경 시 범위만 조작하는 공용 헬퍼.
 * PriceChart·FlowsChart가 함께 사용한다.
 */

export interface SavedRange {
  from: string; // "YYYY-MM-DD"
  to: string;
}

/** Detail이 차트에 내려주는 기간 점프 요청. 같은 버튼 재클릭도 점프하도록 seq를 증가시킨다. */
export interface PeriodRequest {
  /** null이면 전체(fitContent) */
  days: number | null;
  seq: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 기간(일수)을 [from, to] 날짜 범위로 계산한다. days가 null이거나 dates가 비어 있으면
 * null(호출부에서 fitContent 처리). from은 첫 데이터일로 클램프 — 짧은 시리즈는 전체 표시.
 */
export function periodRange(dates: string[], days: number | null): SavedRange | null {
  if (days === null || dates.length === 0) return null;
  const last = dates[dates.length - 1];
  const fromMs = Math.max(parseUtcMs(dates[0]), parseUtcMs(last) - days * DAY_MS);
  return { from: toIsoDate(fromMs), to: last };
}

/**
 * 재생성 후 범위 복원 시 스냅 보정: visible range는 바 단위로 스냅되므로 주간→일별 전환에서
 * 저장된 to(주 시작일)가 우측 끝을 최대 4영업일 후퇴시킨다. 복원할 to가 마지막 데이터일로부터
 * 7일 이내면 to를 마지막 날짜로 스냅해 "끝을 보고 있던 사용자는 계속 끝을 본다"를 보장한다.
 */
export function snapRestoredRange(saved: SavedRange, lastDate: string): SavedRange {
  const gap = parseUtcMs(lastDate) - parseUtcMs(saved.to);
  if (gap >= 0 && gap <= 7 * DAY_MS) {
    return { from: saved.from, to: lastDate };
  }
  return saved;
}

/** 기간 점프를 차트에 적용한다. days null → fitContent. */
export function applyPeriod(chart: IChartApi, dates: string[], days: number | null): void {
  const range = periodRange(dates, days);
  if (range === null) {
    chart.timeScale().fitContent();
    return;
  }
  chart.timeScale().setVisibleRange({
    from: range.from as unknown as Time,
    to: range.to as unknown as Time,
  });
}

/** 저장된 범위(스냅 보정 포함)를 차트에 적용한다. */
export function restoreRange(chart: IChartApi, saved: SavedRange, lastDate: string): void {
  const range = snapRestoredRange(saved, lastDate);
  chart.timeScale().setVisibleRange({
    from: range.from as unknown as Time,
    to: range.to as unknown as Time,
  });
}

/**
 * 줌·팬·기간 점프를 포함한 모든 범위 변화를 ref에 기록한다. 데이터 없음 시 핸들러가
 * null을 받으므로 무시하고 덮어쓰지 않는다. 차트 remove()가 구독도 정리한다.
 */
export function trackVisibleRange(chart: IChartApi, ref: { current: SavedRange | null }): void {
  chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
    if (range) {
      ref.current = { from: String(range.from), to: String(range.to) };
    }
  });
}
