# Implemented — dashboard-mvp

설계 결정·의도적 편차·트레이드오프·미결 질문 기록. 코드 변경과 함께 갱신한다.

## 설계 결정 (2026-08-03, 플랜 확정 시점)

| 결정 | 이유 |
|------|------|
| WTI = **최근월 선물**(Stooq cl.f), FRED 현물(DCOILWTICO) 폴백 제외 | 알상무 기준이 선물. 선물↔현물은 다른 관측값 — 병합 시 시계열 왜곡 (외부 검토 반영) |
| 환율 = **글로벌 FX 시장환율**(Stooq), ECOS 매매기준율 제외 | 장전 수집으로 간밤 변동을 반영하는 것이 목적. 매매기준율은 2단계 별도 지표 |
| 배포는 수집 잡 내부에서 actions/deploy-pages로 완결 | GITHUB_TOKEN 커밋은 후속 워크플로우를 트리거하지 않음 (GitHub 재귀 방지 규칙) |
| 폴백은 동일-정의 소스만, 불가 시 stale | 데이터 정확성 > 최신성. 조용한 왜곡 방지 |
| 라우팅 해시 기반 (#/i/{id}) | GitHub Pages SPA 404 원천 회피, 404.html 핵 불필요 |
| 수급 소스 = 네이버 (비공식) | KRX 2026-02 로그인 필수화로 공식 무료 자동화 경로 부재. 리스크는 data-rights.md 게이트로 관리 |
| MVP는 비홍보 개인 운영, 대중 공유는 권리 게이트 후 | KRX Open API 약관도 제3자 제공 제한 — "공식 API=공개 적법성" 아님 (외부 검토 반영) |
| MA·주간 집계는 프론트 계산, data/는 원시 일별만 | 파라미터 변경 유연성, 파이프라인 단순화 |
| summary.json 분리 (홈 1회 fetch) | 홈 첫 로드에 5년 전체 로드 방지. 연도별 파티셔닝은 10년+ 시점으로 유보 |
| cron 오프셋 08:10/18:40 (정각 회피) | GitHub cron 정시 보장 없음 + 정각 부하 |
| 다크모드 미구현 | Ollama 원문 원칙(라이트 온리) 준수, 사용자 디자인 지시 |

## Stage 1 스파이크 결과 (2026-08-03, 로컬 + GitHub Actions 러너 양쪽 실행)

| 소스 | 로컬(국내 IP) | Actions(해외 IP) | 판정 |
|------|:---:|:---:|------|
| 네이버 investorDealTrendDay | ✅ | ✅ | 채택 확정. `sosok=''`/`'01'`=코스피, `'02'`=코스닥 (응답 값이 다름을 확인) |
| FDR (KS11/KQ11/005930/000660) | ✅ | ✅ | 채택 확정 |
| **Stooq** (usdkrw/usdjpy/cl.f/10usy.b) | ❌ | ❌ | **완전 폐기.** 2026년 중 도입된 봇 방지(SHA-256 proof-of-work JS 챌린지)로 `.com`/`.pl` 도메인 모두 차단. 헤더·파라미터 우회 불가 확인 |
| **yfinance** (KRW=X, JPY=X, CL=F) | ✅ | ✅ | **1순위로 승격** (원래 폴백이었으나 Stooq 폐기로 대체 필요, 클라우드 실측 정상 확인) |
| 미 재무부 Daily Par Yield CSV | ✅ | ✅ | 채택 확정. `10 Yr` 컬럼 사용, 값 예시 4.75% — Stooq 폐기로 비교 대상 없이 단독 채택 |
| ECOS (국고채 3년) | ⏭️ 스킵 | ⏭️ 스킵 | **미해결 — ECOS_API_KEY 필요 (사용자 액션 대기)** |

### 지표 → 소스 매핑 갱신 (requirements.md·design.md·tech.md 동기화 필요)

| 지표 | 확정 1순위 | 폴백 |
|------|-----------|------|
| usdkrw | yfinance `KRW=X` | — (동일 정의 대체 없음, 실패 시 stale) |
| usdjpy | yfinance `JPY=X` | — |
| wti | yfinance `CL=F` | — |
| ust10y | 미 재무부 Daily Par Yield (10 Yr) | FRED `DGS10` (1영업일 지연 보정용) |

## Pages 배포 스켈레톤 검증 (2026-08-03)

`collect-and-deploy.yml`을 `workflow_dispatch`로 실행해 핵심 아키텍처 가정을 실측 확인:

1. 잡 내부에서 `github-actions[bot]`이 `GITHUB_TOKEN`으로 `data/meta.json`을 커밋·push (커밋 `792b962`)
2. 그 push가 `data/**` 경로를 포함해 `deploy.yml`의 push 트리거 조건과 일치했음에도 **`deploy.yml`은 재실행되지 않음** — GitHub의 GITHUB_TOKEN 재귀 방지 규칙을 실측으로 재확인 (`gh run list --workflow=deploy.yml`에 새 실행 없음)
3. `collect-and-deploy.yml`은 같은 잡 안에서 `actions/deploy-pages`로 직접 배포 완료
4. 배포된 `https://jelitz.github.io/todayfin/data/meta.json`이 방금 커밋된 synthetic 값과 정확히 일치함을 curl로 확인

→ **아키텍처의 "수집 잡 내 직접 배포" 설계가 유효함이 실증됨.** Stage 4에서는 이 워크플로우의 synthetic 수집 단계를 `pipeline/collect.py` 실행으로 교체하고 cron 2개를 추가하기만 하면 된다.

## Stage 2 — 수집 파이프라인 구현 노트 (2026-08-03)

- 어댑터 시그니처를 설계 문서의 `fetch(start, end)`에서 `fetch(indicator_id, start, end)`로 확장. 네이버·FDR·yfinance 어댑터가 여러 지표를 공유 로직(심볼/파라미터 매핑)으로 처리하므로 지표 ID를 넘겨받는 편이 자연스러움. `pipeline/indicators.py` 레지스트리가 지표→모듈 매핑을 담당.
- 원자적 교체는 `pipeline/.staging/{id}.json`에 먼저 쓰고 `os.replace()`로 교체 — 실패 응답이 기존 정상 데이터를 덮어쓰지 않음(요구사항 R2 충족).
- 증분 갱신 시 "최근 5영업일 재수집"을 `last_date - 7일`(주말 여유) vs `backfill_start` 중 더 늦은 날짜로 계산. **주의**: 이미 데이터가 존재하는 상태에서 `--backfill-years`를 늘려도 재백필되지 않는다(증분 로직이 항상 우선) — 의도된 동작이나 로컬 테스트 중 실제로 이 경로를 밟아 "5년 백필"이 실제로는 최근 7일만 재수집되는 것을 확인함. 진짜 재백필이 필요하면 `data/*.json`을 먼저 삭제해야 함(운영에서는 발생하지 않을 시나리오 — 최초 백필 1회뿐).
- Windows 콘솔 한글 깨짐: `collect.py`에 `sys.stdout.reconfigure(encoding="utf-8")` 추가(CLAUDE.md 전역 규칙 준수). 로컬 실행 시 `PYTHONIOENCODING=utf-8`도 함께 권장.
- 스테일 판정(3영업일)은 오늘 프로필에 포함된 지표에서만 워크플로우 실패로 승격 — 아직 백필되지 않은 지표(파일 없음)는 summary에서 제외되어 오탐 없음.

## Stage 2 버그 수정: summary.json 대표값 인덱싱 (2026-08-03)

첫 5년 백필 직후 값 검증 중 발견: `build_summary()`가 모든 지표 타입에 `series[-1][-1]`(행의 마지막 컬럼)을 대표값으로 사용했음. OHLCV 행은 `[date,o,h,l,c,v]`라 마지막 컬럼이 **거래량**이었고(코스피 "최신값"이 4억+로 표시), flows 행은 `[date,individual,foreign,institution]`이라 마지막 컬럼이 **institution**이었음(알상무 기준의 핵심 계열인 foreign이 아님). `_headline_index()` 헬퍼로 컬럼명 기반 조회(ohlcv→close, flows→foreign, line→value)로 수정하고 회귀 테스트 3개 추가. 데이터 정확성이 최우선 원칙이라 프론트 착수 전 발견·수정.

## Stage 3 — 프론트 구현 노트 (2026-08-03)

**진행 방식**: Ultracode 모드에서 Workflow 도구로 병렬 구현(9 에이전트: lib/PriceChart/FlowsChart/Home+Card/Detail 5개 병렬 → 통합 1개 → design/requirements/quality 리뷰 3개 병렬). 빌드(tsc/vite build/vitest)는 전부 통과했으나 리뷰에서 실제 요구사항 위반·버그가 다수 발견되어 직접 수정.

**리뷰에서 발견되어 수정한 것들**:
- usdkrw·usdjpy 상세 뷰에 R1이 요구하는 20/60일 MA 토글이 아예 없었음(wti만 처리하는 조건문) → `LINE_MA_PERIODS` 맵으로 일반화
- samsung·skhynix에 "캔들+거래량"이 요구되나 거래량이 전혀 그려지지 않음 → PriceChart에 `showVolume` prop + 별도 priceScale 오버레이 히스토그램 추가
- MA 라인 색상이 `기간`이 아니라 `배열 인덱스`로 정해져 있어 60일 체크 해제 시 120일선이 다른 색으로 바뀌는 등 범례와 어긋남 → `lib/chartTheme.ts`의 `maColor(period, fallbackIndex)`로 기간→색 고정 매핑
- MA가 "기간 필터링된 표시 구간"만으로 계산되어 3M/6M 선택 시 60/120일선이 워밍업 부족으로 비거나 끊김 → `fullRows`(전체 시계열) prop을 추가로 넘겨 워밍업 계산 후 표시 구간만 슬라이스(날짜 매칭, 위치 매칭 아님)
- 크로스헤어 툴팁(R3 요구)이 옵션만 켜져 있고 실제 구현이 없었음 → `subscribeCrosshairMove`로 날짜·OHLC·거래량·MA값을 보여주는 커스텀 툴팁 구현
- 상세 뷰의 stale 판정이 달력일 7일 근사치를 써서 R2(3영업일)와 어긋남, IndicatorCard와도 로직이 따로 있었음 → `lib/stale.ts`(pipeline/collect.py의 `_is_stale`과 동일한 영업일 계산)로 통일, 단위 테스트로 요일 고정 검증
- `decodeURIComponent`가 try/catch 없이 호출되고 ErrorBoundary가 없어 잘못된 해시로 앱 전체가 흰 화면이 될 수 있었음 → try/catch + `ErrorBoundary` 컴포넌트(라우트 변경 시 key로 리셋) 추가
- PriceChart/FlowsChart의 색상 상수 중복 → `lib/chartTheme.ts`로 공용화

**리뷰를 통과했지만 실제 브라우저 검증에서 발견한 버그**: 크로스헤어 툴팁 div에 `z-index`가 없어 lightweight-charts의 내부 캔버스 레이어에 가려 화면에 전혀 안 보였음(콜백은 정상 호출, `param.point`/`seriesData`도 정상, React state도 정상 — 순수 CSS 스태킹 문제). 이건 정적 코드 리뷰로는 잡히지 않는 유형(런타임에 실제로 렌더링해봐야 보임)이라, **리뷰 자동화가 실제 브라우저 실행 검증을 대체할 수 없다는 근거**로 기록해둔다. `docs-rights.md`나 요구사항 문서 위반이 아니라 순수 렌더링 버그였다.

**브라우저 검증 방법**: `web/public/data/`(gitignore 처리)에 `data/*.json`을 로컬 복사해 Vite dev 서버로 실데이터 확인. 홈 카드 값·등락률·스파크라인, 삼성전자 캔들+거래량+MA 3종+크로스헤어 툴팁, 원/달러 MA 토글, 외국인 순매수 주간+4주MA+툴팁을 스크린샷으로 확인. 브라우저 창 리사이즈 툴이 이 세션에서 반영되지 않아 모바일 반응형은 CSS 미디어쿼리 코드 검토로 대체(디자인 리뷰 에이전트도 브레이크포인트 위반 없음으로 확인).

**배포 시 필요 조치(Stage 4에서 처리)**: 로컬 dev용으로 쓴 `web/public/data/` 복사 방식과 별개로, 실제 배포는 `dist/data/`에 빌드 후 복사하는 방식으로 `deploy.yml`/`collect-and-deploy.yml`을 갱신해야 함(현재 두 워크플로우는 Stage 1 placeholder를 배포하는 상태로 남아있어 Stage 4에서 반드시 갱신).

## Stage 4 — 자동화·배포 구현 노트 (2026-08-03)

**GitHub Pages base 경로 버그**: 첫 실배포(`https://jelitz.github.io/todayfin/`) 확인 시 완전한 흰 화면이었음. 원인은 `web/vite.config.ts`에 `base` 설정이 없어 프로덕션 빌드가 asset을 절대경로(`/assets/...`)로 참조했기 때문 — GitHub Pages 프로젝트 사이트는 리포지토리명 서브패스(`/todayfin/`)에서 서빙되므로 실제로는 `/todayfin/assets/...`여야 함. 로컬 `npm run dev`에서는 base가 항상 `/`라 이 문제가 전혀 재현되지 않았고, **실제 배포에서만 드러난 버그**(Stage 3의 z-index 버그와 같은 종류 — 렌더링/배포 환경 차이는 정적 리뷰·로컬 개발로 못 잡음).

수정: `defineConfig(({ command, isPreview }) => ({ base: command === 'build' || isPreview ? '/todayfin/' : '/' }))`. 함정: `vite preview`도 config 로딩 시 `command`는 `'build'`가 아니라 `'serve'`로 잡힌다(dev와 동일) — `isPreview` 플래그로 별도 구분해야 로컬에서 `npm run preview`로 실배포와 동일한 서브패스 조건을 재현할 수 있다. 이 구분 없이 `command==='build'`만 썼다면 로컬 preview 검증이 여전히 실제 문제를 놓쳤을 것.

**배포 파이프라인 동작 확인**: `workflow_dispatch(profile=all)` 실행(run 30757418378)에서 collect(ktb3y만 실패, 나머지 10개 ok) → commit(`data: all sync ...`) → npm build → Pages 배포 전 단계 성공. "Fail job if collect had errors" 안전장치 스텝은 collect가 outcome=success였으므로 정상적으로 skipped. `deploy.yml`도 코드 push로 정상 트리거·배포됨.

## 남은 미결 질문

- [ ] **ECOS 국고채 3년**: 통계표·항목 코드, 단위, 관측일 규약 — 사용자가 `ECOS_API_KEY`를 GitHub Secrets에 등록하면 즉시 재검증
- [ ] FDR 종목 데이터의 수정주가 여부 (액면분할 대응 정책) — MVP 진행에 비차단, Stage 2에서 FDR 문서 확인 후 스키마에 명기
- [ ] yfinance 클라우드 안정성은 1회 검증 — Stage 4 자동화 관찰 기간(수일)에 재확인 필요 (알려진 간헐적 429 이력 있음)
