# Design — news-headlines

2026-08-08 적대적 검증(3-agent 워크플로우) 반영: git add 파일 부재 실패·stale 사각지대·
limit 순서·pubDate naive 가드·말줄임 flex 명세·동시성 수용 조건·문서 목록 보강.
판정 기록은 implemented.md 참조. **R5는 조건부로 수정**(24h 초과 시 숨김 — requirements 갱신).

## 데이터 흐름

```
Google News RSS (BUSINESS, hl=ko&gl=KR&ceid=KR:ko)
  → pipeline/sources/google_news.py  (fetch + 파싱, defusedxml)
  → pipeline/collect_news.py         (재시도·검증·원자적 교체 — collect_media.py 패턴)
  → data/news.json                   (매시간, media-collect.yml)
  → web: usePolledJson(5분)          (Home 내부)
  → NewsHeadlines 컴포넌트           (소개문과 지표 그리드 사이)
```

## data/news.json 스키마

```json
{
  "generated_at": "2026-08-08T05:25:00+00:00",
  "items": [
    { "title": "뉴욕 증시, S&P500 사상 최고치", "url": "https://news.google.com/rss/articles/...",
      "source": "연합뉴스TV", "published_at": "2026-08-08T02:14:00+00:00" }
  ]
}
```

- items는 피드 상위 5건(피드 순서 = 구글 랭킹). `source`는 `<source>` 태그 값, 없으면 null.
- `published_at`: pubDate(RFC 2822)를 `email.utils.parsedate_to_datetime`으로 ISO 8601 변환.

## pipeline/sources/google_news.py

- `FEED_URL = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko"`
- `fetch(limit=5) -> list[dict]`: requests(UA 헤더, timeout 20) → **defusedxml.ElementTree**로
  파싱(외부 XML은 시스템 경계 — XXE·entity 폭탄 방어) → **전체 item을 파싱·필터한 뒤 앞에서
  limit건 절단**(검증 지적 — 절단 후 필터면 불량 item 탓에 5건 미만이 되는 불필요한 손실):
  - title: `" - {source}"` 접미사가 정확히 일치하면 제거(rsplit 1회), strip.
  - url: `<link>` 그대로. **알려진 제약**(검증 지적): rss/articles URL은 서버측 리다이렉트가
    아니라 JS 인터스티셜 경유 — 새 탭에 구글 중간 페이지가 잠깐 보인 뒤 원문 이동. 구글이
    포맷을 바꾸면 링크가 전면 사망할 수 있는 비보장 경로임을 수용(대안 없음 — 원문 URL은
    피드에 미포함).
  - published_at: pubDate 파싱 실패 시 해당 item 스킵. **파싱 결과가 naive(tzinfo 없음)면
    UTC를 부여**(검증 지적 — RFC 2822 "-0000"은 naive로 반환돼 프런트에서 로컬 오해석).
  - title 또는 url이 비면 스킵.
- 필터 후 0건이면 raise (빈 응답·차단 감지).

## pipeline/collect_news.py

`collect_media.py`와 동일 골격 (의도적 대칭 — 유지보수 시 한쪽을 보면 다른 쪽이 보임):

- `_fetch_with_retry`: 2회 재시도(5s/15s).
- `_validate`: items 1건 이상, 각각 title/url/published_at 필수.
- 성공 시 `.staging/news.json` → `os.replace`로 원자적 교체. 실패 시 "[유지]" 로그 후
  exit 0 — 기존 news.json 보존, 워크플로우 비실패(R3).
- **stale 승격**(검증 지적 — 연속 실패 시 며칠 된 뉴스가 무알림으로 계속 노출):
  수집 실패 시 기존 news.json의 generated_at이 **24시간 초과면 `::warning` 어노테이션**
  출력(워크플로우는 계속 성공 — 유튜브 수집까지 막지 않기 위해 exit 1 승격은 하지 않음.
  최종 방어는 프런트 숨김, 아래).

## media-collect.yml 변경

- name·주석: "youtube RSS" → "youtube + news". Install deps: `pip install requests defusedxml`.
- Collect 스텝 뒤에 "Collect news" 스텝 추가: `python pipeline/collect_news.py`.
- Commit 스텝: **`git add data/`** (검증 지적 — `git add data/news.json` 명시는 첫 수집
  실패로 파일이 없으면 pathspec 오류 exit 128로 스텝이 죽어 유튜브 커밋까지 막음. media 잡
  체크아웃 후 data/ 하위 변경은 youtube/news뿐이라 디렉터리 add가 안전). 메시지
  "data: media sync ...".
- 배포 조건(changed == true)은 그대로 — 뉴스가 매시간 바뀌므로 사실상 매시간 배포로 전환
  (기존엔 유튜브 신규 영상 때만). Pages soft limit(10 배포/hr) 내.
- **동시성 수용 조건**(검증 지적): media-collect·collect-and-deploy·deploy가 concurrency
  group "pages"를 공유 — 덕분에 main 동시 push 충돌은 구조적으로 없지만, pending 슬롯은
  그룹당 1개라 cron 지연이 겹치면 media run이 교체·취소될 수 있고, 매시간 빌드로 잡 점유
  시간이 ~1분→수분으로 늘어 취소 창이 커짐. **취소돼도 다음 정시 런에서 자가 회복하므로
  수용**(매시간 갱신은 보장이 아닌 best-effort). 취소가 실제로 잦게 관측되면 media cron을
  장중 30분 격자에서 더 먼 오프셋(매시 40~50분)으로 이동.

## 프런트

### types.ts

```ts
export interface NewsItem { title: string; url: string; source: string | null; published_at: string }
export interface NewsFeed { generated_at: string; items: NewsItem[] }
```

### lib/format.ts — `formatNewsTime(iso: string, now?: Date): string`

KST 기준 오늘이면 `"HH:MM"`, 아니면 `"MM.DD HH:MM"`. `Intl.DateTimeFormat("ko-KR",
{ timeZone: "Asia/Seoul", ... })`의 `formatToParts`로 조립 — 로케일 출력 문자열 포맷을
가정하지 않고 파트를 직접 배치(사용자 로컬 타임존과 무관하게 KST 고정, R2). `now`는 테스트 주입용.

### components/NewsHeadlines.tsx (+ .css)

```
<section class="news" aria-label="주요 뉴스">
  <h2 class="news-title">주요 뉴스</h2>
  <ol class="news-list">
    <li class="news-item">
      <span class="news-time">10:32</span>
      <span class="news-source">연합뉴스TV</span>
      <a class="news-link" href={url} target="_blank" rel="noopener noreferrer">{title}</a>
    </li> ×5
  </ol>
</section>
```

- **1줄 말줄임 명세**(검증 지적 — ellipsis는 inline 요소에 적용되지 않음):
  `.news-item { display: flex; gap: 8px; align-items: baseline; }` +
  `.news-link { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
  (flex item의 min-width:auto 함정 회피). `.news-source`도 `flex-shrink: 0` + `max-width` +
  동일 말줄임.
- 박스: 1px `--hairline` 보더 + 8px 라운드(카드 문법), 내부 패딩 `--space-unit`×2. 행 간
  구분선 없음(컴팩트), 폰트 body-sm. news-time: tabular-nums `--ink-muted`.
  news-link: `--ink-body`, hover 시 `--accent`+underline.
- 모바일(≤640px): 출처명 숨김(시각+제목만) — 폭 확보.
- 데이터 잉크 아님 — 전부 테마 토큰이라 다크모드 자동 대응.

### Home.tsx

- `usePolledJson<NewsFeed>(BASE_URL + 'data/news.json', 5분)` — error 무시(없으면 조용히
  숨김, R4). 폴링 주기 상수는 Home 지역 상수(App의 SUMMARY_POLL_INTERVAL_MS와 공유 강제 안 함).
- **렌더 조건**: items 1건 이상 **이고 generated_at이 24시간 이내**일 때만 표시(R5 조건부 —
  검증 지적의 stale 최종 방어). 초과 시 블록 미렌더.
- 위치: intro와 지표 그리드 사이.

## 문서·부수 변경

- `data-rights.md`: Google News RSS 행 추가 — 피드 고지가 "개인 피드리더 내 비상업 이용"
  한정 명시. 헤드라인·출처·시각·원문 링크만 표시(본문·이미지 미수록, 5건 제한), 클릭 트래픽은
  구글 인터스티셜 경유로 원문 이동. 약관 문언상 근거 없음 → **⚠️ 대중 공유 게이트 항목**.
- App 푸터 출처 문자열에 "Google News" 추가. About "데이터에 대해"에 뉴스 한 줄 추가.
- **web/index.html** meta/og description에 뉴스 반영(검증 지적 — global-indicators 때 갱신 전례).
- steering `design.md`(레이아웃 절)·`tech.md`(소스 표). **`structure.md`는 기존 드리프트까지
  해소**(검증 지적): 데이터 계약 절에 youtube.json·news.json, 트리에 media-collect.yml·
  collect_news.py·collect_media.py.

## 테스트

- pytest `test_google_news.py`: 픽스처 XML로 접미사 제거·source·ISO 변환·필터 후 limit
  절단(불량 item이 상위에 섞여도 5건 확보)·"-0000" naive→UTC·불량 item 스킵·0건 raise.
  `test_collect_news.py`: validate 통과/실패, 실패 시 기존 파일 유지(tmp_path), 24h stale
  warning 경로.
- vitest: `formatNewsTime`(KST 오늘/과거·자정 경계), `NewsHeadlines` 렌더(5행·새 탭 속성),
  Home 렌더 조건(부재·빈 items·24h 초과 시 미렌더).
- 배포 실측: 헤드라인 5건 표시 + **실제 클릭 → 원문 도달**(검증 지적 — 구글 인터스티셜 경유 확인).
