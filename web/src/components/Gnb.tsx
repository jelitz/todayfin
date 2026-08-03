import type { JSX } from 'react'
import './Gnb.css'

export interface GnbProps {
  sections: { title: string; anchor: string }[]
  activeAnchor: string | null
  updatedAtLabel: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

function scrollToAnchor(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Gnb({ sections, activeAnchor, updatedAtLabel, theme, onToggleTheme }: GnbProps): JSX.Element {
  return (
    <nav className="gnb">
      <div className="gnb-inner">
        <span className="gnb-logo">todayfin</span>

        <div className="gnb-tabs" role="tablist" aria-label="섹션 이동">
          {sections.map((section) => (
            <button
              key={section.anchor}
              type="button"
              role="tab"
              aria-selected={activeAnchor === section.anchor}
              className={activeAnchor === section.anchor ? 'gnb-tab gnb-tab-active' : 'gnb-tab'}
              onClick={() => scrollToAnchor(section.anchor)}
            >
              {section.title}
            </button>
          ))}
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
