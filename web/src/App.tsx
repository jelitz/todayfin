import { useEffect, useState } from 'react'
import type { Summary } from './types'
import Home from './components/Home'
import About from './components/About'
import Alsangmoo from './components/Alsangmoo'
import Detail from './components/Detail'
import Modal from './components/Modal'
import ErrorBoundary from './components/ErrorBoundary'
import Gnb, { GNB_TABS } from './components/Gnb'
import TickerBar from './components/TickerBar'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import type { Route } from './lib/route'
import { parseHash } from './lib/route'
import { formatDateTimeKST } from './lib/format'
import { usePolledJson } from './lib/usePolledJson'
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
  // 폴링·캐시 버스팅·실패 시 기존 값 유지 정책은 usePolledJson 참조(알상무 피드와 공용)
  const { data: summary, error: summaryError } = usePolledJson<Summary>(
    `${import.meta.env.BASE_URL}data/summary.json`,
    SUMMARY_POLL_INTERVAL_MS,
  )
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const showTicker = route.name === 'home' || route.name === 'detail'

  return (
    <div className={showTicker ? 'app-shell app-shell-ticker' : 'app-shell'}>
      <Gnb
        tabs={GNB_TABS}
        activeRouteName={route.name === 'detail' ? 'home' : route.name}
        updatedAtLabel={summary ? formatDateTimeKST(summary.generated_at) : null}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {showTicker && (
        <TickerBar
          summary={summary}
          onSelect={(id) => {
            window.location.hash = `#/i/${id}`
          }}
        />
      )}

      <main className="app-main">
        {route.name === 'about' && (
          <ErrorBoundary key="about">
            <About />
          </ErrorBoundary>
        )}

        {route.name === 'alsangmoo' && (
          <ErrorBoundary key="alsangmoo">
            <Alsangmoo videoId={route.videoId} />
          </ErrorBoundary>
        )}

        {(route.name === 'home' || route.name === 'detail') && (
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
            데이터 출처: 한국거래소(KRX), 네이버페이 증권, Yahoo Finance, 미국 재무부, 한국은행(ECOS), Google News
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
