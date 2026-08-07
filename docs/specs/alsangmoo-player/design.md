# Design — alsangmoo-player

요구사항은 [`requirements.md`](requirements.md) 참조. 두 갈래 변경: ① 프론트(라우트 확장 + 모달 플레이어 + 자동 갱신) ② 파이프라인(`embeddable` 필드 수집). 만나는 지점은 `youtube.json`의 `embeddable` 필드 하나다.

## 1. 라우팅

`web/src/lib/route.ts`:

```ts
export type Route =
  | { name: "home" }
  | { name: "detail"; id: string }
  | { name: "about" }
  | { name: "alsangmoo"; videoId: string | null }
```

`parseHash`에서 `/alsangmoo` 완전일치보다 **먼저** `/^\/alsangmoo\/v\/([A-Za-z0-9_-]+)$/`를 매칭한다(유튜브 영상 ID 문자집합 — `decodeURIComponent` 불필요). 매칭 실패한 `#/alsangmoo/v/` 이하 변형은 기존 규칙대로 home 폴백이 아니라 **`{name:"alsangmoo", videoId:null}`로 보내는 게 자연스러우나**, 라우팅 단순성을 위해 정규식 불일치는 기존 폴백 체계(home)를 유지한다 — 실사용 진입로는 카드 클릭(항상 유효한 id)뿐이다.

`App.tsx`: `route.name === 'alsangmoo'` 분기에서 `<Alsangmoo videoId={route.videoId} />` 전달. GNB 활성 판정(`activeRouteName`)은 `alsangmoo`로 동일 — 변경 없음.

## 2. Alsangmoo 컴포넌트

### 카드 분기 (R1·R4)

```tsx
video.embeddable === false
  ? <a href={video.watch_url} target="_blank" rel="noopener noreferrer">…카드… ↗</a>  // 현행 유지 + 외부 표시
  : <a href={`#/alsangmoo/v/${video.video_id}`}>…카드…</a>                             // 모달 열기
```

해시 앵커는 브라우저 기본 동작으로 히스토리 push → 뒤로가기가 모달 닫기가 된다(지표 상세와 동일한 문법).

### 플레이어 모달 (R1~R3·R5)

`videoId != null`이면 목록 위에 기존 `Modal` 재사용:

```tsx
<Modal onClose={() => (window.location.hash = '#/alsangmoo')}>
  <div className="alsangmoo-player">
    <h2>{feed?.videos.find(v => v.video_id === videoId)?.title ?? ''}</h2>
    <div className="alsangmoo-player-frame">  {/* aspect-ratio: 16/9 */}
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
        title={title || '알상무 영상'}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
    <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">
      유튜브에서 보기 ↗
    </a>
  </div>
</Modal>
```

- **모달 내 레이아웃**(`Alsangmoo.css`에 추가): `.alsangmoo-player`에 `max-width: 960px; margin: 0 auto; padding: 32px`(Detail.css와 같은 패턴 — Modal의 ✕ 버튼(absolute 16px)과의 오버랩 회피 겸용). Modal 패널 자체는 1280px 폭이지만 16:9 프레임을 960px로 제한해 일반 노트북 뷰포트(~800px 높이)에서 플레이어 전체와 하단 링크가 첫 화면에 들어오게 한다.
- 모달이 언마운트되면 iframe이 제거되어 재생이 자동 정지된다(R2 — 별도 처리 불필요).
- 피드에 없는 videoId(과거 공유 링크): 제목만 빈 값이고 플레이어·외부 링크는 동작(R5). `watch_url`도 피드가 아니라 videoId에서 직접 조립 — 피드 의존 제거.
- Modal은 목록을 소유한 Alsangmoo 내부에서 렌더 — 모달을 여닫아도 목록 fetch 상태·스크롤이 보존된다.
- ESC로 닫은 직후 뒤로가기 시 모달 재열림은 기존 지표 상세와 동일한 특성 — 일관성 차원에서 수용.

### 자동 갱신 (R6·R7)

`App.tsx`의 summary 폴링과 동일한 요구(5분 간격 + visibilitychange 복귀 시 즉시 + 실패 시 기존 값 유지 + 최초 실패만 에러 표시)가 두 번째 호출처로 생겼으므로, 공용 훅으로 추출한다:

```ts
// web/src/lib/usePolledJson.ts
export function usePolledJson<T>(path: string, intervalMs: number): { data: T | null; error: boolean }
```

- 내부는 현재 App.tsx 구현을 그대로 이전: 캐시 버스팅(`?_=${Date.now()}` + `no-store`), `hasLoadedRef`(성공 이력 있으면 폴링 실패를 에러로 승격하지 않음), hidden 시 폴링 정지·복귀 시 즉시 재조회.
- **`HomeProps.error`를 `string | null` → `boolean`으로 변경한다**(영향 범위에 포함 — 2026-08-08 검증에서 확인). Home은 에러 문자열 내용을 쓰지 않고 고정 문구를 렌더하므로 정보 손실이 없고, 훅의 `error: boolean`을 App이 그대로 내려보낼 수 있다.
- `App.tsx`(summary)와 `Alsangmoo.tsx`(feed)가 함께 사용. App 폴링에는 기존 자동화 테스트가 **없다**(2026-08-08 검증 확인 — web/src 테스트는 lib 순수 함수뿐) — 훅 추출 후 신규 훅 테스트가 유일한 자동화 커버리지이고, App 통합 동작은 브라우저 검증으로 확인한다.
- 목록 갱신은 상태 교체일 뿐 Modal은 `videoId`(라우트)로만 결정되므로 재생을 방해하지 않는다(R7). 재생 중 영상이 피드에서 밀려나면 제목만 사라지고 플레이어는 유지(R5와 동일 경로).

## 3. 파이프라인 (`embeddable` 수집)

### `pipeline/sources/youtube_api.py`

`fetch()`에서 playlistItems 파싱 후 `videos.list`를 1회 추가 호출(+1유닛, id 최대 15개 콤마 연결):

```python
def merge_embeddable(videos: list[dict], status_body: dict) -> list[dict]:
    """videos.list part=status 응답의 embeddable을 video_id 기준으로 병합(순수 함수 — 테스트 진입점).
    응답에 없는 id는 필드를 넣지 않는다(프론트가 누락=true로 취급)."""
```

- `videos.list` 호출 실패 시: 경고 로그만 남기고 embeddable 없이 반환 — **목록 수집 자체를 실패시키지 않는다**(R4). `fetch()` 안에서 try/except로 감싼다.
- 모듈 상단 주석의 쿼터 계산(2유닛/실행)을 3유닛으로 갱신.

### 계약 갱신

- `web/src/types.ts` `YoutubeVideo`에 `embeddable?: boolean` 추가.
- `collect_media.py`: 무변경 — `_REQUIRED_VIDEO_FIELDS`에 embeddable을 넣지 않는다(선택 필드).
- `media-collect.yml`: 무변경(이름의 "(youtube RSS)" 표기는 낡았지만 이 스펙 범위 밖 — 커밋 김에 이름만 정리하는 것은 허용).

## 4. 테스트 전략

| 대상 | 방식 |
|------|------|
| `parseHash` | vitest — `#/alsangmoo/v/{id}` 매칭, 특수문자·빈 id는 home 폴백. **기존 단언 1건 수정 필요**: route.test.ts의 `#/alsangmoo` 기대값을 `{ name: "alsangmoo", videoId: null }`로 갱신(vitest toEqual은 null 값 키를 불일치로 판정 — 2026-08-08 검증 확인) |
| `usePolledJson` | vitest — 성공→데이터 갱신, 최초 실패→error, 성공 후 실패→기존 데이터 유지(기존 App 폴링 테스트가 있으면 훅 테스트로 이전) |
| `merge_embeddable` | pytest — 병합, 응답 누락 id는 필드 없음, status 호출 실패 시 fetch가 embeddable 없이 성공 |
| 통합 | 브라우저 — 카드 클릭→재생, ESC·뒤로가기·배경 클릭 닫기(재생 정지 확인), 딥링크 직접 진입, 다크모드, 모바일 뷰포트 |

## 문서 후속

구현 완료 시 `docs/specs/content-pages/design.md` §3에 "카드의 새 탭 이탈은 alsangmoo-player 스펙으로 대체됨" 주석을 추가한다(원문 수정 대신 대체 이력 명시).
