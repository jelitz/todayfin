# Tasks — home-table-view

설계는 [`design.md`](design.md) 참조.

- ⬜ T1. `web/src/components/Sparkline.tsx` 신규 — IndicatorCard 내부 함수 승격 이동(로직 무변경)
- ⬜ T2. `web/src/components/IndicatorTable.tsx` + `IndicatorTable.css` — colgroup/thead/섹션별 tbody 구조, 지표 행(null 가드·등락 분기·상세 앵커·행 클릭), 스켈레톤 행 (의존: T1)
- ⬜ T3. `Home.tsx`를 IndicatorTable로 교체, `IndicatorCard.tsx`/`IndicatorCard.css` 삭제, `Home.css`에서 그리드·섹션 제목 스타일 삭제(`.home`/`.home-intro`/`.home-error*` 유지) (의존: T2)
- ⬜ T4. vitest(renderToStaticMarkup) — 등락 표시 분기·상세 앵커 href·스켈레톤 행 수 (의존: T2)
- ⬜ T5. 브라우저 검증: 1440×900 한 화면, 390px 가로 스크롤 없음, 다크모드, 행 클릭→모달, 키보드 진입 (의존: T3)
- ⬜ T6. `docs/steering/design.md` 레이아웃 절을 테이블 기준으로 갱신 (의존: T5)
