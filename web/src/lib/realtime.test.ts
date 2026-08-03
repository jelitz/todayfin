import { describe, expect, it } from "vitest";
import { isIntraday, todayKST, REALTIME_ELIGIBLE_IDS } from "./realtime";

describe("todayKST", () => {
  it("UTC 자정 직후에도 KST(UTC+9) 기준 날짜로 넘어가 있다", () => {
    // 2026-08-03T00:35Z = 2026-08-03 09:35 KST
    const now = new Date("2026-08-03T00:35:00Z");
    expect(todayKST(now)).toBe("2026-08-03");
  });

  it("UTC 오후(예: 16:00Z)에는 KST로 다음날 새벽이다", () => {
    // 2026-08-02T16:00Z = 2026-08-03 01:00 KST
    const now = new Date("2026-08-02T16:00:00Z");
    expect(todayKST(now)).toBe("2026-08-03");
  });
});

describe("isIntraday", () => {
  const now = new Date("2026-08-03T05:00:00Z"); // 2026-08-03 14:00 KST

  it("대상 지표이고 observed_last가 오늘(KST)이면 true", () => {
    expect(isIntraday("kospi", "2026-08-03", now)).toBe(true);
  });

  it("대상 지표가 아니면(국채 등) false", () => {
    expect(isIntraday("ust10y", "2026-08-03", now)).toBe(false);
  });

  it("observed_last가 오늘이 아니면 false", () => {
    expect(isIntraday("kospi", "2026-08-01", now)).toBe(false);
  });

  it("observed_last가 null이면 false", () => {
    expect(isIntraday("kospi", null, now)).toBe(false);
  });

  it("REALTIME_ELIGIBLE_IDS는 국채 4종을 포함하지 않는다", () => {
    for (const id of ["ust2y", "ust10y", "ust30y", "ktb3y"]) {
      expect(REALTIME_ELIGIBLE_IDS.has(id)).toBe(false);
    }
  });
});
