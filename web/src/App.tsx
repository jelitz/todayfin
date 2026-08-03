import { useEffect, useRef, useState } from 'react'
import type { Summary } from './types'
import Home from './components/Home'
import About from './components/About'
import Detail from './components/Detail'
import Modal from './components/Modal'
import ErrorBoundary from './components/ErrorBoundary'
import Gnb, { GNB_TABS } from './components/Gnb'
import TickerBar from './components/TickerBar'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import type { Route } from './lib/route'
import { parseHash } from './lib/route'
import { formatDateTimeKST } from './lib/format'
import './App.css'

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}

/** 홈 카드 자동 갱신 주기 — docs/specs/near-realtime-updates/requirements.md R4 */
const SUMMARY_POLL_INTERVAL_MS = 5 * 60 * 1000

function AppShell() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const fetchSummary = () => {
      // 캐시 버스팅 필수 — GitHub Pages(CDN·브라우저)가 summary.json을 캐시하면 폴링을 걸어도
      // 실제로는 오래된 응답을 계속 받게 되어 "5분마다 최신화" 요구사항이 무력화된다(배포 직후 실측으로 확인).
      fetch(`${import.meta.env.BASE_URL}data/summary.json?_=${Date.now()}`, { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<Summary>
        })
        .then((data) => {
          if (!cancelled) {
            hasLoadedRef.current = true
            setSummary(data)
            setSummaryError(null)
          }
        })
        .catch(() => {
          // 폴링 재조회 실패 시 기존 값을 유지하고, 한 번도 로드에 성공한 적 없을 때만 에러 화면 표시
          // (일시적 네트워크 문제로 이미 보여주던 데이터가 에러 화면으로 바뀌는 것을 방지 —
          // 데이터 정확성 원칙: 실패 시 기존 값 유지)
          if (!cancelled && !hasLoadedRef.current) setSummaryError('데이터를 불러오지 못했습니다.')
        })
    }

    fetchSummary()

    let intervalId: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      if (intervalId === null) intervalId = setInterval(fetchSummary, SUMMARY_POLL_INTERVAL_MS)
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
        fetchSummary() // 탭 복귀 시 즉시 최신화
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
  }, [])

  return (
    <div className="app-shell">
      <Gnb
        tabs={GNB_TABS}
        activeRouteName={route.name === 'detail' ? 'home' : route.name}
        updatedAtLabel={summary ? formatDateTimeKST(summary.generated_at) : null}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {(route.name === 'home' || route.name === 'detail') && (
        <TickerBar
          summary={summary}
          onSelect={(id) => {
            window.location.hash = `#/i/${id}`
          }}
        />
      )}

      <main className="app-main">
        {route.name === 'about' ? (
          <ErrorBoundary key="about">
            <About />
          </ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary key="home">
              <Home
                summary={summary}
                error={summaryError}
                onSelect={(id) => {
                  window.location.hash = `#/i/${id}`
                }}
              />
            </ErrorBoundary>

            {route.name === 'detail' && (
              <Modal onClose={() => (window.location.hash = '#/')}>
                <ErrorBoundary key={route.id}>
                  <Detail id={route.id} onBack={() => (window.location.hash = '#/')} />
                </ErrorBoundary>
              </Modal>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="app-disclaimer">
            본 사이트의 모든 정보는 투자 참고용이며 투자 조언이 아닙니다. 데이터는 지연·오류가 있을 수 있습니다. 투자
            판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </p>
          <p className="app-sources muted">
            데이터 출처: 한국거래소(KRX), 네이버페이 증권, Yahoo Finance, 미국 재무부, 한국은행(ECOS)
          </p>
          <p className="app-credit muted">
            제작: jelitz ·{' '}
            <a href="https://github.com/jelitz" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{' '}
            · 문의: <a href="mailto:info@jelitz.com">info@jelitz.com</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
