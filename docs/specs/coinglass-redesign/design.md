# Design — coinglass-redesign

## 개요

순수 프론트엔드(`web/`) 범위의 시각·네비게이션 개편. 데이터 계약(`data/*.json`)·수집 파이프라인(`pipeline/`)·라우팅 방식(해시 기반, 모달 상세)은 변경하지 않는다. 핵심은 (1) 색상·형태 토큰을 coinglass 톤으로 전환, (2) GNB·티커바 신설, (3) 다크모드 도입 3가지다.

## 색상 원칙: UI 크롬 vs 데이터 잉크

이번 개편에서 가장 중요한 설계 축. 두 그룹을 명확히 분리한다.

| 그룹 | 예 | 테마 반응성 |
|------|----|------|
| UI 크롬 | 배경·표면·테두리·본문 텍스트·액센트(네이비)·포커스링 | 라이트/다크에 따라 값이 달라짐 |
| 데이터 잉크 | 상승/하락(빨강·파랑)·MA 20/60/120일선·수급 3주체 라인 | 라이트/다크 **완전히 동일** — 절대 값 고정 |

사용자 피드백(2026-08-03): 다크모드 목업 1차 시안에서 대비 확보를 위해 상승/하락 색을 밝게 보정했으나 "기존처럼 등락표시는 빨간색과 파란색 그대로 유지"로 반려됨. 데이터 잉크는 금융 관례(상승=빨강/하락=파랑)와 차트 범례 인식성이 걸린 값이라 테마 미학보다 우선한다는 원칙으로 확정. 이 원칙은 `--up`/`--down`/`--ma-1..3`/수급 3주체 색상 전부에 동일 적용한다.

**기록해두는 트레이드오프**: `--down`(`#0051c7`)을 다크 배경(`#141414`) 위에 텍스트로 쓸 경우 WCAG 대비비는 약 2.63:1, `--up`(`#d60000`)은 약 3.39:1로 계산됨(둘 다 일반 텍스트 기준 4.5:1 미달, `--down`은 그래픽 객체 기준 3:1도 미달). 사용자가 색상 고정을 명시적으로 확정했고, 캔들·차트 라인처럼 두께가 있는 그래픽 요소에서는 실제 시인성이 계산값보다 나으며, 금융 업계 관례상 등락 색상은 접근성보다 도메인 인식성을 우선하는 경우가 흔하다(예: 대다수 증권 HTS/터미널). 다만 카드·티커의 등락 "텍스트"(예: "▼ -1,140억원")는 다크모드에서 얇은 폰트로 쓰면 가독성이 떨어질 수 있으므로, 구현 시 해당 텍스트에 `font-weight: 600` 이상을 적용해 최소한의 시인성을 확보한다(색상 값 자체는 변경하지 않음).

## 토큰 재정의 (`web/src/styles/tokens.css`)

```css
:root {
  /* UI 크롬 — 라이트 (기본값) */
  --canvas: #ffffff;
  --surface: #f5f5f5;       /* 신규: 카드/티커바 배경 (기존 --surface-soft #fafafa보다 진한 coinglass 톤) */
  --surface-2: #fafafa;     /* 기존 --surface-soft 대체 — 배지·스켈레톤 등 더 옅은 중첩면 */
  --ink: #000000;
  --ink-body: #595959;      /* 기존 #737373 → coinglass text-secondary */
  --ink-muted: #8c8c8c;     /* 기존 #a3a3a3 → coinglass text-tertiary */
  --hairline: #dbdbdb;      /* 기존 #e5e5e5 → coinglass border */
  --hairline-soft: #f0f0f0; /* 신규: 카드 내부 미세 구분선 */
  --accent: #12467b;
  --accent-hover: #2a5b87;
  --accent-active: #082b54;
  --accent-soft: #c7dff7;   /* 배지·링크 배경 */
  --accent-soft-bg: #eaf3fc;
  --focus-ring: rgba(18, 70, 123, .5); /* 액센트 기반으로 갱신 (기존 rgba(59,130,246,.5)) */

  /* 데이터 잉크 — 라이트/다크 공통, 이 블록은 [data-theme="dark"]에서 재정의하지 않는다 */
  --up: #d60000;
  --down: #0051c7;
  --ma-1: #f59e0b;
  --ma-2: #10b981;
  --ma-3: #8b5cf6;
  --flow-individual: #a3a3a3;
  --flow-foreign: #0051c7;
  --flow-institution: #f59e0b;

  /* 형태 */
  --radius-card: 8px;       /* 기존 12px */
  --radius-control: 8px;    /* 기존 --radius-pill 9999px — 이름 변경(용도가 더 이상 알약형이 아니므로) */
  /* --space-*, --fs-*, --font-sans, --max-width-dashboard 등은 변경 없음 */
}

:root[data-theme='dark'] {
  --canvas: #141414;
  --surface: #1d1d1d;
  --surface-2: #1a1a1a;
  --ink: #f0f0f0;
  --ink-body: #adadad;
  --ink-muted: #7e7e7e;
  --hairline: #3e3e3e;
  --hairline-soft: #303030;
  --accent: #4f8fc4;
  --accent-hover: #6ba6d6;
  --accent-active: #3a7ab0;
  --accent-soft: #275076;
  --accent-soft-bg: #1a2c3a;
  --focus-ring: rgba(79, 143, 196, .6);
  /* --up/--down/--ma-*/--flow-* 재정의하지 않음 — 원칙대로 라이트와 동일 값 상속 */
}
```

`--radius-control`(구 `--radius-pill`) 값 변경만으로 `.pill-btn`, 카드 expand 버튼, 배지, 모달 닫기 버튼이 자동으로 8px 사각형이 된다. CSS 클래스명(`pill-btn` 등)은 JSX(`Detail.tsx`)에 이미 쓰이고 있어 변경 범위를 줄이기 위해 그대로 둔다 — 이름이 더 이상 "알약형"을 뜻하지 않는 사소한 네이밍 부채이나, 클래스명 리네임이 끌고 오는 grep 범위(TSX 전반)에 비해 얻는 게 없어 의도적으로 남긴다.

## 다크모드 구현

### `web/src/lib/theme.tsx` (신규)

React Context 기반. 전체 상태 흐름:

1. 초기값: `localStorage.getItem('todayfin-theme')`가 있으면 그 값, 없으면 `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`
2. `useEffect`로 `document.documentElement.dataset.theme = theme` 적용 (tokens.css의 `[data-theme='dark']` 셀렉터가 반응)
3. `toggleTheme()` 호출 시 상태 갱신 + `localStorage.setItem('todayfin-theme', next)`
4. `ThemeProvider`가 `{ theme, toggleTheme }`을 context로 노출, `useTheme()` 훅으로 소비

`App.tsx` 최상단을 `<ThemeProvider>`로 감싼다.

### 차트 다크 대응 (`lib/chartTheme.ts`, `PriceChart.tsx`, `FlowsChart.tsx`)

lightweight-charts는 CSS 커스텀 프로퍼티를 읽지 못하므로(기존 주석 그대로) JS 상수가 필요하다. 색상 원칙에 따라 실제로 테마별로 달라지는 값은 차트 배경·그리드·축 텍스트 3개뿐이고(캔들·MA·수급 라인 색은 고정), 이 3개만 함수화한다:

```ts
export function getChartSurfaceTheme(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? { bg: '#141414', text: '#adadad', grid: '#303030' }
    : { bg: '#ffffff', text: '#595959', grid: '#e5e5e5' };
}
// CHART_COLOR_UP/DOWN/LINE/VOLUME, CHART_MA_COLOR_BY_PERIOD, FLOWS_SUBJECT_COLORS는 기존 상수 그대로 유지(테마 무관 원칙)
```

`PriceChart`/`FlowsChart`는 `useTheme()`으로 현재 테마를 읽어 `createChart` 옵션에 `getChartSurfaceTheme(theme)` 값을 사용한다. 테마 전환 시 부분 패치(`applyOptions`) 대신 **차트 생성 `useEffect`의 의존성 배열에 `theme`을 추가해 전체 재생성**하는 방식을 택한다 — 시리즈 색상은 테마와 무관해 재계산 비용이 없고, 사용자가 다크모드를 토글하는 빈도는 매우 낮아(세션당 0~1회) 재생성 비용이 체감되지 않는다. 부분 패치는 배경/그리드/시리즈 갱신 순서·타이밍 버그 여지가 있어 이 스코프에는 과한 엔지니어링으로 판단, 채택하지 않는다.

## GNB (`web/src/components/Gnb.tsx` + `Gnb.css`, 신규)

- 좌: 로고 `todayfin`
- 중: 탭 4개 — `SECTIONS`(types.ts) 기반, 각 탭 클릭 시 대응 섹션으로 `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- 우: 다크모드 토글 버튼(아이콘), 마지막 갱신 시각
- 활성 탭 추적: `App.tsx`에 `useActiveSection(sectionIds)` 훅(신규, `web/src/lib/useActiveSection.ts`) — `IntersectionObserver`로 각 섹션 `<section id=...>`을 관찰, 뷰포트 상단에 가장 가까운 교차 섹션의 id를 활성 상태로 반환. `Home.tsx`의 각 `<section>`에 `id`를 부여해야 하므로 `types.ts`의 `SECTIONS`에 `anchor: string` 필드를 추가한다(`investor→"section-flows"` 등 4개 고정 슬러그).
- 반응형: 640px 이하에서 탭 컨테이너 `overflow-x: auto`, `white-space: nowrap`(줄바꿈 금지)

기존 `App.tsx`의 `<header className="app-header">`(로고+갱신시각만 있던 다크 바)는 제거하고 `<Gnb>`로 대체한다. `App.css`에서 `.app-header*` 규칙 삭제(`Gnb.css`로 이관), `.app-footer*`는 색상이 토큰 참조라 다크모드에 자연 대응하므로 구조 변경 없음.

## 티커 바 (`web/src/components/TickerBar.tsx` + `TickerBar.css`, 재도입)

2026-08-03 3차 피드백으로 보류됐던 기능. 이전 구현(커밋 `a7789d7`)의 동작 패턴 — 두 벌 복제 콘텐츠 + `translateX(-50%)` 무한 스크롤, hover 시 정지, `prefers-reduced-motion` 대응, 클릭 시 카드와 동일하게 모달 오픈, 좌측에 데이터 기준 시각(KST) 고정 — 을 그대로 유지하되 coinglass 톤(8px, surface 배경, 데이터 잉크는 고정 원칙)으로 새로 스타일링해 구현한다.

- Props: `summary: Summary | null`, `onSelect: (id: string) => void`
- `summary.indicators` 전체(12종)를 `IndicatorCard`와 동일한 포맷 규칙(`lib/format.ts`)으로 렌더링
- `GNB` 바로 아래, `main` 위에 위치 (`App.tsx`)
- 목업 검증 중 발견: CSS 무한 애니메이션은 브라우저 자동화 스크린샷 도구의 idle 감지를 방해할 수 있음(순수 툴링 이슈, 실제 사용자 경험과 무관) — 실브라우저 검증 시 애니메이션을 일시정지하고 캡처하거나 정적 스냅샷으로 대체할 것

## 카드·컨트롤 컴포넌트 변경

- `IndicatorCard.css`: `background: var(--canvas)` → `var(--surface)`, `border-radius: var(--radius-card)`(8px), hover 보더를 `var(--ink)` → `var(--accent)`로, expand 아이콘 hover 색도 accent로
- `Detail.css`: `.pill-btn`이 `var(--radius-control)` 참조(값만 8px로 자동 반영), `.pill-btn-active` 배경을 `var(--ink)` → `var(--accent)`로, `.detail-chart` 컨테이너는 토큰 참조라 다크 자동 대응
- `Modal.css`: `border-radius: var(--radius-card)`(8px), `.modal-overlay` 오버레이 색은 다크에서도 `rgba(0,0,0,.4~.6)` 유지(오버레이는 데이터 잉크가 아니므로 약간 진하게 조정 가능하되 필수 아님)
- `Home.css`: 섹션 `id` 부여 외 구조 변경 없음(카드 그리드 자체는 IndicatorCard.css 변경으로 자동 반영)

## 파일 변경 인벤토리

| 파일 | 변경 |
|------|------|
| `web/src/styles/tokens.css` | 전면 재작성 (라이트 값 갱신 + `[data-theme='dark']` 블록 추가) |
| `web/src/lib/theme.tsx` | 신규 — ThemeProvider/useTheme |
| `web/src/lib/useActiveSection.ts` | 신규 — GNB 활성 탭 추적 |
| `web/src/lib/chartTheme.ts` | `getChartSurfaceTheme(theme)` 함수 추가, 기존 색상 상수는 유지 |
| `web/src/components/Gnb.tsx` / `Gnb.css` | 신규 |
| `web/src/components/TickerBar.tsx` / `TickerBar.css` | 신규(재도입) |
| `web/src/App.tsx` | `ThemeProvider` 래핑, `header`→`Gnb`+`TickerBar` 교체, `useActiveSection` 연결 |
| `web/src/App.css` | `.app-header*` 삭제 |
| `web/src/types.ts` | `SECTIONS`에 `anchor` 필드 추가 |
| `web/src/components/Home.tsx` | `<section id={section.anchor}>` 부여 |
| `web/src/components/IndicatorCard.css` | surface 배경·8px·accent hover |
| `web/src/components/Detail.css` | pill 8px·accent active |
| `web/src/components/Modal.css` | 8px radius |
| `web/src/components/PriceChart.tsx`, `FlowsChart.tsx` | `useTheme()` 구독, `getChartSurfaceTheme` 적용 |
| `docs/steering/design.md` | coinglass 적응판으로 갱신 (별도 문서, 이 스펙과 별개 태스크) |

## 변경하지 않는 것 (명시적 회귀 방지)

- `pipeline/`, `data/*.json` 스키마, 해시 라우팅(`#/i/{id}`), 모달 기반 상세 뷰, 차트 유형·MA 토글·기간 프리셋·크로스헤어 툴팁 로직, `lib/ma.ts`/`lib/weekly.ts`/`lib/stale.ts`/`lib/format.ts`의 계산 로직, Pretendard Variable 폰트, `--space-*`/`--fs-*` 타이포·간격 스케일, 반응형 브레이크포인트(1280/850/640)

## 테스트

- `web/src/lib/theme.test.ts` (신규): localStorage 우선순위, `prefers-color-scheme` 폴백, toggle 후 저장 로직 단위 테스트
- 기존 vitest 37개 스위트 회귀 없음 확인
- 브라우저 검증(claude-in-chrome): 라이트/다크 각각 스크린샷 대조 — 특히 데이터 잉크 색상이 테마 전환 후에도 hex 값 그대로인지 zoom으로 확인
