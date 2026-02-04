interface CompletionScreenProps {
  type: 'submitted' | 'cancelled'
}

export default function CompletionScreen({ type }: CompletionScreenProps) {
  const isSubmitted = type === 'submitted'

  return (
    <div className="completion-screen" data-type={type}>
      {/* Background texture overlay */}
      <div className="completion-bg-texture" />

      {/* Main content container */}
      <div className="completion-content">
        {/* The Seal - central visual element */}
        <div className="completion-seal" data-type={type}>
          {/* Animated rings for submitted state */}
          {isSubmitted && (
            <>
              <div className="seal-ring seal-ring-1" />
              <div className="seal-ring seal-ring-2" />
              <div className="seal-ring seal-ring-3" />
            </>
          )}

          {/* Core seal with icon */}
          <div className="seal-core">
            <div className="seal-icon">
              {isSubmitted ? (
                <svg
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
        <div className="completion-text">
          <span className="completion-label">
            {isSubmitted ? 'REVIEW COMPLETE' : 'REVIEW DISMISSED'}
          </span>

          <h1 className="completion-title">
            {isSubmitted ? 'Feedback Submitted' : 'Session Cancelled'}
          </h1>

          <p className="completion-message">
            {isSubmitted
              ? 'Your annotations have been delivered to Claude Code.'
              : 'No feedback was recorded for this session.'}
          </p>
        </div>

        {/* Footer instruction */}
        <div className="completion-footer">
          <div className="completion-divider" />
          <p className="completion-instruction">
            You can now close this tab and return to <span className="completion-highlight">Claude Code</span>
          </p>
        </div>
      </div>
    </div>
  )
}
