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

export interface HomeSubsection {
  title: string;
  ids: string[];
}

export interface HomeSection {
  title: string;
  anchor: string;
  /** 단일 그리드로 나열할 지표 — subsections와 배타적 */
  ids?: string[];
  /** 국가·성격별로 소제목을 나눠 모아 보여줄 때 사용 (예: 거시·통화의 환율/미국 국채/한국 국채) */
  subsections?: HomeSubsection[];
}

/** 지표 ID → 홈 화면 섹션 분류 (알상무 4분류). requirements.md R1 순서를 따른다.
 * 2026-08-08 global-indicators: 시장 가격·추세를 국내/해외 소그룹으로, 환율 소그룹에
 * 유로/달러·달러인덱스 추가(제목 개칭), 원자재에 금 선물 추가. */
export const SECTIONS: HomeSection[] = [
  { title: "수급", anchor: "section-flows", ids: ["investor_kospi", "investor_kosdaq"] },
  {
    title: "시장 가격·추세",
    anchor: "section-price-trend",
    subsections: [
      { title: "국내", ids: ["kospi", "kosdaq", "samsung", "skhynix"] },
      { title: "해외", ids: ["nasdaq", "sp500", "dow", "nikkei"] },
    ],
  },
  { title: "변동성·리스크", anchor: "section-risk", ids: ["vkospi"] },
  {
    title: "거시·통화",
    anchor: "section-macro",
    subsections: [
      { title: "환율·달러인덱스", ids: ["usdkrw", "usdjpy", "eurusd", "dxy"] },
      { title: "미국 국채", ids: ["ust2y", "ust10y", "ust30y"] },
      { title: "한국 국채", ids: ["ktb3y"] },
    ],
  },
  { title: "원자재", anchor: "section-commodity", ids: ["wti", "gold"] },
];

/** data/youtube.json 의 영상 1건 — pipeline/collect_media.py 스키마와 1:1 대응 */
export interface YoutubeVideo {
  video_id: string;
  title: string;
  /** ISO 8601 (예: "2026-08-02T23:49:20+00:00") */
  published_at: string;
  thumbnail_url: string | null;
  watch_url: string;
  /** 소유자가 임베드를 허용했는지(videos.list part=status). 누락 시 true로 취급 — 임베드 시도 */
  embeddable?: boolean;
}

export interface YoutubeFeed {
  channel_name: string;
  channel_url: string;
  generated_at: string;
  videos: YoutubeVideo[];
}
