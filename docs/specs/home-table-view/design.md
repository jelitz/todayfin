# Design — home-table-view

요구사항은 [`requirements.md`](requirements.md) 참조. 데이터·라우팅·모달은 전부 무변경 — `summary.json → SECTIONS 순회 → 행 렌더 → onSelect(id)`라는 기존 데이터 흐름에서 **렌더 계층만 카드 그리드에서 테이블로 교체**한다.

## 컴포넌트 구조

```
Home.tsx                    (SECTIONS 순회 유지, IndicatorGrid → IndicatorTable로 교체)
└─ IndicatorTable.tsx       (신규 — 섹션 1개분의 테이블. 소그룹은 그룹 헤더 행)
   ├─ IndicatorRow          (내부 컴포넌트 — 지표 1행)
   └─ Sparkline.tsx         (신규 파일 — IndicatorCard 내부 함수를 승격·이동)
삭제: IndicatorCard.tsx, IndicatorCard.css, Home.css의 그리드·스켈레톤 카드 스타일
```

섹션마다 별도 `<table>`을 두지 않고 **홈 전체가 하나의 `<table>`** 이다 — 열 정렬(현재값·등락 우측 정렬 등)이 섹션을 가로질러 유지되어야 스캔이 빠르다. 구조는:

- `<colgroup>` + `<col>` 6개 — 열 폭 지정(`table-layout: fixed`와 결합해 로딩 전후 점프 방지)
- `<thead>` — 열 이름 행(지표/현재값/등락/추세/기준일/상세)
- 섹션·소그룹마다 `<tbody>` — 첫 행은 `<th colSpan={6}>` 헤더 행(섹션 제목, `id={anchor}` 보존), 이어서 지표 행들

따라서 `IndicatorTable`은 "섹션 1개분"이 아니라 **SECTIONS 전체를 받아 단일 테이블을 렌더**한다:

```ts
export interface IndicatorTableProps {
  sections: HomeSection[]        // types.ts SECTIONS
  summary: Summary | null        // null이면 스켈레톤 행
  onSelect: (id: string) => void
}
```

`Home.tsx`는 인트로 문단 + `<IndicatorTable sections={SECTIONS} …/>`만 남는다. 기존 `home-section`/`home-subsection` DOM 구조와 `id={anchor}` 속성은 사라지고, anchor는 섹션 헤더 행의 `id`로 이동한다(향후 앵커 링크 여지 보존).

## 열 구성

| 열 | 내용 | 정렬 | 모바일(≤640px) |
|----|------|------|----------------|
| 지표 | `name` + 장중 배지(`isIntraday`) + stale 배지 | 좌 | 유지 |
| 현재값 | `latest === null ? '—' : formatValue(latest, unit)` | 우 | 유지 |
| 등락 | flows→`formatChangeAbs`, 그 외→`formatPct` + ▲▼ + up/down 색 (null·0은 보합 회색) | 우 | 유지 |
| 추세 | `<Sparkline>` (summary `spark` 그대로 = 최근 약 3개월, 100×24px) | 중앙 | **숨김** |
| 기준일 | `formatDate(observed_last ?? '')` muted | 우 | **숨김** |
| 상세 | `↗ 상세` 링크 | 우 | 아이콘만(`↗`) |

- **스파크라인 기간**: summary.json의 `spark`는 최근 약 95일(≈3개월) 시계열이다(collect.py cutoff — 2026-08-08 검증 확인). 카드가 그리던 것과 동일하게 **자르지 않고 그대로** 쓴다. requirements R1의 "30일" 표기는 이 검증에서 "기존 spark 그대로(약 3개월)"로 정정했다.
- null 가드는 기존 IndicatorCard의 규칙을 그대로 계승한다(위 표에 명시). SECTIONS의 id가 summary에 없으면 행을 건너뛴다(기존 Home.tsx filter 동작 유지).
- 등락 분기 로직(flows는 절대액)은 IndicatorCard에서 그대로 옮긴다 — 카드 삭제로 이동이지 복제가 아니다.
- stale 배지("N일 전 데이터")는 지표 열에 넣어 열 수를 늘리지 않는다.
- 행 높이 44px(패딩 포함), `font-variant-numeric: tabular-nums` 유지 — 13행 ≈ 572px + 헤더 행들로 1440×900 한 화면에 수렴(R5).

## 인터랙션·접근성 (R2·R7)

- **상세 어포던스 = 진짜 앵커**: `<a href={"#/i/" + id} className="row-detail-link">↗ 상세</a>`. 키보드 사용자는 Tab→Enter로 진입(앵커의 기본 동작), 스크린리더에는 링크 의미론이 그대로 전달된다. 기존 카드의 `role="button"`+keydown 수동 처리보다 단순하고 견고하다.
- **행 전체 클릭은 편의 동작**: `<tr onClick={() => onSelect(id)}>` + `cursor: pointer`. 앵커 클릭 시 이벤트 버블로 onSelect가 중복 실행되지 않도록 앵커에서 `stopPropagation()`(해시 대입은 앵커 기본 동작이 수행).
- 행 hover: 배경 `--surface` 전환 + 상세 링크 색 강조(`--accent`) — 그림자 금지 원칙 유지.

## 스켈레톤·에러

- `summary === null`: 지표 자리마다 스켈레톤 행(13행, 기존 `home-skeleton-card` 대체). 섹션 헤더는 실데이터 없이도 SECTIONS에서 렌더 가능하므로 그대로 표시.
- 에러 상태는 Home.tsx의 기존 `home-error` 분기 무변경.

## CSS (`IndicatorTable.css`)

- `table-layout: fixed` + 열별 width — 스파크라인·값 열 폭 고정으로 로딩 전후 레이아웃 점프 방지.
- 모바일 열 숨김은 `@media (max-width: 640px)`에서 `display: none`(추세·기준일 열의 th/td).
- 테이블 자체는 `width: 100%`, 부모에 `overflow-x: auto`를 두되 R4 목표는 "가로 스크롤이 필요 없는 열 구성"이고 overflow는 최후 방어선.
- 색·간격은 전부 기존 토큰(`--hairline`, `--ink-muted`, `--up`/`--down` 등) — 신규 색 없음.

## 삭제 목록

- `web/src/components/IndicatorCard.tsx`, `IndicatorCard.css`
- `Home.css`에서 삭제: `.home-grid`, `.home-skeleton-card`, `.home-section`, `.home-section-title`, `.home-subsection`, `.home-subsection-title`(및 브레이크포인트 3열 규칙). **유지**: `.home`, `.home-intro`, `.home-error*` — Home.css를 통째로 지우지 말 것. 섹션 헤더 행 스타일은 `IndicatorTable.css`에 신규 작성.
- IndicatorCard·Home의 기존 자동화 테스트는 **없음**(2026-08-08 검증 확인 — web/src 테스트는 lib 순수 함수 7개뿐) — IndicatorTable 테스트는 신규 작성이다.

## 테스트 전략

컴포넌트 렌더 테스트 도구가 없다(jsdom·@testing-library 미설치). 의존성을 늘리지 않고 **`react-dom/server`의 `renderToStaticMarkup`**(react-dom은 설치돼 있음)으로 HTML 문자열을 검증한다:

| 대상 | 방식 |
|------|------|
| 등락 표시 분기 | vitest + renderToStaticMarkup — flows(change_abs)·일반(change_pct)·null(보합 회색) 행 출력 문자열 확인 |
| 상세 링크 href | vitest — 렌더 결과에 행마다 `#/i/{id}` 앵커 존재 |
| 스켈레톤 | vitest — summary null 시 스켈레톤 행 수 = 지표 수 |
| 레이아웃 | 브라우저 — 1440×900 한 화면, 390px 가로 스크롤 없음, 다크모드, 행 클릭·키보드 진입 |

## 문서 후속

구현 완료 시 `docs/steering/design.md`의 레이아웃 절(카드 그리드 3/2/1열 서술)을 테이블 기준으로 갱신한다 — 전역 디자인 규칙의 실질 변경이므로 steering 갱신 대상.
