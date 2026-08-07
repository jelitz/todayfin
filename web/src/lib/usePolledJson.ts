import { useEffect, useRef, useState } from 'react'

/**
 * data/*.json 주기 폴링 훅 — App의 summary 폴링 구현을 그대로 옮겨 공용화
 * (docs/specs/alsangmoo-player/design.md, 두 번째 호출처인 알상무 피드가 생기며 추출).
 *
 * - 캐시 버스팅 필수: GitHub Pages(CDN·브라우저)가 응답을 캐시하면 폴링이 무력화된다(실측).
 * - 실패 시 기존 값 유지: 한 번도 성공한 적 없을 때만 error를 올린다 —
 *   일시적 네트워크 문제로 보여주던 데이터가 에러 화면으로 바뀌는 것을 방지.
 * - 탭이 숨겨지면 폴링을 멈추고, 복귀 시 즉시 재조회 후 재개한다.
 */
export function usePolledJson<T>(path: string, intervalMs: number): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = () => {
      fetch(`${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}`, { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<T>
        })
        .then((json) => {
          if (!cancelled) {
            hasLoadedRef.current = true
            setData(json)
            setError(false)
          }
        })
        .catch(() => {
          if (!cancelled && !hasLoadedRef.current) setError(true)
        })
    }

    fetchOnce()

    let intervalId: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      if (intervalId === null) intervalId = setInterval(fetchOnce, intervalMs)
    }
    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchOnce() // 탭 복귀 시 즉시 최신화
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [path, intervalMs])

  return { data, error }
}
