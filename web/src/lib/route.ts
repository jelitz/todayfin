/**
 * 해시 기반 라우팅 — GitHub Pages에서 SPA 404 회피 목적(404.html 핵 불필요).
 * 라우트 목록은 docs/specs/content-pages/requirements.md R1 참조.
 */

export type Route =
  | { name: "home" }
  | { name: "detail"; id: string }
  | { name: "about" }
  | { name: "alsangmoo" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, "");

  const detailMatch = clean.match(/^\/i\/(.+)$/);
  if (detailMatch) {
    let id = detailMatch[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      // 잘못된 %-이스케이프 시퀀스 — 원본 문자열을 그대로 사용
      // (존재하지 않는 id면 Detail이 에러 상태로 처리)
    }
    return { name: "detail", id };
  }

  if (clean === "/about") return { name: "about" };
  if (clean === "/alsangmoo") return { name: "alsangmoo" };

  return { name: "home" };
}
