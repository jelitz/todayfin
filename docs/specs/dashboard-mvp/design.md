# Design — dashboard-mvp

## 아키텍처

```
[collect-and-deploy.yml — cron 2회/일 + workflow_dispatch]
  ├─ 장전: 10 23 * * 0-5 (UTC) = KST 월~토 08:10 → --profile preopen
  └─ 장후: 40 9 * * 1-5 (UTC) = KST 평일 18:40 → --profile afterclose
  잡 1개 안에서: 수집 → 검증 → data/ 커밋(감사 이력) → web 빌드 → actions/deploy-pages
  ※ GITHUB_TOKEN 커밋은 워크플로우를 트리거하지 않으므로 push 트리거 배포에 의존하지 않는다

[deploy.yml — main push] 코드 변경 시 빌드·배포 (data는 repo 최신 커밋 사용)

[브라우저] 홈: summary.json → 상세: data/{id}.json 지연 로드
```

## 수집 시퀀스 (collect.py)

1. `--profile {preopen|afterclose|all}` 파싱 → 프로필별 지표 목록 선택
2. 지표별 어댑터 `fetch(start, end)` 호출 — start = 기존 데이터 마지막 날짜 − 5영업일 (잠정→확정 갱신), 기존 데이터 없으면 백필 시작일
3. 응답 DataFrame을 `pipeline/.staging/{id}.json`으로 직렬화
4. `validate.py`: 스키마 필드 → OHLC 불변식(low ≤ open/close ≤ high) → 날짜 단조 증가 → 전일 대비 ±30% 이상 변동 시 이상치 경고 → 실패 시 해당 지표 skip(기존 유지)
5. 통과 시 기존 `data/{id}.json`과 날짜 키 기준 병합(신규가 우선) → 원자적 교체(임시 파일 write 후 `os.replace`)
6. 전 지표 처리 후 `summary.json`(최근 3개월 슬라이스+최신값·전일 대비), `meta.json`(소스별 상태) 재생성
7. 종료 코드: 스테일 지표(3영업일+, 휴장 제외) 존재 시 exit 1

재시도: 소스당 2회(지수 백오프 5s/15s), 타임아웃 20s. 부분 실패 허용 — 한 소스 실패가 다른 지표를 막지 않는다.

## 소스 어댑터 인터페이스

```python
# pipeline/sources/{name}.py
def fetch(indicator_id: str, start: date, end: date) -> pd.DataFrame:
    """반환: date(index, 오름차순) + 지표별 컬럼. 실패 시 예외 raise (빈 DF 반환 금지)."""
```

| 어댑터 | 담당 지표 | 방식 |
|--------|----------|------|
| naver.py | investor_kospi/kosdaq | `investorDealTrendDay` HTML 표 파싱 (bizdate·sosok·page), UA 헤더 |
| fdr_source.py | kospi, kosdaq, samsung, skhynix | `fdr.DataReader` |
| stooq.py | usdkrw, usdjpy, wti(cl.f), (후보 ust10y=10usy.b) | `https://stooq.com/q/d/l/?s={sym}&i=d` CSV |
| treasury.py | (후보 ust10y) | 재무부 Daily Par Yield CSV |
| ecos.py | ktb3y | ECOS Open API (통계표 817Y002 계열 — Stage 1 확정) |
| fred.py | ust10y 보정 | FRED API DGS10 (선택) |

## 데이터 스키마

`data/{id}.json`:
```json
{ "id": "kospi", "name": "코스피", "type": "ohlcv", "unit": "pt",
  "source": "fdr:KS11", "instrument": "KRX KOSPI index, daily close",
  "timezone": "Asia/Seoul", "frequency": "daily",
  "observed_last": "2026-08-01", "retrieved_at": "2026-08-01T09:45:00Z",
  "series": [["2026-08-01", 2650.1, 2661.0, 2640.2, 2655.3, 450000000]] }
```
- `type`: `ohlcv`(o,h,l,c,v) | `line`(값 1개) | `flows`(+`columns` 배열, 억원)
- `summary.json`: `{ "generated_at": ..., "indicators": [{ id, name, unit, latest, prev, change_pct, observed_last, stale, spark: [최근 3개월 종가/값] }] }`
- `meta.json`: `{ "runs": [{profile, started_at, results: {id: "ok|failed|stale"}}] }` 최근 10회

## 프론트 구조

```
web/src/
├── main.tsx / App.tsx        # 해시 라우터 (#/ 홈, #/i/{id} 상세)
├── components/
│   ├── Home.tsx              # 4섹션 카드 그리드
│   ├── IndicatorCard.tsx     # 값·등락·스파크라인(SVG)·기준일
│   ├── Detail.tsx            # 풀 차트 + 컨트롤
│   ├── PriceChart.tsx        # Lightweight Charts 래퍼 (캔들/라인 + MA)
│   └── FlowsChart.tsx        # 수급 막대 (+주간 집계·4주MA 모드)
├── lib/
│   ├── ma.ts                 # sma(values, n) — 순수 함수
│   ├── weekly.ts             # 일별 → ISO 주간 합산
│   └── format.ts             # 억원/조 단위, %, tabular
└── styles/tokens.css         # steering/design.md 토큰
```

## 에러·스테일 UX

- fetch 실패: 카드에 "데이터를 불러오지 못했습니다" + 재시도 버튼
- stale: 값 옆에 회색 배지 "○일 전 데이터" (meta 기반)
- 빈 상태(백필 전): 스켈레톤 카드

## 테스트

- pipeline: `validate.py` 단위 테스트(불변식·이상치), 어댑터는 저장된 fixture 응답으로 파싱 테스트
- web: `lib/` 순수 함수 단위 테스트 (vitest)
- E2E 검증은 requirements.md 검증 계획 참조
