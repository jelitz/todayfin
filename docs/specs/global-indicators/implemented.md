# Implemented — global-indicators

## 설계 결정

- **yfinance ohlcv 확장은 심볼 사전 2개 분기**: `_LINE_SYMBOL`(6종)·`_OHLCV_SYMBOL`(4종). NaN 행 drop(빈 응답과 별개로 "유효 행 없음" 에러 구분), volume `fillna(0)` float 유지(int 캐스팅 금지 — 기존 파일 계약·int32 오버플로), ohlcv에도 `drop_duplicates`.
- **니케이만 afterclose**: 도쿄증권거래소 15:30 KST 마감(2024-11 연장) → afterclose cron 18:40에서 당일 종가. 확정치 덮어쓰기는 니케이=당일 afterclose, 나머지 신규 6종=이튿날 preopen(lookback 7일).
- **market_hours에 nikkei·eurusd·dxy·gold 추가**(미국 지수는 한국 장중 휴장이라 제외). `realtime.ts`의 REALTIME_ELIGIBLE_IDS와 한 커밋으로 동기화, 양쪽에 상호 참조 주석.
- **상세 화면 정밀도는 별도 경로**(검증 major): Detail 로컬 포맷터 → `formatHeaderValue`(lib/format) 교체 + PriceChart `precision` prop(unit USD→4) — 홈·티커·상세 3화면 표기 일원화.
- About는 섹션>items 평면 구조 유지(새 최상위 그룹 없음), index.html 메타의 "10개 지표" 하드코딩 제거.

## 검증 (2026-08-08)

- 사전 실측: 로컬 프로브로 7개 심볼 전부 최근 10일+5년 이력(1,223~1,300행) 수신 확인. 니케이 OHLC+거래량 제공 확인.
- pytest: test_yfinance.py 8건 신규(컬럼 매핑·반올림·NaN drop·volume 0.0 float·dedup·line 회귀·빈 응답·전결측) + 회귀 전체 57 통과.
- vitest: SECTIONS 단언 4건(types.test.ts 신규 — 소그룹 구성·21개 id 전수)·format 5건 추가 + 회귀 전체 88 통과, `tsc -b && vite build` 성공.
- **로컬 end-to-end 스모크**: collect_one을 스크래치 디렉터리로 실행 — 7종 전부 `ok`, 5년 백필(1,223~1,300행), summary 등락(나스닥 +1.3% 등) 정상. 이 데이터로 dev 서버 브라우저 검증(홈 21행·소그룹·유로/달러 1.1562·금 선물 4,401.30 USD/oz·티커·라이트/다크).
- 프로덕션 백필·배포 확인: 아래 tasks T6·T7 수행 기록 참조.

## 미결 질문

- yfinance 호출량 증가(preopen 9회/일, market_hours 7회/30분)의 429 리스크 — 첫 주 운영 관찰, 문제 시 지표 간 sleep 백로그.
- 니케이 장중 부분봉의 validate_ohlcv 불변식 실패·일본 연휴 stale 오탐은 자가 회복 구조로 수용(design §1-2) — 실발생 시 로그로 빈도 확인.
