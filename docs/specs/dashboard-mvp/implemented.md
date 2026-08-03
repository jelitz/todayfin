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

## 사용자 피드백 반영 (2026-08-03, MVP 배포 후 1차 리뷰)

1. **데이터 출처 표기 정확화**: `source`(어댑터 식별자, 예 `yfinance:CL=F`)를 그대로 화면에 노출하던 것을 `source_name`(사람이 읽는 원 출처) 필드로 분리. `pipeline/indicators.py`에 지표별 원 출처명을 등록(웹 검색으로 확인: finance.naver.com 자체가 "기본 데이터는 한국거래소(KRX)에서 제공"이라 명시, 네이버 증권은 "네이버페이 증권"으로 리브랜딩됨).
   - naver 경유(수급) → "한국거래소(KRX) · 네이버페이 증권" / fdr(지수·종목) → "한국거래소(KRX)" / yfinance(환율·WTI) → "Yahoo Finance" / treasury → "미국 재무부(U.S. Department of the Treasury)" / fred 폴백 → "세인트루이스 연방준비은행(FRED)" / ecos → "한국은행(ECOS)"
   - `source`(내부 식별자)는 유지 — meta.json 로그·디버깅용. 화면은 `source_name`만 사용.
2. **수급 차트를 막대→3주체 라인**으로 전면 재작성. 개인(회색 `#a3a3a3`)/외국인(파랑 `#0051c7`)/기관(주황 `#f59e0b`) 각각 라인, 범례 표시. 기존 "일별/주간+4주MA" 토글은 "일별/주간집계"로 단순화(4주MA 오버레이는 3주체 각각에 적용하면 라인이 6개가 되어 과밀해지므로 이번 변경에서 제외 — 필요하면 옵션으로 재도입 가능).
3. **카드 클릭 UX**: 페이지 전환(라우팅 이동) 대신 **모달 오버레이**로 전환. 홈 그리드(카드 한눈에 보기 — 사용자가 긍정 평가한 부분)는 배경에 그대로 유지되고, 상세 뷰가 그 위에 팝업으로 뜬다. 좌측/상단 메뉴바 방식은 "여러 지표를 나란히 비교하는 그리드 뷰"와 상충되어 채택하지 않음. 해시 라우팅(`#/i/{id}`)은 유지해 딥링크·새로고침·공유 링크는 그대로 동작. 카드 클릭 가능성 인지 문제는 우측 상단 화살표 아이콘(↗) + hover 시 보더를 `--ink`로 진하게 강조해 개선.
4. **푸터 출처 표기**: 1번과 동일한 명칭으로 통일("한국거래소(KRX), 네이버페이 증권, Yahoo Finance, 미국 재무부, 한국은행(ECOS)").

신규 컴포넌트: `Modal.tsx`(ESC·배경클릭·body 스크롤 잠금). `App.tsx`는 Home을 상시 마운트하고 route가 detail일 때만 Modal 안에 Detail을 추가로 렌더하는 구조로 재구성.

## 사용자 피드백 반영 2차 (2026-08-03, MVP 배포 후 2차 리뷰)

1. **파비콘 교체**: Vite 기본 로고(보라색 추상 이미지, todayfin과 무관)를 흑백 미니멀 상승추세 아이콘(검정 배경 + 흰색 꺾은선 + 끝점)으로 교체.
2. **MA 20/60/120일 통일**: 과거 usdkrw/usdjpy=20/60일, wti=60일, ust10y/ktb3y=MA 없음으로 제각각이던 것을 flows를 제외한 전 지표(ohlcv+line)에 동일하게 통일. `Detail.tsx`의 `OHLCV_MA_PERIODS`/`LINE_MA_PERIODS` 이원 관리를 `MA_PERIODS` 단일 상수 + `maChecked` 단일 state로 리팩토링.
3. **수급 카드 등락 표시 변경**: flows(수급) 지표는 유량 데이터라 전일 대비 %가 오도(부호 반전 시 극단값)하는 문제 확인 — `collect.py`의 `build_summary()`에서 flows 타입은 `change_pct` 대신 `change_abs`(절대 증감액)를 계산하도록 분기. 프론트 `formatChangeAbs()` 신설, `IndicatorCard`·`TickerBar` 모두 타입별로 %와 절대액을 구분 표시.
4. **국고채 3년**: 코드는 이미 완비(indicators.py/ecos.py/프론트 전부)되어 있으나 `ECOS_API_KEY` 미등록으로 데이터 파일 자체가 없어 홈 화면에서 조용히 제외되던 상태였음 — 사용자에게 "이미 구현됨, 키만 등록하면 즉시 표시"로 안내. KOFIA 채권정보센터(금투협) 대안도 조사했으나(API는 살아있음, 200 응답) 정확한 POST 파라미터 재현에 추가 검증이 필요해 이번엔 보류 — 잘못된 데이터를 보여줄 리스크가 ECOS 대기보다 크다고 판단.
5. **미국채 2년·30년 추가**: 이미 쓰고 있던 미 재무부 CSV에 `2 Yr`·`30 Yr` 컬럼이 함께 있음을 실응답으로 확인(`treasury.py`의 컬럼 매칭을 indicator_id 파라미터화). `fred.py`도 series_id를 DGS2/DGS10/DGS30으로 매핑해 동일-정의 폴백 유지. 5년 백필 신규 실행, 값 검증(2년 4.28% < 10년 4.75% < 30년 5.27% — 정상 우상향 수익률 곡선).
6. **상단 실시간 티커 바**: `TickerBar.tsx` 신설 — 헤더 바로 아래 얇은 바에 전 지표를 CSS `@keyframes`로 우→좌 무한 스크롤(두 벌 복제 + `translateX(-50%)`). 실시간이 아니므로 좌측에 데이터 기준 시각(KST) 고정 표시, hover 시 정지, `prefers-reduced-motion` 대응, 클릭 시 카드와 동일하게 모달 오픈.

공용 리팩토링: `App.tsx`에 중복 정의됐던 KST 시각 포맷터를 `lib/format.ts`의 `formatDateTimeKST()`로 이동해 `TickerBar`와 공유.

## 사용자 피드백 반영 3차 (2026-08-03, MVP 배포 후 3차 리뷰)

1. **티커 바 제거(보류)**: 2차 피드백에서 만든 `TickerBar.tsx`/`TickerBar.css`를 "나중에 추가"하기로 해 `App.tsx`의 렌더링·임포트를 제거하고 컴포넌트 파일 자체를 삭제. 코드는 커밋 `a7789d7`(2차 반영) 히스토리에 남아 있어 필요 시 `git show a7789d7:web/src/components/TickerBar.tsx` 등으로 복원 가능. 재도입 시점은 2단계 로드맵으로 재분류(`requirements.md` 정책 노트 참고).
2. **헤더 배경 구분**: `.app-header` 배경을 `--canvas`(흰색)에서 `--surface-dark`(`#171717`)로 변경, 로고·갱신시각 텍스트는 `--on-dark`/`--on-dark-mute`로 대비 확보. 디자인 원칙(R"UI 크롬은 흑백·회색만")과 "다크 표면 미사용" 원칙이 상충될 수 있어, 원본 Ollama 디자인 문서(`design-ollama-original.md`)에 이미 문서화된 `surface-dark`/`on-dark` 역색 표면 패턴(원문에서는 최상위 가격표 카드 1곳에 한정 사용)을 그대로 차용 — 전면 다크모드가 아니라 헤더 한 곳에 한정된 예외로, "색은 데이터 잉크에만" 원칙은 유지(사용한 색이 흑백 스케일 내의 짙은 회색이지 유채색이 아님).
3. **푸터 제작자·문의 정보**: "제작: jelitz · GitHub(`https://github.com/jelitz`) · 문의: `info@jelitz.com`" 한 줄 추가. GitHub 링크는 리포지토리가 아닌 프로필 링크로 연결(제작자 식별이 목적).
4. **홈 상단 소개 문구**: 헤더와 "수급" 섹션 사이에 알상무 콘텐츠 기획 의도(기준 없는 판단에 대한 갈증, 기관 투자자 수준 노하우 전달, 루틴한 지표 확인 습관)를 3문장으로 요약해 노출. 사용자가 제공한 원문(유튜브 타임스탬프 포함 장문)을 그대로 옮기지 않고 "종목 추천이 아니라 데이터 기반 판단력을 기르는 것이 목표"라는 핵심만 재작성.

토큰 추가: `web/src/styles/tokens.css`·`docs/steering/design.md`에 `--surface-dark`/`--on-dark`/`--on-dark-mute` 반영.

## KRX Open API 전환 (2026-08-03)

사용자가 KRX Open API 인증키를 발급받아 `KRX_API_KEY` GitHub Secret으로 등록. 코스피/코스닥/삼전/하이닉스(FDR 소스)를 공식 API로 전환하기 위해 `pipeline/spike.py`에 실제 GitHub Actions 러너에서 지수(`idx/kospi_dd_trd`, `idx/kosdaq_dd_trd`)·종목(`sto/stk_bydd_trd`) 4개 엔드포인트를 호출하는 스파이크를 추가해 실행(run `30780108505`).

**결과**: 4개 API 전부 `401 {"respMsg": "Unauthorized API Call"}`. 원인은 KRX Open API 특유의 2단계 인증 구조 — 인증키(AUTH_KEY) 발급과 개별 API 서비스 이용은 별개이며, API마다 "활용신청 → 관리자 승인" 절차가 추가로 필요하다(공식 이용방법 안내: 로그인/인증키 신청 → 서비스 목록 검색 → **API 활용 신청** → 승인 후 서비스 개시). 사용자에게 확인한 결과 인증키 발급만 완료된 상태, 개별 API 활용신청은 아직 — 코드·설정 문제가 아니라 승인 절차 대기.

**설계 결정**: 승인을 기다리지 않고 코드를 먼저 완성 — `collect_one()`이 1차 소스 실패 시 `fallback_module`로 자동 전환하는 기존 폴백 구조(`ust2y`/`ust10y`/`ust30y`의 treasury→FRED 패턴과 동일)를 그대로 활용하면, 미승인 상태에서도 매 수집마다 KRX 401 실패 → FDR 폴백으로 안전하게 동작하고, 승인이 완료되는 순간 코드 변경 없이 자동으로 KRX가 우선 사용되기 시작한다. 그래서 `pipeline/sources/krx.py`를 신규 작성하고 `indicators.py`에서 kospi/kosdaq/samsung/skhynix의 `module`을 `krx`로, 기존 `fdr_source`는 `fallback_module`로 재배치했다(데이터 권리 우선순위상 공식 API가 FDR보다 안전 — `docs/data-rights.md` 참조).

**미검증 상태 명시**: KRX Open API가 basDd(단일 기준일자) 쿼리 방식이라 `krx.py`는 요청 범위의 영업일마다 반복 호출한다. 응답 필드명(`IDX_NM`/`CLSPRC_IDX`/`TDD_CLSPRC` 등)과 코스피 지수의 정확한 `IDX_NM` 값("코스피")은 401이라 실응답으로 확인하지 못했고, 공식 문서·커뮤니티 예제(블로그·오픈소스 CLI) 교차 확인만 거친 상태다. 승인 후 반드시 실응답으로 재검증 필요 — 필드명이 틀리면 `KeyError`로 예외가 발생해 자동으로 FDR 폴백되므로 운영 중단 리스크는 없다.

**전환 대상에서 제외**: 수급(`investor_kospi`/`investor_kosdaq`)은 KRX Open API 서비스 목록(`openapi.krx.co.kr` 전체 목록 확인)에 투자자별 매매동향 API가 없어 전환 불가 — 계속 네이버 비공식 소스 사용.

**사용자 액션 필요**: openapi.krx.co.kr 로그인 → API 서비스 이용 → "KOSPI 시리즈 일별시세정보"·"KOSDAQ 시리즈 일별시세정보"(지수 카테고리)·"유가증권 일별매매정보"(주식 카테고리) 3개 API 각각 활용신청. 승인은 한국거래소 관리자 처리이므로 소요 시간 예측 불가.

**승인 완료 및 재검증 (같은 날, 수 시간 뒤)**: 사용자가 3개 API 활용신청·승인을 모두 완료. `workflow_dispatch(profile=afterclose)` 재실행(run `30780627544`)으로 4개 지표 전부 `status: ok`(폴백 없이 KRX 직접 성공) 확인 — 위 "미검증 상태" 필드명 추정이 실제로 맞아떨어졌다.

재검증 중 **날짜 형식 버그**를 발견: `krx.py`가 API 쿼리 파라미터인 `basDd`(YYYYMMDD, 하이픈 없음)를 그대로 시계열의 `date` 필드에 저장해, 배포된 `data/kospi.json` 등에서 `observed_last`가 `"20260731"`로 저장되고 있었다(다른 모든 소스는 `"2026-07-31"` ISO 형식). Python 3.12의 `date.fromisoformat()`은 하이픈 없는 형식도 파싱하기 때문에 `collect.py`의 stale 판정 로직은 우연히 깨지지 않았지만, 데이터 일관성 문제이자 프론트엔드 날짜 파싱 리스크였다. `_index_row`/`_stock_row`가 `date` 객체를 받아 `d.isoformat()`으로 저장하도록 수정(API 쿼리용 `bas_dd` 문자열과 분리) — 재실행(run `30780814683`)으로 4개 지표 전부 날짜 형식 정상(`bad_date_rows=0`), `status: ok` 재확인. 브라우저(claude-in-chrome)로 홈 카드·상세(코스피 캔들+MA+크로스헤어, 출처 "한국거래소(KRX)") 렌더링도 확인 완료.

## 남은 미결 질문

- [x] **KRX Open API 승인**: 위 항목 참조. 승인 완료, 실응답 검증 완료(날짜 형식 버그 발견·수정 포함)
- [x] **ECOS 국고채 3년**: 2026-08-03 `ECOS_API_KEY` 등록 후 실응답으로 검증 완료. 통계표 817Y002/항목 010200000 값 자체는 정상(3.7~3.9%대). 단, 첫 실행에서 `StatisticSearch` 조회 구간이 `1~1000`행으로 하드코딩돼 있어 5년 백필(~1250영업일) 중 최신 1년치가 잘려 `observed_last`가 2025-08-28에 고정·stale 승격되는 버그 발견 — `pipeline/sources/ecos.py`의 조회 상한을 3000행으로 상향해 수정, 재실행으로 `observed_last=2026-07-31`(최근 영업일) 정상 확인
- [ ] FDR 종목 데이터의 수정주가 여부 (액면분할 대응 정책) — MVP 진행에 비차단, Stage 2에서 FDR 문서 확인 후 스키마에 명기
- [ ] yfinance 클라우드 안정성은 1회 검증 — Stage 4 자동화 관찰 기간(수일)에 재확인 필요 (알려진 간헐적 429 이력 있음)
