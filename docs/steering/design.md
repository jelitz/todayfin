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

- 대시보드 그리드 max-width **1280px**, 브레이크포인트 1280px+ 3열 / 850px 2열 / 640px 1열 — 변경 없음
- **GNB**(신규, 상단 고정 아님·문서 흐름 내 위치): 로고 `todayfin` + 카테고리 4탭(수급/시장 가격·추세/거시·통화/원자재, 클릭 시 스크롤 이동·활성 탭 자동 갱신) + 다크모드 토글 + 마지막 갱신 시각. 배경 `--canvas`, 하단 `--hairline`. 기존 "헤더는 `--surface-dark` 역색 표면" 패턴을 대체한다.
- **티커 바**(신규 재도입): GNB 바로 아래, `--surface` 배경, 전 지표 요약을 우→좌 무한 스크롤. hover 정지·`prefers-reduced-motion` 대응·클릭 시 상세 모달.
- 카드: `--surface` 배경 + 1px `--hairline` + 8px 라운드 + 32px 패딩(모바일 20px)

## 차트 규칙

- 축·그리드·크로스헤어: 테마별 회색 계열(라이트 `#e5e5e5`/`#595959`, 다크 `#303030`/`#adadad`) — lightweight-charts는 CSS 변수를 못 읽으므로 `lib/chartTheme.ts`의 `getChartSurfaceTheme(theme)`로 관리
- 캔들: 상승 `--up`(#d60000) / 하락 `--down`(#0051c7), 심지 두께 확보 — **테마 무관 고정**
- 수급: 개인(`--flow-individual` 회색)/외국인(`--flow-foreign` 파랑)/기관(`--flow-institution` 주황) 3주체 라인, 일별/주간집계 토글 — **테마 무관 고정**
- MA 라인: 최대 3개 동시 표시(`--ma-1..3`), 지정 색상 외 사용 금지 — **테마 무관 고정**
- 등락 표기: `+1.23%` 빨강 / `-1.23%` 파랑 / 보합 회색, 다크 테마에서는 색상은 유지하되 `font-weight: 600` 이상으로 최소 시인성 확보(WCAG 대비 미달 기록 — `docs/specs/coinglass-redesign/design.md` 참조)
