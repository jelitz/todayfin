# Implemented — news-headlines

## 설계 결정

- 소스 확정: Google News 비즈니스 토픽 RSS(한국판 고정 파라미터). 인터뷰에서 연합뉴스 단일
  RSS 대비 "핵심 헤드라인 랭킹"이 요구에 부합해 선택 — 러너(해외 IP) 접근·한국어 반환은
  spike run 31238546959로 사전 실측.
- 수집기는 collect_media.py와 의도적 대칭(재시도→검증→스테이징→원자적 교체→실패 시 유지).
- XML 파싱은 defusedxml(외부 XML = 시스템 경계). 제목의 " - 출처명" 접미사는 source 태그와
  정확히 일치할 때만 제거.
- 출처 표시는 참고 예시의 파비콘 대신 텍스트 — 외부 이미지 의존 제거(requirements R2).

## 적대적 검증 반영 (2026-08-08, 3-agent 워크플로우)

- `git add data/news.json` 명시가 파일 부재 런에서 pathspec 오류로 잡 전체를 죽임(재현 확인)
  → `git add data/`로 변경.
- stale 사각지대(연속 실패 시 며칠 된 뉴스 무알림 노출) → 2중 방어: 파이프라인 24h 초과
  `::warning` + 프런트 24h 초과 블록 숨김(R5 조건부로 개정).
- limit 절단은 필터 후에(불량 item이 상위에 섞여도 5건 확보), pubDate "-0000" naive→UTC 부여.
- 1줄 말줄임은 flex + min-width:0 명세(ellipsis는 inline에 미적용).
- 매시간 배포는 concurrency group "pages" 공유로 best-effort(pending 교체 취소 가능,
  다음 정시 자가 회복) — 수용 조건으로 기록.

## 계획과의 편차

- 없음 — 설계(검증 반영판) 그대로 구현.

## 검증 (2026-08-08)

- pytest 12건 신규(google_news 7·collect_news 5) 포함 69 통과, vitest 95(formatNewsTime 4·
  NewsHeadlines 3 신규) 통과.
- 로컬 실수집: 실제 피드에서 한국어 헤드라인 5건(출처·KST 시각 정상) 생성, dev 브라우저에서
  소개문과 그리드 사이 5행 렌더·다크모드 정상 확인.
- 배포 후 실측 예정 항목: media-collect 러너 실수집(news.json 첫 커밋), 배포 사이트 5행 표시,
  헤드라인 클릭 → 구글 경유 원문 도달.

## 미결 질문

- 출처명이 "v.daum.net"·"mk.co.kr"처럼 도메인으로 오는 item이 간혹 있음(구글 피드 원본 그대로) —
  표시 품질 이슈로 보이면 도메인→언론사명 매핑 도입 검토.
