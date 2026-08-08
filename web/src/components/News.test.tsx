/**
 * News 컨테이너 — 정적 렌더에서는 useEffect(fetch)가 돌지 않아 항상 로딩 상태.
 * 로딩 = 빈 본문(오류 문구 플래시 방지, R5)을 그대로 검증한다.
 * unavailable/ready 분기는 newsPageState 단위 테스트(lib/news.test.ts)가 커버.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import News from './News'

describe('News', () => {
  it('로딩 중(첫 응답 전)에는 아무것도 렌더하지 않는다', () => {
    const html = renderToStaticMarkup(<News />)
    expect(html).toBe('')
  })
})
