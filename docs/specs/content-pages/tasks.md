# Tasks — content-pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GNB를 페이지 전환 탭(홈/소개/알상무)으로 재구성하고, 소개 페이지와 유튜브 RSS 기반 알상무 미디어 페이지를 추가한다.

**Architecture:** 기존 해시 라우팅에 `#/about`·`#/alsangmoo`를 추가하고 `parseHash`를 테스트 가능한 `lib/route.ts`로 분리한다. 알상무 페이지 데이터는 주가 파이프라인과 완전히 분리된 별도 워크플로우가 매시간 유튜브 RSS를 가져와 `data/youtube.json`으로 배포한다. 두 축은 이 JSON 파일 계약으로만 만난다.

**Tech Stack:** React 19 + TypeScript + Vite (프론트), Python 3.12 + `defusedxml` (파이프라인), GitHub Actions cron + Pages (배포)

## Global Constraints

- 문서 컨벤션: 코드 변경마다 `docs/specs/content-pages/implemented.md`에 설계 결정·의도적 편차를 기록
- Python 파일 I/O·표준출력은 반드시 `encoding="utf-8"` 명시 (Windows 기본 cp949로 한글 깨짐)
- 프론트에서 `data/*.json`을 fetch할 때는 반드시 캐시 버스팅: `?_=${Date.now()}` + `{ cache: 'no-store' }`
- GitHub Actions 서드파티 액션은 SHA pin (기존 워크플로우의 pin 값을 그대로 복사해 사용)
- GITHUB_TOKEN 커밋은 후속 워크플로우를 트리거하지 않으므로, 데이터 커밋과 Pages 배포는 반드시 같은 잡 안에서 완결
- 알상무 채널 ID: `UCiDmfbYvuMEVbRxPmFP4sng` / 채널 URL: `https://www.youtube.com/channel/UCiDmfbYvuMEVbRxPmFP4sng`
- 커밋 메시지는 한국어, Conventional Commits prefix 사용 (`feat:`, `fix:`, `docs:`, `test:`)

---

### Task 1: 라우트 파싱 로직 분리

**Files:**
- Create: `web/src/lib/route.ts`
- Create: `web/src/lib/route.test.ts`
- Modify: `web/src/App.tsx` (기존 `Route` 타입·`parseHash` 함수 제거 후 import로 교체)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `export type Route = { name: 'home' } | { name: 'detail'; id: string } | { name: 'about' } | { name: 'alsangmoo' }`, `export function parseHash(hash: string): Route`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseHash } from "./route";

describe("parseHash", () => {
  it("빈 해시는 홈", () => {
    expect(parseHash("")).toEqual({ name: "home" });
  });

  it("#/ 는 홈", () => {
    expect(parseHash("#/")).toEqual({ name: "home" });
  });

  it("#/about 은 소개 페이지", () => {
    expect(parseHash("#/about")).toEqual({ name: "about" });
  });

  it("#/alsangmoo 는 알상무 페이지", () => {
    expect(parseHash("#/alsangmoo")).toEqual({ name: "alsangmoo" });
  });

  it("#/i/{id} 는 상세", () => {
    expect(parseHash("#/i/kospi")).toEqual({ name: "detail", id: "kospi" });
  });

  it("상세 id의 %-인코딩을 디코드한다", () => {
    expect(parseHash("#/i/%EA%B5%AD%EA%B3%A0%EC%B1%84")).toEqual({
      name: "detail",
      id: "국고채",
    });
  });

  it("잘못된 %-이스케이프는 원본 문자열을 그대로 쓴다", () => {
    expect(parseHash("#/i/%E0%A4%A")).toEqual({ name: "detail", id: "%E0%A4%A" });
  });

  it("알 수 없는 해시는 홈으로 폴백", () => {
    expect(parseHash("#/nonexistent")).toEqual({ name: "home" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd web && npx vitest run src/lib/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: 구현**

`web/src/lib/route.ts`:

```ts
/**
 * 해시 기반 라우팅 — GitHub Pages에서 SPA 404 회피 목적(404.html 핵 불필요).
 * 라우트 목록은 docs/specs/content-pages/requirements.md R1 참조.
 */

export type Route =
  | { name: "home" }
  | { name: "detail"; id: string }
  | { name: "about" }
  | { name: "alsangmoo" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, "");

  const detailMatch = clean.match(/^\/i\/(.+)$/);
  if (detailMatch) {
    let id = detailMatch[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      // 잘못된 %-이스케이프 시퀀스 — 원본 문자열을 그대로 사용
      // (존재하지 않는 id면 Detail이 에러 상태로 처리)
    }
    return { name: "detail", id };
  }

  if (clean === "/about") return { name: "about" };
  if (clean === "/alsangmoo") return { name: "alsangmoo" };

  return { name: "home" };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && npx vitest run src/lib/route.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: App.tsx에서 기존 정의 제거하고 import로 교체**

`web/src/App.tsx` 상단의 다음 블록을 삭제한다:

```ts
/** 현재 hash("#/", "#/i/{id}" 등)를 파싱해 라우트를 계산한다. */
type Route = { name: 'home' } | { name: 'detail'; id: string }

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, '')
  const detailMatch = clean.match(/^\/i\/(.+)$/)
  if (detailMatch) {
    let id = detailMatch[1]
    try {
      id = decodeURIComponent(id)
    } catch {
      // 잘못된 %-이스케이프 시퀀스 — 원본 문자열을 그대로 사용(존재하지 않는 id면 Detail이 에러 상태로 처리)
    }
    return { name: 'detail', id }
  }
  return { name: 'home' }
}
```

그리고 import 블록에 다음 줄을 추가한다:

```ts
import { parseHash } from './lib/route'
```

- [ ] **Step 6: 타입 체크·전체 테스트 통과 확인**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: `TypeScript: No errors found`, 전체 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add web/src/lib/route.ts web/src/lib/route.test.ts web/src/App.tsx
git commit -m "refactor: 라우트 파싱을 lib/route.ts로 분리하고 about/alsangmoo 라우트 추가"
```

---

### Task 2: GNB를 페이지 전환 탭으로 교체

**Files:**
- Modify: `web/src/components/Gnb.tsx` (props 인터페이스·탭 렌더링 전면 교체)
- Modify: `web/src/components/Gnb.css` (앵커 스타일 추가)
- Modify: `web/src/App.tsx` (Gnb 호출부, 티커바 조건부 렌더링)
- Delete: `web/src/lib/useActiveSection.ts`

**Interfaces:**
- Consumes: `Route` / `parseHash` (Task 1)
- Produces: `export interface GnbTab { label: string; hash: string; routeName: string }`, `export const GNB_TABS: GnbTab[]` (Gnb.tsx에서 export)

- [ ] **Step 1: Gnb.tsx 전면 교체**

`web/src/components/Gnb.tsx` 전체를 다음으로 대체한다:

```tsx
import type { JSX } from 'react'
import './Gnb.css'

export interface GnbTab {
  label: string
  hash: string
  /** 활성 판정용 — App의 Route.name과 대조한다 */
  routeName: string
}

/** GNB 페이지 탭. 기존 섹션 스크롤 탭을 페이지 전환 탭으로 교체(requirements.md R1). */
export const GNB_TABS: GnbTab[] = [
  { label: '홈', hash: '#/', routeName: 'home' },
  { label: '소개', hash: '#/about', routeName: 'about' },
  { label: '알상무', hash: '#/alsangmoo', routeName: 'alsangmoo' },
]

export interface GnbProps {
  tabs: GnbTab[]
  activeRouteName: string
  updatedAtLabel: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Gnb({
  tabs,
  activeRouteName,
  updatedAtLabel,
  theme,
  onToggleTheme,
}: GnbProps): JSX.Element {
  return (
    <nav className="gnb">
      <div className="gnb-inner">
        <a className="gnb-logo" href="#/">
          todayfin
        </a>

        <div className="gnb-tabs">
          {tabs.map((tab) => {
            const active = activeRouteName === tab.routeName
            return (
              <a
                key={tab.routeName}
                href={tab.hash}
                aria-current={active ? 'page' : undefined}
                className={active ? 'gnb-tab gnb-tab-active' : 'gnb-tab'}
              >
                {tab.label}
              </a>
            )
          })}
        </div>

        <div className="gnb-actions">
          {updatedAtLabel && <span className="gnb-updated">마지막 갱신: {updatedAtLabel}</span>}
          <button
            type="button"
            className="gnb-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Gnb.css에서 탭 스타일을 앵커에 맞게 수정**

`web/src/components/Gnb.css`의 `.gnb-logo` 규칙을 다음으로 교체한다(앵커가 되었으므로 밑줄 제거):

```css
.gnb-logo {
  flex-shrink: 0;
  font-size: var(--fs-heading-sm);
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}
```

그리고 `.gnb-tab` 규칙을 다음으로 교체한다(`button` → `a` 전환에 맞춰 `text-decoration`·`display` 추가):

```css
.gnb-tab {
  flex-shrink: 0;
  display: inline-block;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: calc(var(--space-unit) * 2) 0;
  font-size: var(--fs-body-sm);
  color: var(--ink-muted);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease;
}
```

- [ ] **Step 3: App.tsx의 Gnb 호출부·티커바 조건부 렌더링 수정**

`web/src/App.tsx`에서 import 블록의 다음 두 줄을 삭제한다:

```ts
import { SECTIONS } from './types'
import { useActiveSection } from './lib/useActiveSection'
```

`import Gnb from './components/Gnb'` 를 다음으로 교체한다:

```ts
import Gnb, { GNB_TABS } from './components/Gnb'
```

`AppShell` 함수 안의 다음 줄을 삭제한다:

```ts
const activeAnchor = useActiveSection(SECTIONS.map((s) => s.anchor))
```

그리고 `<Gnb .../>` 와 `<TickerBar .../>` 호출부를 다음으로 교체한다:

```tsx
      <Gnb
        tabs={GNB_TABS}
        activeRouteName={route.name === 'detail' ? 'home' : route.name}
        updatedAtLabel={summary ? formatDateTimeKST(summary.generated_at) : null}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {(route.name === 'home' || route.name === 'detail') && (
        <TickerBar
          summary={summary}
          onSelect={(id) => {
            window.location.hash = `#/i/${id}`
          }}
        />
      )}
```

- [ ] **Step 4: useActiveSection 삭제**

```bash
rm web/src/lib/useActiveSection.ts
```

- [ ] **Step 5: 타입 체크·테스트 통과 확인**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: `TypeScript: No errors found`, 전체 테스트 PASS

`useActiveSection`을 참조하는 곳이 남아 있으면 tsc가 에러를 낸다. 에러가 나면 해당 참조를 제거한다.

- [ ] **Step 6: 커밋**

```bash
git add web/src/components/Gnb.tsx web/src/components/Gnb.css web/src/App.tsx
git rm --cached web/src/lib/useActiveSection.ts 2>/dev/null || true
git add -A web/src/lib
git commit -m "feat: GNB를 섹션 스크롤 탭에서 페이지 전환 탭(홈/소개/알상무)으로 교체"
```

---

### Task 3: 소개 페이지

**Files:**
- Create: `web/src/components/About.tsx`
- Create: `web/src/components/About.css`
- Modify: `web/src/App.tsx` (about 라우트 렌더링 추가)

**Interfaces:**
- Consumes: `Route` (Task 1), GNB 탭 전환 (Task 2)
- Produces: `export default function About(): JSX.Element` (props 없음 — 정적 콘텐츠)

- [ ] **Step 1: About.tsx 작성**

`web/src/components/About.tsx`:

```tsx
import type { JSX } from 'react'
import './About.css'

/**
 * 지표별 설명. types.ts의 SECTIONS를 재사용하지 않고 별도 상수로 둔다 —
 * 소개 문구의 분류·순서는 대시보드 레이아웃과 독립적으로 바뀔 수 있다(design.md 참조).
 * 지표 이름은 docs/specs/dashboard-mvp/requirements.md R1 표와 일치시킬 것.
 */
const INDICATOR_NOTES: { section: string; items: { name: string; note: string }[] }[] = [
  {
    section: '수급',
    items: [
      {
        name: '주체별 순매수 (코스피 / 코스닥)',
        note: '개인·외국인·기관이 하루에 얼마를 사고팔았는지 보여줍니다. 지수가 오르내린 이유를 "누가 샀는가"로 되짚을 때 먼저 보는 숫자입니다.',
      },
    ],
  },
  {
    section: '시장 가격·추세',
    items: [
      {
        name: '코스피 / 코스닥',
        note: '국내 증시의 전반적인 방향입니다. 캔들과 이동평균선(20·60·120일)으로 단기 흐름이 중기 추세 위에 있는지 아래에 있는지 확인합니다.',
      },
      {
        name: '삼성전자 / SK하이닉스',
        note: '코스피 시가총액 상위 두 종목이자 국내 반도체 업황의 대리 지표입니다. 지수가 이 둘에 크게 좌우되기 때문에 따로 봅니다.',
      },
    ],
  },
  {
    section: '거시·통화',
    items: [
      {
        name: '원/달러 · 달러/엔',
        note: '환율은 외국인 자금의 유출입과 직결됩니다. 원화가 약해지면 외국인 입장에서는 한국 주식의 달러 환산 수익이 줄어듭니다.',
      },
      {
        name: '미국 국채 2년 · 10년 · 30년',
        note: '2년물은 기준금리 기대를, 10년·30년물은 장기 성장·물가 기대를 반영합니다. 만기별 금리 차이(장단기 스프레드)는 경기 국면을 읽는 대표적인 신호입니다.',
      },
      {
        name: '국고채 3년',
        note: '한국의 대표 시장금리입니다. 한국은행 기준금리 변화 기대가 가장 빠르게 반영되는 구간입니다.',
      },
    ],
  },
  {
    section: '원자재',
    items: [
      {
        name: 'WTI',
        note: '국제 유가는 물가와 기업 원가에 동시에 영향을 줍니다. 에너지 수입 비중이 큰 한국 경제에는 특히 민감한 변수입니다.',
      },
    ],
  },
]

export default function About(): JSX.Element {
  return (
    <div className="about">
      <h1 className="about-title">소개</h1>

      <section className="about-block">
        <h2 className="about-heading">왜 만들었나</h2>
        <p className="about-text">
          시황에 따라 말이 바뀌는 코멘트 대신, 기관 투자자들이 매일 아침 확인하는 핵심 지표를 스스로
          살펴보며 자신만의 판단 기준을 세울 수 있도록 돕습니다. 종목을 추천하는 곳이 아니라, 데이터를
          매일 루틴하게 확인하는 훈련을 통해 시장을 읽는 감각을 기르는 것이 목표입니다.
        </p>
        <p className="about-text">
          그래서 지표를 12개로 제한했습니다. 더 많은 숫자를 나열하는 대신, 매일 같은 지표를 같은
          자리에서 보며 변화를 체감하는 편이 판단 기준을 만드는 데 유리하다고 봤습니다.
        </p>
      </section>

      <section className="about-block">
        <h2 className="about-heading">지표별 특성</h2>
        {INDICATOR_NOTES.map((group) => (
          <div key={group.section} className="about-group">
            <h3 className="about-group-title">{group.section}</h3>
            <dl className="about-list">
              {group.items.map((item) => (
                <div key={item.name} className="about-item">
                  <dt className="about-item-name">{item.name}</dt>
                  <dd className="about-item-note">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="about-block">
        <h2 className="about-heading">데이터에 대해</h2>
        <p className="about-text">
          모든 수치는 한국거래소(KRX), 한국은행(ECOS), 미국 재무부, Yahoo Finance 등 공개된 출처에서
          자동으로 수집합니다. 국내 지표는 정규장 중 30분 간격으로 갱신되며, 국채 금리처럼 하루 한 번
          고시되는 값은 발표 후 반영됩니다. 카드에 표시된 기준일이 실제 데이터의 관측일입니다.
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: About.css 작성**

`web/src/components/About.css`:

```css
.about {
  max-width: 760px;
  margin: 0 auto;
  padding: calc(var(--space-unit) * 6) var(--pad-card-mobile) calc(var(--space-unit) * 8);
}

@media (min-width: 850px) {
  .about {
    padding-left: var(--pad-card);
    padding-right: var(--pad-card);
  }
}

.about-title {
  font-size: var(--fs-heading-lg);
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 calc(var(--space-unit) * 4);
}

.about-block {
  margin-bottom: calc(var(--space-unit) * 6);
}

.about-block:last-child {
  margin-bottom: 0;
}

.about-heading {
  font-size: var(--fs-heading-md);
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 calc(var(--space-unit) * 2);
}

.about-text {
  font-size: var(--fs-body-sm);
  line-height: 1.8;
  color: var(--ink-body);
  margin: 0 0 var(--space-unit);
}

.about-text:last-child {
  margin-bottom: 0;
}

.about-group {
  margin-bottom: calc(var(--space-unit) * 3);
}

.about-group:last-child {
  margin-bottom: 0;
}

.about-group-title {
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--ink-muted);
  margin: 0 0 var(--space-unit);
}

.about-list {
  margin: 0;
  padding: 0;
}

.about-item {
  padding: calc(var(--space-unit) * 1.5) 0;
  border-top: 1px solid var(--hairline-soft);
}

.about-item-name {
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 calc(var(--space-unit) / 2);
}

.about-item-note {
  font-size: var(--fs-body-sm);
  line-height: 1.7;
  color: var(--ink-body);
  margin: 0;
}
```

- [ ] **Step 3: App.tsx에 about 라우트 렌더링 추가**

`web/src/App.tsx`의 import 블록에 다음을 추가한다:

```ts
import About from './components/About'
```

`<main className="app-main">` 안의 내용을 다음으로 교체한다:

```tsx
      <main className="app-main">
        {route.name === 'about' ? (
          <ErrorBoundary key="about">
            <About />
          </ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary key="home">
              <Home
                summary={summary}
                error={summaryError}
                onSelect={(id) => {
                  window.location.hash = `#/i/${id}`
                }}
              />
            </ErrorBoundary>

            {route.name === 'detail' && (
              <Modal onClose={() => (window.location.hash = '#/')}>
                <ErrorBoundary key={route.id}>
                  <Detail id={route.id} onBack={() => (window.location.hash = '#/')} />
                </ErrorBoundary>
              </Modal>
            )}
          </>
        )}
      </main>
```

- [ ] **Step 4: 타입 체크·빌드 확인**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: `TypeScript: No errors found`, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add web/src/components/About.tsx web/src/components/About.css web/src/App.tsx
git commit -m "feat: 소개 페이지 추가 — 제작 배경과 지표별 특성 설명"
```

---

### Task 4: 유튜브 RSS 파서

**Files:**
- Create: `pipeline/sources/youtube_rss.py`
- Create: `pipeline/tests/fixtures/youtube_rss.xml`
- Create: `pipeline/tests/test_youtube_rss.py`

**Interfaces:**
- Consumes: 없음
- Produces: `def fetch(channel_id: str) -> dict` — 반환 `{"channel_name": str, "channel_url": str, "videos": list[dict]}`. 각 video는 `{"video_id": str, "title": str, "published_at": str, "thumbnail_url": str | None, "watch_url": str}`. `def parse_feed(xml_text: str) -> dict` (순수 함수, 테스트 진입점)

- [ ] **Step 1: 실제 RSS 응답을 픽스처로 저장**

```bash
curl -s "https://www.youtube.com/feeds/videos.xml?channel_id=UCiDmfbYvuMEVbRxPmFP4sng" \
  -o pipeline/tests/fixtures/youtube_rss.xml
head -20 pipeline/tests/fixtures/youtube_rss.xml
```

Expected: `<feed ...>`로 시작하는 Atom XML, `<title>알상무</title>` 포함

- [ ] **Step 2: 실패하는 테스트 작성**

`pipeline/tests/test_youtube_rss.py`:

```python
"""youtube_rss.py 파싱 단위 테스트.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_youtube_rss.py
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sources.youtube_rss import parse_feed  # noqa: E402

_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "youtube_rss.xml")


def _fixture_text() -> str:
    with open(_FIXTURE, "r", encoding="utf-8") as f:
        return f.read()


def test_parse_feed_extracts_channel_name():
    result = parse_feed(_fixture_text())
    assert result["channel_name"] == "알상무"


def test_parse_feed_returns_videos():
    result = parse_feed(_fixture_text())
    assert len(result["videos"]) > 0


def test_parse_feed_video_has_required_fields():
    video = parse_feed(_fixture_text())["videos"][0]
    assert video["video_id"]
    assert video["title"]
    assert video["published_at"]
    assert video["watch_url"] == f"https://www.youtube.com/watch?v={video['video_id']}"


def test_parse_feed_videos_sorted_newest_first():
    videos = parse_feed(_fixture_text())["videos"]
    published = [v["published_at"] for v in videos]
    assert published == sorted(published, reverse=True)


def test_parse_feed_empty_feed_returns_empty_videos():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <yt:channelId>UCtest</yt:channelId>
 <title>빈 채널</title>
</feed>"""
    result = parse_feed(xml)
    assert result["channel_name"] == "빈 채널"
    assert result["videos"] == []


def test_parse_feed_invalid_xml_raises():
    with pytest.raises(ValueError, match="파싱 실패"):
        parse_feed("not xml at all <<<")


def test_parse_feed_missing_thumbnail_yields_none():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <title>채널</title>
 <entry>
  <yt:videoId>abc123</yt:videoId>
  <title>썸네일 없는 영상</title>
  <published>2026-08-01T00:00:00+00:00</published>
 </entry>
</feed>"""
    video = parse_feed(xml)["videos"][0]
    assert video["thumbnail_url"] is None
    assert video["video_id"] == "abc123"
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd pipeline && uv run --python 3.12 --with pytest --with requests --with defusedxml pytest tests/test_youtube_rss.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'sources.youtube_rss'`

- [ ] **Step 4: 구현**

`pipeline/sources/youtube_rss.py`:

```python
"""유튜브 채널 RSS — 알상무 미디어 게시판용 최신 영상 목록.

유튜브가 공식 제공하는 Atom 피드(https://www.youtube.com/feeds/videos.xml?channel_id=...)로,
인증·API 키가 필요 없고 최신 15개 영상을 최신순으로 준다(2026-08-03 실응답 확인).

주의: 커뮤니티 게시글(텍스트·투표)은 이 피드에도 공식 API에도 없어 영상만 다룬다.
브라우저에서 직접 fetch할 수 없으므로(CORS 헤더 없음) 반드시 서버 사이드에서 호출할 것 —
docs/specs/content-pages/requirements.md R4 참조.

기존 지표 어댑터(fetch(indicator_id, start, end) -> DataFrame)와 시그니처가 다른 것은 의도적이다.
미디어는 시계열이 아니라 목록이라 pandas가 불필요하고 collect.py의 지표 레지스트리에도 등록되지 않는다.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

import requests
from defusedxml.ElementTree import fromstring as safe_fromstring

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}

_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
_CHANNEL_URL = "https://www.youtube.com/channel/{channel_id}"
_WATCH_URL = "https://www.youtube.com/watch?v={video_id}"
_TIMEOUT = 20


def _text(element, path: str) -> str | None:
    found = element.find(path, _NS)
    return found.text if found is not None else None


def parse_feed(xml_text: str) -> dict:
    """Atom 피드 문자열을 파싱한다. 반환: {channel_name, videos}.

    defusedxml을 쓰는 이유: 표준 xml.etree는 billion-laughs(엔티티 폭탄) 등
    XML 폭탄 공격에 취약하다. 지금 입력은 유튜브 공식 HTTPS 엔드포인트라 실질
    위험은 낮지만, 외부에서 받은 XML을 파싱하는 지점이므로 방어적으로 처리한다.
    """
    try:
        root = safe_fromstring(xml_text)
    except ET.ParseError as e:
        raise ValueError(f"youtube_rss 파싱 실패: {e}") from e

    channel_name = _text(root, "atom:title") or ""

    videos = []
    for entry in root.findall("atom:entry", _NS):
        video_id = _text(entry, "yt:videoId")
        title = _text(entry, "atom:title")
        published_at = _text(entry, "atom:published")
        if not (video_id and title and published_at):
            continue

        thumbnail = entry.find("media:group/media:thumbnail", _NS)
        thumbnail_url = thumbnail.get("url") if thumbnail is not None else None

        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "published_at": published_at,
                "thumbnail_url": thumbnail_url,
                "watch_url": _WATCH_URL.format(video_id=video_id),
            }
        )

    videos.sort(key=lambda v: v["published_at"], reverse=True)
    return {"channel_name": channel_name, "videos": videos}


def fetch(channel_id: str) -> dict:
    """채널 RSS를 가져와 파싱한다. 반환: {channel_name, channel_url, videos}."""
    r = requests.get(_FEED_URL.format(channel_id=channel_id), timeout=_TIMEOUT)
    r.raise_for_status()
    parsed = parse_feed(r.text)
    return {
        "channel_name": parsed["channel_name"],
        "channel_url": _CHANNEL_URL.format(channel_id=channel_id),
        "videos": parsed["videos"],
    }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd pipeline && uv run --python 3.12 --with pytest --with requests --with defusedxml pytest tests/test_youtube_rss.py -v`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add pipeline/sources/youtube_rss.py pipeline/tests/test_youtube_rss.py pipeline/tests/fixtures/youtube_rss.xml
git commit -m "feat: 유튜브 채널 RSS 파서 추가 (알상무 미디어용)"
```

---

### Task 5: 미디어 수집 스크립트

**Files:**
- Create: `pipeline/collect_media.py`
- Create: `pipeline/tests/test_collect_media.py`

**Interfaces:**
- Consumes: `sources.youtube_rss.fetch(channel_id) -> dict` (Task 4)
- Produces: `def collect(data_dir: str) -> int` (0=성공/유지, 로그만 남김), `data/youtube.json` 파일. CLI: `python pipeline/collect_media.py [--data-dir ../data]`

- [ ] **Step 1: 실패하는 테스트 작성**

`pipeline/tests/test_collect_media.py`:

```python
"""collect_media.py 단위 테스트 — 실패 시 기존 파일 보존 동작 검증.

실행: uv run --python 3.12 --with pytest --with requests --with defusedxml pytest pipeline/tests/test_collect_media.py
"""

import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import collect_media  # noqa: E402

_SAMPLE = {
    "channel_name": "알상무",
    "channel_url": "https://www.youtube.com/channel/UCiDmfbYvuMEVbRxPmFP4sng",
    "videos": [
        {
            "video_id": "abc123",
            "title": "당일전략",
            "published_at": "2026-08-02T23:49:20+00:00",
            "thumbnail_url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
            "watch_url": "https://www.youtube.com/watch?v=abc123",
        }
    ],
}


def test_collect_writes_json(tmp_path):
    with patch("collect_media.youtube_rss.fetch", return_value=_SAMPLE):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        data = json.load(f)
    assert data["channel_name"] == "알상무"
    assert data["videos"][0]["video_id"] == "abc123"
    assert "generated_at" in data


def test_collect_preserves_existing_file_on_fetch_failure(tmp_path):
    existing = {"channel_name": "기존", "channel_url": "x", "generated_at": "old", "videos": []}
    with open(tmp_path / "youtube.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    with patch("collect_media.youtube_rss.fetch", side_effect=RuntimeError("네트워크 오류")):
        code = collect_media.collect(str(tmp_path))

    # 실패해도 exit 0 — 영상 미업로드·일시적 RSS 장애는 정상 범주(requirements.md R5)
    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        assert json.load(f)["channel_name"] == "기존"


def test_collect_rejects_empty_video_list(tmp_path):
    existing = {"channel_name": "기존", "channel_url": "x", "generated_at": "old", "videos": []}
    with open(tmp_path / "youtube.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    empty = {"channel_name": "알상무", "channel_url": "u", "videos": []}
    with patch("collect_media.youtube_rss.fetch", return_value=empty):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    with open(tmp_path / "youtube.json", encoding="utf-8") as f:
        assert json.load(f)["channel_name"] == "기존"


def test_collect_rejects_video_missing_required_field(tmp_path):
    broken = {
        "channel_name": "알상무",
        "channel_url": "u",
        "videos": [{"video_id": "", "title": "제목", "watch_url": "w"}],
    }
    with patch("collect_media.youtube_rss.fetch", return_value=broken):
        code = collect_media.collect(str(tmp_path))

    assert code == 0
    assert not os.path.exists(tmp_path / "youtube.json")
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd pipeline && uv run --python 3.12 --with pytest --with requests --with defusedxml pytest tests/test_collect_media.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'collect_media'`

- [ ] **Step 3: 구현**

`pipeline/collect_media.py`:

```python
"""미디어 수집 — 알상무 유튜브 채널 최신 영상 목록을 data/youtube.json으로 저장.

주가 데이터 파이프라인(collect.py)과 완전히 분리돼 있다. 스케줄·장애를 독립시켜
RSS 파싱 실패가 대시보드 배포에 영향을 주지 않게 하기 위함 —
docs/specs/content-pages/design.md 참조.

사용:
    python collect_media.py [--data-dir ../data]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import youtube_rss  # noqa: E402

_CHANNEL_ID = "UCiDmfbYvuMEVbRxPmFP4sng"  # 알상무
_RETRIES = 2
_RETRY_DELAYS = [5, 15]
_REQUIRED_VIDEO_FIELDS = ("video_id", "title", "watch_url")


def _staging_dir() -> str:
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".staging")
    os.makedirs(d, exist_ok=True)
    return d


def _fetch_with_retry(channel_id: str) -> dict:
    last_err: Exception | None = None
    for attempt in range(_RETRIES + 1):
        try:
            return youtube_rss.fetch(channel_id)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < _RETRIES:
                time.sleep(_RETRY_DELAYS[attempt])
    assert last_err is not None
    raise last_err


def _validate(payload: dict) -> None:
    videos = payload.get("videos") or []
    if not videos:
        raise ValueError("영상 목록이 비어 있음")
    for video in videos:
        missing = [f for f in _REQUIRED_VIDEO_FIELDS if not video.get(f)]
        if missing:
            raise ValueError(f"영상 필수 필드 누락: {missing} (video={video})")


def collect(data_dir: str) -> int:
    """수집·검증 후 원자적 교체. 실패해도 기존 파일을 유지하고 항상 0을 반환한다.

    영상이 며칠 안 올라오거나 RSS가 일시적으로 죽는 것은 정상 범주라 워크플로우를
    실패시키지 않는다(주가 지표의 stale 실패 승격과 다른 정책 — requirements.md R5).
    """
    os.makedirs(data_dir, exist_ok=True)

    try:
        payload = _fetch_with_retry(_CHANNEL_ID)
        _validate(payload)
    except Exception as e:  # noqa: BLE001
        print(f"[유지] 미디어 수집 실패 — 기존 data/youtube.json 유지: {e}")
        return 0

    record = {
        "channel_name": payload["channel_name"],
        "channel_url": payload["channel_url"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "videos": payload["videos"],
    }

    staging_path = os.path.join(_staging_dir(), "youtube.json")
    with open(staging_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(staging_path, os.path.join(data_dir, "youtube.json"))  # 원자적 교체

    print(f"[ok] 영상 {len(record['videos'])}건 저장 (최신: {record['videos'][0]['title']})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    )
    args = parser.parse_args()
    return collect(os.path.abspath(args.data_dir))


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd pipeline && uv run --python 3.12 --with pytest --with requests --with defusedxml pytest tests/test_collect_media.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: 실제 네트워크로 한 번 실행해 확인**

Run: `cd pipeline && uv run --python 3.12 --with requests --with defusedxml python collect_media.py --data-dir ../data`
Expected: `[ok] 영상 N건 저장 (최신: ...)`

그 다음 결과 확인:

```bash
python -c "import json; d=json.load(open('data/youtube.json',encoding='utf-8')); print(d['channel_name'], len(d['videos'])); print(d['videos'][0])"
```

Expected: `알상무 15` + 첫 영상 dict 출력

- [ ] **Step 6: 커밋**

```bash
git add pipeline/collect_media.py pipeline/tests/test_collect_media.py data/youtube.json
git commit -m "feat: 미디어 수집 스크립트 추가 — 알상무 유튜브 최신 영상을 data/youtube.json으로"
```

---

### Task 6: 알상무 페이지 (프론트)

**Files:**
- Create: `web/src/components/Alsangmoo.tsx`
- Create: `web/src/components/Alsangmoo.css`
- Modify: `web/src/types.ts` (미디어 타입 추가)
- Modify: `web/src/App.tsx` (alsangmoo 라우트 렌더링 추가)

**Interfaces:**
- Consumes: `data/youtube.json` (Task 5 스키마), `Route` (Task 1)
- Produces: `export interface YoutubeVideo`, `export interface YoutubeFeed` (types.ts), `export default function Alsangmoo(): JSX.Element`

- [ ] **Step 1: types.ts에 미디어 타입 추가**

`web/src/types.ts` 파일 끝에 다음을 추가한다:

```ts
/** data/youtube.json 의 영상 1건 — pipeline/collect_media.py 스키마와 1:1 대응 */
export interface YoutubeVideo {
  video_id: string;
  title: string;
  /** ISO 8601 (예: "2026-08-02T23:49:20+00:00") */
  published_at: string;
  thumbnail_url: string | null;
  watch_url: string;
}

export interface YoutubeFeed {
  channel_name: string;
  channel_url: string;
  generated_at: string;
  videos: YoutubeVideo[];
}
```

- [ ] **Step 2: Alsangmoo.tsx 작성**

`web/src/components/Alsangmoo.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { YoutubeFeed } from '../types'
import { formatDateTimeKST } from '../lib/format'
import './Alsangmoo.css'

const CHANNEL_FALLBACK_URL = 'https://www.youtube.com/@rsangmoo'

export default function Alsangmoo(): JSX.Element {
  const [feed, setFeed] = useState<YoutubeFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    // 캐시 버스팅 — GitHub Pages CDN·브라우저 캐시로 새 영상이 가려지는 것 방지
    fetch(`${import.meta.env.BASE_URL}data/youtube.json?_=${Date.now()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<YoutubeFeed>
      })
      .then((data) => {
        if (!cancelled) {
          setFeed(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const channelUrl = feed?.channel_url ?? CHANNEL_FALLBACK_URL

  return (
    <div className="alsangmoo">
      <header className="alsangmoo-header">
        <h1 className="alsangmoo-title">알상무</h1>
        <a className="alsangmoo-channel-link" href={channelUrl} target="_blank" rel="noopener noreferrer">
          유튜브 채널 바로가기 ↗
        </a>
      </header>

      {loading && <p className="alsangmoo-status muted">불러오는 중…</p>}

      {error && (
        <div className="alsangmoo-status">
          <p className="alsangmoo-error-text">영상 목록을 불러오지 못했습니다.</p>
          <p className="muted">
            <a href={CHANNEL_FALLBACK_URL} target="_blank" rel="noopener noreferrer">
              유튜브에서 직접 보기 ↗
            </a>
          </p>
        </div>
      )}

      {feed && feed.videos.length > 0 && (
        <>
          <div className="alsangmoo-grid">
            {feed.videos.map((video) => (
              <a
                key={video.video_id}
                className="alsangmoo-card"
                href={video.watch_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="alsangmoo-thumb-wrap">
                  {video.thumbnail_url ? (
                    <img
                      className="alsangmoo-thumb"
                      src={video.thumbnail_url}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="alsangmoo-thumb-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="alsangmoo-card-body">
                  <span className="alsangmoo-card-title">{video.title}</span>
                  <span className="alsangmoo-card-date muted">
                    {formatDateTimeKST(video.published_at)}
                  </span>
                </div>
              </a>
            ))}
          </div>
          <p className="alsangmoo-updated muted">
            목록 갱신: {formatDateTimeKST(feed.generated_at)}
          </p>
        </>
      )}

      {feed && feed.videos.length === 0 && (
        <p className="alsangmoo-status muted">표시할 영상이 없습니다.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Alsangmoo.css 작성**

`web/src/components/Alsangmoo.css`:

```css
.alsangmoo {
  max-width: var(--max-width-dashboard);
  margin: 0 auto;
  padding: calc(var(--space-unit) * 6) var(--pad-card-mobile) calc(var(--space-unit) * 8);
}

@media (min-width: 850px) {
  .alsangmoo {
    padding-left: var(--pad-card);
    padding-right: var(--pad-card);
  }
}

.alsangmoo-header {
  display: flex;
  align-items: baseline;
  gap: calc(var(--space-unit) * 2);
  margin-bottom: calc(var(--space-unit) * 4);
}

.alsangmoo-title {
  font-size: var(--fs-heading-lg);
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.alsangmoo-channel-link {
  font-size: var(--fs-body-sm);
  color: var(--accent);
  text-decoration: none;
}

.alsangmoo-channel-link:hover {
  text-decoration: underline;
}

.alsangmoo-status {
  padding: calc(var(--space-unit) * 4) 0;
  font-size: var(--fs-body-sm);
}

.alsangmoo-error-text {
  color: var(--ink);
  margin: 0 0 var(--space-unit);
}

.alsangmoo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: calc(var(--space-unit) * 2);
}

@media (min-width: 850px) {
  .alsangmoo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .alsangmoo-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.alsangmoo-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-card);
  overflow: hidden;
  text-decoration: none;
  transition: border-color 0.12s ease;
}

.alsangmoo-card:hover,
.alsangmoo-card:focus-visible {
  border-color: var(--accent);
}

.alsangmoo-thumb-wrap {
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  overflow: hidden;
}

.alsangmoo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.alsangmoo-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--hairline-soft);
}

.alsangmoo-card-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-unit) / 2);
  padding: calc(var(--space-unit) * 2);
}

.alsangmoo-card-title {
  font-size: var(--fs-body-sm);
  font-weight: 600;
  line-height: 1.5;
  color: var(--ink);
}

.alsangmoo-card-date {
  font-size: var(--fs-caption-sm);
}

.alsangmoo-updated {
  margin: calc(var(--space-unit) * 3) 0 0;
  font-size: var(--fs-caption-sm);
}
```

- [ ] **Step 4: App.tsx에 alsangmoo 라우트 추가**

`web/src/App.tsx`의 import 블록에 추가:

```ts
import Alsangmoo from './components/Alsangmoo'
```

Task 3에서 만든 `<main>` 안의 `route.name === 'about' ? (...) : (...)` 구조를, 페이지 라우트가 2개가 되었으므로 다음으로 교체한다:

```tsx
      <main className="app-main">
        {route.name === 'about' && (
          <ErrorBoundary key="about">
            <About />
          </ErrorBoundary>
        )}

        {route.name === 'alsangmoo' && (
          <ErrorBoundary key="alsangmoo">
            <Alsangmoo />
          </ErrorBoundary>
        )}

        {(route.name === 'home' || route.name === 'detail') && (
          <>
            <ErrorBoundary key="home">
              <Home
                summary={summary}
                error={summaryError}
                onSelect={(id) => {
                  window.location.hash = `#/i/${id}`
                }}
              />
            </ErrorBoundary>

            {route.name === 'detail' && (
              <Modal onClose={() => (window.location.hash = '#/')}>
                <ErrorBoundary key={route.id}>
                  <Detail id={route.id} onBack={() => (window.location.hash = '#/')} />
                </ErrorBoundary>
              </Modal>
            )}
          </>
        )}
      </main>
```

- [ ] **Step 5: 타입 체크·빌드·테스트 확인**

Run: `cd web && npx tsc --noEmit && npx vitest run && npm run build`
Expected: 모두 성공

- [ ] **Step 6: 커밋**

```bash
git add web/src/components/Alsangmoo.tsx web/src/components/Alsangmoo.css web/src/types.ts web/src/App.tsx
git commit -m "feat: 알상무 미디어 페이지 추가 — 유튜브 최신 영상 카드 그리드"
```

---

### Task 7: 미디어 수집 워크플로우

**Files:**
- Create: `.github/workflows/media-collect.yml`
- Modify: `pipeline/requirements.txt` (`defusedxml` 추가)

**Interfaces:**
- Consumes: `pipeline/collect_media.py` (Task 5)
- Produces: 매시간 `data/youtube.json` 갱신 + Pages 배포

- [ ] **Step 1: requirements.txt에 defusedxml 추가**

`pipeline/requirements.txt`는 현재 다음과 같다:

```
pandas
requests
lxml
finance-datareader
yfinance
```

마지막 줄에 `defusedxml`을 추가한다:

```
pandas
requests
lxml
finance-datareader
yfinance
defusedxml
```

`collect-and-deploy.yml`이 이 파일로 설치하므로, 주가 파이프라인 실행에도 영향이 없는지 확인:

Run: `cd pipeline && uv run --python 3.12 --with pytest --with pandas --with requests --with finance-datareader --with lxml --with yfinance --with defusedxml pytest tests/ -q`
Expected: 전체 PASS

- [ ] **Step 2: 워크플로우 작성**

`.github/workflows/media-collect.yml`:

```yaml
name: Collect media (youtube RSS)

# 알상무 유튜브 채널 RSS를 매시간 가져와 data/youtube.json을 갱신하고 Pages까지 배포한다.
# 주가 데이터 파이프라인(collect-and-deploy.yml)과 스케줄·장애를 완전히 분리한다 —
# RSS 파싱 실패가 대시보드 배포에 영향을 주지 않게 하기 위함
# (docs/specs/content-pages/design.md 참조).
#
# GITHUB_TOKEN 커밋은 후속 워크플로우를 트리거하지 않으므로 배포를 이 잡 안에서 완결한다.
# cron "25 * * * *": 매시 25분 — 정각 회피 + 기존 워크플로우들과 시간대 비중복.

on:
  schedule:
    - cron: "25 * * * *"
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  collect-media:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0
        with:
          python-version: "3.12"

      - name: Install deps
        run: pip install requests defusedxml

      - name: Collect media
        run: python pipeline/collect_media.py

      - name: Commit data
        id: commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/youtube.json
          if git diff --cached --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "no media changes to commit"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
            git commit -m "data: youtube sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
            git push
          fi

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        if: steps.commit.outputs.changed == 'true'
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: web/package-lock.json

      - name: Build site
        if: steps.commit.outputs.changed == 'true'
        run: |
          cd web
          npm ci
          npm run build
          mkdir -p dist/data
          cp -r ../data/. dist/data/

      - name: Configure Pages
        if: steps.commit.outputs.changed == 'true'
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0

      - name: Upload artifact
        if: steps.commit.outputs.changed == 'true'
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: web/dist

      - name: Deploy to GitHub Pages
        id: deployment
        if: steps.commit.outputs.changed == 'true'
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0
```

새 영상이 없으면(대부분의 시간) 빌드·배포 단계를 건너뛴다 — 매시간 무의미한 재배포를 막기 위함.

- [ ] **Step 3: 커밋·푸시**

```bash
git add .github/workflows/media-collect.yml pipeline/requirements.txt
git commit -m "feat: 유튜브 RSS 매시간 수집 워크플로우 추가"
git push
```

- [ ] **Step 4: 수동 실행으로 검증**

```bash
gh workflow run media-collect.yml --repo jelitz/todayfin
sleep 10
gh run list --repo jelitz/todayfin --workflow=media-collect.yml --limit 2
```

완료될 때까지 대기한 뒤:

```bash
gh run view <RUN_ID> --repo jelitz/todayfin --log | grep -E "\[ok\]|\[유지\]|youtube"
```

Expected: `[ok] 영상 N건 저장` 또는 `no media changes to commit`

---

### Task 8: 통합 검증 및 문서화

**Files:**
- Create: `docs/specs/content-pages/implemented.md`
- Modify: `docs/steering/tech.md` (워크플로우 목록 갱신)
- Modify: `docs/steering/design.md` (GNB 설명 갱신)

**Interfaces:**
- Consumes: Task 1~7 전체
- Produces: 없음 (문서·검증)

- [ ] **Step 1: 로컬 dev 서버로 전체 화면 검증**

```bash
cd web
rm -rf public/data && mkdir -p public/data && cp -r ../data/. public/data/
npm run dev
```

브라우저(claude-in-chrome)로 다음을 순서대로 확인한다:

1. `http://localhost:5173/#/` — GNB에 "홈/소개/알상무" 3탭, 홈 탭 활성, 티커바 보임
2. "소개" 탭 클릭 — URL이 `#/about`, 소개 페이지 렌더, 티커바 사라짐, 소개 탭 활성
3. "알상무" 탭 클릭 — URL이 `#/alsangmoo`, 영상 카드 그리드(썸네일+제목+날짜) 렌더, 티커바 없음
4. "홈" 탭 클릭 후 지표 카드 클릭 — `#/i/{id}` 모달 정상, GNB는 홈 탭이 계속 활성
5. 다크모드 토글 — 세 페이지 모두 정상 표시

- [ ] **Step 2: dev 서버 종료**

```bash
pkill -f vite
```

- [ ] **Step 3: implemented.md 작성**

`docs/specs/content-pages/implemented.md`:

```markdown
# Implemented — content-pages

## 설계 결정

- **`parseHash`를 `lib/route.ts`로 분리**: 라우트가 2개에서 4개로 늘면서 단위 테스트 가치가 생겼다. `App.tsx` 안의 로컬 함수는 테스트가 불가능했다.
- **GNB 탭을 `<button>`이 아니라 `<a href>`로**: 진짜 페이지 내비게이션이므로 앵커가 의미상 맞고, 새 탭으로 열기·링크 복사 같은 브라우저 표준 동작을 공짜로 얻는다. 홈 카드가 `role="button"`인 것과 대비되는데, 카드는 모달을 여는 동작이라 성격이 다르다.
- **`useActiveSection` 삭제**: GNB 활성 탭 판정이 유일한 호출처였다. 홈 화면에서 섹션으로 점프하는 수단이 없어졌지만, 지표가 12개뿐이라 스크롤 부담이 크지 않다고 판단해 대체 UI를 만들지 않았다(YAGNI).
- **소개 페이지가 `SECTIONS`를 재사용하지 않음**: 소개 문구의 분류·순서는 대시보드 레이아웃과 독립적으로 바뀔 수 있다(예: 소개에서는 국채 3종을 한 항목으로 묶어 설명). id 기반 상수와 사람이 읽는 설명문은 결합도가 다르다.
- **미디어 파이프라인을 `collect.py`와 분리**: 도메인이 다르고(주가 시계열 vs 미디어 목록), 실패 정책도 다르다. 주가는 3영업일 stale을 워크플로우 실패로 승격시키지만, 영상이 며칠 안 올라오는 것은 정상이다.
- **`youtube_rss.fetch`의 시그니처가 기존 어댑터와 다름**: 기존은 `fetch(indicator_id, start, end) -> DataFrame`이지만 미디어는 시계열이 아니라 목록이라 pandas가 불필요하다. `sources/`에 두는 것은 "외부 데이터 어댑터"라는 역할이 같기 때문.
- **새 영상이 없으면 빌드·배포 스킵**: 매시간 실행이라 무변경 시에도 배포하면 하루 24번 불필요한 Pages 배포가 발생한다. `git diff --cached --quiet` 결과를 스텝 output으로 넘겨 조건부 실행한다.

## 범위에서 제외한 것과 이유

- **인스타그램(`alex.ods5`)**: Meta Business Discovery API는 (1) 대상 계정이 Business/Creator 계정이어야 하고 (2) 요청하는 앱이 App Review와 Business Verification을 통과해야 한다. 개인 프로젝트 규모에서 통과 가능성·소요 기간이 모두 불확실해 2단계 백로그로 이관했다.
- **유튜브 커뮤니티 게시글**: 공식 API에 해당 엔드포인트가 없고 RSS에도 포함되지 않는다. 비공식 HTML 스크래핑은 구조 변경·차단 리스크가 커서 사용자와 협의해 제외했다.

## 미결 질문

- (없음)
```

- [ ] **Step 4: steering 문서 갱신**

`docs/steering/tech.md`의 "스택" 표에서 `자동화` 행의 비고를 다음으로 교체한다:

```
| 자동화 | GitHub Actions cron | 장전 `10 23 * * 0-5`, 장후 `40 9 * * 1-5` (UTC) + 정규장 중 준실시간 `*/30 0-6 * * 1-5`(UTC, 9개 지표만) + 미디어 `25 * * * *`(매시간, 유튜브 RSS) |
```

`docs/steering/design.md`의 레이아웃 섹션에서 GNB 설명 줄을 다음으로 교체한다:

```
- **GNB**(상단 고정 아님·문서 흐름 내 위치): 로고 `todayfin` + 페이지 탭 3개(홈/소개/알상무, 해시 라우트 전환) + 다크모드 토글 + 마지막 갱신 시각. 배경 `--canvas`, 하단 `--hairline`. 2026-08-03: 기존 섹션 스크롤 탭(수급/시장 가격·추세/거시·통화/원자재)을 페이지 전환 탭으로 교체 — 섹션 구획 자체는 홈 화면 안에 그대로 유지된다(`docs/specs/content-pages/` 참조).
```

`docs/steering/design.md`의 티커 바 설명 줄 끝에 다음을 덧붙인다:

```
홈(`#/`)·상세(`#/i/{id}`)에서만 노출하고 소개·알상무 페이지에서는 숨긴다.
```

- [ ] **Step 5: 커밋·푸시**

```bash
git add docs/specs/content-pages/implemented.md docs/steering/tech.md docs/steering/design.md
git commit -m "docs: content-pages 구현 기록 및 steering 문서 갱신"
git push
```

- [ ] **Step 6: 배포된 사이트에서 최종 검증**

푸시 후 `deploy.yml`이 자동 트리거된다. 완료 확인:

```bash
sleep 10
gh run list --repo jelitz/todayfin --workflow=deploy.yml --limit 1
```

완료되면 브라우저로 `https://jelitz.github.io/todayfin/?v=5` 에 접속해 Step 1의 5개 항목을 실배포 환경에서 다시 확인한다.
