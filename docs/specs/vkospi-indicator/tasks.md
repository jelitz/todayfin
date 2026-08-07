# Tasks — vkospi-indicator

설계는 [`design.md`](design.md) 참조.

- ✅ T1. `pipeline/sources/krx.py`: `fetch()`를 공용 일자 루프로 재구성(+백필 스로틀, `import time`), drvprod 분기·`_drvprod_row`(공백 무시 매칭, 빈 CLSPRC_IDX → None) 추가
- ✅ T2. pytest — drvprod 파싱: 정상 매칭(공백 표기), 공백 변형, 빈 CLSPRC_IDX 방어, 대상 행 부재, `fetch("vkospi")` DataFrame 계약 (의존: T1)
- ✅ T3. `pipeline/indicators.py`: vkospi 등록(line·afterclose·폴백 없음·market_hours 제외) (의존: T1)
- ✅ T4. `web/src/types.ts`: SECTIONS에 "변동성·리스크" 섹션 추가(시장 가격·추세 뒤)
- ✅ T5. `web/src/components/About.tsx`: items에 `sourceUrl`/`sourceLabel` 선택 필드 + 렌더, "변동성·리스크" 그룹·VKOSPI 항목 추가, "지표 12개" 하드코딩 카피 수정
- ✅ T6. 문서: `docs/data-rights.md` KRX 행에 drvprod 추가, `docs/steering/tech.md` 소스 매트릭스 VKOSPI 행
- ✅ T7. Actions workflow_dispatch(afterclose)로 5년 백필 실행 → `data/vkospi.json` 생성·이력·status ok 검증 (의존: T1~T3 푸시)
- ✅ T8. 브라우저 검증: 홈 노출·상세 차트·티커 포함, 라이트/다크 (의존: T4·T5·T7)
