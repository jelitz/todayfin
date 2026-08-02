/**
 * 차트 컴포넌트(PriceChart, FlowsChart) 공용 색상 상수.
 * docs/steering/design.md 토큰과 동일한 값 — styles/tokens.css와 반드시 동기화할 것.
 * (lightweight-charts 시리즈 옵션은 CSS 커스텀 프로퍼티를 받지 못해 hex 상수로 중복 정의함)
 */

export const CHART_COLOR_UP = "#d60000";
export const CHART_COLOR_DOWN = "#0051c7";
export const CHART_COLOR_LINE = "#000000";
export const CHART_COLOR_VOLUME = "#d4d4d4";

/** MA 기간 → 색상 고정 매핑. design.md: --ma-1(20일/4주) / --ma-2(60일) / --ma-3(120일). */
export const CHART_MA_COLOR_BY_PERIOD: Record<number, string> = {
  4: "#f59e0b",
  20: "#f59e0b",
  60: "#10b981",
  120: "#8b5cf6",
};
export const CHART_MA_COLOR_FALLBACK = ["#f59e0b", "#10b981", "#8b5cf6"];

export function maColor(period: number, fallbackIndex: number): string {
  return (
    CHART_MA_COLOR_BY_PERIOD[period] ??
    CHART_MA_COLOR_FALLBACK[fallbackIndex % CHART_MA_COLOR_FALLBACK.length]
  );
}

export const CHART_BG = "#ffffff";
export const CHART_TEXT = "#525252";
export const CHART_GRID = "#e5e5e5";

/** 수급 차트(개인/외국인/기관) 주체별 고정 색상. 외국인이 알상무 기준 핵심 계열이라 가장 눈에 띄는 파랑을 배정. */
export const FLOWS_SUBJECT_COLORS = {
  individual: "#a3a3a3",
  foreign: "#0051c7",
  institution: "#f59e0b",
} as const;
