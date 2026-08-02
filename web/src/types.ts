/**
 * data/*.json 계약 타입. 스키마는 docs/specs/dashboard-mvp/design.md "데이터 스키마" 참조.
 * pipeline/collect.py가 생성하는 JSON과 1:1로 대응한다 — 필드를 바꿀 때는 양쪽을 함께 수정할 것.
 */

export type IndicatorType = "ohlcv" | "line" | "flows";

/** [date, open, high, low, close, volume] */
export type OhlcvRow = [string, number, number, number, number, number];
/** [date, value] */
export type LineRow = [string, number];
/** [date, individual, foreign, institution] */
export type FlowsRow = [string, number, number, number];

export type SeriesRow = OhlcvRow | LineRow | FlowsRow;

export interface IndicatorRecord {
  id: string;
  name: string;
  type: IndicatorType;
  unit: string;
  source: string;
  /** 화면에 표시할 "데이터의 원래 출처" 이름 (예: "Yahoo Finance", "한국거래소(KRX)") */
  source_name: string;
  instrument: string;
  timezone: string;
  frequency: "daily";
  observed_last: string;
  retrieved_at: string;
  columns?: string[]; // flows 타입에서만 존재 (예: ["individual","foreign","institution"])
  series: SeriesRow[];
}

/** data/summary.json 의 지표 1건 — 홈 카드가 사용하는 압축 표현 */
export interface SummaryIndicator {
  id: string;
  name: string;
  unit: string;
  type: IndicatorType;
  latest: number | null;
  prev: number | null;
  /** flows 타입 외 전 지표에서 사용하는 전일 대비 등락률(%) */
  change_pct: number | null;
  /** flows 타입(수급) 전용 — 전일 대비 절대 증감액(억원). %는 플로우 데이터에 의미가 없어 대체 지표로 사용 */
  change_abs: number | null;
  observed_last: string | null;
  stale: boolean;
  /** 최근 3개월 대표값(ohlcv=close, flows=foreign, line=value) 시계열 — 스파크라인용 */
  spark: number[];
}

export interface Summary {
  generated_at: string;
  indicators: SummaryIndicator[];
}

export interface MetaRun {
  profile: "preopen" | "afterclose" | "all" | "skeleton";
  started_at: string;
  results: Record<string, string>;
}

export interface Meta {
  runs: MetaRun[];
}

/** 지표 ID → 홈 화면 섹션 분류 (알상무 4분류). requirements.md R1 순서를 따른다. */
export const SECTIONS: { title: string; ids: string[] }[] = [
  { title: "수급", ids: ["investor_kospi", "investor_kosdaq"] },
  { title: "시장 가격·추세", ids: ["kospi", "kosdaq", "samsung", "skhynix"] },
  { title: "거시·통화", ids: ["usdkrw", "usdjpy", "ust2y", "ust10y", "ust30y", "ktb3y"] },
  { title: "원자재", ids: ["wti"] },
];
