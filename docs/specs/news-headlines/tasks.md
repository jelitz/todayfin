# Tasks — news-headlines

- ✅ T1. pipeline/sources/google_news.py: fetch(limit) — defusedxml·접미사 제거·naive→UTC·필터 후 절단
- ✅ T2. pipeline/collect_news.py: collect_media 대칭 골격 + 24h stale ::warning
- ✅ T3. pytest: test_google_news.py·test_collect_news.py
- ✅ T4. media-collect.yml: news 스텝·`git add data/`·deps(defusedxml)·이름/주석
- ✅ T5. web types.ts: NewsItem·NewsFeed
- ✅ T6. format.ts: formatNewsTime(formatToParts, KST) + 테스트
- ✅ T7. NewsHeadlines.tsx + .css (flex 말줄임·모바일 출처 숨김) + 렌더 테스트
- ✅ T8. Home.tsx: 폴링·렌더 조건(items>0 && 24h 이내)·intro 아래 배치
- ✅ T9. 문서: data-rights.md·푸터 출처·About·index.html·steering design/tech/structure(드리프트 해소)
- ✅ T10. pytest + tsc + vitest 전체 통과
- ✅ T11. 로컬 수집 스모크(스크래치) → 로컬 브라우저 실측
- ✅ T12. 커밋·푸시 → media-collect dispatch → 배포 실측(뉴스 5건·클릭 원문 도달)

의존: T1→T2→T3, T5→(T6·T7)→T8, 전부→T10→T11→T12
