# Tasks — alsangmoo-player

설계는 [`design.md`](design.md) 참조.

- ⬜ T1. `web/src/lib/route.ts`: alsangmoo 라우트에 `videoId` 추가(`#/alsangmoo/v/{id}` 우선 매칭) + route.test.ts 기존 단언 갱신·신규 케이스
- ⬜ T2. `web/src/lib/usePolledJson.ts` 추출(App.tsx 폴링 이전) + 훅 테스트, `App.tsx` 적용, `HomeProps.error`를 boolean으로 변경
- ⬜ T3. `pipeline/sources/youtube_api.py`: `videos.list part=status` 추가·`merge_embeddable` 순수 함수·실패 시 embeddable 생략, 쿼터 주석 갱신(2→3유닛) + pytest
- ⬜ T4. `web/src/types.ts`: `YoutubeVideo.embeddable?: boolean`
- ⬜ T5. `Alsangmoo.tsx`: 카드 분기(embeddable=false → 새 탭 유지), 플레이어 모달(`Modal` 재사용, nocookie iframe, "유튜브에서 보기" 상시 링크), `usePolledJson`으로 자동 갱신 전환, `Alsangmoo.css` 플레이어 스타일 (의존: T1·T2·T4)
- ⬜ T6. 브라우저 검증: 카드 클릭→재생, ESC·뒤로가기·배경 클릭 닫기(재생 정지), 딥링크 직접 진입, 다크모드, 모바일 (의존: T5)
- ⬜ T7. `docs/specs/content-pages/design.md` §3에 대체 주석 (의존: T5)
- ⬜ T8. 3개 스펙 implemented.md 작성 + tasks 체크 동기화 + steering 갱신 (공통 마무리)
