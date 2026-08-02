# Design — todayfin (Ollama 스타일 적응)

기반: [Ollama 디자인 시스템 분석 문서](design-ollama-original.md) (출처: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), MIT License). 아래 적응 규칙이 원문과 충돌하면 **이 문서가 우선**한다.

## 디자인 토큰

```css
:root {
  /* 표면 */
  --canvas: #ffffff;
  --surface-soft: #fafafa;
  /* 텍스트 */
  --ink: #000000;
  --ink-charcoal: #525252;
  --ink-body: #737373;
  --ink-muted: #a3a3a3;
  /* 보더 */
  --hairline: #e5e5e5;
  --hairline-strong: #d4d4d4;
  /* 데이터 잉크 (차트 전용 — UI 크롬 사용 금지) */
  --up: #d60000;        /* 상승 빨강 (국내 관례) */
  --down: #0051c7;      /* 하락 파랑 */
  --ma-1: #f59e0b;      /* MA 20일/4주 */
  --ma-2: #10b981;      /* MA 60일 */
  --ma-3: #8b5cf6;      /* MA 120일 */
  --focus-ring: rgba(59,130,246,.5);
  /* 형태·간격 */
  --radius-card: 12px;
  --radius-pill: 9999px;
  --space-unit: 8px;
  --space-section: 88px;
  --pad-card: 32px;
}
```

## 원칙

1. **UI 크롬은 흑백·회색만.** 색은 데이터 잉크(캔들, 수급 막대, MA 라인, 등락 표시)에만 허용 — Ollama의 "의미 있는 곳에만 색" 철학의 금융 확장.
2. **그림자·그라디언트·장식 금지.** 구분은 1px 헤어라인과 여백으로.
3. **라이트 모드 온리** (원문 원칙). 다크 표면은 사용하지 않는다(원문의 1회 예외도 MVP에선 미사용).
4. **타이포가 개성**: Pretendard Variable(OFL — SF Pro Rounded의 한글·라이선스 대체). 스케일 36/30/24/20/18/16/14/12, 수치는 `font-variant-numeric: tabular-nums` 필수.
5. **알약형**: 버튼·토글·기간 선택 칩은 radius 9999px. 카드만 12px.
6. **여백이 레이아웃**: 8px 단위, 섹션 간 88px. 장식적 구분선 없음.

## 레이아웃

- 대시보드 그리드 max-width **1280px** (원문 720px 독서 폭은 텍스트 페이지 전용)
- 브레이크포인트: 1280px+ 카드 3열 / 850px 2열 / 640px 1열 (원문 준용)
- 카드: `--surface-soft` 아님 — 흰 배경 + 1px `--hairline` + 32px 패딩 (모바일 20px)

## 차트 규칙

- 축·그리드·크로스헤어: 회색 계열(`--ink-muted`, `--hairline`)
- 캔들: 상승 `--up` / 하락 `--down`, 심지 두께 확보(아래꼬리 판독이 분석 포인트)
- 수급 막대: 순매수 양수 `--up` / 음수 `--down`, 4주MA 라인 `--ma-1`
- MA 라인: 최대 3개 동시 표시, 지정 색상 외 사용 금지
- 등락 표기: `+1.23%` 빨강 / `-1.23%` 파랑 / 보합 회색
