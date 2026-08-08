# Tasks — home-two-column

- ✅ T1. types.ts: `HomeBlockGroup`·`HomeBlock`·`HOME_BLOCKS` 추가, `SECTIONS`·`HomeSection`·`HomeSubsection` 삭제
- ✅ T2. types.test.ts: HOME_BLOCKS 전수(21개·중복 없음·순서) 검증으로 개편
- ✅ T3. IndicatorTable.tsx: blocks prop·h2 승격·5열(기준일 삭제)·상세 아이콘만·COLUMN_COUNT 5
- ✅ T4. IndicatorTable.css: itable-grid(1000px 2단)·block-title 룰·유동 스파크·이름 줄바꿈·기준일/섹션th 룰 삭제
- ✅ T5. Home.tsx: HOME_BLOCKS 전달·sr-only h1
- ✅ T6. format.ts: formatDate 삭제(+format.test.ts 해당 블록)
- ✅ T7. IndicatorTable.test.tsx: 블록 렌더·앵커·기준일 부재·소그룹·스켈레톤 colSpan 검증으로 개편
- ✅ T8. About.tsx: SECTIONS 주석·기준일 문장 갱신
- ✅ T9. steering design.md: 레이아웃 절·subsections 참조 절 갱신
- ✅ T10. tsc -b + vitest 전체 통과
- ✅ T11. 브라우저 실측: 2단 배치·반폭 최장 조합·라이트/다크 (1000px 미만 1단은 결정적 media query — 창 축소 불가로 실측 생략, implemented.md)

의존: T1→(T2·T3·T5), T3→(T4·T7), 전부→T10→T11
