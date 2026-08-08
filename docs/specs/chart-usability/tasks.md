# Tasks — chart-usability

> 구현 순서: 본 스펙이 global-indicators보다 선행(PriceChart를 양쪽에서 수정하므로 기반 공사 먼저).

- ✅ T1. `lib/flows.ts` 신규(toCumulative·cumulativeSummary) + `lib/flows.test.ts`
- ✅ T2. `lib/chartRange.ts` 신규(기간→범위 계산·복원 스냅 보정 순수 함수) + 테스트 — PriceChart/FlowsChart 공용
- ✅ T3. PriceChart 개편: 전체 rows·period prop·precision prop·범위 관리(effect A/B·가드·구독)·vertTouchDrag:false·fitContent 제거·fullRows 삭제
- ✅ T4. FlowsChart 개편: 범위 관리 적용 + 누적 모드(주체 토글·4주 SMA·요약·툴팁 규칙·flex-wrap)
- ✅ T5. Detail 개편: filterByDays 제거·period seq·MA 타입별 초기값(fetch 콜백)·flowsMode 3모드·헤더 등락(R6)
- ✅ T6. vitest 전체 + `tsc -b && vite build` — 88 passed
- ✅ T7. 브라우저 실측(휠 줌·범위 유지·누적 모드·라이트/다크) — 모바일 뷰포트는 창 최대화 제약으로 생략(implemented.md 기록)
- ✅ T8. implemented.md 작성·steering design.md 차트 규칙 갱신
