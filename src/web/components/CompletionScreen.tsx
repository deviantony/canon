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
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
            You can now close this tab and return to{' '}
            <span className={styles.highlight}>Claude Code</span>
          </p>
        </div>
      </div>
    </div>
  )
}
