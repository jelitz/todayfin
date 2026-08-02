import { useEffect } from 'react'
import type { JSX, ReactNode } from 'react'
import './Modal.css'

export interface ModalProps {
  onClose: () => void
  children: ReactNode
}

/** 카드 클릭 시 페이지 전환 없이 홈 위에 상세 뷰를 띄우기 위한 오버레이. */
export default function Modal({ onClose, children }: ModalProps): JSX.Element {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
