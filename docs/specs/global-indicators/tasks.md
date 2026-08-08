# Tasks — global-indicators

> 구현 순서: chart-usability 완료 후 진행(PriceChart precision prop은 chart-usability T3에서 생성됨).

- ✅ T1. `sources/yfinance_source.py` ohlcv 확장(dropna·dedup·volume fillna(0) float 유지·round) + `tests/test_yfinance.py` 신규
- ✅ T2. `indicators.py` 7종 등록(instrument·module 포함) + `PROFILES["market_hours"]`에 4종 추가
- ✅ T3. 프론트 상수·포맷: types.ts SECTIONS 재편, format.ts USD/USD/oz(+헤더용 포맷), realtime.ts 4종 추가 + SECTIONS 단언 테스트 신규·format 테스트 추가
- ✅ T4. Detail unit→precision 매핑·헤더 포맷 교체, About 7종 항목·데이터 문단, index.html 메타, TickerBar 주석
- ✅ T5. pytest(57)·vitest(88) 전체 + `tsc -b && vite build` + 로컬 end-to-end 스모크(7종 실수집 ok)
- ⬜ T6. 커밋·푸시 → workflow_dispatch(profile=all) 백필 → run 로그·data/*.json 확인 (run 중 main 푸시 금지)
- ⬜ T7. 배포 사이트 실측: 테이블 21행·티커·상세(캔들/라인·4자리)·라이트/다크
- ✅ T8. 문서 갱신: tech.md·steering design.md·data-rights.md·implemented.md
