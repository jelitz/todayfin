# Requirements — alsangmoo-player

알상무 페이지 영상을 유튜브 이탈 없이 모달에서 바로 재생하고, 페이지를 열어둔 동안에도 새 영상이 자동 반영되게 한다.

## 배경과 목적

현재 영상 카드는 유튜브 새 탭으로 이탈한다(content-pages 스펙의 의도된 설계였음). 사용자가 사이트 내 재생을 요청했고, 인터뷰(2026-08-08)에서 **모달 방식**을 채택했다 — 지표 상세(`#/i/{id}`)와 동일한 조작 문법(클릭→모달, ESC·뒤로가기·배경 클릭 닫기), 검증된 Modal 컴포넌트 재사용, 3열 그리드 카드 폭(~400px)에서 인라인 플레이어가 너무 작다는 근거. **이 스펙은 content-pages design.md §3의 "카드는 유튜브 새 탭 이탈" 결정을 대체한다.**

수집은 이미 매시 25분 cron이 갱신 중이므로, 남은 갭인 "페이지를 열어둔 동안"의 클라이언트 측 갱신을 함께 다룬다(사용자 요청 4번).

## 요구사항

### 모달 재생

- R1. WHEN 영상 카드를 클릭하면 THEN `#/alsangmoo/v/{videoId}`로 이동하고 모달에서 임베드 플레이어가 자동재생돼야 한다.
  - iframe: `https://www.youtube-nocookie.com/embed/{id}?autoplay=1&rel=0&playsinline=1`(프라이버시 강화 모드 — 시청이 개인화·광고에 사용되지 않음), `allow="autoplay; encrypted-media; picture-in-picture"`, `allowfullscreen`, `title`=영상 제목
  - 알려진 한계: iOS Safari는 클릭 후 삽입된 iframe의 autoplay를 무시할 수 있어 재생 버튼을 한 번 더 탭해야 할 수 있다(WebKit 정책, 무해한 폴백으로 수용)
- R2. WHEN 모달을 닫으면(ESC·배경 클릭·✕·브라우저 뒤로가기) THEN `#/alsangmoo`로 복귀하고 재생이 정지돼야 한다(iframe unmount로 자동 정지).
- R3. 모달 안에 "유튜브에서 보기 ↗"(새 탭, `watch_url`) 링크가 항상 표시돼야 한다 — 저작권·지역 차단 등 사전 감지 불가능한 재생 실패의 최종 안전망.
- R4. 파이프라인은 `videos.list part=status`(+1유닛/실행, 하루 48→72유닛 — 무료 한도 10,000의 0.7%)로 `embeddable`을 수집해 `youtube.json` 각 항목에 포함해야 한다. WHEN `embeddable === false` THEN 해당 카드는 모달 대신 기존 새 탭 앵커로 동작하고 외부 링크 표시를 보여야 한다. 필드 누락 시 true로 취급한다(status 호출 실패가 전체 수집을 막지 않게).
- R5. 피드(최신 15개 롤링)에 없는 videoId의 딥링크도 재생을 허용한다 — 제목 없이 플레이어만 표시(과거 공유 링크 대응).

### 자동 갱신 (클라이언트)

- R6. WHEN 알상무 페이지가 열린 상태에서 문서가 다시 visible이 되거나(`visibilitychange`) 마지막 조회 후 5분이 지나면 THEN `youtube.json`을 캐시 버스팅으로 재조회해 목록을 갱신해야 한다.
- R7. 목록 갱신은 재생 중인 모달을 방해하지 않아야 한다(모달은 videoId 기준 — 목록 상태와 독립).

## 검증 계획

- vitest: `route.ts` 확장(`#/alsangmoo/v/{id}` 매칭, 특수문자 방어, 기존 라우트 회귀), 재조회 트리거 로직(타이머·visibility)
- pytest: `videos.list` 응답에서 embeddable 병합, status 호출 실패 시 embeddable 생략하되 수집은 성공 처리
- 브라우저: 재생→닫기→뒤로가기 동작, 자동 갱신(모의), 다크모드, 모바일 뷰포트
- 쿼터: 배포 후 Google Cloud Console에서 실사용량 1회 확인 [제안]

## 범위 제외 (백로그)

- cron 주기 단축(매시 → 15분, 하루 96유닛) — 필요 시 별도 결정
- IFrame Player API 기반 재생 오류(101/150) 자동 감지 — ~1MB 스크립트 대비 이득 작음, R3 링크로 갈음
- 인스타그램(`alex.ods5`)·유튜브 커뮤니티 게시글 — content-pages 백로그 유지
