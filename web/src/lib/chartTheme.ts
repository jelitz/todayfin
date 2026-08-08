/**
 * 차트 컴포넌트(PriceChart, FlowsChart) 공용 색상 상수.
 * docs/steering/design.md 토큰과 동일한 값 — styles/tokens.css와 반드시 동기화할 것.
 * (lightweight-charts 시리즈 옵션은 CSS 커스텀 프로퍼티를 받지 못해 hex 상수로 중복 정의함)
 */

export const CHART_COLOR_UP = "#d60000";
export const CHART_COLOR_DOWN = "#0051c7";
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

/**
 * 차트 배경·그리드·축 텍스트·단색 라인은 테마에 따라 달라진다(up/down/MA/수급 주체색 같은
 * "등락 의미"를 담은 데이터 잉크만 위 상수처럼 테마 무관 고정 — line 타입 차트의 단색 선은
 * 의미 없는 UI색이라 카드 스파크라인의 --ink-charcoal과 동일하게 테마를 따른다).
 * docs/steering/design.md의 --canvas/--ink-body/--ink-charcoal/--hairline(라이트) · dark
 * 오버라이드 값과 동기화.
 */
export function getChartSurfaceTheme(theme: "light" | "dark"): {
  bg: string;
  text: string;
  grid: string;
  line: string;
} {
  return theme === "dark"
    ? { bg: "#141414", text: "#adadad", grid: "#303030", line: "#c2c2c2" }
    : { bg: "#ffffff", text: "#595959", grid: "#dbdbdb", line: "#525252" };
}

/** 수급 차트(개인/외국인/기관) 주체별 고정 색상. 외국인이 알상무 기준 핵심 계열이라 가장 눈에 띄는 파랑을 배정. */
export const FLOWS_SUBJECT_COLORS = {
  individual: "#a3a3a3",
  foreign: "#0051c7",
  institution: "#f59e0b",
} as const;

/**
 * 누적 모드의 원본 누적 라인용 50% 투명 변형(8자리 hex) — 4주 평활선(불투명·굵게)과
 * "가는 원본 + 굵은 평활선" 문법을 이룬다. docs/specs/chart-usability/design.md §4.
 */
export const FLOWS_SUBJECT_COLORS_FADED = {
  individual: "#a3a3a380",
  foreign: "#0051c780",
  institution: "#f59e0b80",
} as const;
