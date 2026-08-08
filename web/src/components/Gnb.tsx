import type { JSX } from 'react'
import './Gnb.css'

export interface GnbTab {
  label: string
  hash: string
  /** 활성 판정용 — App의 Route.name과 대조한다 */
  routeName: string
}

/** GNB 페이지 탭. 기존 섹션 스크롤 탭을 페이지 전환 탭으로 교체(requirements.md R1). */
export const GNB_TABS: GnbTab[] = [
  { label: '홈', hash: '#/', routeName: 'home' },
  { label: '뉴스', hash: '#/news', routeName: 'news' },
  { label: '소개', hash: '#/about', routeName: 'about' },
  { label: '알상무', hash: '#/alsangmoo', routeName: 'alsangmoo' },
]

export interface GnbProps {
  tabs: GnbTab[]
  activeRouteName: string
  updatedAtLabel: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Gnb({
  tabs,
  activeRouteName,
  updatedAtLabel,
  theme,
  onToggleTheme,
}: GnbProps): JSX.Element {
  return (
    <nav className="gnb">
      <div className="gnb-inner">
        <a className="gnb-logo" href="#/">
          todayfin
        </a>

        <div className="gnb-tabs">
          {tabs.map((tab) => {
            const active = activeRouteName === tab.routeName
            return (
              <a
                key={tab.routeName}
                href={tab.hash}
                aria-current={active ? 'page' : undefined}
                className={active ? 'gnb-tab gnb-tab-active' : 'gnb-tab'}
              >
                {tab.label}
              </a>
            )
          })}
        </div>

        <div className="gnb-actions">
          {updatedAtLabel && <span className="gnb-updated">마지막 갱신: {updatedAtLabel}</span>}
          <button
            type="button"
            className="gnb-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  )
}
