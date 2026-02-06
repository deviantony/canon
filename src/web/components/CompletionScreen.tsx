import { Check, X } from 'lucide-react'
import type { CompletionType } from '../../shared/types'
import styles from './CompletionScreen.module.css'

interface CompletionScreenProps {
  type: CompletionType
}

export default function CompletionScreen({ type }: CompletionScreenProps) {
  const isSubmitted = type === 'submitted'
  const screenClass = `${styles.screen} ${isSubmitted ? styles.submitted : styles.cancelled}`
  const sealClass = `${styles.seal} ${isSubmitted ? styles.sealSubmitted : styles.sealCancelled}`

  return (
    <div className={screenClass}>
      {/* Background texture overlay */}
      <div className={styles.bgTexture} />

      {/* Main content container */}
      <div className={styles.content}>
        {/* The Seal - central visual element */}
        <div className={sealClass}>
          {/* Animated rings for submitted state */}
          {isSubmitted && (
            <>
              <div className={styles.sealRing1} />
              <div className={styles.sealRing2} />
              <div className={styles.sealRing3} />
            </>
          )}

          {/* Core seal with icon */}
          <div className={styles.sealCore}>
            <div className={styles.sealIcon}>
              {isSubmitted ? (
                <Check size={32} strokeWidth={2.5} />
              ) : (
                <X size={28} strokeWidth={2} />
              )}
            </div>
          </div>
        </div>

        {/* Typography section */}
        <div className={styles.text}>
          <span className={styles.label}>
            {isSubmitted ? 'REVIEW COMPLETE' : 'REVIEW DISMISSED'}
          </span>

          <h1 className={styles.title}>
            {isSubmitted ? 'Feedback Submitted' : 'Session Cancelled'}
          </h1>

          <p className={styles.message}>
            {isSubmitted
              ? 'Your annotations have been delivered to Claude Code.'
              : 'No feedback was recorded for this session.'}
          </p>
        </div>

        {/* Footer instruction */}
        <div className={styles.footer}>
          <div className={styles.divider} />
          <p className={styles.instruction}>
            You can now close this tab and return to <span className={styles.highlight}>Claude Code</span>
          </p>
        </div>
      </div>
    </div>
  )
}
