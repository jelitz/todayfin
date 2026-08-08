# Implemented — home-two-column

## 설계 결정

- 블록 배치를 별도 "행 페어" 구조 없이 `HOME_BLOCKS` 배열 순서 + grid auto-placement로 표현 —
  홀수 개면 마지막 우측이 자연 여백(향후 지표 자리).
- 섹션 제목을 테이블 내 `<th colSpan>`에서 테이블 밖 `<h2>`로 승격, 같은 섹션의 좌우 분할은
  "섹션 — 소그룹" 합성 제목("시장 가격·추세 — 국내")으로 식별. 홈에 sr-only `<h1>` 추가로
  heading 위계 확보.
- 상세 링크를 전 폭에서 아이콘(↗)+aria-label로 통일 — 반폭 공간 제약, 구 모바일 패턴의 확대.
- 등락 열 20%: 최장 "▼ -10.1조원"(≈84px)이 표준 반폭 588px에서 한 줄 유지되도록 실측 후
  16%→20% 조정(구현 중 실측에서 16%는 최대 폭에서도 줄바꿈 발생). 1000~1140px 뷰포트
  구간에서는 화살표/숫자 줄바꿈으로 우아하게 밀림 — 수용.
- 이름 셀 `white-space: normal`(전 폭): nowrap+ellipsis가 반폭에서 stale·장중 배지를 통째로
  자르는 문제(적대적 검증 지적)의 해법. 긴 이름+배지는 2줄로 감김.

## 적대적 검증 반영 (2026-08-08, 3-agent 워크플로우 — 두 스펙 합산 16건 전부 수용)

이 스펙 관련 주요 건: 스파크 100px 고정의 열 폭 산술 불성립(→유동 폭 max-width 100px),
900px 브레이크포인트 계산의 gap 40px 누락(→1000px 상향), h2 승격 시 UA margin 잔존·구
섹션 룰 데드코드(→`.itable-block-title` margin:0 신설·구 룰 삭제), formatDate·HomeSection
타입 등 삭제 잔재 목록화, Home.tsx의 SECTIONS import 영향 범위 누락.

## 계획과의 편차

- 모바일(≤640px) 실기기·창 축소 실측 생략 — 검증 시점 브라우저가 최대화 고정(이전 세션과
  동일 제약). 1000px 미만 1단 전환은 결정적 media query + 로컬 데이터가 최장 조합(배지
  다수·조원 단위)을 이미 커버한 2단 실측으로 수용.

## 검증 (2026-08-08)

- vitest 95(신규 HOME_BLOCKS 5·IndicatorTable 7 개편 포함)·pytest 69·tsc·vite build 통과.
- 로컬 브라우저(dev, 실데이터): 2단 배치 4행 전부 의도대로, 등락 한 줄(getClientRects 1),
  grid 588px×2, 스파크 유동 88px, 상세 모달 회귀 정상, 라이트/다크 정상.
- React 19 renderToStaticMarkup이 colSpan을 camelCase 속성으로 출력 — 테스트 단언을
  `colSpan="5"`로 맞춤.
