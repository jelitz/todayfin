"""지표 레지스트리 — canonical 정의는 docs/specs/dashboard-mvp/requirements.md R1 참조.

`source_label`: 내부 식별자(어댑터:심볼 형태) — meta.json 등 디버깅·로그용.
`source_name`: 화면에 표시할 "데이터의 원래 출처" — 어댑터/경유 서비스가 아니라
    실제 데이터 생산 주체를 사람이 읽는 이름으로 표기한다(사용자 피드백 2026-08-03 반영).
"""

from sources import ecos, fdr_source, fred, naver, naver_realtime, treasury, yfinance_source

KRX_NAME = "한국거래소(KRX)"
KRX_VIA_NAVER_NAME = "한국거래소(KRX) · 네이버페이 증권"
YAHOO_FINANCE_NAME = "Yahoo Finance"
US_TREASURY_NAME = "미국 재무부(U.S. Department of the Treasury)"
FRED_NAME = "세인트루이스 연방준비은행(FRED)"
BOK_ECOS_NAME = "한국은행(ECOS)"

INDICATORS = {
    "investor_kospi": dict(
        name="주체별 순매수 (코스피)",
        type="flows",
        unit="억원",
        columns=["individual", "foreign", "institution"],
        instrument="KRX 코스피 현물 거래대금 기준 개인/외국인/기관 일별 순매수",
        source_label="naver:investorDealTrendDay:sosok=01",
        source_name=KRX_VIA_NAVER_NAME,
        module=naver,
        profile="afterclose",
    ),
    "investor_kosdaq": dict(
        name="주체별 순매수 (코스닥)",
        type="flows",
        unit="억원",
        columns=["individual", "foreign", "institution"],
        instrument="KRX 코스닥 현물 거래대금 기준 개인/외국인/기관 일별 순매수",
        source_label="naver:investorDealTrendDay:sosok=02",
        source_name=KRX_VIA_NAVER_NAME,
        module=naver,
        profile="afterclose",
    ),
    "kospi": dict(
        name="코스피",
        type="ohlcv",
        unit="pt",
        instrument="KRX 산출 코스피 지수 종가",
        source_label="fdr:KS11",
        source_name=KRX_NAME,
        module=fdr_source,
        profile="afterclose",
        realtime_module=naver_realtime,
    ),
    "kosdaq": dict(
        name="코스닥",
        type="ohlcv",
        unit="pt",
        instrument="KRX 산출 코스닥 지수 종가",
        source_label="fdr:KQ11",
        source_name=KRX_NAME,
        module=fdr_source,
        profile="afterclose",
        realtime_module=naver_realtime,
    ),
    "samsung": dict(
        name="삼성전자",
        type="ohlcv",
        unit="원",
        instrument="삼성전자(005930) 일봉 OHLCV",
        source_label="fdr:005930",
        source_name=KRX_NAME,
        module=fdr_source,
        profile="afterclose",
        realtime_module=naver_realtime,
    ),
    "skhynix": dict(
        name="SK하이닉스",
        type="ohlcv",
        unit="원",
        instrument="SK하이닉스(000660) 일봉 OHLCV",
        source_label="fdr:000660",
        source_name=KRX_NAME,
        module=fdr_source,
        profile="afterclose",
        realtime_module=naver_realtime,
    ),
    "usdkrw": dict(
        name="원/달러",
        type="line",
        unit="KRW",
        instrument="USD/KRW 글로벌 FX 시장환율 일봉 종가",
        source_label="yfinance:KRW=X",
        source_name=YAHOO_FINANCE_NAME,
        module=yfinance_source,
        profile="preopen",
    ),
    "usdjpy": dict(
        name="달러/엔",
        type="line",
        unit="JPY",
        instrument="USD/JPY 글로벌 FX 시장환율 일봉 종가",
        source_label="yfinance:JPY=X",
        source_name=YAHOO_FINANCE_NAME,
        module=yfinance_source,
        profile="preopen",
    ),
    "wti": dict(
        name="WTI",
        type="line",
        unit="USD/bbl",
        instrument="NYMEX WTI 최근월 선물 종가",
        source_label="yfinance:CL=F",
        source_name=YAHOO_FINANCE_NAME,
        module=yfinance_source,
        profile="preopen",
    ),
    "ust2y": dict(
        name="미국채 2년",
        type="line",
        unit="%",
        instrument="미 재무부 Daily Par Yield Curve 2년물",
        source_label="treasury:2Yr",
        source_name=US_TREASURY_NAME,
        module=treasury,
        profile="preopen",
        fallback_module=fred,
        fallback_source_label="fred:DGS2",
        fallback_source_name=FRED_NAME,
    ),
    "ust10y": dict(
        name="미국채 10년",
        type="line",
        unit="%",
        instrument="미 재무부 Daily Par Yield Curve 10년물",
        source_label="treasury:10Yr",
        source_name=US_TREASURY_NAME,
        module=treasury,
        profile="preopen",
        fallback_module=fred,
        fallback_source_label="fred:DGS10",
        fallback_source_name=FRED_NAME,
    ),
    "ust30y": dict(
        name="미국채 30년",
        type="line",
        unit="%",
        instrument="미 재무부 Daily Par Yield Curve 30년물",
        source_label="treasury:30Yr",
        source_name=US_TREASURY_NAME,
        module=treasury,
        profile="preopen",
        fallback_module=fred,
        fallback_source_label="fred:DGS30",
        fallback_source_name=FRED_NAME,
    ),
    "ktb3y": dict(
        name="국고채 3년",
        type="line",
        unit="%",
        instrument="ECOS 국고채 3년 최종호가수익률",
        source_label="ecos:817Y002:010200000",
        source_name=BOK_ECOS_NAME,
        module=ecos,
        profile="afterclose",
    ),
}

PROFILES = {
    "preopen": [k for k, v in INDICATORS.items() if v["profile"] == "preopen"],
    "afterclose": [k for k, v in INDICATORS.items() if v["profile"] == "afterclose"],
}
PROFILES["all"] = list(INDICATORS.keys())

# 정규장 중(09:00~15:30 KST) 30분 간격 준실시간 수집 대상 — 국채 4종은 하루 1회 고시값이라 제외.
# 지표의 "주 프로필"(preopen/afterclose, 백필·확정치 담당)과는 별개로 부가 참여하는 집합.
PROFILES["market_hours"] = [
    "investor_kospi",
    "investor_kosdaq",
    "kospi",
    "kosdaq",
    "samsung",
    "skhynix",
    "usdkrw",
    "usdjpy",
    "wti",
]
