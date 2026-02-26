import type { SessionState } from '../../shared/ide-types'
import { useAnnotations } from '../context/AnnotationContext'
import styles from './SessionDots.module.css'

interface SessionDotsProps {
  sessionState: SessionState | null
  onAnnotationClick: () => void
}

function dotClass(state: SessionState | null): string {
  switch (state) {
    case 'processing':
      return styles.dotProcessing
    case 'ready':
      return styles.dotReady
    case 'starting':
      return styles.dotStarting
    case 'error':
      return styles.dotError
    default:
      return styles.dotEmpty
  }
}

export default function SessionDots({ sessionState, onAnnotationClick }: SessionDotsProps) {
  const { annotations } = useAnnotations()

  // Circumference of circle r=11: 2 * PI * 11 ≈ 69.12
  const circumference = 69.12
  // Placeholder token gauge — 0% used when no session
  const tokenPercent = 0
  const offset = circumference - (tokenPercent / 100) * circumference

  return (
    <div className={styles.sessionDotsExt}>
      {/* Active session dot */}
      <div className={`${styles.dotWrap} ${sessionState ? styles.dotActive : ''}`}>
        <div className={`${styles.dot} ${dotClass(sessionState)}`} />
      </div>

      {/* Empty slots for future multi-session */}
      <div className={styles.dotWrap}>
        <div className={`${styles.dot} ${styles.dotEmpty}`} />
      </div>
      <div className={styles.dotWrap}>
        <div className={`${styles.dot} ${styles.dotEmpty}`} />
      </div>

      <div className={styles.vitalsSep} />

      {/* Token gauge (placeholder) */}
      <div className={styles.vitalsGauge}>
        <svg viewBox="0 0 26 26" role="img" aria-label="Token usage">
          <title>Token usage</title>
          <circle className={styles.gaugeTrack} cx="13" cy="13" r="11" />
          <circle
            className={styles.gaugeFill}
            cx="13"
            cy="13"
            r="11"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className={styles.vitalsGaugeLabel}>{tokenPercent || '--'}</span>
      </div>

      {/* Annotation count */}
      {annotations.length > 0 && (
        <button type="button" className={styles.vitalsAnn} onClick={onAnnotationClick}>
          {annotations.length}&#9642;
        </button>
      )}
    </div>
  )
}
