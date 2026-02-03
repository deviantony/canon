import { useState } from 'react'
import FileTree from './components/FileTree'
import CodeViewer from './components/CodeViewer'

interface FeedbackPayload {
  feedback: string
  cancelled: boolean
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')

  async function sendFeedback(payload: FeedbackPayload) {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSubmitted(true)
      setMessage(payload.cancelled ? 'Review Cancelled' : 'Feedback Submitted')
    } catch (err) {
      console.error('Failed to send feedback:', err)
    }
  }

  function handleSubmit() {
    sendFeedback({
      feedback: '## Code Review Feedback\n\nTest annotation from React UI.',
      cancelled: false,
    })
  }

  function handleCancel() {
    sendFeedback({
      feedback: "User cancelled review. Ask what they'd like to do next.",
      cancelled: true,
    })
  }

  if (submitted) {
    return (
      <div className="submitted-container">
        <h1>{message}</h1>
        <p>You can close this tab.</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Canon</h1>
        <div className="header-actions">
          <button className="btn cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn submit" onClick={handleSubmit}>
            Submit Feedback
          </button>
        </div>
      </header>
      <main className="main">
        <aside className="sidebar">
          <FileTree onSelectFile={setSelectedFile} selectedFile={selectedFile} />
        </aside>
        <section className="content">
          <CodeViewer filePath={selectedFile} />
        </section>
      </main>
    </div>
  )
}
