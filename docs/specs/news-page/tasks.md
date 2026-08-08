# Tasks — news-page

- ⬜ T1. pipeline/collect_news.py: `_LIMIT` 5 → 70 + 모듈 docstring "상위 5건" 갱신
- ⬜ T2. lib/news.ts 신규: isFreshNews·NEWS_MAX_AGE_MS 이동(Home import 전환)·sortByPublishedDesc + 테스트
- ⬜ T3. format.ts: formatNewsRelativeTime + 테스트
- ⬜ T4. route.ts: `/news` 라우트 + 테스트, Gnb.tsx: 뉴스 탭(2번째)
- ⬜ T5. NewsHeadlines.tsx: className·moreHref prop + 더보기 링크, Home.tsx: moreHref 전달 + 테스트 갱신
- ⬜ T6. components/NewsView.tsx(프레젠테이션, initialTab prop) + News.tsx(컨테이너, 3-상태 분기) + News.css + 렌더·분기 테스트
- ⬜ T7. App.tsx: news 라우트 렌더·showTicker에 news 추가
- ⬜ T8. 문서: data-rights.md 완화책 갱신·steering design/structure/tech·About.tsx·news-headlines 스펙 supersession 주석·index.html 확인
- ⬜ T9. pytest + tsc + vitest 전체 통과
- ⬜ T10. 로컬 수집 스모크(스크래치, 70건 실측) → 로컬 브라우저 실측(탭·다크·모바일)
- ⬜ T11. 커밋·푸시 → **직후 media-collect dispatch**(주요뉴스 탭 빈 화면 윈도 최소화) → 배포 실측(70건·탭 전환·원문 도달)

의존: T2→(T5·T6), T3→T6, T4→(T6·T7), T5→T6, T6→T7, 전부→T9→T10→T11
