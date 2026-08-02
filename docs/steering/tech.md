# Tech — todayfin

## 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 수집 | Python 3.12, requests, pandas, finance-datareader | Windows 개발 — 모든 파일 I/O `encoding="utf-8"` 명시 |
| 프론트 | Vite + React + TypeScript | 정적 빌드 |
| 차트 | TradingView Lightweight Charts | 캔들·MA 오버레이·크로스헤어 |
| 폰트 | Pretendard Variable (OFL) | 수치는 tabular-nums |
| 자동화 | GitHub Actions cron 2회/일 | 장전 `10 23 * * 0-5`, 장후 `40 9 * * 1-5` (UTC) |
| 호스팅 | GitHub Pages (public repo) | actions/deploy-pages로 잡 내 직접 배포 |
| 저장 | repo 내 JSON (`data/`) | DB 없음. 도입 기준: 지표 30개+ 또는 일중 데이터 필요 시 재검토 |

## 아키텍처 제약 (위반 금지)

1. **GITHUB_TOKEN 커밋은 후속 워크플로우를 트리거하지 않는다** (GitHub 재귀 방지). 배포는 수집 잡 내부에서 `actions/deploy-pages`로 완결한다. push 트리거 배포는 코드 변경용 `deploy.yml`에만 사용.
2. **비동등 소스 폴백 금지**: 지표 정의가 동일한 소스 간에만 폴백. 선물↔현물, 시장환율↔매매기준율 병합 금지. 폴백 불가 시 stale 표시 + 기존 데이터 유지.
3. **원자적 갱신**: 소스 응답은 스테이징(`pipeline/.staging/`)에 적재 → 검증 통과 시에만 `data/` 교체. 실패 응답이 정상 데이터를 덮어쓰지 않는다.
4. **API 키는 GitHub Secrets / 로컬 `.env`로만** — 코드·커밋에 포함 금지.

## 데이터 소스 (2026-08 검증)

| 지표 | 1순위 | 동일-정의 폴백 | 키 |
|------|-------|---------------|-----|
| 수급(외인/주체별) | 네이버 investorDealTrendDay | pykrx(로컬 수동) | 불필요 |
| 코스피/코스닥/삼전/하이닉스 | FinanceDataReader | 네이버 시세 | 불필요 |
| USD/KRW, USD/JPY | Stooq | yfinance | 불필요 |
| 미국채 10년 | 재무부 CSV vs Stooq (Stage 1 확정) | FRED DGS10(보정) | FRED만 필요 |
| 국고채 3년 | ECOS Open API | 없음(stale) | ECOS 필수 |
| WTI 최근월 선물 | Stooq cl.f | yfinance CL=F | 불필요 |

배경: KRX 정보데이터시스템 2026-02 로그인 필수화(pykrx 클라우드 부적합), yfinance 클라우드 IP 429 빈발, FDR 0.9.110+ GitHub 캐시 전환. 상세·근거 링크는 `docs/data-rights.md`.

## 운영

- cron은 정시 보장이 없다(정각 회피 오프셋 적용). public repo는 60일 무활동 시 cron 자동 비활성화 — 데이터 커밋이 활동을 만들므로 실질 위험 낮음.
- 지표가 마지막 정상 관측일보다 3영업일 이상 늦으면 워크플로우 실패로 승격(Actions 알림).
- 휴장일은 "새 데이터 없음 = 정상 no-op". 캘린더 도입은 오판 사례 발생 시.
- 서드파티 GitHub Actions는 SHA pin, workflow 권한 최소화.
