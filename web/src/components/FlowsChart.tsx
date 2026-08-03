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
import { getChartSurfaceTheme, FLOWS_SUBJECT_COLORS } from "../lib/chartTheme";
import { useTheme } from "./ThemeProvider";

export interface FlowsChartProps {
  /** 화면에 표시할(기간 필터링된) 행 — [date, individual, foreign, institution], date 오름차순 */
  rows: FlowsRow[];
  /** daily: 일별 값을 그대로 라인으로 / weekly: 주간 합산 후 라인으로(노이즈 감소) */
  mode: "daily" | "weekly";
  height?: number;
}

interface TooltipState {
  x: number;
  date: string;
  lines: { label: string; value: string; color: string }[];
}

const SUBJECTS = [
  { key: "individual", label: "개인", idx: 1 as const, color: FLOWS_SUBJECT_COLORS.individual },
  { key: "foreign", label: "외국인", idx: 2 as const, color: FLOWS_SUBJECT_COLORS.foreign },
  { key: "institution", label: "기관", idx: 3 as const, color: FLOWS_SUBJECT_COLORS.institution },
];

function formatNum(v: number): string {
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function FlowsChart(props: FlowsChartProps) {
  const { rows, mode, height = 400 } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { theme } = useTheme();
  const surface = getChartSurfaceTheme(theme);

  const isEmpty = rows.length === 0;

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
    });
    chartRef.current = chart;

    const seriesList: { label: string; color: string; series: ISeriesApi<"Line"> }[] = [];

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

    chart.timeScale().fitContent();

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
  }, [rows, mode, height, isEmpty, theme]);

  if (isEmpty) {
    return <div>표시할 데이터가 없습니다</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {SUBJECTS.map((s) => (
          <span
            key={s.key}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: surface.text }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }}
            />
            {s.label}
          </span>
        ))}
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
