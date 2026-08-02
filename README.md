# todayfin

한국 시장 중심의 데일리 투자 지표 대시보드. 유튜브 "알상무"가 매일 추적하는 핵심 지표(수급·지수·환율·금리·원자재)를 하루 2회 자동 수집해 정적 웹으로 보여준다.

- **수집**: Python + GitHub Actions (장전 KST 08:10 / 장후 18:40)
- **화면**: Vite + React + TradingView Lightweight Charts, GitHub Pages 호스팅
- **데이터**: repo 내 JSON (`data/`), 소스별 어댑터 + 동일-정의 폴백 원칙

## 문서

- 제품·기술·구조·디자인: [`docs/steering/`](docs/steering/)
- MVP 명세(요구사항·설계·태스크): [`docs/specs/dashboard-mvp/`](docs/specs/dashboard-mvp/)
- 데이터 소스 권리·공개 수위: [`docs/data-rights.md`](docs/data-rights.md)

## 로컬 실행

```bash
# 수집 (환경 변수: ECOS_API_KEY 필수, FRED_API_KEY 선택 — .env 참조)
cd pipeline && pip install -r requirements.txt && python collect.py --profile all

# 프론트
cd web && npm install && npm run dev
```

## 면책

본 사이트의 모든 정보는 투자 참고용이며 투자 조언이 아닙니다. 데이터는 지연·오류가 있을 수 있습니다. 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
