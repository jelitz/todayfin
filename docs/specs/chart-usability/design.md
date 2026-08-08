# Design — chart-usability

핵심 전환: "기간 버튼 = 데이터 슬라이싱 + 차트 재생성" → **"전체 시계열 1회 로드 + 기간은 보이는 범위(visible range) 조작"**. lightweight-charts(5.2.0 설치 확인)는 휠 줌·드래그 팬·핀치를 기본 내장하고 있어(현재도 켜져 있으나 데이터가 잘려 있어 무의미), 전체 데이터를 주는 순간 요구된 상호작용이 대부분 공짜로 열린다.

> 2026-08-08 적대적 검증(3-agent) 반영: 모드 전환 범위 스냅 보정, effect 가드·순서, 누적 툴팁 규칙, props 누락, MA 초기값 타이밍, 요약 박스 위치 6건 수정.

## 1. 범위 관리 아키텍처 (R1·R2·R3 공통)

PriceChart·FlowsChart 양쪽에 동일 패턴을 적용한다:

```
Detail (period 상태, seq 카운터)
  └─ Chart 컴포넌트
       ├─ effect A [데이터·옵션·테마]: 차트 생성/재생성  ← effect B보다 먼저 선언
       │    └─ 생성 직후: savedRangeRef 있으면 복원(아래 스냅 보정), 없으면 기본 기간 적용
       ├─ effect B [period.seq]: 기간 점프 — 재생성 없음. `if (!chartRef.current) return` 가드 필수
       └─ subscribeVisibleTimeRangeChange → savedRangeRef 갱신
            (null 범위는 무시하고 덮어쓰지 않음 — 데이터 없음 시 핸들러가 null을 받음)
```

- **기간 버튼**: Detail이 `period = { days, seq }`를 내려주고(같은 버튼 재클릭도 점프하도록 seq 증가), effect B가 `setVisibleRange({ from: max(첫 데이터일, 마지막일−days), to: 마지막일 })` 호출. 5Y는 `fitContent()`(전체와 동일).
- **옵션 변경 시 범위 유지(R3)**: MA 토글·수급 모드·테마 변경은 effect A 재실행(차트 재생성)이지만, 재생성 직후 `savedRangeRef`의 마지막 범위를 복원하므로 사용자 관점에서는 범위가 유지된다. 재생성 접근을 유지하는 이유: 시리즈 증감·테마 색 교체를 인스턴스 내 증분 갱신으로 하면 코드 복잡도가 훨씬 크고, 재생성은 이미 검증된 경로다(1,300행 재생성은 체감 지연 없음 — 현재도 매 조작마다 하던 일).
- **복원 시 스냅 보정**: visible range는 바 단위로 스냅되므로 일별↔주간 전환에서 최대 ±1주 오차가 생기고, 특히 주간→일별 전환은 저장된 `to`가 마지막 주간 바의 월요일이라 우측 끝이 최대 4영업일 후퇴한다(검증에서 라이브러리 소스로 확인). 보정 규칙: **복원할 `to`가 시리즈 마지막 날짜로부터 7일 이내면 `to`를 마지막 날짜로 스냅**(우측 끝을 보고 있던 사용자는 계속 끝을 본다). `from`은 그대로 — 잔여 ±1주 오차는 수용(requirements R3에 각주 반영).
- **초기 진입**: savedRangeRef 비어 있음 → 기본 1Y 적용(R1). Detail 재마운트(다른 지표 진입) 시 ref도 초기화되므로 지표 간 범위 오염 없음. 시리즈가 1Y보다 짧으면 from이 첫 데이터일로 클램프되어 사실상 전체 표시(시리즈 1~2행 엣지 포함).
- **휠·터치(R2)**: `handleScale`/`handleScroll` 기본값이 휠 줌·드래그 팬·핀치를 제공. 단 `handleScroll: { vertTouchDrag: false }`를 명시해 모바일 세로 스와이프는 페이지 스크롤로 남긴다(수평 스와이프·핀치는 차트가 소비).
- **데이터**: Detail은 이미 `data/{id}.json` 전체(약 5년)를 로드하고 있었다 — `filterByDays` 슬라이싱과 `fullRows` prop(MA 워밍업용 이중 전달)을 제거하고 rows 하나로 단순화한다. MA는 항상 전체 시계열로 계산되므로 워밍업 문제도 소멸.

## 2. PriceChart 변경

- props: `type`·`height`는 유지, `rows`는 전체 시계열로 의미 변경, `maPeriods`·`showVolume` 유지, **신설** `period {days: number | null, seq: number}`·`precision?: number`(global-indicators §2-3 — line 시리즈 priceFormat과 툴팁 소수 자리), **삭제** `fullRows`
- `fitContent()` 호출 제거 → §1 범위 관리로 대체
- 크로스헤어 툴팁·거래량 패널·캔들/라인 분기·테마 색: 무변경(R7)

## 3. Detail 변경

- **라인 MA 토글(R4)**: MA 체크박스 그룹을 ohlcv 한정에서 line까지 확장. 초기값은 타입별 — ohlcv 전부 켜짐(현행), line 전부 꺼짐. **적용 시점**: id 변경 effect의 fetch 시작 시점에는 type을 모르므로(검증 지적), fetch 성공 콜백에서 `record.type`을 보고 `setMaChecked(타입별 기본)`을 세팅한다. `MA_PERIODS`(20/60/120)·색상 매핑 공유.
- **헤더 등락(R6)**: `record.series` 마지막 2행에서 계산(일반: (last−prev)/prev %, flows: foreign 컬럼 last−prev 억원 — summary·홈 테이블과 동일 규칙). 표기는 `formatPct`/`formatChangeAbs` + 전역 `.up`/`.down`/`.muted` 클래스. series가 2행 미만이면 생략.
- 수급 모드 상태: `flowsWeekly: boolean` → `flowsMode: 'daily' | 'weekly' | 'cumulative'`(pill 3개, 기본 weekly — 현행 기본과 동일). 누적 모드 전용 상태: `cumSubjects`(기본 3주체 전부 — 2026-08-08 사용자 피드백으로 외국인 단독에서 변경)·`cumMA`(기본 켜짐).

## 4. FlowsChart — 누적 모드 (R5)

- `lib/flows.ts`(신규) 순수 함수:
  - `toCumulative(rows, idx): { date, sum }[]` — 시계열 시작부터 누적 합
  - `cumulativeSummary(rows, idx): { total, today, prev }` — 요약 값(마지막 누적치·마지막 일별값·직전 일별값), 2행 미만 시 null 필드
- 렌더(누적 모드):
  - 표시 주체 각각: 원본 누적 라인(주체색 50% 투명 — hex에 alpha 붙인 8자리 hex 상수를 chartTheme에 추가, lineWidth 1) + **20영업일(≈4주) SMA 라인(주체색 불투명, lineWidth 2)** — 예시 이미지의 "가는 원본 + 굵은 평활선" 문법. `cumMA` 꺼짐이면 원본 라인만 불투명 lineWidth 2로.
  - **툴팁 규칙**(검증 지적): 크로스헤어 툴팁에는 원본 누적 라인 값만 표시하고 SMA 라인은 제외한다(시각 참고선) — 같은 주체 라벨 2행 중복과 React key 충돌 방지.
  - 주체 토글: 기존 범례 행을 클릭 가능한 체크박스로 승격(일별·주간 모드에서는 현행처럼 항상 3주체 표시, 누적 모드에서만 토글 동작). 기본 3주체 전부(사용자 피드백).
  - **요약 박스**: 범례 행 오른쪽 끝(`margin-left: auto`)에 표시 주체별 `누적 −186.8조원 · 오늘 −3.3조원 · 직전일 +1.4조원`(값 색은 등락 규칙 ±빨강/파랑). 차트 위 오버레이가 아니라 범례 행에 두어 크로스헤어 툴팁과 겹침을 원천 차단 — requirements R5의 위치 문구도 이에 맞춰 갱신함. 범례 행에 `flex-wrap: wrap`을 주어 모바일(390px)에서 줄바꿈으로 수용.
- 일별/주간 모드: 무변경(범위 관리 패턴만 §1대로 적용).
- 누적 라인의 등락색을 쓰지 않는 이유: 주체 식별색(회색/파랑/주황)이 이미 의미를 점유 — 요약 박스 숫자에만 등락색 적용.

## 5. 테스트 설계

- vitest(신규 `lib/flows.test.ts`): toCumulative 누적 합·빈 배열, cumulativeSummary(2행 미만 처리 포함)
- vitest(기존): route·format 등 회귀 전체
- 컴포넌트 렌더 테스트는 lightweight-charts가 jsdom 없이 동작하지 않으므로 종전 결정대로 생략 — 브라우저 실측으로 갈음:
  - 휠 줌(커서 기준 확대)·드래그 팬·기간 버튼 점프·같은 버튼 재클릭
  - MA 토글·수급 모드 전환·테마 전환 각각에서 **보던 범위 유지**(±1주 스냅 오차 이내, 우측 끝 후퇴 없음) 확인
  - 누적 모드: 외국인 기본·주체 추가·4주MA 토글·요약 박스 값(데이터와 대조)·툴팁에 SMA 미표시
  - line 지표 MA 기본 꺼짐·켜면 3색 라인, eurusd 툴팁·y축 4자리(global-indicators §2-3 연계)
  - 모바일(390px): 핀치 줌, 세로 스와이프로 페이지 스크롤 되는지, 범례 행 줄바꿈
- `tsc -b && vite build`

## 6. 리스크·트레이드오프

- **재생성+복원 방식의 순간 깜빡임**: 옵션 변경 시 차트가 완전 재생성되므로 이론상 1프레임 미만의 리셋이 보일 수 있다 — 현재도 동일한 재생성이 일어나고 있어 체감 악화는 없음. 증분 갱신(시리즈 add/remove)은 코드량·엣지케이스 대비 이득이 작아 미채택.
- **모드 전환 범위 스냅**: §1의 보정 규칙으로 우측 끝 후퇴는 제거, 좌측 ±1주 오차는 수용.
- **휠이 페이지 스크롤을 가로챔**: 요구사항 R2에서 관례로 수용 결정 — 차트 밖 여백에서는 정상 스크롤.
