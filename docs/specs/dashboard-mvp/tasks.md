# Tasks — dashboard-mvp

## Stage 0 — 초기화 + 데이터 권리 게이트
- ✅ git init, 디렉터리 골격, .gitignore, README
- ✅ steering 문서 4종 (product/tech/structure/design + Ollama 원문)
- ✅ specs 문서 (requirements/design/tasks/implemented)
- ✅ docs/data-rights.md 초안
- ✅ GitHub public repo 생성·push (https://github.com/jelitz/todayfin)
- ⬜ 사용자: ECOS 키(필수)·FRED 키(권장)·KRX Open API 인증키(대기용) 신청

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
- ⬜ Vite+React+TS 스캐폴드, 디자인 토큰 CSS
- ⬜ lib/ (ma·weekly·format) + 단위 테스트
- ⬜ 홈: 4섹션 카드 그리드 + 스파크라인 (summary.json)
- ⬜ 상세: PriceChart/FlowsChart + MA 토글·기간 프리셋·크로스헤어
- ⬜ 해시 라우팅, stale·에러·스켈레톤 상태
- ⬜ 반응형(1280/850/640), OG 메타·파비콘·면책 푸터
- ⬜ 브라우저 검증 (차트 값 스팟체크·모바일)

## Stage 4 — 자동화·운영 경화
- ⬜ collect-and-deploy.yml (cron 2개 + dispatch, 잡 내 빌드·배포, concurrency)
- ⬜ deploy.yml (main push)
- ⬜ Secrets 등록 (ECOS_API_KEY, FRED_API_KEY)
- ⬜ workflow_dispatch 일괄 검증 → 익일 크론 관찰
- ⬜ 스테일 3영업일 실패 승격 동작 확인

## 2단계 (범위 외 백로그)
- ⬜ 기준일 선택 누적수익률 비교 (롱숏 상대강도)
- ⬜ KRX Open API 전환 (승인+허용 범위 확인 시)
- ⬜ ECOS 매매기준율 별도 지표, 수급 세부 주체(연기금 등), 알림, 커스텀 도메인
