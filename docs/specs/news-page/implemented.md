# Implemented — news-page

구현 착수 전 스펙 단계 기록. 구현 진행에 따라 편차·검증 절을 갱신한다.

## 설계 결정 (스펙 단계)

- 인터뷰 확정: 탭 2개(주요뉴스=구글 랭킹순 / 최신뉴스=시간순 — 우리가 가진 신호 2개에
  1:1 대응), 텍스트 피드(썸네일 크롤링 배제), 전체 건수 노출 + data-rights 갱신.
- 아키텍처 A안(스냅숏 + 클라이언트 정렬) 채택 — B안(축적 아카이브)은 병합 상태·구글 URL
  중복 판정 미검증 리스크로 배제.
- 티커 바는 뉴스 페이지에서도 노출(사용자 확정) — 클릭 시 홈+상세 모달 이탈은 수용.

## 적대적 검증 반영 (2026-08-08, 3-agent 워크플로우 — major 7·minor 15)

- **로딩 플래시**: usePolledJson 첫 응답 전 data=null을 isFreshNews가 실패로 오판 →
  진입 때마다 오류 문구 플래시. News 컨테이너 3-상태(로딩=빈 본문 / 미성공·24h stale=문구 /
  fresh=렌더)로 개정, R5 정밀화(첫 성공 이후 일시 실패는 기존 값 유지).
- **테스트 전략 정합**: repo는 jsdom 없는 renderToStaticMarkup 전략 — fetch·클릭 내장
  단일 컴포넌트는 검증 불가 → News(컨테이너)/NewsView(프레젠테이션, initialTab prop) 분리.
- **ARIA**: tabpanel·키보드 없는 role="tab"은 반쪽 패턴이라 유해 → aria-pressed 토글
  버튼 2개로 단순화.
- **티커 클릭 이탈**: 뉴스에서 티커 클릭 → 홈+상세 모달, 닫으면 홈(복귀 없음) — 라우트
  구조 변경 비용 대비 수용, 설계에 명문화.
- **문서 접점 보강**: steering tech.md 소스 표(전례 대비 누락)·About.tsx·news-headlines
  구 스펙 supersession 주석 추가. collect_news.py docstring 5건 표기도 T1 범위로.
- 기타: pill-btn 스케치·프로즈 모순 정리(.news-tab 복제 선언으로 확정), source null 시
  고아 구분점 방지 규칙, .news-page 컨테이너 폭 명세(Home 문법), tasks 의존 그래프
  T5→T6·T6→T7 보강, 배포 직후 주요뉴스 탭 빈 윈도 수용(+푸시 직후 dispatch로 완화).

## 계획과의 편차

- 구현은 ultracode 동적 워크플로우(8-agent, 웨이브 4개: T1·T2·T3·T4·T8 병렬 → T5 → T6 →
  T7)로 실행 — 에이전트는 편집·스코프 테스트만, 커밋·최종 게이트는 메인 루프.
- 커밋 단위: 계획의 태스크별 11커밋 대신 파일셋 기준 7커밋(T2+T3 lib 통합, T6의
  newsPageState는 lib/news.ts 파일 단위로 T2 커밋에 포함) — 병렬 편집 후 순차 커밋 제약.
- formatNewsRelativeTime 배치는 "파일 끝" 대신 formatNewsTime 바로 뒤(뉴스 시각 포맷 응집).
- 계획 T2 Step 4의 "테스트 7건" 기대는 오기 — 실제 6건(코드 블록 기준) 전부 통과.
- index.html: 현행 description이 뉴스 페이지 신설 후에도 정확해 무변경으로 확정(T8 Step 7).
- vite.config.ts base 변경·web/public/CNAME(todayfin.jelitz.com)은 이 기능과 무관한
  사용자 병행 작업으로 확인 — news-page 커밋에서 제외.

## 검증

- 2026-08-08 게이트(메인 루프 직접 실행): tsc -b 무에러, vitest 122/122(신규:
  news 9·format 6·route 2·NewsHeadlines 3·NewsView 6·News 1), oxlint 에러 0(기존 경고
  2건 유지), vite build 성공, pytest 72/72(uv --python 3.12 — 로컬 PATH python 3.9의
  3.10+ 문법 collection 실패 회피, repo 확립 관례).
- 2026-08-08 로컬 실측(T10): 실수집 70건(`--data-dir web/public/data`), dev 브라우저에서
  고정 5건(+`--surface` 구분감)·주요뉴스 탭 6번째부터·최신뉴스 시간순 재정렬(3h→13h)·
  다크/라이트 정상·홈 "더보기 →" 이동·피드 클릭 시 구글 경유 원문 도달(MIT 테크놀로지
  리뷰 실측) 확인. 모바일(≤640px)은 브라우저 창 리사이즈가 환경 제약으로 미적용되어
  CSS 미디어쿼리 검토로 갈음 — 배포 후 실기기 확인 권장.
- 2026-08-08 배포 실측(T11): push → media-collect dispatch(run 31262179956 성공) →
  media-collect 내장 Pages 배포. `http://todayfin.jelitz.com/data/news.json` 70건
  (generated 14:32Z), 배포 번들 해시가 로컬 검증 빌드와 동일(index-CCFvLth4.js) —
  뉴스 페이지 코드 포함 확인. github.io → 커스텀 도메인 301.
  **주의**: 배포 브라우저 픽셀 실측은 두 가지 환경 제약으로 미완 — (1) 커스텀 도메인
  HTTPS 인증서 발급 대기(HTTP는 200), (2) Claude-in-Chrome 확장에 새 도메인 사이트
  권한 없음. 렌더링 자체는 동일 코드·데이터로 로컬 실측 완료.

## 배포 후 개정 (2026-08-08, T12 — 사용자 피드백)

- **페이지네이션**: 전체 렌더 → 20건/페이지 + `‹ 1 2 3 4 ›` 번호 버튼(활성 accent·
  aria-current, 탭 전환 시 1페이지 리셋, 페이지 전환 시 탭 상단 scrollIntoView).
- **시각 표기**: 상대 시각("n시간 전") → 항상 KST "MM.DD HH:MM"(피드·고정 블록·홈 블록
  공통, 오늘 여부 무관 날짜 표기). `formatNewsRelativeTime`은 도입 당일 폐기·삭제.
- 검증: tsc 무에러, vitest 119/119(상대시각 6건 삭제·페이지네이션 3건 등 추가), lint
  기존 경고만. 로컬 브라우저: 날짜 표기·20건·페이지 전환·상단 복귀 실측.

## 미결 질문

- 고정 블록 "주요 뉴스" h2와 탭 라벨 "주요뉴스"의 이름 중복 — 연속 목록으로 읽혀 수용.
  혼란이 실측되면 "상단 고정 5건 제외" 캡션 추가.
