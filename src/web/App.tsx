import { useState, useEffect } from 'react'
import FileTree from './components/FileTree'
import CodeViewer from './components/CodeViewer'
import DiffViewer from './components/DiffViewer'
import AnnotationPanel from './components/AnnotationPanel'
import CompletionScreen from './components/CompletionScreen'
import { AnnotationProvider, useAnnotations } from './context/AnnotationContext'
import type { FeedbackResult, GitInfo } from '../shared/types'

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showChangedOnly, setShowChangedOnly] = useState(true)
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('diff')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [completionState, setCompletionState] = useState<'submitted' | 'cancelled' | null>(null)

  const { annotations, formatAsMarkdown } = useAnnotations()

  // Load git info to know which files have changes
  useEffect(() => {
    async function loadGitInfo() {
      try {
        const res = await fetch('/api/git/info')
        if (res.ok) {
          const info = await res.json()
          setGitInfo(info)
        }
      } catch (err) {
        console.error('Failed to load git info:', err)
      }
    }
    loadGitInfo()
  }, [])

  // Get status of selected file
  const selectedFileStatus = gitInfo?.changedFiles.find(
    (f) => f.path === selectedFile
  )?.status

  // Can only show diff for changed files
  const canShowDiff = !!selectedFileStatus

  // Can only submit if there are annotations
  const canSubmit = annotations.length > 0

  async function sendFeedback(payload: FeedbackResult): Promise<void> {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setCompletionState(payload.cancelled ? 'cancelled' : 'submitted')
    } catch (err) {
      console.error('Failed to send feedback:', err)
    }
  }

  function handleSubmit(): void {
    const markdown = formatAsMarkdown()
    sendFeedback({
      feedback: markdown,
      cancelled: false,
    })
  }

  function handleCancel(): void {
    sendFeedback({
      feedback: "User cancelled review. Ask what they'd like to do next.",
      cancelled: true,
    })
  }

  if (completionState) {
    return <CompletionScreen type={completionState} />
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Canon</h1>
        <div className="header-center">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${showChangedOnly ? 'active' : ''}`}
              onClick={() => setShowChangedOnly(true)}
            >
              Changed
            </button>
            <button
              className={`toggle-btn ${!showChangedOnly ? 'active' : ''}`}
              onClick={() => setShowChangedOnly(false)}
            >
              All Files
            </button>
          </div>
          {selectedFile && (
            <div className="view-toggle" style={{ marginLeft: 12 }}>
              <button
                className={`toggle-btn ${viewMode === 'diff' ? 'active' : ''}`}
                onClick={() => setViewMode('diff')}
                disabled={!canShowDiff}
                title={!canShowDiff ? 'No changes to show' : undefined}
              >
                Diff
              </button>
              <button
                className={`toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
              >
                Code
              </button>
            </div>
          )}
        </div>
        <div className="header-actions">
          <button className="btn cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="btn submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!canSubmit ? 'Add annotations to submit feedback' : undefined}
          >
            Submit ({annotations.length})
          </button>
        </div>
      </header>
      <main className="main">
        <aside className="sidebar">
          <FileTree
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
            showChangedOnly={showChangedOnly}
          />
        </aside>
        <section className="content">
          {viewMode === 'diff' && canShowDiff ? (
            <DiffViewer filePath={selectedFile} status={selectedFileStatus} />
          ) : (
            <CodeViewer filePath={selectedFile} />
          )}
        </section>
        {selectedFile && (
          <aside className="annotation-sidebar">
            <AnnotationPanel filePath={selectedFile} />
          </aside>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AnnotationProvider>
      <AppContent />
    </AnnotationProvider>
  )
}
