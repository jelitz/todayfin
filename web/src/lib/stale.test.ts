import { describe, it, expect } from "vitest";
import { businessDaysSince, isStale, daysSince } from "./stale";

describe("businessDaysSince / isStale", () => {
  it("금요일 데이터를 다음주 월요일에 확인하면 1영업일 경과 → stale 아님", () => {
    // 2026-08-07은 금요일, 2026-08-10은 월요일
    const ref = new Date("2026-08-10T00:00:00");
    expect(businessDaysSince("2026-08-07", ref)).toBe(1);
    expect(isStale("2026-08-07", ref)).toBe(false);
  });

  it("금요일 데이터를 그 다음주 목요일에 확인하면 4영업일 경과 → stale", () => {
    // 2026-08-07(금) -> 08-10(월,1) 08-11(화,2) 08-12(수,3) 08-13(목,4)
    const ref = new Date("2026-08-13T00:00:00");
    expect(businessDaysSince("2026-08-07", ref)).toBe(4);
    expect(isStale("2026-08-07", ref)).toBe(true);
  });

  it("정확히 3영업일 경과는 stale 아님(초과만 stale)", () => {
    const ref = new Date("2026-08-12T00:00:00"); // 수요일, 금요일로부터 3영업일
    expect(businessDaysSince("2026-08-07", ref)).toBe(3);
    expect(isStale("2026-08-07", ref)).toBe(false);
  });

  it("당일 데이터는 0영업일 경과", () => {
    const ref = new Date("2026-08-07T00:00:00");
    expect(businessDaysSince("2026-08-07", ref)).toBe(0);
    expect(isStale("2026-08-07", ref)).toBe(false);
  });

  it("주말은 영업일 카운트에서 제외", () => {
    // 2026-08-07(금) -> 08-08(토,미포함) 08-09(일,미포함) 08-10(월,1)
    const ref = new Date("2026-08-10T00:00:00");
    expect(businessDaysSince("2026-08-07", ref)).toBe(1);
  });
});

describe("daysSince", () => {
  it("달력일 기준 경과일을 계산한다", () => {
    expect(daysSince("2026-08-01", new Date("2026-08-05T00:00:00"))).toBe(4);
  });

  it("당일이면 0을 반환한다", () => {
    expect(daysSince("2026-08-05", new Date("2026-08-05T12:34:00"))).toBe(0);
  });

  it("음수가 되지 않도록 0으로 clamp한다", () => {
    expect(daysSince("2026-08-10", new Date("2026-08-05T00:00:00"))).toBe(0);
  });
});
