import { useState, useEffect, useRef, useCallback } from 'react'
import FileTree from './components/FileTree'

// Delay to allow file content to load before scrolling
const NAVIGATION_SCROLL_DELAY_MS = 100
import CodeViewer, { CodeViewerRef } from './components/CodeViewer'
import DiffViewer, { DiffViewerRef } from './components/DiffViewer'
import MarginPanel from './components/MarginPanel'
import FileAnnotationFooter from './components/FileAnnotationFooter'
import EditorHeader from './components/EditorHeader'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import AnnotationSummaryPopover from './components/AnnotationSummaryPopover'
import CompletionScreen from './components/CompletionScreen'
import { AnnotationProvider, useAnnotations } from './context/AnnotationContext'
import { LayoutProvider, useLayout } from './context/LayoutContext'
import type { FeedbackResult, GitInfo } from '../shared/types'

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showChangedOnly, setShowChangedOnly] = useState(true)
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [completionState, setCompletionState] = useState<'submitted' | 'cancelled' | null>(null)

  const { formatAsMarkdown } = useAnnotations()
  const { clearSelection } = useLayout()

  const codeViewerRef = useRef<CodeViewerRef>(null)
  const diffViewerRef = useRef<DiffViewerRef>(null)

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

  // Check if file is newly added (no original to compare)
  const isNewFile = selectedFileStatus === 'added'

  // Has any changes at all
  const hasChanges = (gitInfo?.changedFiles?.length || 0) > 0

  // Clear selection when changing files
  useEffect(() => {
    clearSelection()
  }, [selectedFile, clearSelection])

  // Auto-switch to 'code' mode for new files
  useEffect(() => {
    if (isNewFile && viewMode === 'diff') {
      setViewMode('code')
    }
  }, [isNewFile, selectedFile])

  // Scroll to line in the current viewer
  const scrollToLine = useCallback((line: number) => {
    if (viewMode === 'diff' && canShowDiff && !isNewFile) {
      diffViewerRef.current?.scrollToLine(line)
    } else {
      codeViewerRef.current?.scrollToLine(line)
    }
  }, [viewMode, canShowDiff, isNewFile])

  // Handle navigation from summary popover
  const handleNavigate = useCallback((file: string, line?: number) => {
    setSelectedFile(file)
    if (line !== undefined && line > 0) {
      setTimeout(() => {
        scrollToLine(line)
      }, NAVIGATION_SCROLL_DELAY_MS)
    }
  }, [scrollToLine])

  // Handle line click from margin panel
  const handleLineClick = useCallback((line: number) => {
    if (line === 0) {
      // File-level annotation - scroll to top
      scrollToLine(1)
    } else {
      scrollToLine(line)
    }
  }, [scrollToLine])

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

  // Determine which viewer to show
  const showDiffViewer = viewMode === 'diff' && canShowDiff && !isNewFile

  if (completionState) {
    return <CompletionScreen type={completionState} />
  }

  return (
    <div className="app">
      <Header
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      <main className="main">
        <Sidebar
          showChangedOnly={showChangedOnly}
          setShowChangedOnly={setShowChangedOnly}
          hasChanges={hasChanges}
          changedCount={gitInfo?.changedFiles?.length || 0}
        >
          <FileTree
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
            showChangedOnly={showChangedOnly}
            gitInfo={gitInfo}
          />
        </Sidebar>
        <div className="content-area">
          <EditorHeader
            filePath={selectedFile}
            canShowDiff={canShowDiff}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isNewFile={isNewFile}
          />
          <div className="editor-panel">
            <section className="content">
              {showDiffViewer ? (
                <DiffViewer
                  ref={diffViewerRef}
                  filePath={selectedFile}
                  status={selectedFileStatus}
                />
              ) : (
                <CodeViewer
                  ref={codeViewerRef}
                  filePath={selectedFile}
                />
              )}
            </section>
            {selectedFile && (
              <div className="annotations-panel">
                <MarginPanel filePath={selectedFile} onLineClick={handleLineClick} />
              </div>
            )}
          </div>
          {selectedFile && (
            <FileAnnotationFooter filePath={selectedFile} />
          )}
        </div>
      </main>
      <AnnotationSummaryPopover
        onSubmit={handleSubmit}
        onNavigate={handleNavigate}
      />
    </div>
  )
}

export default function App() {
  return (
    <AnnotationProvider>
      <LayoutProvider>
        <AppContent />
      </LayoutProvider>
    </AnnotationProvider>
  )
}
