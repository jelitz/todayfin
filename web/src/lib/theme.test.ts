import { describe, expect, it } from "vitest";
import { resolveInitialTheme, toggleThemeValue } from "./theme";

describe("resolveInitialTheme", () => {
  it("저장된 값이 있으면 OS 선호도와 무관하게 저장값을 우선한다", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("저장된 값이 없으면 OS 선호도를 따른다", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
  });

  it("저장값이 유효하지 않은 문자열이면 OS 선호도로 폴백한다", () => {
    expect(resolveInitialTheme("system", true)).toBe("dark");
    expect(resolveInitialTheme("", false)).toBe("light");
  });
});

describe("toggleThemeValue", () => {
  it("light와 dark를 서로 전환한다", () => {
    expect(toggleThemeValue("light")).toBe("dark");
    expect(toggleThemeValue("dark")).toBe("light");
  });
});
