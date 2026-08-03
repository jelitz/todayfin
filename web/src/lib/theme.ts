/** 다크모드 테마 상태의 순수 로직. React 바인딩은 components/ThemeProvider.tsx 참조. */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "todayfin-theme";

/** localStorage 저장값과 OS 선호도로 초기 테마를 결정한다. 저장값이 있으면 최우선. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function toggleThemeValue(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}
