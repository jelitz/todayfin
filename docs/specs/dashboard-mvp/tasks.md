# Tasks — dashboard-mvp

## Stage 0 — 초기화 + 데이터 권리 게이트
- ✅ git init, 디렉터리 골격, .gitignore, README
- ✅ steering 문서 4종 (product/tech/structure/design + Ollama 원문)
- ✅ specs 문서 (requirements/design/tasks/implemented)
- ✅ docs/data-rights.md 초안
- ✅ GitHub public repo 생성·push (https://github.com/jelitz/todayfin)
- ✅ 사용자: ECOS 키(2026-08-03 등록·검증 완료)·FRED 키(등록 완료) 신청
- 🔶 사용자: KRX Open API 인증키 발급 완료(2026-08-03) — 코스피/코스닥 지수·유가증권
  일별매매정보 3개 API 활용신청·승인 대기 중 (`pipeline/sources/krx.py` 구현 완료,
  미승인 시 자동 FDR 폴백)

## Stage 1 — 클라우드 워킹 스켈레톤 + 소스 스파이크
- ✅ 소스별 최소 fetch 스크립트 (pipeline/spike.py: naver/fdr/stooq/yfinance/treasury/ecos)
- ✅ GitHub Actions 러너에서 실행 — 해외 IP 접근·포맷·지연 기록 (spike.yml, run 30755054154)
- ✅ 미국채 10년: 재무부 CSV 채택 확정 (Stooq는 완전 폐기로 비교 불가, 단독 채택)
- ⬜ ECOS 통계표·항목 코드·단위·발표시각 확정 — **ECOS_API_KEY 필요 (사용자 액션 대기)**
- ✅ 네이버 sosok 값·컬럼 확정 (`''`/`'01'`=코스피, `'02'`=코스닥)
- ✅ synthetic JSON으로 actions/deploy-pages 관통 검증 완료 (https://jelitz.github.io/todayfin/, GITHUB_TOKEN 재트리거 없음도 실측 확인)
- ✅ 결과를 requirements.md R1·design.md·tech.md·implemented.md에 반영

## Stage 2 — 수집 파이프라인
- ✅ 어댑터 정규화 (naver/fdr_source/yfinance_source/treasury/ecos/fred, fetch(id,start,end) 통일)
- ✅ validate.py (스키마·OHLC 불변식·날짜 단조·이상치) — 단위 테스트 12개 통과
- ✅ collect.py (프로필 분기·재시도·스테이징·원자적 교체·meta/summary, stale 3영업일 실패 승격)
- ✅ 최근 3개월(90일) 수집으로 파이프라인 검증 (2회 연속 실행 — 중복 0건, 날짜 정렬 정상)
- ✅ 5년 백필 실행 → data/ 완성 (2021-08~2026-08, ktb3y 제외 10개 지표, 12,420 데이터 포인트. FRED_API_KEY는 사용자가 Secrets 등록 완료, ECOS·KRX는 신청 대기)
- ✅ validate.py 단위 테스트 (pipeline/tests/test_validate.py, 15 passed — summary 대표값 버그 회귀 테스트 포함)
- ✅ summary.json 대표값 인덱싱 버그 수정 (OHLCV가 종가 대신 거래량을 표시하던 문제)

## Stage 3 — 프론트 대시보드
- ✅ Vite+React19+TS 스캐폴드, 디자인 토큰 CSS(styles/tokens.css), Pretendard Variable
- ✅ lib/ (ma·weekly·format·stale·chartTheme) + 단위 테스트 37개 통과
- ✅ 홈: 4섹션 카드 그리드 + 스파크라인 (summary.json 1회 fetch)
- ✅ 상세: PriceChart(캔들+거래량+MA)/FlowsChart(막대+주간4주MA) + MA 토글·기간 프리셋(3M/6M/1Y/3Y/5Y)·크로스헤어 툴팁
- ✅ 해시 라우팅(#/i/{id}), stale·에러·로딩 상태, ErrorBoundary
- ✅ 반응형(1280/850/640 — CSS 미디어쿼리로 확인, 브라우저 리사이즈 시각 검증은 툴 제약으로 미실시), OG 메타·면책 푸터
- ✅ Workflow(9 에이전트: 구현 5 + 통합 1 + 리뷰 3)로 구현 후 실제 브라우저(claude-in-chrome)로 검증
  - 리뷰에서 발견된 실제 버그 다수 수정: usdkrw/usdjpy MA 토글 누락, samsung/skhynix 거래량 누락, MA 색상 인덱스 불일치, 크로스헤어 툴팁 미구현, MA가 표시기간으로 잘려 워밍업 부족, stale 판정 로직 이원화, decodeURIComponent 무방비
  - 브라우저 검증 중 추가 발견·수정: 크로스헤어 툴팁 z-index 누락으로 실제 화면에 렌더 안 되던 버그(리뷰에서는 못 잡음 — 실행 결과를 봐야 드러나는 유형)
  - 파비콘은 Vite 기본 favicon.svg 유지(커스텀 파비콘은 2단계)

## Stage 4 — 자동화·운영 경화
- ✅ collect-and-deploy.yml: synthetic → 실제 pipeline/collect.py 실행으로 교체. cron 2개
  (장전 `10 23 * * 0-5`/장후 `40 9 * * 1-5` UTC, github.event.schedule로 프로필 분기) +
  workflow_dispatch(profile 선택 입력). collect 실패는 continue-on-error로 배포를 막지 않되
  마지막 단계에서 job을 실패로 승격(R2 충족)
- ✅ deploy.yml: 실제 `npm ci && npm run build`로 교체(placeholder 대체), data/ 복사
- ✅ Secrets 등록: FRED_API_KEY(사용자 완료). ECOS_API_KEY·KRX Open API 키는 신청 대기 중 —
  등록되는 대로 collect-and-deploy.yml 재실행만 하면 ktb3y 자동 반영
- ✅ workflow_dispatch(profile=all) 실행 → 수집(ktb3y만 예상대로 실패)→커밋→빌드→배포 전 단계
  success 확인(run 30757418378), meta.json에 실행 이력 기록 확인
- ✅ 배포 URL(`https://jelitz.github.io/todayfin/`) 실제 브라우저 검증 — 홈·상세(캔들+거래량+MA+
  크로스헤어) 정상
- ✅ **배포 중 발견·수정한 버그**: `web/vite.config.ts`에 GitHub Pages 서브패스(`/todayfin/`)용
  base 설정이 없어 첫 배포가 흰 화면이었음(asset 경로가 절대경로 `/assets/...`로 생성되어 503).
  `isPreview`로 dev만 `/`, build/preview는 `/todayfin/`로 분기해 수정 — 로컬에서도 실배포와
  동일하게 재현·검증 가능하도록 함
- ⬜ 스테일 3영업일 실패 승격의 실제 발동은 자연 발생 대기(현재는 안전장치가 "skipped"로
  정상 통과함만 확인) — 향후 소스 장애 시 관찰
- ⬜ 익일 이후 장전(KST 08:10)·장후(KST 18:40) cron 자동 실행은 시간 경과가 필요해 미확인
  (워크플로우 자체는 workflow_dispatch로 관통 검증 완료, cron 트리거만 남음)

## 2단계 (범위 외 백로그)
- ⬜ 기준일 선택 누적수익률 비교 (롱숏 상대강도)
- 🔶 KRX Open API 전환 — 코드는 2026-08-03 완료(`pipeline/sources/krx.py`,
  코스피/코스닥/삼전/하이닉스 1순위, FDR 폴백). API별 활용신청 승인 대기 중,
  승인 후 실응답으로 필드명 재검증 필요 (수급은 KRX Open API에 해당 서비스 없어 전환 대상 아님)
- ⬜ ECOS 매매기준율 별도 지표, 수급 세부 주체(연기금 등), 알림, 커스텀 도메인
- ⬜ 헤더 아래 실시간 티커 바 재도입 (2026-08-03 3차 피드백으로 보류 — 코드는 커밋 `a7789d7`에 보존)
