import { useEffect, useState } from 'react'
import type { Summary } from './types'
import Home from './components/Home'
import Detail from './components/Detail'
import Modal from './components/Modal'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

/** 현재 hash("#/", "#/i/{id}" 등)를 파싱해 라우트를 계산한다. */
type Route = { name: 'home' } | { name: 'detail'; id: string }

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, '')
  const detailMatch = clean.match(/^\/i\/(.+)$/)
  if (detailMatch) {
    let id = detailMatch[1]
    try {
      id = decodeURIComponent(id)
    } catch {
      // 잘못된 %-이스케이프 시퀀스 — 원본 문자열을 그대로 사용(존재하지 않는 id면 Detail이 에러 상태로 처리)
    }
    return { name: 'detail', id }
  }
  return { name: 'home' }
}

/** "2026-08-02T16:06:33.887335+00:00" 같은 ISO 문자열을 "YYYY.MM.DD HH:MM" (KST)로 포맷한다. */
function formatGeneratedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(`${import.meta.env.BASE_URL}data/summary.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Summary>
      })
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummaryError('데이터를 불러오지 못했습니다.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-logo">todayfin</span>
          {summary && <span className="app-updated muted">마지막 갱신: {formatGeneratedAt(summary.generated_at)}</span>}
        </div>
      </header>

      <main className="app-main">
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
        </div>
      </footer>
    </div>
  )
}
