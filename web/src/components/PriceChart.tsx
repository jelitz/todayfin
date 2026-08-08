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
  applyPeriod,
  restoreRange,
  trackVisibleRange,
  type PeriodRequest,
  type SavedRange,
} from "../lib/chartRange";
import {
  CHART_COLOR_UP,
  CHART_COLOR_DOWN,
  CHART_COLOR_VOLUME,
  getChartSurfaceTheme,
  maColor,
} from "../lib/chartTheme";
import { useTheme } from "./ThemeProvider";

export interface PriceChartProps {
  type: "ohlcv" | "line";
  /**
   * 전체 시계열(약 5년, date 오름차순). 기간은 데이터를 자르지 않고 보이는 범위로만
   * 조작한다 — docs/specs/chart-usability/design.md §1. MA도 항상 전체로 계산(워밍업 문제 소멸).
   */
  rows: (OhlcvRow | LineRow)[];
  /** 예: [20,60,120]. 지정된 각 기간의 SMA를 오버레이 라인으로 표시 */
  maPeriods?: number[];
  /** ohlcv에서 거래량 서브패널 표시 여부 (요구사항 R1: 삼성전자·SK하이닉스만 해당) */
  showVolume?: boolean;
  /** 기간 버튼 점프 요청 — seq 증가 시 보이는 범위만 전환(재생성 없음) */
  period?: PeriodRequest;
  /** line 시리즈 y축·툴팁 소수 자리(기본 2) — eurusd 등 4자리 지표용 */
  precision?: number;
  height?: number; // 기본 400
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  lines: { label: string; value: string; color: string }[];
}

export default function PriceChart(props: PriceChartProps) {
  const { type, rows, maPeriods, showVolume, period, precision = 2, height = 400 } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // 줌·팬 포함 마지막 보이는 범위 — 옵션·테마 변경으로 차트를 재생성해도 이 범위를 복원한다(R3)
  const savedRangeRef = useRef<SavedRange | null>(null);
  // effect A(재생성)가 period를 deps로 가지면 기간 점프마다 재생성되므로 ref로만 읽는다
  const periodRef = useRef<PeriodRequest | undefined>(period);
  periodRef.current = period;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { theme } = useTheme();
  const surface = getChartSurfaceTheme(theme);

  const isEmpty = rows.length === 0;

  const formatNum = (v: number): string =>
    v.toLocaleString("ko-KR", { maximumFractionDigits: precision });

  // effect A: 차트 생성/재생성 — effect B(기간 점프)보다 먼저 선언해 마운트 시 생성이 선행된다
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
      // 모바일 세로 스와이프는 페이지 스크롤로 남긴다(R2) — 수평 팬·핀치·휠 줌은 기본값 유지
      handleScroll: {
        vertTouchDrag: false,
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
        color: surface.line,
        lineWidth: 2,
        priceFormat: { type: "price", precision, minMove: Math.pow(10, -precision) },
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

    // MA 오버레이 — 전체 시계열로 계산·표시(범위 밖 구간은 스크롤로 보임)
    const maSeriesList: { period: number; series: ISeriesApi<"Line"> }[] = [];
    if (maPeriods && maPeriods.length > 0) {
      const baseValues =
        type === "ohlcv"
          ? (rows as OhlcvRow[]).map(([, , , , close]) => close)
          : (rows as LineRow[]).map(([, value]) => value);
      const dates = rows.map((r) => r[0]);

      maPeriods.forEach((maPeriod, idx) => {
        const maAll = sma(baseValues, maPeriod);
        const maSeries = chart.addSeries(LineSeries, {
          color: maColor(maPeriod, idx),
          lineWidth: 1,
        });
        const maData: LineData[] = dates
          .map((d, i) => ({ time: d, value: maAll[i] }))
          .filter((d): d is { time: string; value: number } => d.value !== null)
          .map((d) => ({ time: d.time as unknown as UTCTimestamp, value: d.value }));
        maSeries.setData(maData);
        maSeriesList.push({ period: maPeriod, series: maSeries });
      });
    }

    // 범위: 저장된 범위가 있으면 복원(스냅 보정 포함), 첫 진입이면 기본 기간(1Y) 적용
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
      maSeriesList.forEach(({ period: maPeriod, series }) => {
        const md = param.seriesData.get(series);
        if (md && "value" in md) {
          lines.push({ label: `MA${maPeriod}`, value: formatNum(md.value), color: series.options().color as string });
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
    // period는 의도적으로 제외(기간 점프는 effect B) — periodRef로만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, type, maPeriods, showVolume, precision, height, isEmpty, theme]);

  // effect B: 기간 버튼 점프 — 재생성 없이 보이는 범위만 전환(R1)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !period || rows.length === 0) return;
    applyPeriod(
      chart,
      rows.map((r) => r[0]),
      period.days,
    );
    // seq만 본다 — rows 변경은 effect A가 재생성하며 범위를 복원한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.seq]);

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
