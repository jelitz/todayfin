import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvRow, LineRow } from "../types";
import { sma } from "../lib/ma";
import {
  CHART_COLOR_UP,
  CHART_COLOR_DOWN,
  CHART_COLOR_LINE,
  CHART_COLOR_VOLUME,
  getChartSurfaceTheme,
  maColor,
} from "../lib/chartTheme";
import { useTheme } from "./ThemeProvider";

export interface PriceChartProps {
  type: "ohlcv" | "line";
  /** 화면에 표시할(기간 필터링된) 행 — date 오름차순 */
  rows: (OhlcvRow | LineRow)[];
  /**
   * MA 계산용 전체 시계열(워밍업 포함, date 오름차순). 생략 시 rows로만 계산하므로
   * 긴 기간 MA(60/120일)가 표시 구간 앞부분에서 비어 보일 수 있다.
   */
  fullRows?: (OhlcvRow | LineRow)[];
  /** 예: [20,60,120]. 지정된 각 기간의 SMA를 오버레이 라인으로 표시 */
  maPeriods?: number[];
  /** ohlcv에서 거래량 서브패널 표시 여부 (요구사항 R1: 삼성전자·SK하이닉스만 해당) */
  showVolume?: boolean;
  height?: number; // 기본 400
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  lines: { label: string; value: string; color: string }[];
}

function formatNum(v: number): string {
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export default function PriceChart(props: PriceChartProps) {
  const { type, rows, fullRows, maPeriods, showVolume, height = 400 } = props;
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

    const mainSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null = (() => {
      if (type === "ohlcv") {
        const ohlcvRows = rows as OhlcvRow[];
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: CHART_COLOR_UP,
          downColor: CHART_COLOR_DOWN,
          borderUpColor: CHART_COLOR_UP,
          borderDownColor: CHART_COLOR_DOWN,
          wickUpColor: CHART_COLOR_UP,
          wickDownColor: CHART_COLOR_DOWN,
        });
        const data: CandlestickData[] = ohlcvRows.map(([date, open, high, low, close]) => ({
          time: date as unknown as UTCTimestamp,
          open,
          high,
          low,
          close,
        }));
        candlestickSeries.setData(data);
        return candlestickSeries;
      }
      const lineRows = rows as LineRow[];
      const lineSeries = chart.addSeries(LineSeries, {
        color: CHART_COLOR_LINE,
        lineWidth: 2,
      });
      const data: LineData[] = lineRows.map(([date, value]) => ({
        time: date as unknown as UTCTimestamp,
        value,
      }));
      lineSeries.setData(data);
      return lineSeries;
    })();

    // 거래량 서브패널(하단 20% 오버레이 — lightweight-charts 공식 패턴: 별도 priceScaleId + scaleMargins)
    let volumeSeries: ISeriesApi<"Histogram"> | null = null;
    if (type === "ohlcv" && showVolume) {
      const ohlcvRows = rows as OhlcvRow[];
      volumeSeries = chart.addSeries(HistogramSeries, {
        color: CHART_COLOR_VOLUME,
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      const volData: HistogramData[] = ohlcvRows.map(([date, open, , , close, volume]) => ({
        time: date as unknown as UTCTimestamp,
        value: volume,
        color: close >= open ? CHART_COLOR_UP : CHART_COLOR_DOWN,
      }));
      volumeSeries.setData(volData);
    }

    // MA 오버레이 — fullRows(워밍업 포함 전체)로 계산 후 rows(표시 구간) 날짜만 취함
    const maSeriesList: { period: number; series: ISeriesApi<"Line"> }[] = [];
    if (maPeriods && maPeriods.length > 0) {
      const source = fullRows && fullRows.length > 0 ? fullRows : rows;
      const sourceBaseValues =
        type === "ohlcv"
          ? (source as OhlcvRow[]).map(([, , , , close]) => close)
          : (source as LineRow[]).map(([, value]) => value);
      const sourceDates = source.map((r) => r[0]);
      const visibleDates = new Set(rows.map((r) => r[0]));

      maPeriods.forEach((period, idx) => {
        const maAll = sma(sourceBaseValues, period);
        const maByDate = new Map(sourceDates.map((d, i) => [d, maAll[i]]));
        const maSeries = chart.addSeries(LineSeries, {
          color: maColor(period, idx),
          lineWidth: 1,
        });
        const maData: LineData[] = sourceDates
          .filter((d) => visibleDates.has(d))
          .map((d) => ({ time: d, value: maByDate.get(d) ?? null }))
          .filter((d): d is { time: string; value: number } => d.value !== null)
          .map((d) => ({ time: d.time as unknown as UTCTimestamp, value: d.value }));
        maSeries.setData(maData);
        maSeriesList.push({ period, series: maSeries });
      });
    }

    chart.timeScale().fitContent();

    // 크로스헤어 툴팁
    const container = containerRef.current;
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !container) {
        setTooltip(null);
        return;
      }
      const lines: TooltipState["lines"] = [];
      if (mainSeries) {
        const d = param.seriesData.get(mainSeries);
        if (d) {
          if ("open" in d) {
            lines.push({ label: "시가", value: formatNum(d.open), color: surface.text });
            lines.push({ label: "고가", value: formatNum(d.high), color: surface.text });
            lines.push({ label: "저가", value: formatNum(d.low), color: surface.text });
            lines.push({ label: "종가", value: formatNum(d.close), color: surface.text });
          } else if ("value" in d) {
            lines.push({ label: "값", value: formatNum(d.value), color: surface.text });
          }
        }
      }
      if (volumeSeries) {
        const vd = param.seriesData.get(volumeSeries);
        if (vd && "value" in vd) {
          lines.push({ label: "거래량", value: formatNum(vd.value), color: CHART_COLOR_VOLUME });
        }
      }
      maSeriesList.forEach(({ period, series }) => {
        const md = param.seriesData.get(series);
        if (md && "value" in md) {
          lines.push({ label: `MA${period}`, value: formatNum(md.value), color: series.options().color as string });
        }
      });
      if (lines.length === 0) {
        setTooltip(null);
        return;
      }
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        date: String(param.time),
        lines,
      });
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
  }, [rows, fullRows, type, maPeriods, showVolume, height, isEmpty, theme]);

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
