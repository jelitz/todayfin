# Structure — todayfin

## 디렉터리

```
todayfin/
├── docs/
│   ├── steering/            # 전역: product · tech · structure · design(+ollama 원문)
│   ├── specs/dashboard-mvp/ # 기능 명세: requirements · design · tasks · implemented
│   └── data-rights.md       # 데이터 소스 권리·공개 수위
├── pipeline/                # Python 수집
│   ├── sources/             # 소스 어댑터 (1소스 1파일)
│   ├── collect.py           # 오케스트레이션 (프로필 분기·검증·원자적 교체)
│   ├── validate.py          # 스키마·불변식 검증
│   └── requirements.txt
├── data/                    # 산출물 JSON (Actions가 커밋) — 손으로 편집 금지
├── web/                     # Vite + React 앱
│   └── src/
│       ├── components/      # 카드·차트·레이아웃
│       ├── lib/             # MA·주간 집계·포맷 유틸 (순수 함수)
│       └── styles/          # 디자인 토큰 CSS
└── .github/workflows/       # collect-and-deploy.yml · deploy.yml
```

## 모듈 경계

- `pipeline/sources/*.py`: 각 어댑터는 `fetch(start, end) -> pd.DataFrame(date, ...columns)` 하나만 노출. 네트워크·파싱은 어댑터 안에 격리, 밖으로는 정규화된 DataFrame만.
- `collect.py`: 어댑터 호출 → `validate.py` 검증 → 스테이징 → 병합 → 원자적 교체 → `meta.json`/`summary.json` 생성. 어댑터 내부 사정을 모름.
- `web/src/lib/`: 시계열 계산(이동평균, 주간 집계, 등락률)은 순수 함수 + 단위 테스트 대상. 컴포넌트는 계산 로직을 갖지 않음.

## 지표 ID (고정 네이밍)

`investor_kospi` · `investor_kosdaq` · `foreign_kospi`(=investor_kospi의 외인 시리즈 파생, 별도 파일 없음) · `kospi` · `kosdaq` · `samsung` · `skhynix` · `usdkrw` · `usdjpy` · `ust10y` · `ktb3y` · `wti`

## 데이터 계약 (`data/`)

- `{id}.json` — 지표별 전체 시계열(5년). 스키마는 `docs/specs/dashboard-mvp/design.md` 참조
- `summary.json` — 전 지표 최근 3개월 압축 + 최신값·전일 대비 (홈 1회 fetch)
- `meta.json` — 소스별 수집 상태·관측 기준일·stale 여부 (프론트 표시 + 스테일 승격 판단)

## 컨벤션

- Python: snake_case, 파일 I/O·print 모두 `encoding="utf-8"` 명시
- TS/React: 컴포넌트 PascalCase, 유틸 camelCase
- 커밋: `feat:`/`fix:`/`docs:`/`chore:`/`data:` prefix (data: 는 Actions 자동 커밋)
- 문서 동기화: 코드 변경 시 `tasks.md`·`implemented.md` 갱신, PR 전 코드·문서 일치 확인
