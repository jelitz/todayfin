# Design — todayfin (coinglass 적응)

기반: 원래 [Ollama 디자인 시스템 분석 문서](design-ollama-original.md) 적응 위에서 출발했으나, 2026-08-03 사용자 제공 coinglass 디자인 시스템(coinglass.com 브랜드 토큰 참고자료) 기반 구조 리디자인으로 전환됨. 상세 결정 근거·트레이드오프는 [`docs/specs/coinglass-redesign/`](../specs/coinglass-redesign/) 참조. 이 문서가 최신 전역 규칙이며, Ollama 원문은 레이아웃 여백 원칙 등 일부만 유산으로 남아있다.

## 디자인 토큰

```css
:root {
  /* UI 크롬 — 라이트 (기본값) */
  --canvas: #ffffff;
  --surface: #f5f5f5;
  --surface-2: #fafafa;
  --ink: #000000;
  --ink-charcoal: #525252;
  --ink-body: #595959;
  --ink-muted: #8c8c8c;
  --hairline: #dbdbdb;
  --hairline-soft: #f0f0f0;
  --accent: #12467b;
  --accent-hover: #2a5b87;
  --accent-active: #082b54;
  --accent-soft: #c7dff7;
  --accent-soft-bg: #eaf3fc;
  --focus-ring: rgba(18, 70, 123, .5);

  /* 데이터 잉크 — 라이트/다크 완전 동일, 절대 재정의하지 않음 */
  --up: #d60000;
  --down: #0051c7;
  --ma-1: #f59e0b;
  --ma-2: #10b981;
  --ma-3: #8b5cf6;
  --flow-individual: #a3a3a3;
  --flow-foreign: #0051c7;
  --flow-institution: #f59e0b;

  /* 형태·간격 */
  --radius-card: 8px;
  --radius-control: 8px;
  --space-unit: 8px;
  --space-section: 88px;
  --pad-card: 32px;
  --pad-card-mobile: 20px;

  /* 타이포 스케일 — 변경 없음 */
  --fs-display-xl: 36px; --fs-display-lg: 30px;
  --fs-heading-lg: 24px; --fs-heading-md: 20px; --fs-heading-sm: 18px;
  --fs-body-md: 16px; --fs-body-sm: 14px; --fs-caption-sm: 12px;

  --max-width-dashboard: 1280px;
  --font-sans: "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

:root[data-theme='dark'] {
  --canvas: #141414;
  --surface: #1d1d1d;
  --surface-2: #1a1a1a;
  --ink: #f0f0f0;
  --ink-charcoal: #c2c2c2;
  --ink-body: #adadad;
  --ink-muted: #7e7e7e;
  --hairline: #3e3e3e;
  --hairline-soft: #303030;
  --accent: #4f8fc4;
  --accent-hover: #6ba6d6;
  --accent-active: #3a7ab0;
  --accent-soft: #275076;
  --accent-soft-bg: #1a2c3a;
  --focus-ring: rgba(79, 143, 196, .6);
  /* --up/--down/--ma-*/--flow-* 재정의 금지 — 라이트와 동일 값 상속 */
}
```

## 원칙

1. **UI 크롬은 네이비 액센트 중심, 데이터 잉크는 테마 불변.** 코인글래스 네이비(`--accent`)를 GNB·버튼·활성 탭·링크 등 UI 크롬 전반에 사용한다(구 원칙 "UI는 흑백만" 폐기). 단, 등락·MA·수급 라인 등 **데이터 잉크는 라이트/다크 완전히 동일한 값을 유지**해야 한다 — 금융 관례(상승=빨강/하락=파랑)와 차트 범례 인식성이 테마 미학보다 우선한다(2026-08-03 사용자 피드백으로 확정).
2. **그림자·그라디언트·장식 금지는 유지.** 카드 hover 등 상호작용 피드백도 보더 색상 전환(`--hairline` → `--accent`)만으로 처리하고 그림자를 추가하지 않는다.
3. **다크모드 지원.** 사용자가 GNB에서 라이트/다크를 토글할 수 있다(구 원칙 "라이트모드 온리" 폐기). 초기값은 `prefers-color-scheme`, 선택은 `localStorage`에 저장. 헤더를 별도로 어둡게 하던 기존의 "헤더 1곳 한정 다크" 패턴은 전역 다크모드 도입으로 대체되어 더 이상 필요 없다.
4. **타이포가 개성**: Pretendard Variable 유지(coinglass 원본의 "XPK"는 실제 폰트 자산이 없는 참고자료 내 플레이스홀더라 채택하지 않음). 스케일 36/30/24/20/18/16/14/12, `font-variant-numeric: tabular-nums` 유지.
5. **형태는 8px 라운드 사각형으로 통일.** 카드·버튼·모달·배지 모두 `--radius-card`/`--radius-control`(8px) 사용. 구 원칙의 알약형(9999px) 버튼은 폐기.
6. **여백이 레이아웃**: 8px 단위, 섹션 간 88px — 변경 없음(Ollama 원문 유산).

## 레이아웃

- **홈 = 반폭 블록 2단 그리드**(2026-08-08, `docs/specs/home-two-column/`): 같은 날 도입한 단일 컴팩트 테이블(`home-table-view`)을 세로 스크롤 완화를 위해 반폭 블록 7개의 2단 그리드로 재편. 블록 = 카테고리 테이블(지표당 1행: 이름·현재값·등락·스파크·상세 아이콘 — 기준일 열은 제거, stale 배지가 대신 전달), 배치는 [수급|변동성·리스크], [시장 국내|해외], [환율·달러인덱스|국채], [원자재|여백]. 2단은 ≥1000px, 미만 1단 스택, 모바일(≤640px)은 추세 열 숨김. 블록 제목은 테이블 밖 h2, 스파크라인은 유동 폭(max 100px). 배치 데이터는 `types.ts`의 `HOME_BLOCKS`. max-width **1280px** 유지. 구 3/2/1열 카드 그리드는 알상무 영상 카드에만 남아 있다.
- **주요 뉴스 헤드라인**(2026-08-08, `docs/specs/news-headlines/`): 홈 소개문과 지표 그리드 사이에 Google News 비즈니스 헤드라인(한국판) 5건 — 행 = KST 시각 + 출처명 + 제목 링크(새 탭 원문, 1줄 말줄임). 매시간 media-collect가 `data/news.json` 갱신, 실패 시 기존 유지·24h 초과 stale이면 프런트가 블록을 숨긴다. 데이터 잉크 아님(전부 테마 토큰).
- **GNB**(상단 고정 아님·문서 흐름 내 위치): 로고 `todayfin` + 페이지 탭 3개(홈/소개/알상무, 해시 라우트 전환) + 다크모드 토글 + 마지막 갱신 시각. 배경 `--canvas`, 하단 `--hairline`. 탭은 `<a href>`로 렌더링하고 활성 판정은 현재 라우트 기준. 2026-08-03: 기존 섹션 스크롤 탭(수급/시장 가격·추세/거시·통화/원자재)을 페이지 전환 탭으로 교체 — 섹션 구획 자체는 홈 화면 안에 그대로 유지된다(`docs/specs/content-pages/` 참조).
- **티커 바**(신규 재도입): **화면 하단 고정(fixed, z-index 50 — 모달 오버레이 아래)**, `--surface` 배경 + 상단 헤어라인, 전 지표 요약을 우→좌 무한 스크롤(80s 주기, OS 모션 설정과 무관하게 항상 재생). hover 정지·클릭 시 상세 모달. 홈(`#/`)·상세(`#/i/{id}`)에서만 노출하고 소개·알상무 페이지에서는 숨기며, 노출 라우트에서는 shell에 하단 패딩(35px)을 줘 푸터를 가리지 않는다. 2026-08-08 사용자 피드백: GNB 아래 배치 → 하단 부유로 변경, 속도 45s→80s 완화.
- 카드(알상무 영상 등 잔존 카드): `--surface` 배경 + 1px `--hairline` + 8px 라운드. 지표 카드(`IndicatorCard`)는 2026-08-08 테이블 전환으로 삭제됨
- **블록 내 소그룹**: 한 블록에 성격이 다른 지표가 섞이면(현재는 국채 블록의 미국/한국) `--ink-muted` 소그룹 헤더 행으로 나눈다(`types.ts`의 `HOME_BLOCKS[].groups[].title`). 2단 재편(2026-08-08 home-two-column)으로 구 섹션·소그룹 트리는 대부분 블록 제목("거시·통화 — 환율·달러인덱스" 식 합성)으로 흡수됐다. 지표 21개: 국내(코스피·코스닥·삼성전자·SK하이닉스)/해외(나스닥·S&P 500·다우존스·니케이 225), 환율·달러인덱스(원/달러·달러/엔·유로/달러·달러인덱스), 국채(미국 2·10·30년/한국 3년), 원자재(WTI·금 선물), 수급 2종, VKOSPI
- **알상무 영상 재생**(2026-08-08, `docs/specs/alsangmoo-player/`): 카드 클릭 → `#/alsangmoo/v/{id}` 모달에서 youtube-nocookie 임베드 자동재생(뒤로가기=닫기, "유튜브에서 보기" 상시 링크). 임베드가 꺼진 영상만 새 탭 이탈 유지

## 차트 규칙

- **상세 차트 = 전체 시계열 로드 + 보이는 범위 조작**(2026-08-08, `docs/specs/chart-usability/`): 기간 버튼(3M~5Y)은 데이터를 자르지 않고 visible range만 점프, 마우스 휠 줌·드래그 팬·핀치 상시 활성(모바일 세로 스와이프는 페이지 스크롤 유지). MA·집계 모드·테마 변경 시 보던 범위 유지(`lib/chartRange.ts` 저장·복원, 바 단위 스냅 보정 포함). 상세 헤더에 전일 대비 등락 표시
- MA 정책: 캔들 지표는 20/60/120일 기본 켜짐, **라인 지표는 동일 토글을 기본 꺼짐**으로 제공(2026-08-08 — 8/3의 "라인 MA 제외"를 옵트인으로 완화)
- 수급 상세 집계: 일별/주간/**누적** 3모드. 누적 = 시계열 시작 0 기준 주체별 누적 순매수, 기본 3주체 전부 표시 + 20영업일(4주) 평활선(원본은 50% 투명 가늘게 — `FLOWS_SUBJECT_COLORS_FADED`), 범례 행 우측에 누적·오늘·직전일 요약, 크로스헤어 툴팁에는 평활선 제외
- line 시리즈 정밀도: 기본 소수 2자리, unit `USD`(유로/달러)만 4자리 — `PriceChart`의 `precision` prop으로 y축·툴팁 동시 적용
- 축·그리드·크로스헤어: 테마별 회색 계열(라이트 `#e5e5e5`/`#595959`, 다크 `#303030`/`#adadad`) — lightweight-charts는 CSS 변수를 못 읽으므로 `lib/chartTheme.ts`의 `getChartSurfaceTheme(theme)`로 관리
- line 타입 지표(환율·국채·WTI)의 단색 선: `getChartSurfaceTheme(theme).line`(라이트 `#525252`/다크 `#c2c2c2`, 카드 스파크라인의 `--ink-charcoal`과 동일 톤) — 등락 의미가 없는 순수 UI색이라 **테마를 따름**. 2026-08-03: 이전 값 `#000000` 고정이 다크모드 배경에서 거의 보이지 않던 버그를 사용자 리포트로 발견·수정
- 캔들: 상승 `--up`(#d60000) / 하락 `--down`(#0051c7), 심지 두께 확보 — **테마 무관 고정**
- 수급: 개인(`--flow-individual` 회색)/외국인(`--flow-foreign` 파랑)/기관(`--flow-institution` 주황) 3주체 라인, 일별/주간집계 토글 — **테마 무관 고정**
- MA 라인: 최대 3개 동시 표시(`--ma-1..3`), 지정 색상 외 사용 금지 — **테마 무관 고정**
- 등락 표기: `+1.23%` 빨강 / `-1.23%` 파랑 / 보합 회색, 다크 테마에서는 색상은 유지하되 `font-weight: 600` 이상으로 최소 시인성 확보(WCAG 대비 미달 기록 — `docs/specs/coinglass-redesign/design.md` 참조)
