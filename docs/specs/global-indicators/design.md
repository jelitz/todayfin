# Design — global-indicators

requirements.md의 지표 7종 추가를 기존 파이프라인·프론트 구조 변경 최소로 구현한다. 새 어댑터 없음 — `yfinance_source` 확장 + 레지스트리 등록 + 프론트 상수·포맷 갱신이 핵심이다.

> 2026-08-08 적대적 검증(3-agent) 반영: 상세 화면 정밀도 경로(major), volume 캐스팅, 니케이 마감 시각·재수집 경로, About 구조, 테스트 대상 등 11건 수정.

## 1. 파이프라인

### 1-1. `sources/yfinance_source.py` — ohlcv 지원 확장

현재 line(Close만) 전용을 타입별 분기로 확장한다:

```python
_LINE_SYMBOL = {
    "usdkrw": "KRW=X", "usdjpy": "JPY=X", "wti": "CL=F",
    "eurusd": "EURUSD=X", "dxy": "DX-Y.NYB", "gold": "GC=F",
}
_OHLCV_SYMBOL = {
    "nasdaq": "^IXIC", "sp500": "^GSPC", "dow": "^DJI", "nikkei": "^N225",
}

def fetch(indicator_id, start, end) -> pd.DataFrame:
    # ohlcv: date, open, high, low, close, volume 반환 (fdr_source와 동일 컬럼 계약)
    # line:  date, value 반환 (기존 계약 유지)
```

- **NaN 방어**: yfinance는 휴장일·부분 데이터에서 NaN 행을 섞어 줄 수 있다. ohlcv는 OHLC 4열 기준 `dropna`, line은 Close 기준 `dropna`(기존 동작 유지).
- **중복 날짜 제거**: ohlcv 경로에도 기존 line 경로와 동일하게 `drop_duplicates(subset="date")` 적용 — 없으면 `validate._check_date_order`가 raise해 지표가 failed 처리된다(fdr_source에는 없지만 yfinance는 중복 이력이 있는 소스).
- **volume 정규화**: OHLC는 유효한데 volume만 NaN인 행은 `fillna(0)`. **int 캐스팅은 하지 않는다** — 기존 ohlcv 파일이 volume을 float로 저장하고 있고(data/kospi.json 실측), 증분 병합(`pd.concat`)에서 어차피 float64로 승격되며, `astype(int)`는 Windows/numpy<2에서 int32라 나스닥 거래량(7.2e9 > 2^31)이 오버플로한다(검증 실측).
- 반올림: line은 기존 4자리 유지(eurusd 1.1562 정밀도 요구와 일치), ohlcv는 지수라 2자리.
- 기존 3종(usdkrw·usdjpy·wti)의 동작·계약은 그대로 — 회귀 테스트로 고정.

### 1-2. `indicators.py` — 7종 등록

| id | name | type | unit | source_label | profile |
|---|---|---|---|---|---|
| nasdaq | 나스닥 | ohlcv | pt | `yfinance:^IXIC` | preopen |
| sp500 | S&P 500 | ohlcv | pt | `yfinance:^GSPC` | preopen |
| dow | 다우존스 | ohlcv | pt | `yfinance:^DJI` | preopen |
| nikkei | 니케이 225 | ohlcv | pt | `yfinance:^N225` | afterclose |
| eurusd | 유로/달러 | line | USD | `yfinance:EURUSD=X` | preopen |
| dxy | 달러인덱스 | line | pt | `yfinance:DX-Y.NYB` | preopen |
| gold | 금 선물 | line | USD/oz | `yfinance:GC=F` | preopen |

- 각 엔트리는 **기존 yfinance 3종과 동일 구조로 등록** — 표의 필드 외에 `instrument`(사람이 읽는 설명)·`module=yfinance_source`·`source_name=YAHOO_FINANCE_NAME`을 반드시 포함한다. `instrument` 누락은 KeyError로 수집 런 전체를 중단시킨다(collect.py:168이 무조건 접근, 호출부에 try 없음 — 검증 확인).
- 폴백·realtime_module 없음(기존 yfinance 3종과 동일 정책).
- **니케이만 afterclose**: 도쿄증권거래소 현물 마감은 **15:30 JST(=KST)**(2024-11-05 연장 반영) → afterclose cron(KST 18:40)에서 당일 종가 확보. preopen(KST 08:10)이면 항상 하루 늦다.
- `PROFILES["market_hours"]`에 **nikkei·eurusd·dxy·gold 추가**(한국 장중에 실제로 움직이는 시장). 미국 지수 3종은 한국 장중에 휴장이라 제외. market_hours 경로는 realtime_module이 없으면 일반 fetch로 흐르므로(collect.py 분기 실측) 코드 변경 없이 목록 추가만으로 동작한다 — usdkrw가 이미 같은 방식.
- 니케이 장중 갱신은 yfinance 일봉의 당일 잠정 행(장중 부분봉)을 받는 경로. 확정치 덮어쓰기는 **니케이는 당일 afterclose(18:40)가, eurusd·dxy·gold는 이튿날 preopen이** `_REVISION_LOOKBACK_DAYS=7` 재수집으로 수행한다(니케이는 preopen 프로필에 없음 — 주체 분리 명시).
- **니케이 장중 부분봉의 불변식 리스크 수용**: 니케이는 기존 market_hours yfinance 선례(line 3종)와 달리 `validate_ohlcv` 불변식(low≤min(o,c) 등)을 통과해야 한다. 부분봉이 불변식을 깨면 해당 런의 nikkei만 failed(기존 데이터 유지) 처리되고 다음 런·당일 afterclose가 자가 회복한다 — 방어 코드 추가 없이 수용.
- **니케이 stale 오탐 가능성 수용**: stale 판정은 주말만 빼는 주중 일수 기준이라 일본 연휴(골든위크 등 3주중일+ 휴장)에는 재개장일 아침 런에서 일시적 exit 1이 날 수 있다 — 다음 런 자가 회복으로 수용, 반복 시 니케이 한정 임계 상향을 백로그로.

### 1-3. 백필·호출량

- 파일 부재 → 기존 자동 5년 백필. yfinance는 범위 조회 1회로 5년을 통째로 받으므로(로컬 프로브에서 1,223~1,300행 확인) KRX 백필 같은 스로틀 불요.
- 호출량 증가: preopen의 yfinance 호출 3→9회/일, market_hours 3→7회/30분. Yahoo 비공식 한도 대비 미미하지만 429 이력이 있는 경로이므로 **기존 재시도(2회, 5/15초 백오프)로 수용**하고 첫 주 운영 관찰. 문제 시 지표 간 소폭 sleep 추가(백로그).

## 2. 프론트

### 2-1. `types.ts` SECTIONS 재편 (R3)

```ts
{ title: "시장 가격·추세", anchor: "section-price-trend", subsections: [
    { title: "국내", ids: ["kospi", "kosdaq", "samsung", "skhynix"] },
    { title: "해외", ids: ["nasdaq", "sp500", "dow", "nikkei"] },
]},
// 거시·통화 섹션 내부의 환율 소그룹 제목·구성 변경:
{ title: "환율·달러인덱스", ids: ["usdkrw", "usdjpy", "eurusd", "dxy"] },
// 원자재:
{ title: "원자재", anchor: "section-commodity", ids: ["wti", "gold"] },
```

IndicatorTable은 subsections를 이미 지원하므로 상수 변경만으로 렌더된다. anchor 변경 없음.

### 2-2. 값 포맷 — 홈·티커 (R4)

`lib/format.ts` formatValue에 unit 2종 추가:

- `"USD"`: 소수 4자리 (`1.1562`) — eurusd 전용
- `"USD/oz"`: `4,401.30 USD/oz` — `USD/bbl` 패턴과 동일, 단 금값은 4천 달러대라 천 단위 구분 포함(`toLocaleString` + 소수 2자리 고정)

### 2-3. 값 포맷 — 상세 화면 (R4, 검증 major 반영)

상세 화면은 lib/format.ts를 쓰지 않는 별도 경로 2곳이 있어 **코드 변경이 필요하다**(초안의 "자동 동작" 주장은 오류):

- `Detail.tsx`의 로컬 `formatValue`(소수 2자리 고정)가 헤더 현재값을 그림 → **lib/format.ts의 `formatValue(value, unit)`로 교체**. eurusd 헤더가 1.16으로 뭉개지는 것과 gold의 끝자리 0 탈락을 동시에 해소하고 홈·티커와 표기 일원화.
- `PriceChart.tsx`의 툴팁 `formatNum`(2자리)과 line 시리즈의 `priceFormat` 미지정(기본 precision 2 → y축 2자리) → **`precision?: number` prop 신설**(기본 2). Detail이 unit 기반으로 결정(`USD` → 4, 그 외 2)해 내려주고, line 시리즈 `priceFormat: { type: 'price', precision, minMove: 10^-precision }`과 툴팁 포맷에 함께 적용.
- PriceChart는 chart-usability 스펙도 크게 수정하는 파일 — 두 스펙을 같은 브랜치에서 순차 구현하므로 충돌 없음(구현 순서는 tasks에서 chart-usability 선행으로 고정).

### 2-4. `lib/realtime.ts` — 장중 배지 대상 동기화

`REALTIME_ELIGIBLE_IDS`에 `nikkei`·`eurusd`·`dxy`·`gold` 추가. 이 상수는 `PROFILES["market_hours"]`와 수동 동기화 관계(주석에 명시돼 있음) — 본 스펙에서 양쪽을 한 커밋으로 바꾼다.

### 2-5. `About.tsx` — 7종 항목 (R8)

About의 `INDICATOR_NOTES`는 섹션 > items 2단 평면 구조(소그룹 없음, SECTIONS와 의도적 독립 — 코드 주석 확인)이므로 **기존 섹션에 items를 추가**한다. 새 최상위 그룹을 만들지 않는다:

- section "시장 가격·추세"에: 미국 3대 지수(나스닥·S&P 500·다우존스 — 밤사이 위험자산 선호도, 한국 시장의 방향키) 1항목 + 니케이 225(엔캐리·아시아 리스크 동조) 1항목
- section "거시·통화"에: 유로/달러(달러 상대가치의 반대편) + 달러인덱스(달러 종합 강세 → 외국인 수급·원화 압력) — 기존 "원/달러 · 달러/엔" item 뒤에 배치, 기존 item 명명은 유지
- section "원자재"에: 금 선물(안전자산 선호·실질금리 프록시)

### 2-6. 자동 반영 확인 (코드 변경 불요 범위)

- 티커 바·홈 테이블 행·스파크라인·상세 라우팅(`#/i/{id}`)·캔들/라인 분기: summary/레지스트리 기반이라 등록만으로 동작
- `VOLUME_INDICATOR_IDS`에 추가하지 않으므로 해외 지수 상세에 거래량 패널 없음(R5)
- 단, 상세 화면 **정밀도**는 §2-3의 코드 변경이 필요함 — "자동"의 범위를 혼동하지 말 것

## 3. 시퀀스 (첫 수집)

1. main 푸시(코드) → 수동 workflow_dispatch(profile=all) 1회로 7종 백필 + summary 재생성 + 배포
2. 이후 cron이 프로필별로 유지: preopen(6종)·afterclose(nikkei)·market_hours(4종 참여)
3. **백필 run 실행 중 main 푸시 금지**(데이터 커밋 push 충돌 — 운영 규율 기존과 동일)

## 4. 테스트 설계

- pytest `test_yfinance.py`(신규): yf.Ticker.history를 monkeypatch한 픽스처로 ① ohlcv 컬럼 매핑·반올림 ② NaN 행 drop ③ volume NaN→0(float 유지) ④ 중복 날짜 제거 ⑤ line 기존 계약 회귀 ⑥ 빈 응답 예외
- vitest: `format.test.ts`에 USD(4자리)·USD/oz 케이스 추가. **SECTIONS 재편은 기존 테스트를 깨지 않는다**(IndicatorTable.test.tsx는 로컬 픽스처만 사용 — 검증 확인). 대신 실제 `SECTIONS`를 import해 새 구성(국내/해외 소그룹 제목·순서, 환율·달러인덱스 제목·구성, 원자재의 gold 포함, 21개 id 전수)을 단언하는 테스트를 **신규 추가**해 R3을 실제로 고정한다.
- 실측: Actions 백필 run 로그에서 7종 `ok` + `data/*.json` 행수(약 1,250) 확인, 배포 사이트에서 홈 테이블 21행·티커·상세 캔들/라인·eurusd 4자리 확인(라이트/다크)

## 5. 문서·문구 갱신

- `docs/steering/tech.md` 지표 소스 표에 7종 행 추가
- `docs/steering/design.md` 레이아웃 절 — 섹션 수는 5개 유지, "시장 가격·추세 국내/해외 소그룹"·"환율·달러인덱스" 구성 변경 명시
- `docs/data-rights.md` yfinance 항목에 신규 심볼 추기
- `web/index.html` meta/og description의 "10개 지표" → 지표 수 하드코딩 제거 또는 21개로 갱신
- `TickerBar.tsx` 상단 주석의 "9종" market_hours 서술 → 13종으로 갱신
- `About.tsx` "데이터에 대해" 문단의 "국내 지표는 정규장 중 30분 간격으로 갱신되며" → 니케이·환율·달러인덱스·금도 장중 갱신 대상이 되므로 서술 수정
