# Tasks — coinglass-redesign

## Stage 0 — 스펙
- ✅ 인터뷰(AskUserQuestion 4라운드) + 시각 컴패니언 목업 승인
- ✅ requirements.md / design.md 작성
- ✅ docs/steering/design.md 갱신

## Stage 1 — 토큰·테마 인프라
- ✅ `web/src/styles/tokens.css` 재작성 (라이트 값 갱신 + `[data-theme='dark']` 블록, `--radius-pill`→`--radius-control` 반영)
- ✅ `web/src/lib/theme.ts` + `web/src/components/ThemeProvider.tsx` 신규 (설계 문서는 `lib/theme.tsx` 단일 파일로 적었으나, JSX 없는 순수 로직/Context 분리 원칙(structure.md)에 맞춰 두 파일로 나눔 — implemented.md 참조)
- ✅ `web/src/lib/theme.test.ts` 단위 테스트 (4개)
- ✅ `web/src/lib/chartTheme.ts`에 `getChartSurfaceTheme(theme)` 추가, 기존 라이트 고정 상수(`CHART_BG`/`CHART_TEXT`/`CHART_GRID`)는 참조 제거 후 삭제

## Stage 2 — GNB·티커바
- ✅ `web/src/types.ts` SECTIONS에 `anchor` 필드 추가
- ✅ `web/src/lib/useActiveSection.ts` 신규 (IntersectionObserver 기반 활성 섹션 추적)
- ✅ `web/src/components/Gnb.tsx` / `Gnb.css` 신규
- ✅ `web/src/components/TickerBar.tsx` / `TickerBar.css` 신규(재도입, coinglass 톤)
- ✅ `web/src/App.tsx`: ThemeProvider 래핑, header→Gnb+TickerBar 교체, useActiveSection 연결
- ✅ `web/src/App.css`: `.app-header*` 삭제

## Stage 3 — 컴포넌트 리스킨
- ✅ `web/src/components/Home.tsx`: 섹션에 anchor id 부여
- ✅ `web/src/components/IndicatorCard.css`: surface 배경·8px·accent hover, 변동 텍스트 font-weight 600
- ✅ `web/src/components/Detail.css`: pill 8px·accent active
- ✅ `web/src/components/Modal.css`: 8px radius
- ✅ `web/src/components/PriceChart.tsx`, `FlowsChart.tsx`: useTheme 구독 + getChartSurfaceTheme 적용 (크로스헤어 툴팁 인라인 색상 포함)

## Stage 4 — 검증
- ✅ `npx tsc -b` + `npx vitest run`(45/45, 신규 theme.test.ts 4개 포함) + `npm run build` 전부 통과
- ✅ 로컬 dev 서버 + claude-in-chrome 실브라우저 검증: 라이트/다크 각각 GNB 탭 클릭→스크롤+활성탭 갱신, 티커바 실데이터 렌더, 카드 hover, 상세 모달(캔들+MA+기간선택+크로스헤어), 데이터 잉크 색상 라이트/다크 동일(zoom 스크린샷 대조) 확인
- ✅ 640px 반응형은 실브라우저 리사이즈 도구가 이번 세션에서도 반영되지 않아(Stage 3 때와 동일한 툴링 한계 — implemented.md 참조), `Gnb.css`/`Home.css`의 `@media (max-width: 640px)` 코드 리뷰로 대체 확인
- ✅ `docs/specs/coinglass-redesign/implemented.md` 작성
