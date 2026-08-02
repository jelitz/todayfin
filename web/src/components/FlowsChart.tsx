import { useEffect, useRef, useState } from "react";
import {
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { FlowsRow } from "../types";
import { toWeekly, fourWeekMA } from "../lib/weekly";
import { CHART_COLOR_UP, CHART_COLOR_DOWN, CHART_BG, CHART_TEXT, CHART_GRID, maColor } from "../lib/chartTheme";

export interface FlowsChartProps {
  /** 화면에 표시할(기간 필터링된) 행 — [date, individual, foreign, institution], date 오름차순 */
  rows: FlowsRow[];
  /** 4주MA 계산용 전체 시계열(워밍업 포함). 생략 시 rows로만 계산. */
  fullRows?: FlowsRow[];
  mode: "daily" | "weekly4ma";
  height?: number;
}

interface TooltipState {
  x: number;
  date: string;
  lines: { label: string; value: string; color: string }[];
}

function formatNum(v: number): string {
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function FlowsChart(props: FlowsChartProps) {
  const { rows, fullRows, mode, height = 400 } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const isEmpty = mode === "daily" ? rows.length === 0 : toWeekly(rows, 2).length === 0;

  useEffect(() => {
    if (isEmpty || !containerRef.current) return;
    setTooltip(null);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: CHART_BG },
        textColor: CHART_TEXT,
      },
      grid: {
        vertLines: { color: CHART_GRID },
        horzLines: { color: CHART_GRID },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: CHART_GRID,
      },
      rightPriceScale: {
        borderColor: CHART_GRID,
      },
    });
    chartRef.current = chart;

    let histogramSeries: ISeriesApi<"Histogram">;
    let maSeries: ISeriesApi<"Line"> | null = null;

    if (mode === "daily") {
      histogramSeries = chart.addSeries(HistogramSeries, { color: CHART_COLOR_UP });
      const data: HistogramData[] = rows.map(([date, , foreign]) => ({
        time: date as unknown as UTCTimestamp,
        value: foreign,
        color: foreign >= 0 ? CHART_COLOR_UP : CHART_COLOR_DOWN,
      }));
      histogramSeries.setData(data);
    } else {
      // 4주MA 워밍업: fullRows(전체)로 주간집계+MA를 계산한 뒤, rows(표시 구간)에 해당하는 주만 그린다.
      const source = fullRows && fullRows.length > 0 ? fullRows : rows;
      const weeklyAll = toWeekly(source, 2);
      const maAll = fourWeekMA(weeklyAll);
      const maByWeekStart = new Map(weeklyAll.map((w, i) => [w.weekStart, maAll[i]]));

      const visibleStart = rows[0]?.[0];
      const visibleWeekly = visibleStart ? weeklyAll.filter((w) => w.weekStart >= visibleStart) : weeklyAll;

      histogramSeries = chart.addSeries(HistogramSeries, { color: CHART_COLOR_UP });
      const histData: HistogramData[] = visibleWeekly.map((w) => ({
        time: w.weekStart as unknown as UTCTimestamp,
        value: w.sum,
        color: w.sum >= 0 ? CHART_COLOR_UP : CHART_COLOR_DOWN,
      }));
      histogramSeries.setData(histData);

      maSeries = chart.addSeries(LineSeries, { color: maColor(4, 0), lineWidth: 2 });
      const lineData: LineData[] = visibleWeekly
        .map((w) => ({ time: w.weekStart, value: maByWeekStart.get(w.weekStart) ?? null }))
        .filter((d): d is { time: string; value: number } => d.value !== null)
        .map((d) => ({ time: d.time as unknown as UTCTimestamp, value: d.value }));
      maSeries.setData(lineData);
    }

    chart.timeScale().fitContent();

    const container = containerRef.current;
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !container) {
        setTooltip(null);
        return;
      }
      const lines: TooltipState["lines"] = [];
      const hd = param.seriesData.get(histogramSeries);
      if (hd && "value" in hd) {
        lines.push({
          label: mode === "daily" ? "외국인 순매수" : "주간 순매수",
          value: formatNum(hd.value),
          color: hd.value >= 0 ? CHART_COLOR_UP : CHART_COLOR_DOWN,
        });
      }
      if (maSeries) {
        const md = param.seriesData.get(maSeries);
        if (md && "value" in md) {
          lines.push({ label: "4주MA", value: formatNum(md.value), color: maColor(4, 0) });
        }
      }
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
  }, [rows, fullRows, mode, height, isEmpty]);

  if (isEmpty) {
    return <div>표시할 데이터가 없습니다</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height }} />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 300) - 140),
            top: 8,
            background: CHART_BG,
            border: `1px solid ${CHART_GRID}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            color: CHART_TEXT,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "none",
          }}
        >
          <div style={{ color: "#000", fontWeight: 600, marginBottom: 2 }}>{tooltip.date}</div>
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
