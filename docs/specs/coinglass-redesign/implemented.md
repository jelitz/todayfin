# Implemented — coinglass-redesign

## 구현 방식

Workflow 도구로 4개 병렬 구현(GNB, 티커바, 카드/컨트롤 CSS 리스킨, 차트 다크 대응) → 통합 1개(App.tsx 배선) → 검증 1개(tsc/vitest/build) 순으로 진행. 토큰(`tokens.css`)·테마 인프라(`lib/theme.ts`, `ThemeProvider.tsx`)·`chartTheme.ts`의 `getChartSurfaceTheme`·`types.ts`의 `SECTIONS.anchor`·`Home.tsx`의 섹션 id·`App.css`의 `.app-header*` 삭제는 병렬 작업 시작 전 직접(메인 루프에서) 먼저 반영해 모든 에이전트가 동일한 기반 위에서 작업하도록 함.

## 설계 편차

| 편차 | 이유 |
|------|------|
| `design.md`는 `web/src/lib/theme.tsx` 단일 파일로 명시했으나 실제로는 `lib/theme.ts`(순수 로직: `resolveInitialTheme`/`toggleThemeValue`) + `components/ThemeProvider.tsx`(React Context, JSX)로 분리 | `structure.md`의 기존 모듈 경계 원칙("`lib/`은 순수 함수 + 단위 테스트 대상, 컴포넌트는 계산 로직을 갖지 않음")과 일관성 유지. 덕분에 `theme.test.ts`가 DOM/Context 없이 순수 함수만 테스트 |
| `Gnb.css`가 640px 이하에서 `.gnb-updated`(마지막 갱신 텍스트)를 숨김 — requirements.md/design.md에는 명시 안 됨 | 좁은 화면에서 로고+토글+갱신텍스트가 겹쳐 GNB 자체가 가로 스크롤을 유발할 수 있어 담당 에이전트가 추가. 탭 영역만 가로 스크롤되도록 하는 원 요구사항(R2)의 의도를 지키기 위한 최소 보강 |

## 구현 중 발견·수정한 버그

1. **`tokens.css` 주석 조기 종료로 프로덕션 빌드 실패**: `/* --up/--down/--ma-*/--flow-* ... */` 주석 안의 `*/`(`ma-*`의 `*` 다음 `/`)가 CSS 주석을 조기 종료시켜 `vite build`의 lightningcss 압축 단계에서 파싱 에러 발생. `tsc`/`vitest`/`dev` 서버는 이 문제를 잡지 못하고 **프로덕션 빌드에서만** 드러남 — Stage 4(base 경로 버그)·Stage 3(z-index 버그)와 같은 유형("실행 결과를 봐야 드러나는 문제"). 주석 문구를 `--ma-1..3`으로 바꿔 해결.
2. **`Home.css`에 옛 토큰명 `--surface-soft` 잔존**: 리네임(`--surface-soft`→`--surface-2`) 대상 파일 인벤토리에 `Home.css`가 빠져 있었음(design.md 파일 인벤토리 누락). 검증 에이전트가 전수 Grep으로 발견·수정.

## 브라우저 검증 결과 (claude-in-chrome, 로컬 dev 서버)

- 라이트/다크 모두 확인: GNB 활성 탭(네이비 밑줄), 티커바 실데이터 스크롤, 카드 hover, 상세 모달(캔들+MA 3종 색상+기간 pill 활성 상태+크로스헤어 툴팁) — 스크린샷 zoom 대조로 상승 `#d60000`/하락 `#0051c7`가 라이트·다크 완전히 동일함을 확인(요청하신 등락 색상 고정 원칙 실제 반영 확인)
- GNB 탭 클릭 → 해당 섹션(`거시·통화`)으로 부드러운 스크롤 + 활성 탭 자동 갱신 정상 동작
- 640px 반응형은 이번 세션에서도 브라우저 리사이즈 툴이 실제 뷰포트에 반영되지 않는 한계가 있어(Stage 3 때와 동일 현상), `Gnb.css`/`Home.css`의 미디어쿼리 코드 리뷰로 대체 확인 — 실기기/실브라우저 리사이즈로 재확인은 후속 과제로 남김

## 남은 미결 질문

- [ ] 640px 이하 실기기 반응형은 코드 리뷰로만 확인됨 — 실제 좁은 화면(또는 리사이즈 가능한 브라우저 세션)에서 한 번 더 확인 권장
- [ ] `--down`(#0051c7) 다크모드 대비 WCAG 미달(약 2.63:1, design.md 기록) — 사용자 확정 사항이라 변경하지 않았으나, 실사용 중 가독성 피드백이 오면 재검토
