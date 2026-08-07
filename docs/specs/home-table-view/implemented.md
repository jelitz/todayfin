# Implemented — home-table-view

## 설계 결정

- **홈 전체가 단일 `<table>`**: 섹션마다 테이블을 쪼개면 열 정렬(현재값·등락 우측 정렬)이 섹션 경계에서 어긋난다. `<colgroup>`(열 폭) + `<thead>`(열 이름) + 섹션·소그룹별 `<tbody>`(첫 행 = `<th colSpan={6}>` 헤더 행, 기존 anchor id 보존).
- **상세 어포던스 = 진짜 앵커**: 요구사항 원문은 카드의 `role="button"` 패턴 계승이었으나, `<a href="#/i/{id}">`가 키보드 Tab→Enter·링크 의미론·새 탭 열기를 기본 동작으로 제공해 더 단순하고 견고하다 — requirements R7을 이 방향으로 정정하고 반영(검증 에이전트가 문서 간 상충을 지적). 행 전체 클릭은 편의 동작으로 병행(앵커에서 stopPropagation으로 중복만 차단).
- **스파크라인은 summary `spark` 그대로(약 3개월)**: 요구사항 초안의 "30일"은 데이터 계약(collect.py cutoff 95일)과 모순임이 검증에서 드러나 정정. 카드 시절과 동일한 데이터를 동일하게 그린다.
- **컴포넌트 렌더 테스트는 `renderToStaticMarkup`**: jsdom·@testing-library 미설치 상태에서 의존성을 늘리지 않고 문자열 검증으로 커버(등락 분기·앵커 href·스켈레톤 행 수·소그룹 헤더). 클릭·키보드 등 동적 동작은 브라우저 검증으로.
- **Sparkline 승격**: IndicatorCard 내부 함수를 `Sparkline.tsx`로 이동(로직 무변경). IndicatorCard.tsx/.css 삭제, Home.css는 그리드·섹션 제목 스타일만 제거하고 `.home`/`.home-intro`/`.home-error*` 유지.

## 계획과의 편차

- **모바일 열 폭·줄바꿈 보정**(브라우저 검증에서 발견): "억원"·"원" 단위가 단어 중간에서 꺾여 보기 흉했다 — 값·등락 셀에 `word-break: keep-all`, 모바일 열 폭을 38/26/24/12%로 조정. 390px에서 가로 스크롤 없음 확인.

## 검증 (2026-08-08)

- vitest 6건 + 전체 회귀(프론트 68) 통과, `tsc -b && vite build` 성공.
- 브라우저(Playwright — claude-in-chrome 확장 미연결로 폴백): 1440×900 라이트/다크 렌더, 행 클릭 → `#/i/kospi` 모달, stale 배지, 390px 가로 스크롤 없음·열 축소 확인. 스크린샷 `.playwright-cli/` 세션 산출물.

## 미결 질문

- 1440×900에서 13개 지표는 "한 화면 남짓"(섹션 헤더 여백 포함 약 1.2화면). 지표가 20개를 넘으면 섹션 헤더 상단 여백(32px) 축소나 밀도 옵션을 재검토.
