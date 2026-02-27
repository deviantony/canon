import { useCallback, useEffect, useRef, useState } from 'react'
import { type Annotation, useAnnotations } from '../context/AnnotationContext'
import styles from './AnnotationOverlay.module.css'

interface AnnotationOverlayProps {
  open: boolean
  onClose: () => void
  onSubmit: (annotationsXml: string, additionalContext: string) => void
}

function locationLabel(a: Annotation): string {
  if (a.target === 'code') {
    if (a.lineStart === 0) return a.file
    if (a.lineEnd && a.lineEnd !== a.lineStart) {
      return `${a.file}:${a.lineStart}-${a.lineEnd}`
    }
    return `${a.file}:${a.lineStart}`
  }
  if (a.target === 'conversation') {
    return a.quote ? `"${a.quote.slice(0, 40)}${a.quote.length > 40 ? '...' : ''}"` : 'Message'
  }
  return a.toolLabel
}

function pillarBadge(a: Annotation): { label: string; className: string } {
  switch (a.target) {
    case 'code':
      return { label: 'Code', className: styles.cardPillarCode }
    case 'conversation':
      return { label: 'Conv', className: styles.cardPillarConv }
    case 'tool-call':
      return { label: 'Tool', className: styles.cardPillarTool }
  }
}

export default function AnnotationOverlay({ open, onClose, onSubmit }: AnnotationOverlayProps) {
  const { annotations, removeAnnotation, formatAsXml, clearAllAnnotations } = useAnnotations()
  const [composeText, setComposeText] = useState('')
  const composeRef = useRef<HTMLTextAreaElement>(null)

  // Focus compose textarea when overlay opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => composeRef.current?.focus())
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [open, onClose])

  const handleSubmit = useCallback(() => {
    const xml = formatAsXml()
    onSubmit(xml, composeText.trim())
    setComposeText('')
    clearAllAnnotations()
    onClose()
  }, [formatAsXml, composeText, onSubmit, clearAllAnnotations, onClose])

  return (
    <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`} onClick={onClose}>
      <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Review Annotations</span>
          <span className={styles.count}>
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            &#10005;
          </button>
        </div>

        <div className={styles.list}>
          {annotations.length === 0 ? (
            <div className={styles.empty}>No annotations yet</div>
          ) : (
            annotations.map((a) => {
              const badge = pillarBadge(a)
              return (
                <div key={a.id} className={styles.card}>
                  <div className={styles.cardSource}>
                    <span className={`${styles.cardPillar} ${badge.className}`}>{badge.label}</span>
                    <span className={styles.cardLocation}>{locationLabel(a)}</span>
                  </div>
                  <div className={styles.cardText}>{a.comment}</div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.cardBtn} ${styles.cardBtnDelete}`}
                      onClick={() => removeAnnotation(a.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className={styles.compose}>
          <textarea
            ref={composeRef}
            className={styles.composeTextarea}
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Add context or instructions to accompany your annotations..."
          />
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <kbd>Esc</kbd> close
          </span>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSubmit}`}
              onClick={handleSubmit}
              disabled={annotations.length === 0}
            >
              Submit All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
