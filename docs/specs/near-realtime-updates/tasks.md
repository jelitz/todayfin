# Tasks — near-realtime-updates

## Stage 0 — 스펙·실측
- ✅ 인터뷰(AskUserQuestion 2라운드) + 실측 스파이크(naver/FDR/yfinance 실제 응답 확인)
- ✅ requirements.md / design.md 작성

## Stage 1 — 백엔드
- ✅ `pipeline/sources/naver_realtime.py` 신규(코스피/코스닥/삼성전자/SK하이닉스 실시간 스냅샷)
- ✅ `pipeline/tests/test_naver_realtime.py` 신규(숫자 파싱 단위 테스트 5개)
- ✅ `pipeline/indicators.py`: realtime_module 필드, `PROFILES["market_hours"]`(9개 지표) 추가
- ✅ `pipeline/collect.py`: `collect_one()`에 market_hours 전용 스냅샷 병합 분기 추가, `--profile` choices 확장
- ✅ 실측 검증: 스크래치 데이터 디렉터리로 market_hours 프로필 실행 → 9개 지표 전부 성공, 오늘 날짜 행 정상 병합 확인(수급 잠정치가 실행 간 실제로 변동하는 것도 확인)

## Stage 2 — CI
- ✅ `.github/workflows/collect-and-deploy.yml`: `*/30 0-6 * * 1-5` 크론 추가, workflow_dispatch profile 옵션에 market_hours 추가, "Determine profile" 분기 추가
- ✅ YAML 파싱 검증(로컬 PyYAML)

## Stage 3 — 프론트
- ✅ `web/src/lib/realtime.ts` 신규(REALTIME_ELIGIBLE_IDS, todayKST, isIntraday)
- ✅ `web/src/lib/realtime.test.ts` 신규(7개 테스트)
- ✅ `web/src/App.tsx`: summary 5분 폴링 + `visibilitychange` 대응(탭 숨김 시 중단, 복귀 시 즉시 재조회) + 실패 시 기존 값 유지(ref 기반, stale-closure 버그 직접 발견·수정)
- ✅ `IndicatorCard.tsx`/`.css`: "장중" 배지(펄스 점 + 라벨) 추가
- ✅ `TickerBar.tsx`/`.css`: 항목별 펄스 점 배지 추가

## Stage 4 — 검증
- ✅ `npx tsc -b` + `npx vitest run`(52/52) + `npm run build` 전부 통과
- ✅ `python -m pytest`(pipeline, 20/20) 통과
- ✅ 실브라우저(claude-in-chrome) 검증: market_hours 스냅샷을 로컬 dev 데이터에 반영 후 라이트/다크 모두 "장중" 배지가 대상 9개(정확히는 오늘 날짜가 확보된 8개, WTI는 소스 특성상 예외 — 아래 참조) 카드·티커 항목에만 정확히 표시되고 국채 4종·과거 데이터에는 표시 안 됨을 DOM 조회로 확인
- ✅ `docs/data-rights.md`에 네이버 실시간 시세 소스 항목 추가
- ✅ `docs/specs/near-realtime-updates/implemented.md` 작성
