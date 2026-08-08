# Design — home-two-column

2026-08-08 적대적 검증(3-agent 워크플로우) 반영: 스파크 폭 산술 오류·브레이크포인트 재산정·
h2 승격 스타일·삭제 잔재·영향 범위 누락 수정. 판정 기록은 implemented.md 참조.

## 데이터 모델 (types.ts)

기존 `SECTIONS`(섹션→소그룹 트리)를 **`HOME_BLOCKS: HomeBlock[]`로 대체**한다. 2단 그리드의
auto-placement가 순서대로 좌→우로 채우므로 별도의 "행 페어" 구조 없이 블록 순서만으로
R1의 배치가 성립한다(홀수 개면 마지막 우측 셀이 자연스럽게 여백).

```ts
export interface HomeBlockGroup {
  /** 블록 안에서 소그룹 제목이 필요할 때만 (예: 미국 국채 / 한국 국채) */
  title?: string;
  ids: string[];
}
export interface HomeBlock {
  /** 블록 제목. 같은 섹션이 좌우로 갈리면 "섹션 — 소그룹" 합성 (예: "시장 가격·추세 — 국내") */
  title: string;
  anchor: string;
  groups: HomeBlockGroup[];
}

export const HOME_BLOCKS: HomeBlock[] = [
  { title: "수급", anchor: "section-flows", groups: [{ ids: ["investor_kospi", "investor_kosdaq"] }] },
  { title: "변동성·리스크", anchor: "section-risk", groups: [{ ids: ["vkospi"] }] },
  { title: "시장 가격·추세 — 국내", anchor: "section-price-trend", groups: [{ ids: ["kospi", "kosdaq", "samsung", "skhynix"] }] },
  { title: "시장 가격·추세 — 해외", anchor: "section-price-trend-global", groups: [{ ids: ["nasdaq", "sp500", "dow", "nikkei"] }] },
  { title: "거시·통화 — 환율·달러인덱스", anchor: "section-macro", groups: [{ ids: ["usdkrw", "usdjpy", "eurusd", "dxy"] }] },
  { title: "거시·통화 — 국채", anchor: "section-macro-bonds", groups: [
    { title: "미국 국채", ids: ["ust2y", "ust10y", "ust30y"] },
    { title: "한국 국채", ids: ["ktb3y"] },
  ] },
  { title: "원자재", anchor: "section-commodity", groups: [{ ids: ["wti", "gold"] }] },
];
```

- **삭제 목록**(검증 지적 — 잔재 방지): `SECTIONS`, `HomeSection`·`HomeSubsection` 인터페이스,
  `formatDate`(사용처가 기준일 셀 단 한 곳) + `format.test.ts`의 formatDate 블록,
  기준일 관련 CSS(`.itable-col-date`·`.itable-date`·`.itable-th-date`),
  `.itable-section-title`·`tbody:first-of-type` 룰(h2 승격으로 데드코드).
- 앵커 id는 웹 내부 참조가 없어(GNB 섹션 탭은 페이지 탭으로 대체됨) 기존 5개 유지 +
  분할 블록 신규 2개.
- R6(확장성): 새 지표는 `HOME_BLOCKS`의 ids에 추가, 새 카테고리는 블록 객체 추가만으로 반영.

## 컴포넌트 (IndicatorTable.tsx 개편)

```
<div class="itable-grid">
  {blocks.map(block =>
    <section class="itable-block" aria-labelledby={block.anchor}>
      <h2 id={block.anchor} class="itable-block-title">{block.title}</h2>
      <table class="itable">
        <colgroup> 이름 32% · 현재값 22% · 등락 16% · 추세 20% · 상세 10% </colgroup>
        <thead>지표 · 현재값 · 등락 · 추세 · (상세: aria-label만)</thead>
        {block.groups.map(g =>
          <tbody>
            {g.title && <tr class="itable-subgroup-row"><th colSpan=5>{g.title}</th></tr>}
            {renderRows(g.ids)}
          </tbody>)}
      </table>
    </section>)}
</div>
```

- props는 `blocks: HomeBlock[]` (기존 sections prop 대체 — 테스트 주입 편의상 prop 유지,
  기존 test 패턴과 일치). **Home.tsx도 SECTIONS import → HOME_BLOCKS로 수정**(검증 지적 —
  종전 영향 범위 서술에서 누락).
- 섹션 제목을 테이블 내부 `<th colSpan>`에서 **테이블 밖 `<h2>`로 승격**. `.itable-block-title`
  신규 룰로 `margin: 0` 명시(전역 리셋이 heading margin을 안 지움 — UA 기본 margin 잔존 방지,
  검증 지적). 블록 간 수직 간격은 grid row-gap 단일 책임.
- 홈에 heading 구조가 h2에서 시작하게 되므로 시각적으로 숨긴 `<h1>`(sr-only)을 Home에 추가.
- 행 렌더(`IndicatorRow`)는 현행 유지하되 **기준일 `<td>` 제거**(R3), 상세 링크는 전 폭에서
  **아이콘(↗)만 + aria-label="상세"** 로 통일(반폭에서 텍스트 공간 부족 — 현행 모바일과 동일
  패턴을 전 폭으로 확대).
- `COLUMN_COUNT` 6→5. 스켈레톤 행 colSpan도 5.

## CSS (IndicatorTable.css)

```css
.itable-grid { display: grid; grid-template-columns: 1fr; column-gap: calc(var(--space-unit) * 5); row-gap: calc(var(--space-unit) * 4); }
@media (min-width: 1000px) { .itable-grid { grid-template-columns: 1fr 1fr; } }
```

- **브레이크포인트 1000px** (검증 반영 — 종전 900px 산정은 column-gap 40px 누락 오류):
  반폭 = (뷰포트 − 좌우 패딩 64 − gap 40) / 2 → 1000px에서 448px, 1280px에서 588px(최대).
- **스파크라인 유동 폭** (검증 반영 — 100px 고정은 반폭 추세 셀에 안 들어감):
  `.itable-spark { width: 100%; max-width: 100px; }` — SVG가 `preserveAspectRatio="none"`이라
  그대로 스케일. 추세 열 20%면 448px 반폭에서 콘텐츠 ~66px, 588px에서 ~93px.
- **이름 셀 줄바꿈 허용** (검증 반영 — nowrap+ellipsis가 반폭에서 stale·장중 배지를 통째로
  잘라 R3·R5 위반): 현행 모바일 규칙(`white-space: normal`)을 전 폭으로 확대. 긴
  이름+배지는 2줄로 감기고 행 높이가 늘어남 — 수용. 현재값 "4,401.30 USD/oz"도 공백에서
  줄바꿈될 수 있음(keep-all 유지) — 수용, 구현 시 최장 조합(수급 이름+배지, 금 선물 값)으로
  반폭 448px 실측해 열 % 최종 조정.
- ≤640px 모바일: 현행 규칙 유지 — 추세 열 숨김(기준일 규칙은 열 자체가 사라지므로 삭제).
- `.itable-wrap`의 overflow-x 최후 방어선은 블록 단위로 유지(`.itable-block` overflow-x: auto).
- 등락 색 명시도 보정(`.itable-row td.up` 등)·배지·라이브 dot·스켈레톤은 그대로.
- grid row 안에서 두 블록 높이가 다르면 짧은 쪽 아래 여백 — 의도된 동작(R1의 표가 이를 전제).

## 테스트

- `types.test.ts` 개편: HOME_BLOCKS 전 블록 ids 합집합 = 21개 전수·중복 없음, 배치 순서
  (수급→변동성→국내→해외→환율→국채→원자재).
- `IndicatorTable.test.tsx` 개편: 블록 렌더·h2 앵커 id·기준일 셀 부재·소그룹 헤더(미국/한국
  국채)·스켈레톤 colSpan=5.
- 브라우저 실측(검증 계획 보강): 1000px 직상·직하(2단↔1단 전환), 반폭 448px에서 최장
  이름+배지·최장 값 렌더, 모바일 열 숨김, 라이트/다크.

## 영향 범위·문서

- 수정 파일: types.ts(+test), IndicatorTable.tsx(+test)·css, **Home.tsx**(SECTIONS→HOME_BLOCKS),
  format.ts(+test — formatDate 삭제).
- `About.tsx` 상단 주석의 "SECTIONS를 재사용하지 않고" 문구 갱신(심볼 소멸), About 본문
  "화면에 표시된 기준일" 문장은 상세 화면 기준으로 재기술(홈 기준일 열 삭제) — 검증 지적.
- steering `design.md`: 레이아웃 절(단일 테이블 → 2단 블록 그리드) + `SECTIONS[].subsections`
  참조 절(:88) 함께 갱신 — 검증 지적.
