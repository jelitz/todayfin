import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { FlowsRow } from "../types";
import { toWeekly } from "../lib/weekly";
import { toCumulative, cumulativeSummary } from "../lib/flows";
import { sma } from "../lib/ma";
import { formatValue, formatChangeAbs } from "../lib/format";
import {
  applyPeriod,
  restoreRange,
  trackVisibleRange,
  type PeriodRequest,
  type SavedRange,
} from "../lib/chartRange";
import {
  getChartSurfaceTheme,
  FLOWS_SUBJECT_COLORS,
  FLOWS_SUBJECT_COLORS_FADED,
  CHART_COLOR_UP,
  CHART_COLOR_DOWN,
} from "../lib/chartTheme";
import { useTheme } from "./ThemeProvider";

export type FlowsMode = "daily" | "weekly" | "cumulative";
export type FlowsSubjectKey = "individual" | "foreign" | "institution";

export interface FlowsChartProps {
  /** 전체 시계열 — [date, individual, foreign, institution], date 오름차순 */
  rows: FlowsRow[];
  /**
   * daily: 일별 값 그대로 / weekly: 주간 합산(노이즈 감소) /
   * cumulative: 시계열 시작점 0 기준 주체별 누적 순매수 — docs/specs/chart-usability/design.md §4
   */
  mode: FlowsMode;
  /** 기간 버튼 점프 요청 — seq 증가 시 보이는 범위만 전환(재생성 없음) */
  period?: PeriodRequest;
  /** 누적 모드에서 표시할 주체(기본 3주체 전부). 일별·주간 모드에서는 무시(항상 3주체) */
  cumSubjects?: Record<FlowsSubjectKey, boolean>;
  /** 누적 모드 범례 체크박스 토글 콜백 */
  onToggleSubject?: (key: FlowsSubjectKey) => void;
  /** 누적 모드에서 20영업일(≈4주) 평활선 표시 여부 */
  cumMA?: boolean;
  height?: number;
}

interface TooltipState {
  x: number;
  date: string;
  lines: { label: string; value: string; color: string }[];
}

const SUBJECTS: { key: FlowsSubjectKey; label: string; idx: 1 | 2 | 3; color: string }[] = [
  { key: "individual", label: "개인", idx: 1, color: FLOWS_SUBJECT_COLORS.individual },
  { key: "foreign", label: "외국인", idx: 2, color: FLOWS_SUBJECT_COLORS.foreign },
  { key: "institution", label: "기관", idx: 3, color: FLOWS_SUBJECT_COLORS.institution },
];

// Detail.tsx의 동명 상수와 동일 값 유지 — 기본 3주체 전부(2026-08-08 사용자 피드백)
const DEFAULT_CUM_SUBJECTS: Record<FlowsSubjectKey, boolean> = {
  individual: true,
  foreign: true,
  institution: true,
};

/** 누적 평활선 기간 — 20영업일 ≈ 4주 (참고 예시 차트의 4w MA 관점) */
const CUM_MA_PERIOD = 20;

function formatNum(v: number): string {
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 요약 값의 등락색(+빨강/−파랑/0 회색) — 데이터 잉크라 테마 무관 고정 */
function signColor(v: number, neutral: string): string {
  if (v > 0) return CHART_COLOR_UP;
  if (v < 0) return CHART_COLOR_DOWN;
  return neutral;
}

export default function FlowsChart(props: FlowsChartProps) {
  const {
    rows,
    mode,
    period,
    cumSubjects = DEFAULT_CUM_SUBJECTS,
    onToggleSubject,
    cumMA = true,
    height = 400,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const savedRangeRef = useRef<SavedRange | null>(null);
  const periodRef = useRef<PeriodRequest | undefined>(period);
  periodRef.current = period;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { theme } = useTheme();
  const surface = getChartSurfaceTheme(theme);

  const isEmpty = rows.length === 0;
  const visibleSubjects =
    mode === "cumulative" ? SUBJECTS.filter((s) => cumSubjects[s.key]) : SUBJECTS;

  // effect A: 차트 생성/재생성 — effect B(기간 점프)보다 먼저 선언
  useEffect(() => {
    if (isEmpty || !containerRef.current) return;
    setTooltip(null);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: surface.bg },
        textColor: surface.text,
      },
      grid: {
        vertLines: { color: surface.grid },
        horzLines: { color: surface.grid },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: surface.grid,
      },
      rightPriceScale: {
        borderColor: surface.grid,
      },
      // 모바일 세로 스와이프는 페이지 스크롤로 남긴다(R2)
      handleScroll: {
        vertTouchDrag: false,
      },
    });
    chartRef.current = chart;

    // 툴팁에 표시할 시리즈만 등록 — 누적 평활선(SMA)은 시각 참고선이라 제외(라벨 중복 방지)
    const seriesList: { label: string; color: string; series: ISeriesApi<"Line"> }[] = [];

    if (mode === "cumulative") {
      const subjects = SUBJECTS.filter((s) => cumSubjects[s.key]);
      subjects.forEach((subject) => {
        const cum = toCumulative(rows, subject.idx);
        const cumData: LineData[] = cum.map((c) => ({
          time: c.date as unknown as UTCTimestamp,
          value: c.sum,
        }));

        // 원본 누적 라인: 평활선이 켜져 있으면 가늘고 반투명하게, 꺼져 있으면 단독으로 굵게
        const mainSeries = chart.addSeries(LineSeries, {
          color: cumMA ? FLOWS_SUBJECT_COLORS_FADED[subject.key] : subject.color,
          lineWidth: cumMA ? 1 : 2,
        });
        mainSeries.setData(cumData);
        seriesList.push({ label: subject.label, color: subject.color, series: mainSeries });

        if (cumMA) {
          const maVals = sma(
            cum.map((c) => c.sum),
            CUM_MA_PERIOD,
          );
          const maSeries = chart.addSeries(LineSeries, { color: subject.color, lineWidth: 2 });
          const maData: LineData[] = cum
            .map((c, i) => ({ time: c.date, value: maVals[i] }))
            .filter((d): d is { time: string; value: number } => d.value !== null)
            .map((d) => ({ time: d.time as unknown as UTCTimestamp, value: d.value }));
          maSeries.setData(maData);
        }
      });
    } else {
      SUBJECTS.forEach((subject) => {
        const series = chart.addSeries(LineSeries, { color: subject.color, lineWidth: 2 });
        let data: LineData[];
        if (mode === "daily") {
          data = rows.map((r) => ({
            time: r[0] as unknown as UTCTimestamp,
            value: r[subject.idx],
          }));
        } else {
          const weekly = toWeekly(rows, subject.idx);
          data = weekly.map((w) => ({
            time: w.weekStart as unknown as UTCTimestamp,
            value: w.sum,
          }));
        }
        series.setData(data);
        seriesList.push({ label: subject.label, color: subject.color, series });
      });
    }

    // 범위: 저장된 범위 복원(스냅 보정) 또는 기본 기간(1Y)
    const lastDate = rows[rows.length - 1][0];
    if (savedRangeRef.current) {
      restoreRange(chart, savedRangeRef.current, lastDate);
    } else {
      applyPeriod(
        chart,
        rows.map((r) => r[0]),
        periodRef.current?.days ?? 365,
      );
    }
    trackVisibleRange(chart, savedRangeRef);

    const container = containerRef.current;
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !container) {
        setTooltip(null);
        return;
      }
      const lines: TooltipState["lines"] = [];
      seriesList.forEach(({ label, color, series }) => {
        const d = param.seriesData.get(series);
        if (d && "value" in d) {
          lines.push({ label, value: formatNum(d.value), color });
        }
      });
      if (lines.length === 0) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: param.point.x, date: String(param.time), lines });
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
    // period는 의도적으로 제외(기간 점프는 effect B) — periodRef로만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, mode, cumSubjects, cumMA, height, isEmpty, theme]);

  // effect B: 기간 버튼 점프 — 재생성 없이 보이는 범위만 전환(R1)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !period || rows.length === 0) return;
    applyPeriod(
      chart,
      rows.map((r) => r[0]),
      period.days,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.seq]);

  if (isEmpty) {
    return <div>표시할 데이터가 없습니다</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {SUBJECTS.map((s) =>
          mode === "cumulative" ? (
            // 누적 모드: 범례를 체크박스로 승격해 주체 토글
            <label
              key={s.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: surface.text,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={cumSubjects[s.key]}
                onChange={() => onToggleSubject?.(s.key)}
              />
              <span
                style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }}
              />
              {s.label}
            </label>
          ) : (
            <span
              key={s.key}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: surface.text }}
            >
              <span
                style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }}
              />
              {s.label}
            </span>
          ),
        )}

        {mode === "cumulative" && (
          // 요약: 범례 행 우측 — 차트 위 오버레이가 아니라서 크로스헤어 툴팁과 겹치지 않는다
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 12,
              color: surface.text,
            }}
          >
            {visibleSubjects.map((subject) => {
              const s = cumulativeSummary(rows, subject.idx);
              if (!s) return null;
              return (
                <span key={subject.key} style={{ whiteSpace: "nowrap" }}>
                  {subject.label} 누적{" "}
                  <strong style={{ color: signColor(s.total, surface.text) }}>
                    {formatValue(s.total, "억원")}
                  </strong>
                  {" · "}오늘{" "}
                  <span style={{ color: signColor(s.today, surface.text) }}>
                    {formatChangeAbs(s.today, "억원")}
                  </span>
                  {" · "}직전일{" "}
                  <span style={{ color: s.prev === null ? surface.text : signColor(s.prev, surface.text) }}>
                    {s.prev === null ? "-" : formatChangeAbs(s.prev, "억원")}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div ref={containerRef} style={{ width: "100%", height }} />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 300) - 140),
            top: 8,
            background: surface.bg,
            border: `1px solid ${surface.grid}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            color: surface.text,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "none",
          }}
        >
          <div style={{ color: surface.text, fontWeight: 600, marginBottom: 2 }}>{tooltip.date}</div>
          {tooltip.lines.map((l) => (
            <div key={l.label} style={{ color: l.color }}>
              {l.label} {l.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
