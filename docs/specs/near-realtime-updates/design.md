# Design — near-realtime-updates

## 개요

기존 배치 파이프라인(하루 2회) 구조를 유지한 채, 정규장 시간에만 별도의 고빈도 수집 프로필(`market_hours`)을 추가한다. 데이터 스키마(`data/{id}.json`)는 변경하지 않는다 — "오늘 하루치 OHLCV 한 행"이 장중 계속 갱신되다가 장후 수집에서 최종 확정되는 기존 "잠정→확정" 병합 로직(`_REVISION_LOOKBACK_DAYS`)을 그대로 재사용한다.

## 신규 소스: `pipeline/sources/naver_realtime.py`

네이버 금융이 자체 실시간 시세 위젯에 사용하는 폴링 API(비공식, `pollingInterval: 7000`ms 명시 — 사실상 실시간에 가까움)를 사용한다. 실측(2026-08-03 09:37 KST) 확인:

```
GET https://polling.finance.naver.com/api/realtime/domestic/stock/{종목코드}   # 삼성전자·SK하이닉스
GET https://polling.finance.naver.com/api/realtime/domestic/index/{지수코드}   # KOSPI·KOSDAQ
```

응답 필드 매핑(콤마 제거 후 숫자 변환): `openPrice`→open, `highPrice`→high, `lowPrice`→low, `closePrice`→close(필드명과 달리 "현재가"), `accumulatedTradingVolume`→volume(단위 접미사 "천주"/"백만" 등이 붙는 경우 숫자만 파싱, 실패 시 0 — 지수 volume은 어차피 화면에 쓰이지 않음, `VOLUME_INDICATOR_IDS`는 samsung/skhynix만 해당).

```python
_ENDPOINT = {
    "kospi": ("index", "KOSPI"),
    "kosdaq": ("index", "KOSDAQ"),
    "samsung": ("stock", "005930"),
    "skhynix": ("stock", "000660"),
}

def fetch_today(indicator_id: str) -> dict:
    """반환: {date, open, high, low, close, volume} — 오늘 하루치 단일 스냅샷."""
    kind, code = _ENDPOINT[indicator_id]
    url = f"https://polling.finance.naver.com/api/realtime/domestic/{kind}/{code}"
    resp = requests.get(url, headers=_UA, timeout=10)
    resp.raise_for_status()
    data = resp.json()["datas"][0]
    def num(s: str) -> float:
        s = re.sub(r"[^\d.-]", "", s)
        return float(s) if s else 0.0
    return {
        "date": date.today().isoformat(),
        "open": num(data["openPrice"]),
        "high": num(data["highPrice"]),
        "low": num(data["lowPrice"]),
        "close": num(data["closePrice"]),
        "volume": num(data["accumulatedTradingVolume"]),
    }
```

기존 소스 모듈들의 `fetch(indicator_id, start, end) -> DataFrame` 인터페이스와 의도적으로 다르다(단일 스냅샷 vs 범위 조회) — `collect.py`에서 별도 분기 처리(아래).

## `pipeline/indicators.py` 변경

- `kospi`/`kosdaq`/`samsung`/`skhynix` 각 항목에 `realtime_module=naver_realtime` 필드 추가(기존 `module=fdr_source`는 과거 확정 일봉 백필용으로 그대로 유지)
- `MARKET_HOURS_IDS = ["investor_kospi", "investor_kosdaq", "kospi", "kosdaq", "samsung", "skhynix", "usdkrw", "usdjpy", "wti"]`
- `PROFILES["market_hours"] = MARKET_HOURS_IDS`(기존 `profile` 필드 기반 자동 생성 방식과 별개로 명시적 리스트 — 지표의 "주 프로필"은 preopen/afterclose로 그대로 두고, market_hours는 부가적으로 참여하는 지표 집합이기 때문)

## `pipeline/collect.py` 변경

`collect_one()`에 분기 추가: `profile == "market_hours"`이고 `spec.get("realtime_module")`이 있으면 기존 `_fetch_with_retry` + 범위 병합 경로 대신 아래 경로를 탄다.

```python
if profile == "market_hours" and spec.get("realtime_module"):
    snapshot = spec["realtime_module"].fetch_today(indicator_id)
    new_df = pd.DataFrame([snapshot])
    warnings = validators.validate("ohlcv", new_df)  # 기존 validate_ohlcv 그대로 재사용
    if existing and existing.get("series"):
        old_df = _series_to_df(spec, existing)
        merged = pd.concat([old_df[old_df["date"] != snapshot["date"]], new_df], ignore_index=True)
    else:
        merged = new_df
    # 이후 원자적 저장 로직은 기존과 동일
```

`investor_kospi`/`investor_kosdaq`/`usdkrw`/`usdjpy`/`wti`는 `realtime_module`이 없으므로 market_hours 프로필에서도 **기존 `fetch(id, start, end)` 경로를 그대로** 탄다 — 이미 실측으로 확인했듯 이 소스들은 원래 인터페이스 그대로 호출해도 오늘 행이 갱신되어 있으므로 코드 변경이 필요 없다. `main()`의 `--profile` choices에 `market_hours` 추가.

`collect_one`에 `profile` 인자를 새로 받아야 하므로(현재는 안 받음) 시그니처에 `profile: str` 파라미터 추가 — 호출부(`main()`)에서 `args.profile` 전달.

## `.github/workflows/collect-and-deploy.yml` 변경

```yaml
on:
  schedule:
    - cron: "10 23 * * 0-5"      # 기존 preopen
    - cron: "40 9 * * 1-5"       # 기존 afterclose
    - cron: "*/30 0-6 * * 1-5"   # 신규 market_hours — UTC 00:00~06:30 = KST 09:00~15:30, 월~금
  workflow_dispatch:
    inputs:
      profile:
        options: [preopen, afterclose, market_hours, all]
```

"Determine profile" 스텝의 `github.event.schedule` 분기에 `*/30 0-6 * * 1-5` → `market_hours` 케이스 추가. 나머지(커밋·빌드·배포) 스텝은 프로필명이 다를 뿐 로직 변경 없음 — 단, market_hours 실행은 실패해도(`continue-on-error`) 기존과 동일하게 배포를 막지 않되, stale 3영업일 판정에 market_hours 전용 지표가 걸릴 일은 사실상 없음(장전/장후가 이미 매일 최신화하므로).

## 프론트 자동 갱신 — `web/src/App.tsx`

기존 summary fetch를 함수로 추출해 최초 1회 + `setInterval(FETCH_INTERVAL_MS)`(5분)에서 재사용. `document.visibilitychange` 리스너로 탭이 숨겨지면 interval을 정지하고, 다시 보이면 즉시 1회 재조회 후 interval 재개(백그라운드 탭에서 불필요한 요청 방지 + 복귀 시 최신화).

```ts
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
```

## 장중 표시 배지 — `web/src/lib/realtime.ts`(신규, 순수 함수) + `IndicatorCard.tsx`/`TickerBar.tsx`

```ts
export const REALTIME_ELIGIBLE_IDS = new Set([
  "investor_kospi", "investor_kosdaq", "kospi", "kosdaq",
  "samsung", "skhynix", "usdkrw", "usdjpy", "wti",
]);

export function isIntraday(id: string, observedLast: string | null): boolean {
  if (!observedLast || !REALTIME_ELIGIBLE_IDS.has(id)) return false;
  return observedLast === todayKST(); // Asia/Seoul 기준 오늘 날짜 문자열
}
```

`IndicatorCard`에서 `isIntraday(indicator.id, indicator.observed_last)`가 true면 카드 우측 상단(또는 값 옆)에 작은 펄스 점 + "장중" 라벨 배지 추가(디자인 토큰: `--accent` 계열 점 + `--accent-soft-bg` 배경, 기존 stale 배지와 시각적으로 구분되는 위치). 국채 4종·과거 날짜 데이터에는 절대 표시되지 않는다(집합에 없거나 날짜 불일치).

## `docs/data-rights.md` 변경

매트릭스에 행 추가:

| 네이버 실시간 시세(polling API) | KRX 원천, 네이버 재가공 | JSON 폴링 API (비공식) | 네이버 자체 위젯이 쓰는 미문서화 엔드포인트, 약관상 자동화 수집 근거 없음. 개인 이용 관행 범위, 대중 공개 재배포는 근거 없음(기존 수급 소스와 동일 리스크 등급) | ⚠️ 게이트 항목 |

## 변경하지 않는 것

- `data/{id}.json` 스키마, `summary.json`/`meta.json` 스키마
- 기존 preopen/afterclose 크론·프로필·백필 로직
- 국채 4종(`ust2y`/`ust10y`/`ust30y`/`ktb3y`) 수집 방식
- 프론트 차트 계산 로직(MA·주간집계), 해시 라우팅, 모달 상세 뷰 구조

## 테스트

- `pipeline/tests/test_validate.py`는 변경 없이 그대로 통과해야 함(검증 로직 재사용, 신규 로직 없음)
- `naver_realtime.py`의 숫자 파싱(`num()`)에 대한 단위 테스트 신규 추가(콤마·단위 접미사 케이스)
- `web/src/lib/realtime.test.ts` 신규 — `isIntraday()` 순수 함수 테스트
