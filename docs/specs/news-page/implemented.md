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

- (구현 전)

## 검증

- (구현 전)

## 미결 질문

- 고정 블록 "주요 뉴스" h2와 탭 라벨 "주요뉴스"의 이름 중복 — 연속 목록으로 읽혀 수용.
  혼란이 실측되면 "상단 고정 5건 제외" 캡션 추가.
