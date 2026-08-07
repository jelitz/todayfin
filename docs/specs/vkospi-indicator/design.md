# Design — vkospi-indicator

요구사항은 [`requirements.md`](requirements.md) 참조. VKOSPI는 파생 계산이 아니라 **일반 외부 소스 지표**다 — KRX Open API에서 직접 받으므로 기존 수집 구조를 그대로 타고, 새 훅이나 특수 경로가 필요 없다.

## 1. 파이프라인

### `pipeline/sources/krx.py` 확장

기존 `_INDEX_ENDPOINT`(kospi/kosdaq)·`_STOCK_CODE`(삼전/하이닉스)와 나란히 파생상품지수 분기를 추가한다:

```python
_DRVPROD_PATH = "idx/drvprod_dd_trd"
# IDX_NM은 공백 제거 후 비교 — 실측 표기는 "코스피 200 변동성지수"지만 표기 변형 방어
_DRVPROD_INDEX = {"vkospi": "코스피200변동성지수"}

def _drvprod_row(d: date, idx_name_nospace: str) -> dict | None:
    matched = [
        row for row in _get_rows(_DRVPROD_PATH, d.strftime("%Y%m%d"))
        if row.get("IDX_NM", "").replace(" ", "") == idx_name_nospace
    ]
    if not matched:
        return None
    close = matched[0].get("CLSPRC_IDX", "")
    if str(close).strip() == "":
        return None  # 일부 지수는 CLSPRC_IDX가 빈 문자열로 옴(spike 실측) — 0으로 오기록 방지
    return {"date": d.isoformat(), "value": _num(close)}
```

`fetch()`에 `indicator_id in _DRVPROD_INDEX` 분기를 추가한다. 반환 DataFrame 컬럼은 `date, value` — line 타입 계약(`validate.py`의 date/value 검증)과 일치한다. 기존 OHLCV 분기와 반환 스키마가 달라지는데, 이는 지표 type이 다르기 때문이고 collect.py는 type별로 검증하므로 문제없다.

**빈 CLSPRC_IDX 방어가 핵심 안전장치다.** spike 실측(run 31209393183)에서 같은 응답 계열의 일부 행이 `CLSPRC_IDX: ""`로 오는 것을 확인했다. `_num("")`은 0을 돌려주므로 방어 없이는 "VKOSPI가 0으로 폭락"하는 오염 데이터가 저장될 수 있다.

### 백필 스로틀

30일을 넘는 범위(=백필)에서는 호출 간 `time.sleep(0.15)`를 넣는다. 5년 백필 ≈ 영업일 1,240회 호출 × (응답 ~0.5s + 0.15s) ≈ 15분. 일상 증분(7일 lookback, 호출 5회)에는 영향이 없다.

적용 메커니즘(현재 `fetch()`는 분기마다 독립 컴프리헨션이라 공용 삽입 지점이 없음 — 소규모 재구성 필요): `fetch()`에서 `days = _business_days(start, end)`를 한 번 계산해 `throttle = len(days) > 30`을 판정하고, 세 분기를 "per-day 행 함수 + 공용 일자 루프(스로틀 포함)" 형태로 정리한다. `import time` 추가. kospi 등 기존 지표도 파일 유실 시 같은 백필 경로를 타므로 세 분기 공통으로 적용한다.

### `pipeline/indicators.py` 등록

```python
"vkospi": dict(
    name="VKOSPI",
    type="line",
    unit="pt",
    instrument="KRX 코스피200 변동성지수(V-KOSPI200) 종가",
    source_label="krx:idx/drvprod_dd_trd:vkospi",
    source_name=KRX_NAME,
    module=krx,
    profile="afterclose",
),
```

- **폴백 없음** — 동일 정의 소스가 존재하지 않음을 실측으로 확인(requirements 참조). 실패 시 collect.py 기본 동작(기존 값 유지 + stale)이 그대로 적용된다.
- **market_hours 프로필에 넣지 않는다** — naver_realtime에 VKOSPI가 없고, T+1 공표 특성상 장중 갱신이 원천적으로 불가.
- summary.json·티커 바는 INDICATORS 순회로 자동 생성되므로 코드 변경 없음(R7 충족).

### 백필 실행 경로

로컬에 KRX_API_KEY가 없으므로(GitHub Secrets 전용 — 2026-08-08 확인) 백필은 **Actions에서 수행**한다: 머지 후 첫 afterclose 실행(또는 workflow_dispatch profile=afterclose)이 `data/vkospi.json` 부재를 감지하고 자동으로 5년 백필을 돈다(collect.py의 기존 backfill_start 로직). `collect-and-deploy.yml`에는 `timeout-minutes`가 없어 GitHub 기본값 360분이 적용된다(2026-08-08 검증 확인) — 백필 15분 + 재시도 증폭(collect.py의 재시도는 fetch 전체 재실행 ×최대 3회 = 최악 ~45분)을 그대로 수용하므로 **변경하지 않는다**. 임의로 짧은 타임아웃을 넣으면 첫 백필이 원자적 교체 전에 죽어 다음 실행이 백필을 처음부터 반복하는 루프가 생길 수 있다.

## 2. 프론트

- `web/src/types.ts` `SECTIONS`: "시장 가격·추세"와 "거시·통화" 사이에 추가 —
  `{ title: "변동성·리스크", anchor: "section-risk", ids: ["vkospi"] }`
- 상세 화면: type이 line이므로 `Detail.tsx`/`PriceChart` 무변경(2026-08-08 저장소 조사로 확인).
- `About.tsx` `INDICATOR_NOTES`: "변동성·리스크" 그룹 추가. 문구(자체 요약): VKOSPI가 무엇인지(코스피200 옵션가격에서 산출한 향후 30일 기대변동성, 통상 "공포지수"), 왜 보는지(글로벌 기관은 VaR 한도로 움직여 변동성이 커지면 담을 수 있는 코스피 한도가 기계적으로 줄어든다 — 외국인 수급을 읽는 보조 렌즈).
  - **구조 변경 필요**(2026-08-08 검증에서 확인): 현재 `items`의 `note`는 순수 문자열이고 렌더도 평문 출력이라 출처 링크를 표현할 수 없다. `items`에 선택 필드 `sourceUrl?: string; sourceLabel?: string`을 추가하고 렌더에서 note 뒤에 `<a href>` 를 붙인다(R5의 링크 요구 충족).
  - **기존 카피 갱신**: `About.tsx`의 "그래서 지표를 12개로 제한했습니다" 문구가 하드코딩돼 있고 이미 실제(13개)와 어긋나 있다. vkospi 추가로 14개가 되므로 개수 하드코딩을 제거한 표현("지표 수를 엄선해 제한")으로 고친다.

## 3. 문서·데이터 권리

- `docs/data-rights.md`: KRX 행에 drvprod_dd_trd 사용 추가(동일 약관 — 기존 KRX Open API 사용 조건과 같음).
- `docs/steering/tech.md` 소스 매트릭스: VKOSPI 행 추가("KRX Open API drvprod, 폴백 없음(stale), KRX 키 필요").

## 4. 테스트 전략

| 대상 | 방식 |
|------|------|
| `_drvprod_row` 파싱 | pytest — 실측 응답 리터럴 픽스처: 정상 행 매칭(공백 포함 표기), 공백 변형 매칭, 빈 CLSPRC_IDX → None, 대상 행 부재 → None |
| `fetch("vkospi", ...)` | pytest — `_get_rows` 모킹으로 date/value DataFrame 반환·정렬·중복 제거 확인 |
| 통합 | Actions 첫 실행에서 vkospi.json 생성·status ok 확인 후 홈·상세·티커 브라우저 검증(라이트/다크) |

## 트레이드오프·주의

- VKOSPI는 항상 전 영업일 값이다(T+1 공표). 카드 기준일 표기가 다른 afterclose 지표(당일)와 하루 어긋나 보일 수 있으나, 이는 소스의 사실을 그대로 반영하는 것이며 stale 판정(3영업일)에는 여유가 있다.
- `validate_line`의 "전일 대비 30%+ 변동 경고"가 변동성 급등 국면에서 발생할 수 있다(예: 급락장에서 VKOSPI 하루 +40%). 경고는 ok_with_warnings일 뿐 실패가 아니므로 수용 — 오히려 이상치 감지 로그로 유용.
