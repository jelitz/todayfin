# Requirements — content-pages

승인 이력: 브레인스토밍 인터뷰(2026-08-03)를 통해 사용자 승인됨.

## 배경

GNB의 기존 4개 탭("수급"/"시장 가격·추세"/"거시·통화"/"원자재")은 홈 화면 안의 섹션으로 스크롤 이동하는 용도였다. 사용자 요청으로 이를 coinglass 스타일의 "서로 다른 페이지로 전환되는 탭" 구조로 바꾸고, 신규 페이지 2개("소개", "알상무")를 추가한다.

## R1. GNB 재구성 (라우팅)

- WHEN 사용자가 GNB에서 탭을 클릭하면 THEN 시스템은 스크롤 이동이 아니라 해시 라우트 전환으로 해당 페이지를 표시해야 한다.
- GNB 탭 구성: `홈` / `소개` / `알상무` 3개. 기존 4개 섹션 스크롤 탭("수급" 등)은 GNB에서 제거한다.
- 홈 화면 내부의 섹션 구획(수급/시장 가격·추세/거시·통화/원자재, `types.ts`의 `SECTIONS`)과 카드 그리드는 변경하지 않는다 — 없어지는 것은 GNB의 탭일 뿐, 홈 화면 자체의 섹션 레이아웃은 그대로 유지된다.
- 라우트: `#/`(홈) · `#/i/{id}`(지표 상세, 기존 모달 동작 유지) · `#/about`(소개) · `#/alsangmoo`(알상무). 기존 `#/i/{id}` 링크의 하위 호환은 깨지지 않아야 한다.
- 티커 바는 홈(`#/`)에서만 노출한다. 소개·알상무 페이지에서는 숨긴다.
- GNB의 활성 탭 판정은 `route.name` 기준으로 한다(기존 `useActiveSection`의 IntersectionObserver 기반 판정은 GNB 활성 탭 용도로는 더 이상 쓰지 않는다).

## R2. 소개 페이지

- WHEN 사용자가 `#/about`으로 이동하면 THEN 시스템은 (1) 사이트를 만든 이유, (2) 지표별 특성 설명을 보여줘야 한다.
- 지표별 특성은 기존 4개 섹션 분류(수급/시장 가격·추세/거시·통화/원자재)를 그대로 사용해, 지표마다 1~2문장의 짧은 설명을 붙인다.
- 콘텐츠는 정적 텍스트로 코드에 인라인 상수로 관리한다(파이프라인·데이터 파일 불필요).
- UI는 카드·장식 없이 텍스트 블록 + 소제목 위주로 간단하게 구성한다.
- 문구 초안은 담당자(어시스턴트)가 작성하고, 사용자 검토·승인 후 확정한다.

## R3. 알상무 미디어 페이지

- WHEN 사용자가 `#/alsangmoo`로 이동하면 THEN 시스템은 알상무 유튜브 채널(`@rsangmoo`, 채널 ID `UCiDmfbYvuMEVbRxPmFP4sng`)의 최신 영상 목록을 게시일 최신순으로 보여줘야 한다.
- 감지 대상은 영상 업로드만이다. 유튜브 "커뮤니티 게시글"(텍스트/이미지/투표)은 공식 API가 없어 이번 범위에서 제외한다.
- 인스타그램(`instagram.com/alex.ods5`) 연동은 이번 범위에서 제외한다 — Meta Business Discovery API는 대상 계정이 Business/Creator 계정이어야 하고 요청 앱도 App Review·Business Verification을 통과해야 해서, 개인 프로젝트 규모에서 사실상 불가능하다고 판단했다. 2단계 백로그로 이관.
- 카드는 썸네일 + 제목 + 게시일로 구성하고, 클릭 시 유튜브(`watch_url`)로 새 탭 이동한다. 사이트 내 임베드 재생은 하지 않는다.
- 목록은 최신 15개를 그대로 표시한다(별도 페이지네이션·누적 저장 없음).

## R4. 데이터 파이프라인 (알상무)

- WHEN GitHub Actions가 매시간 실행되면 THEN 시스템은 YouTube Data API v3로 채널(`UCiDmfbYvuMEVbRxPmFP4sng`)의 최신 영상 목록을 가져와 `data/youtube.json`을 원자적 교체해야 한다.
- **소스 변경(2026-08-03)**: 최초 계획은 유튜브 RSS 피드였으나 GitHub Actions 러너 IP에서 일관되게 404가 반환돼 사용할 수 없었다. 공식 API로 전환하고 `YOUTUBE_API_KEY` secret을 추가했다 — 경위는 `implemented.md` 참조.
- 스키마:
  ```json
  {
    "channel_name": "알상무",
    "channel_url": "https://www.youtube.com/channel/UCiDmfbYvuMEVbRxPmFP4sng",
    "generated_at": "2026-08-03T12:00:00Z",
    "videos": [
      {
        "video_id": "mnErc78D7R4",
        "title": "당일전략 (0803 월)",
        "published_at": "2026-08-02T23:49:20+00:00",
        "thumbnail_url": "https://i2.ytimg.com/vi/mnErc78D7R4/hqdefault.jpg",
        "watch_url": "https://www.youtube.com/watch?v=mnErc78D7R4"
      }
    ]
  }
  ```
- API 키를 프론트에 노출할 수 없고 RSS 역시 CORS 헤더가 없어(2026-08-03 실측 확인), 수집은 반드시 서버 사이드(GitHub Actions)에서 하고 결과를 정적 JSON으로 배포한다.
- 구현은 기존 주가 데이터 파이프라인(`pipeline/collect.py`)과 완전히 분리한다: `pipeline/sources/youtube_api.py`(API 호출·파싱) + `pipeline/collect_media.py`(신규 스크립트) + `.github/workflows/media-collect.yml`(신규 워크플로우, cron 매시간·정각 회피 오프셋). 주가 데이터 수집(`collect-and-deploy.yml`)과 스케줄·장애를 독립시켜, 미디어 수집 실패가 대시보드 배포에 영향을 주지 않도록 한다.
- 배포는 기존 패턴과 동일하게 GITHUB_TOKEN 커밋이 재귀 트리거를 일으키지 않는 원칙을 지키며, 같은 잡 안에서 커밋→빌드→Pages 배포까지 완결한다.

## R5. 에러 처리 / 엣지 케이스

- API 요청 실패 시 기존 `data/youtube.json`을 그대로 유지한다(빈 목록으로 덮어쓰지 않음) — 기존 파이프라인의 "실패 시 stale 유지, 조용한 왜곡 방지" 원칙과 동일하게 적용한다.
- 미디어 데이터에는 주가 데이터의 "3영업일 stale 실패 승격" 개념을 적용하지 않는다 — 영상이 며칠 올라오지 않는 것은 정상적인 상황이라 워크플로우 실패로 취급하지 않는다.
- `data/youtube.json`이 아예 없거나 fetch 실패 시, 알상무 페이지는 "불러오지 못했습니다" 안내와 채널 링크(유튜브로 바로 이동)만 표시한다.
- 잘못된 해시(`#/unknown`)는 기존 동작대로 홈으로 처리한다(변경 없음).

## R6. 테스트 계획

- `pipeline/sources/youtube_api.py`: playlistItems 응답 파싱 단위 테스트(필드 매핑, 최신순 정렬, 썸네일 해상도 선택, 비공개·삭제 영상 제외, 빈 응답).
- 프론트: 라우트 파싱(`parseHash`)에 `#/about`/`#/alsangmoo` 케이스 추가, GNB 탭 클릭 시 라우트 전환 확인.
- Stage 3와 동일하게 dev 서버 + 브라우저(claude-in-chrome)로 실제 화면(GNB 탭 전환, 소개 페이지, 알상무 카드 그리드, 티커바 노출/숨김) 검증.

## 범위 외 (2단계 백로그)

- 인스타그램(`alex.ods5`) 연동 — 공식 API 제약 때문에 자동화 보류. 재검토 시 프로필 링크 버튼 또는 수동 큐레이션 방식부터 검토.
- 유튜브 커뮤니티 게시글 — 공식 API 없음, 비공식 스크래핑 리스크 때문에 제외.
- 신규 영상 "NEW" 배지, 알림 기능 등 부가 UX.
