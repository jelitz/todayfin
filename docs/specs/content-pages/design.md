# Design — content-pages

요구사항은 [`requirements.md`](requirements.md) 참조. 이 문서는 구현 구조·인터페이스·트레이드오프를 다룬다.

## 아키텍처 개요

두 개의 독립적인 변경이 하나의 스펙으로 묶여 있다:

1. **프론트 라우팅 전환** — 기존 해시 라우팅(`#/`, `#/i/{id}`)에 페이지 라우트 2개를 추가하고, GNB 탭의 의미를 "섹션 스크롤"에서 "페이지 전환"으로 바꾼다. 새 의존성 없음.
2. **미디어 수집 파이프라인** — 유튜브 RSS를 주기적으로 가져와 `data/youtube.json`으로 배포하는, 기존 주가 파이프라인과 완전히 분리된 경로.

두 변경은 `data/youtube.json`이라는 파일 계약으로만 만난다.

## 1. 프론트 라우팅

### 라우트 정의

`web/src/App.tsx`의 `Route` 타입을 확장한다:

```ts
type Route =
  | { name: 'home' }
  | { name: 'detail'; id: string }
  | { name: 'about' }
  | { name: 'alsangmoo' }
```

`parseHash`는 `#/about` → `{name:'about'}`, `#/alsangmoo` → `{name:'alsangmoo'}`로 매핑하고, 그 외 알 수 없는 해시는 기존대로 `{name:'home'}`으로 폴백한다. `#/i/{id}` 매칭이 먼저 평가되는 순서는 유지한다.

`parseHash`는 현재 `App.tsx` 안의 로컬 함수라 테스트가 불가능하다. 라우트 분기가 4개로 늘어나면서 단위 테스트 가치가 생겼으므로 `web/src/lib/route.ts`로 분리한다(`lib/`의 다른 순수 함수들 — `ma.ts`, `stale.ts`, `format.ts` — 와 같은 패턴).

### 페이지 렌더링 구조

`AppShell`은 route에 따라 `<main>` 내용을 전환한다:

| route | main 내용 | 티커 바 |
|-------|-----------|---------|
| `home` | `<Home>` | 표시 |
| `detail` | `<Home>` + `<Modal><Detail></Modal>` | 표시 |
| `about` | `<About>` | 숨김 |
| `alsangmoo` | `<Alsangmoo>` | 숨김 |

`detail`에서 `<Home>`을 함께 렌더링하는 기존 구조(모달 뒤에 홈이 비치는 UX)는 그대로 유지한다.

### GNB

`GnbProps`를 페이지 탭 기반으로 교체한다:

```ts
export interface GnbTab {
  label: string
  hash: string        // 예: '#/', '#/about'
  routeName: string   // 예: 'home', 'about' — 활성 판정용
}

export interface GnbProps {
  tabs: GnbTab[]
  activeRouteName: string
  updatedAtLabel: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}
```

탭은 `<button>` + `window.location.hash` 대입 대신 **`<a href>`로 렌더링**한다. 해시 링크는 브라우저가 기본 처리하므로 JS 없이도 동작하고, 새 탭으로 열기·링크 복사 같은 표준 브라우저 동작을 얻는다(기존 카드 클릭이 `role="button"`인 것과 달리, 여기는 진짜 내비게이션이므로 앵커가 의미상 맞다). 활성 판정은 `activeRouteName === tab.routeName`.

`detail` route일 때는 `activeRouteName`으로 `'home'`을 넘겨 홈 탭이 활성으로 보이게 한다 — 상세는 홈의 모달이므로 별도 탭이 아니다.

### useActiveSection 처리

`web/src/lib/useActiveSection.ts`는 GNB 활성 탭 판정 용도로만 쓰이고 있었다. 페이지 탭으로 바뀌면 호출처가 사라지므로 훅 파일과 테스트를 삭제한다. 홈 화면의 섹션(`SECTIONS`)과 `id={section.anchor}` 속성은 그대로 두되(향후 앵커 링크 여지), IntersectionObserver 구독은 없앤다.

**트레이드오프**: 홈 화면에서 섹션으로 바로 점프하는 수단이 사라진다. 지표가 12개뿐이고 홈이 한 화면에 가까워 스크롤 부담이 크지 않다고 판단해 별도 대체 UI(사이드 목차 등)를 만들지 않는다 — YAGNI. 필요해지면 그때 홈 내부에 섹션 칩을 두는 편이 GNB에 두는 것보다 맥락에 맞다.

## 2. 소개 페이지 (`About.tsx`)

정적 텍스트만 렌더링한다. 데이터 fetch·상태 없음.

콘텐츠는 컴포넌트 파일 내 상수로 관리한다:

```ts
const INDICATOR_NOTES: { section: string; items: { name: string; note: string }[] }[] = [...]
```

`types.ts`의 `SECTIONS`를 import해 재사용하지 않고 별도 상수로 둔다 — 소개 문구의 분류·순서가 대시보드 레이아웃과 독립적으로 바뀔 수 있고(예: 소개에서는 국채를 한 항목으로 묶어 설명), `SECTIONS`는 id 기반이라 사람이 읽는 설명문과 결합도가 다르다. 대신 지표 이름은 `requirements.md` R1 표와 일치시킨다.

## 3. 알상무 페이지 (`Alsangmoo.tsx`)

### 데이터 로딩

기존 `Detail.tsx`의 fetch 패턴을 그대로 따른다 — 캐시 버스팅(`?_=${Date.now()}` + `cache: 'no-store'`) 필수. GitHub Pages CDN 캐시로 새 영상이 안 보이는 문제를 방지한다(near-realtime-updates에서 실측으로 확인된 이슈).

로딩·에러·정상 3상태. 에러 시 채널 바로가기 링크를 함께 노출해 사용자가 막다른 길에 갇히지 않게 한다.

### UI

카드 그리드는 `Home.css`의 `.home-grid`와 같은 브레이크포인트(1280px 3열 / 850px 2열 / 그 이하 1열)를 쓰되, 별도 CSS 파일(`Alsangmoo.css`)로 둔다 — 썸네일 16:9 비율 유지가 필요해 카드 내부 구조가 지표 카드와 다르다.

카드는 `<a href={watch_url} target="_blank" rel="noopener noreferrer">`. 유튜브 이탈이 의도된 동작이므로 앵커가 맞다.

썸네일은 `loading="lazy"` + `aspect-ratio: 16/9` + `object-fit: cover`. RSS가 주는 `hqdefault.jpg`는 4:3 레터박스가 있는 경우가 있어 `cover`로 잘라낸다.

## 4. 미디어 수집 파이프라인

### `pipeline/sources/youtube_rss.py`

```python
def fetch(channel_id: str) -> dict:
    """반환: {channel_name, channel_url, videos: [...]} — generated_at은 호출측에서 붙인다."""
```

표준 라이브러리 `xml.etree.ElementTree`로 파싱한다(외부 파서 불필요 — Atom 피드 구조가 단순하고 고정적). Atom/media/yt 네임스페이스 3개를 다룬다.

기존 소스 어댑터(`fetch(indicator_id, start, end) -> pd.DataFrame`)와 시그니처가 다른데, 이건 의도적이다 — 미디어는 시계열이 아니라 목록이라 pandas가 불필요하고, `collect.py`의 지표 레지스트리에 등록되지도 않는다. 같은 `sources/` 디렉터리에 두는 것은 "외부 데이터 어댑터"라는 역할이 같기 때문.

`media:thumbnail`이 없는 항목은 `thumbnail_url: None`으로 두고, 프론트에서 플레이스홀더를 표시한다(RSS 스펙상 항상 있지만 방어).

### `pipeline/collect_media.py`

`collect.py`의 스테이징→원자적 교체 패턴을 재사용하되, 훨씬 단순하다(지표 루프·검증·summary 생성 없음):

1. RSS fetch (재시도 2회, `collect.py`와 동일한 백오프)
2. 최소 검증: `videos`가 비어 있지 않고 각 항목에 `video_id`/`title`/`watch_url`이 있는지
3. `.staging/youtube.json`에 쓴 뒤 `os.replace`로 교체
4. 실패 시 기존 파일 유지하고 **exit 0** — 영상이 안 올라오거나 RSS가 일시적으로 죽는 것은 정상 범주라 워크플로우를 실패시키지 않는다

**주가 파이프라인과의 차이**: `collect.py`는 3영업일 stale을 실패로 승격시키지만(데이터 누락이 곧 대시보드 오류), 미디어는 그 개념이 없다. 대신 fetch 실패는 로그에 명시적으로 남겨 Actions 로그에서 추적 가능하게 한다.

### `.github/workflows/media-collect.yml`

`collect-and-deploy.yml`과 동일한 구조(수집→커밋→빌드→Pages 배포 단일 잡)를 따른다. GITHUB_TOKEN 커밋이 후속 워크플로우를 트리거하지 않는 제약 때문에 배포까지 같은 잡에서 끝내야 한다.

cron: `25 * * * *` — 매시 25분(정각 회피). 기존 워크플로우들과 시간대가 겹치지 않는다.

`concurrency: group: pages`를 공유해 `collect-and-deploy.yml`과 동시 배포 충돌을 막는다.

## 테스트 전략

| 대상 | 방식 |
|------|------|
| `lib/route.ts` | vitest — 4개 라우트 + 알 수 없는 해시 폴백 + `%` 인코딩 깨진 id |
| `sources/youtube_rss.py` | pytest — 실제 RSS 응답 픽스처 파싱, 빈 피드, 잘못된 XML |
| `collect_media.py` | pytest — fetch 실패 시 기존 파일 보존 |
| 통합 | dev 서버 + claude-in-chrome으로 GNB 탭 전환·티커 노출/숨김·알상무 카드 렌더 확인 |

RSS 픽스처는 2026-08-03 실제 응답을 `pipeline/tests/fixtures/youtube_rss.xml`로 저장해 사용한다(네트워크 의존 테스트 회피).
