import { useState, useEffect, useRef, useCallback } from 'react'
import FileTree from './components/FileTree'
import CodeViewer, { CodeViewerRef } from './components/CodeViewer'
import DiffViewer, { DiffViewerRef } from './components/DiffViewer'
import FileAnnotationFooter from './components/FileAnnotationFooter'
import EditorHeader from './components/EditorHeader'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import AnnotationSummaryPopover from './components/AnnotationSummaryPopover'
import CompletionScreen from './components/CompletionScreen'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import { AnnotationProvider, useAnnotations } from './context/AnnotationContext'
import { LayoutProvider, useLayout } from './context/LayoutContext'
import type { FeedbackResult, GitInfo } from '../shared/types'
import styles from './App.module.css'

// Delay to allow file content to load before scrolling
const NAVIGATION_SCROLL_DELAY_MS = 100

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showChangedOnly, setShowChangedOnly] = useState(true)
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [completionState, setCompletionState] = useState<'submitted' | 'cancelled' | null>(null)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [lineCount, setLineCount] = useState<number | undefined>(undefined)

  const { formatAsXml, annotations } = useAnnotations()
  const { clearSelection, setFileAnnotationExpanded } = useLayout()

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

  // Fetch line count when file changes
  useEffect(() => {
    if (!selectedFile) {
      setLineCount(undefined)
      return
    }

    const currentFile = selectedFile
    async function loadLineCount() {
      try {
        const res = await fetch(`/api/file/${encodeURIComponent(currentFile)}`)
        if (res.ok) {
          const data = await res.json()
          setLineCount(data.lineCount)
        }
      } catch {
        setLineCount(undefined)
      }
    }
    loadLineCount()
  }, [selectedFile])

  // Get info for selected file from gitInfo
  const selectedFileInfo = gitInfo?.changedFiles.find(
    (f) => f.path === selectedFile
  )

  // Get status of selected file
  const selectedFileStatus = selectedFileInfo?.status

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
  }, [isNewFile, viewMode])

  // Auto-switch to 'all files' mode when no changes detected
  useEffect(() => {
    if (gitInfo && !hasChanges && showChangedOnly) {
      setShowChangedOnly(false)
    }
  }, [gitInfo, hasChanges])

  // Submit/cancel handlers (defined before keyboard shortcuts so they can be used there)
  const sendFeedback = useCallback(async (payload: FeedbackResult): Promise<void> => {
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
  }, [])

  const handleSubmit = useCallback((): void => {
    const xml = formatAsXml()
    sendFeedback({
      feedback: xml,
      cancelled: false,
    })
  }, [formatAsXml, sendFeedback])

  const handleCancel = useCallback((): void => {
    sendFeedback({
      feedback: "User cancelled review. Ask what they'd like to do next.",
      cancelled: true,
    })
  }, [sendFeedback])

  // Keyboard shortcuts - consolidated handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()

      // Cmd+K / Ctrl+K to open shortcuts modal (but not Ctrl+Cmd+K)
      if ((e.metaKey || e.ctrlKey) && key === 'k' && !e.shiftKey && !e.altKey) {
        if (e.ctrlKey && e.metaKey) return
        e.preventDefault()
        e.stopPropagation()
        setShortcutsModalOpen(prev => !prev)
        return
      }

      // All other shortcuts require both Ctrl and Cmd
      if (!e.ctrlKey || !e.metaKey) return

      // Ctrl+Cmd+Z: Toggle changes/all in file sidebar
      if (key === 'z') {
        e.preventDefault()
        e.stopPropagation()
        if (showChangedOnly || hasChanges) {
          setShowChangedOnly(!showChangedOnly)
        }
        return
      }

      // Ctrl+Cmd+X: Toggle diff/source view (only if possible)
      if (key === 'x') {
        e.preventDefault()
        e.stopPropagation()
        if (canShowDiff && !isNewFile) {
          setViewMode(viewMode === 'diff' ? 'code' : 'diff')
        }
        return
      }

      // Ctrl+Cmd+C: Focus file annotation field
      if (key === 'c') {
        e.preventDefault()
        e.stopPropagation()
        if (selectedFile) {
          setFileAnnotationExpanded(true)
        }
        return
      }

      // Ctrl+Cmd+Enter: Submit review (only if annotations exist)
      if (key === 'enter') {
        e.preventDefault()
        e.stopPropagation()
        if (annotations.length > 0) {
          handleSubmit()
        }
        return
      }

      // Ctrl+Cmd+Backspace: Cancel review
      if (key === 'backspace') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showChangedOnly, hasChanges, viewMode, canShowDiff, isNewFile, selectedFile, setFileAnnotationExpanded, handleSubmit, handleCancel, annotations])

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
    // File-level annotations (line 0) scroll to top (line 1)
    scrollToLine(Math.max(line, 1))
  }, [scrollToLine])

  // Determine which viewer to show
  const showDiffViewer = viewMode === 'diff' && canShowDiff && !isNewFile

  if (completionState) {
    return <CompletionScreen type={completionState} />
  }

  return (
    <div className={styles.app}>
      <Header
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onShowShortcuts={() => setShortcutsModalOpen(true)}
      />
      <main className={styles.main}>
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
        <div className={styles.contentArea}>
          <EditorHeader
            filePath={selectedFile}
            canShowDiff={canShowDiff}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isNewFile={isNewFile}
            fileStatus={selectedFileStatus}
            additions={selectedFileInfo?.additions}
            deletions={selectedFileInfo?.deletions}
            lineCount={lineCount}
          />
          <div className={styles.editorPanel}>
            {showDiffViewer ? (
              <DiffViewer
                ref={diffViewerRef}
                filePath={selectedFile}
                status={selectedFileStatus}
                onLineClick={handleLineClick}
              />
            ) : (
              <CodeViewer
                ref={codeViewerRef}
                filePath={selectedFile}
                onLineClick={handleLineClick}
              />
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
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        canShowDiff={canShowDiff && !isNewFile}
        hasChanges={hasChanges}
        hasAnnotations={annotations.length > 0}
        hasSelectedFile={!!selectedFile}
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
