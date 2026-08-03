import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** 렌더링 중 예외로 앱 전체가 흰 화면이 되는 것을 막는 최후 방어선. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('todayfin: unhandled render error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 480, margin: '88px auto', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-body)', marginBottom: 16 }}>
            페이지를 표시하는 중 오류가 발생했습니다.
          </p>
          <a
            href={`${import.meta.env.BASE_URL}#/`}
            style={{
              display: 'inline-block',
              borderRadius: 'var(--radius-control)',
              border: '1px solid var(--hairline)',
              background: 'var(--canvas)',
              color: 'var(--ink)',
              padding: '8px 20px',
              fontSize: 'var(--fs-body-sm)',
              textDecoration: 'none',
            }}
          >
            홈으로 돌아가기
          </a>
        </div>
      )
    }
    return this.props.children
  }
}
