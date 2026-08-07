# Implemented — alsangmoo-player

## 설계 결정

- **모달 재생 + 해시 딥링크**: 카드가 `<a href="#/alsangmoo/v/{id}">`라 브라우저 기본 동작으로 히스토리 push → 뒤로가기·모바일 스와이프 백이 모달 닫기가 된다(지표 상세와 동일 문법). 모달 언마운트 = iframe 제거 = 재생 자동 정지라 별도 정지 코드가 없다.
- **`usePolledJson` 훅 추출**: App의 summary 폴링(5분 + visibilitychange 복귀 + 실패 시 기존 값 유지)과 알상무 피드의 자동 갱신 요구가 동일해 두 번째 호출처가 생긴 시점에 공용화. `HomeProps.error`는 `string | null` → `boolean`으로 단순화(Home이 고정 문구를 렌더하므로 정보 손실 없음 — 검증 에이전트가 타입 충돌을 사전 지적).
- **embeddable 사전 수집**: `videos.list part=status`(+1유닛/실행, 하루 72유닛 = 무료 한도의 0.7%)로 소유자가 임베드를 껐는지 미리 판별 — `false`인 카드만 기존 새 탭 앵커 유지(↗ 표시). status 호출 실패는 경고 로그 후 필드 생략, 프론트가 누락=true로 취급해 부분 실패가 기능 저하로만 끝난다.
- **모달 내 "유튜브에서 보기" 상시 링크**: embeddable=true여도 저작권·지역 차단은 플레이어 레벨에서만 드러나므로(Data API로 사전 감지 불가) 최종 안전망. IFrame Player API(onError 101/150) 자동 감지는 ~1MB 스크립트 대비 이득이 작아 미채택.
- **피드 밖 딥링크 허용**: 최신 15개 롤링에서 밀려난 과거 공유 링크도 videoId만으로 재생(제목만 생략). watch_url도 videoId에서 직접 조립해 피드 의존을 없앴다.

## 계획과의 편차

- **훅 자동화 테스트 미작성**: 설계는 훅 테스트를 계획했으나 useEffect 실행에는 DOM 환경(jsdom 등)이 필요하고 `renderToStaticMarkup`은 effect를 돌리지 않는다. 의존성 추가 대신 (1) 훅 내부가 검증된 App.tsx 코드의 그대로 이전이라는 점 (2) 브라우저 실측으로 갈음 — jsdom 도입은 컴포넌트 테스트 수요가 더 쌓이면 재검토.

## 검증 (2026-08-08)

- pytest: merge_embeddable 4건(병합·누락 id 생략·비불리언 무시·빈 응답) + 회귀 전체(파이프라인 49) 통과.
- vitest: route 확장 3건(신규 매칭·문자집합 밖 폴백·기존 단언 갱신) + 회귀 전체(프론트 68) 통과.
- 브라우저(Playwright — claude-in-chrome 확장 미연결로 폴백):
  - 카드 클릭 → `#/alsangmoo/v/{id}`, youtube-nocookie iframe **실제 자동재생 확인**(스크린샷에 재생 중인 프레임)
  - ESC → `#/alsangmoo` 복귀 + 플레이어 언마운트, 브라우저 뒤로가기도 동일
  - 피드에 없는 id 딥링크: 플레이어 렌더·제목 생략 확인
  - 다크모드·모바일 뷰포트 정상
- iOS Safari의 autoplay 더블탭 현상은 문헌 확인만 — 실기기 검증 안 함(무해한 폴백으로 수용).

## 미결 질문

- 알상무 채널 영상은 전부 embeddable로 보임(15/15 임베드 재생 가능) — `embeddable: false` 경로는 pytest·코드 리뷰로만 검증됨. 실사례 발생 시 카드 ↗ 표시를 실물 확인할 것.
