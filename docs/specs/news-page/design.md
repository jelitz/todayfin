# Design — news-page

토스증권 뉴스 피드(tossinvest.com/feed/news) 벤치마크의 레이아웃 리듬(메타 라인 + 제목 행,
상단 큐레이션 블록 + 탭 피드)만 가져오고, 시각 언어는 전부 우리 토큰(헤어라인·8px 라운드·
그림자 금지·데이터 잉크 아님)으로 구현한다.

2026-08-08 적대적 검증(3-agent 워크플로우, major 7·minor 15) 반영: 로딩 상태 3분기·
News/NewsView 분리(정적 렌더 테스트 전략 정합)·ARIA 탭 롤 제거(aria-pressed 토글로 단순화)·
티커 클릭 이탈 수용 명문화·tech.md/About/구 스펙 supersession 접점 보강·source null 구분자·
컨테이너 폭·의존 그래프 간선. 판정 기록은 implemented.md에 남긴다.

## 데이터 흐름

```
Google News RSS (BUSINESS, ~70건/회)
  → pipeline/collect_news.py  (_LIMIT 5 → 70 — 유일한 파이프라인 변경)
  → data/news.json            (스키마 불변: 배열 순서 = 구글 랭킹)
  → 홈: 기존 그대로 items.slice(0, 5)
  → 뉴스 페이지: usePolledJson(5분)
      ├─ 헤드라인 고정 블록 = items.slice(0, 5)
      ├─ 주요뉴스 탭        = items.slice(5)            (랭킹순 연속)
      └─ 최신뉴스 탭        = sortByPublishedDesc(items) (전체 70건)
```

파일 크기 ~35KB(70건 × ~500B) — summary.json과 같은 수준, 폴링 부담 없음.

## 파이프라인

- `collect_news.py`: `_LIMIT = 5` → `70` + **모듈 docstring의 "상위 5건" 표기 갱신**(검증
  지적 — 상수만 바꾸면 docstring이 거짓이 된다). 로직 변경 없음 — `google_news.parse_feed`는
  이미 "전체 파싱·필터 후 limit 절단"이라 70으로 올려도 동작 동일. 검증(`_validate`)은
  건수 하한 1건 그대로(피드가 70건 미만이어도 실패 아님). `google_news.fetch`의 기본값
  `limit=5`는 유지(호출자가 항상 명시 전달 — 기본값은 안전한 하한).
- media-collect.yml 변경 없음(같은 스크립트·같은 커밋 경로).

## 라우팅·셸

### lib/route.ts

`Route`에 `{ name: "news" }` 추가, `clean === "/news"` 매치. 그 외 변형은 기존 규칙대로
홈 폴백.

### Gnb.tsx

`GNB_TABS`에 `{ label: '뉴스', hash: '#/news', routeName: 'news' }`를 홈 다음(2번째)에
삽입. 컴포넌트 로직 변경 없음.

### App.tsx

- `route.name === 'news'` → `<ErrorBoundary key="news"><News /></ErrorBoundary>`.
- `showTicker`에 `'news'` 추가(R6) — shell 하단 패딩 규칙(`app-shell-ticker`)이 함께 적용됨.
- **티커 클릭 동작 수용**(검증 지적): 뉴스 페이지에서 티커 항목을 클릭하면 해시가
  `#/i/{id}`로 바뀌어 News가 언마운트되고 홈+상세 모달이 렌더되며, 모달을 닫으면 홈에
  남는다(뉴스 복귀 없음). detail 모달이 Home 위에만 얹히는 기존 라우트 구조를 바꾸는 비용
  대비, GNB 뉴스 탭 한 번으로 복귀 가능해 수용한다 — 의도된 동작으로 명문화.
- 뉴스 데이터 fetch는 News 컴포넌트 내부(홈의 뉴스 폴링과 동일 패턴 — App은 summary만 안다).

## lib/news.ts (신규 — 순수 함수, 단위 테스트 대상)

```ts
export const NEWS_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** 부재·빈 목록·24h 초과 stale 판정 — 홈(블록 숨김)·뉴스 페이지(안내 문구) 공용 */
export function isFreshNews(feed: NewsFeed | null): feed is NewsFeed

/** 발행 시각 내림차순 새 배열 반환. Array.prototype.sort는 ES2019+ 안정 정렬 —
    동일 시각이면 원래(랭킹) 순서 유지. 파싱 불능 시각은 맨 뒤로. */
export function sortByPublishedDesc(items: NewsItem[]): NewsItem[]
```

- `isFreshNews`·`NEWS_MAX_AGE_MS`는 현재 Home.tsx 내부에 있는 것을 **이동**(중복 금지).
  Home은 import로 전환 — 동작 불변.

## lib/format.ts — `formatNewsRelativeTime(iso, now?)`

피드 행의 토스식 상대 시각. 경계는 floor:

- 파싱 불능 → `''` / **미래 시각(음수 diff) → "방금 전"**(수집·클라 시계 오차 가드)
- < 60초 → "방금 전" / < 60분 → "n분 전" / < 24시간 → "n시간 전" / < 7일 → "n일 전"
- ≥ 7일 → `formatNewsTime(iso, now)` 위임("MM.DD HH:MM" — 기존 KST 규칙 재사용)

헤드라인 고정 블록은 홈과 동일하게 `formatNewsTime`(절대 시각) 유지 — "메인 페이지에 뜬
것처럼" 요구의 일부.

## components/News.tsx = 컨테이너 + NewsView.tsx = 프레젠테이션 (+ News.css)

**분리 이유**(검증 지적): 이 repo의 컴포넌트 테스트 전략은 jsdom 없이
`react-dom/server`의 `renderToStaticMarkup` 정적 렌더(IndicatorTable.test.tsx 주석에
명문화). fetch 훅과 클릭 상태를 품은 단일 컴포넌트는 이 전략으로 검증 불가 — fetch는
News(컨테이너)에, 표시는 NewsView(프레젠테이션, props 주입)에 두고 렌더 테스트는
NewsView만 겨눈다.

### News.tsx (컨테이너)

`usePolledJson<NewsFeed>(BASE_URL + 'data/news.json', 5분)` 후 **3-상태 분기**(R5 —
검증 지적: 로딩을 실패로 오판하면 진입 때마다 오류 문구 플래시):

1. `data === null && !error` → 로딩: 아무것도 렌더하지 않음(빈 본문 — 5분 폴링 첫 응답은
   보통 수백 ms라 스피너 불필요).
2. `error === true`(한 번도 성공 못 함·파일 부재 포함) **또는** `data !== null &&
   !isFreshNews(data)`(24h stale) → 안내 문구: "뉴스를 불러오지 못했습니다 / 잠시 후
   새로고침해 다시 시도해 주세요"(홈 에러 문구 문법). 첫 성공 이후 일시 실패는
   usePolledJson이 기존 값을 유지하므로 이 분기에 오지 않는다.
3. fresh → `<NewsView items={data.items} />`.

### NewsView.tsx (프레젠테이션 — 렌더 테스트 대상)

```
<div class="news-page">                      ← Home과 동일한 컨테이너 문법
  <h1 class="sr-only">뉴스</h1>                 (max-width-dashboard·좌우 패딩 — 검증 지적:
                                              app-main은 폭을 주지 않아 미명시 시 전폭 렌더)
  <NewsHeadlines items={items.slice(0,5)} className="news-pinned" />
  ── 구분감: .news-pinned { background: var(--surface) } — 배경만 다르고
     보더·라운드·행 문법은 홈과 동일(살짝 구분, R2)

  <div class="news-tabs">
    <button type="button" aria-pressed class="news-tab [news-tab-active]">주요뉴스</button>
    <button type="button" …>최신뉴스</button>
  </div>

  <ol class="news-feed">
    <li class="news-feed-item">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <span class="news-feed-meta">연합뉴스 · 2시간 전</span>
        <span class="news-feed-title">제목 — 최대 2줄 클램프</span>
      </a>
    </li> × N
  </ol>
</div>
```

- **탭 = aria-pressed 토글 버튼 2개**(검증 지적 — tabpanel·aria-controls·화살표 키보드
  내비게이션 없는 role="tab"은 반쪽 ARIA 패턴이라 생략보다 해롭다. 2개짜리 정렬 스위치는
  토글 버튼 선언이 정확): `props.initialTab?: 'major' | 'latest'`(기본 `'major'`)으로
  초기화하는 `useState` — 테스트는 initialTab 주입으로 두 상태를 각각 정적 렌더 검증.
  스타일은 News.css에 `.news-tab`/`.news-tab-active`로 Detail의 pill-btn과 동일 토큰
  조합(1px `--hairline`, 8px 라운드, 활성 = `--accent` 배경 + `--on-accent` 글자)을 **복제
  선언**한다 — Detail.css는 모달 전용이라 import 의존 금지, 공용화는 세 번째 사용처가 생길
  때(검증 지적: 스케치·프로즈 모순 정리).
- **행**: 메타 라인 = `--ink-muted` `--fs-caption-sm`. **구분점 `·`은 출처와 상대시각이
  모두 있을 때만** — `source`가 null이면 상대시각만, 상대시각이 `''`(파싱 불능)이면 출처만
  (검증 지적 — NewsItem.source는 nullable, 고아 구분점 방지. 기존 NewsHeadlines의 조건부
  렌더와 동일 정신). 제목 = `--ink` `--fs-body-md`, `display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`(2줄 클램프의
  사실상 표준 — 전 브라우저 지원). 링크 hover/focus-visible 시 제목 `--accent` + underline.
- **행 간 구분**: `border-bottom: 1px solid var(--hairline-soft)`, 마지막 행 제외.
  행 패딩 상하 `calc(var(--space-unit) * 1.5)`. 피드는 카드 박스로 감싸지 않는다(토스
  리듬 — 헤드라인 블록만 박스, 피드는 개방형 리스트로 위계 대비).
- **빈 탭**: 항목 0건이면 `muted` 문구 "더 표시할 뉴스가 없습니다"(R3). 프런트 배포 직후
  데이터가 아직 5건이면 주요뉴스 탭이 이 상태가 되는 윈도가 있다 — 매시간 수집으로 자가
  회복하므로 수용하되, T11에서 푸시 직후 media-collect를 dispatch해 윈도를 분 단위로
  줄인다(검증 지적).
- **이름 중복 수용**(검증 지적): 고정 블록 h2 "주요 뉴스"와 탭 라벨 "주요뉴스"는 이름이
  겹치지만 내용은 연속(1~5위 고정 / 6위~ 피드) — 탭 라벨은 사용자가 지정한 명칭이고, 고정
  블록이 바로 위에 붙어 있어 "이어지는 목록"으로 읽히므로 별도 캡션 없이 수용. 혼란이
  실측되면 탭 상단에 "상단 고정 5건 제외" 캡션 추가를 후속으로.
- **모바일(≤640px)**: 행 패딩 축소. 헤드라인 블록은 NewsHeadlines 기존 규칙(출처 숨김)
  상속. 피드 행은 2줄 구성이라 출처 숨김 불필요.
- 전부 테마 토큰 — 다크모드 자동(R9). 데이터 잉크 아님.

### NewsHeadlines.tsx 변경

`className?: string` prop 추가(섹션 클래스에 병합)와 **제목 행 우측 "더보기 →" 링크**
(`#/news`, `--fs-caption-sm`) 추가. 더보기는 홈·뉴스 페이지 공통 노출이 아니라 **홈에서만**
— prop `moreHref?: string`로 제어(News 페이지에서는 미전달: 자기 페이지로의 링크 방지).
제목 h2 행을 flex로 바꿔 우측 정렬(R7).

## 문서·부수 변경

- `data-rights.md` Google News 행: 완화책 "5건 제한" → "피드 제공 건수 내(~70건) 표시,
  본문·이미지 미수록" 서술로 갱신. ⚠️ 게이트 지위·개인 운영 전제 불변(R8).
- steering `design.md` 레이아웃 절: 뉴스 페이지 항목 추가(GNB 4탭·티커 노출 라우트에
  `#/news` 포함으로 문구 갱신). `structure.md`: 데이터 계약 news.json "상위 5건" → "상위
  70건(홈은 5건 표시)". **`tech.md` 소스 표: "경제뉴스 헤드라인 5건" 행 갱신**(검증 지적 —
  전례인 news-headlines는 tech.md를 포함했었다).
- `About.tsx` "데이터에 대해" 절: "홈 상단의 주요 뉴스는 …" 서술을 뉴스 페이지 승격 반영
  ("홈 상단 5건 + 뉴스 페이지 전체 피드")으로 갱신(검증 지적).
- **구 스펙 supersession**(검증 지적): `docs/specs/news-headlines/requirements.md` 상단에
  "2026-08-08 news-page 스펙으로 수집 상한 5→70건 개정(홈 표시는 5건 유지)" 한 줄 추가 —
  라이브 코드 주석이 그 문서를 현행 참조로 지목하고 있어 모순 방치 시 혼선 경로.
- `web/index.html` meta/og description: 현행 문구 확인 후 뉴스 페이지 언급이 자연스러우면
  갱신(news-headlines 때 전례).

## 테스트

전부 기존 전략(renderToStaticMarkup 정적 렌더, jsdom 미도입) 안에서 — 클릭 시뮬레이션이
필요한 "탭 전환 그 자체"는 useState 한 줄이라 테스트하지 않고, initialTab 주입으로 두
상태의 렌더 결과를 각각 검증한다(검증 지적 반영).

- vitest:
  - `lib/news.test.ts`: isFreshNews(부재·빈 items·24h 경계), sortByPublishedDesc(내림차순·
    동일 시각 안정성·불능 시각 맨 뒤·원본 불변).
  - `format.test.ts` 추가: formatNewsRelativeTime 경계(59초/60초·59분/60분·23h/24h·
    6일/7일 위임·미래 시각·파싱 불능).
  - `NewsView.test.tsx`: 고정 5건 렌더, 기본(주요뉴스) = 6번째부터 랭킹순,
    initialTab='latest' = 전체 시간순, 새 탭 속성, source null 행(고아 구분점 없음),
    빈 탭 문구(items 5건 이하).
  - `News.test.tsx`: 상태 분기 — 로딩 중(문구·본문 모두 부재), 24h stale(안내 문구).
    fetch 훅 자체는 usePolledJson 기존 동작 — 모킹 없이 분기 로직을 함수로 뽑아 검증하거나
    NewsView처럼 정적 렌더 가능한 수준으로 한정.
  - `NewsHeadlines.test.tsx` 갱신: moreHref 전달 시 더보기 렌더·미전달 시 부재, className
    병합.
  - `route.test.ts`: `/news` 파싱·변형 홈 폴백.
- pytest: 변경 없음(상수·docstring만) — 기존 스위트 통과 확인.
- 실측: 로컬 수집 스모크(70건) → 로컬 브라우저(탭 전환·다크모드·모바일 뷰포트) → 배포 후
  탭 전환·원문 도달 확인.
