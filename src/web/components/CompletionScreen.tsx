interface CompletionScreenProps {
  type: 'submitted' | 'cancelled'
}

export default function CompletionScreen({ type }: CompletionScreenProps) {
  const isSubmitted = type === 'submitted'

  return (
    <div className="completion-screen">
      <div className="completion-icon" data-type={type}>
        {isSubmitted ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
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

      <h1 className="completion-title">
        {isSubmitted ? 'Feedback Submitted' : 'Review Cancelled'}
      </h1>

      <p className="completion-message">
        {isSubmitted
          ? 'Claude Code will process your feedback.'
          : 'No feedback was sent.'}
      </p>

      <div className="completion-divider" />

      <p className="completion-instruction">
        You can close this tab and return to <strong>Claude Code</strong>.
      </p>
      <p className="completion-status">Your response has been sent.</p>
    </div>
  )
}
