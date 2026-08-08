# Implemented — chart-usability

## 설계 결정

- **범위 관리 공용화**: 저장·복원·기간 계산을 `lib/chartRange.ts`로 분리(PriceChart·FlowsChart 공용). 날짜 계산(`periodRange`)과 스냅 보정(`snapRestoredRange`)은 순수 함수라 vitest로 고정.
- **재생성+복원 방식 채택**: 옵션·테마 변경은 종전처럼 차트를 재생성하되 `savedRangeRef`(subscribeVisibleTimeRangeChange로 추적)를 복원 — 증분 갱신 대비 코드가 단순하고 검증된 경로. 기간 점프만 effect 분리(seq 카운터)로 재생성 없이 처리.
- **effect A(생성)가 period를 deps로 가지면 점프마다 재생성되므로 `periodRef`로만 읽는다** — 초기 기본 1Y 적용에만 사용.
- **누적 요약 위치**: requirements 초안의 "차트 우측 상단" 대신 범례 행 우측(`margin-left:auto`) — 크로스헤어 툴팁과 겹침 원천 차단(검증 지적으로 requirements도 갱신).
- **누적 툴팁에서 평활선 제외**: 같은 주체 라벨 2행 중복·React key 충돌 방지(검증 지적).
- **헤더 숫자 포맷은 `formatHeaderValue` 신설**: 설계는 "lib formatValue로 교체"였으나 formatValue는 일부 unit에서 단위 문자열까지 포함해 헤더의 별도 단위 표기와 중복된다 — 숫자만 unit별 자릿수로 맞추는 헤더 전용 함수로 조정(의도적 편차).

## 계획과의 편차

- **모바일 뷰포트 실측 생략**: 검증 시점에 브라우저 창이 최대화 상태로 고정되어 extension resize가 viewport에 반영되지 않았다(innerWidth 2560 유지). 모바일 관련 변경은 결정적 CSS(범례 flex-wrap, vertTouchDrag: false)와 기존 검증된 테이블 브레이크포인트뿐이라 수용 — 실기기에서 문제 리포트 시 재검증.
- 드래그 팬은 개별 실측 생략 — 휠 줌과 동일한 lightweight-charts 기본 핸들러이고 휠 소비(defaultPrevented)를 실측 확인.

## 검증 (2026-08-08)

- vitest: chartRange 6건·flows 5건 신규 + 회귀 전체(88) 통과, `tsc -b && vite build` 성공.
- 브라우저(claude-in-chrome, dev 서버 + 로컬 스모크 데이터 21종):
  - eurusd 상세: 헤더 1.1562 USD + 등락(+0.04% 빨강), y축·툴팁 4자리, 라인 MA 기본 꺼짐
  - 휠 줌: WheelEvent가 차트에 소비(defaultPrevented: true)되고 커서 기준 확대 실측
  - MA 20일 토글 → **줌인 상태 범위 유지** 확인(종전엔 1Y 리셋), 3Y 버튼 점프 정상, MA가 표시 구간 시작부터 그려짐(워밍업 문제 소멸)
  - 수급 상세: 헤더 -10.1조원(파랑), 일별/주간/누적 pill, 누적+4주 평활+요약(누적 -163.9조원·직전일 +7.2조원 색상), 주체 토글 시 대칭 곡선+요약 확장+범위 유지, 툴팁 주체당 1행(평활선 제외). 검증 당시 기본은 외국인 단독이었으나 **2026-08-08 사용자 피드백으로 기본을 3주체 전부로 변경**(배포 후 재확인)
  - 라이트/다크 모두 정상

## 미결 질문

- 누적 기준점이 데이터 시작(약 5년 전) 고정이라 참고 예시(2024-09 기점 -186.8조원)와 절대값이 다르다 — 의도된 동작이나, 사용자가 특정 시점 기점 누적을 원하면 기준일 지정 기능을 백로그에서 꺼낼 것.
