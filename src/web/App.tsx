import { FileCode, FileDiff, FileText, Minimize2, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompletionType, FeedbackResult, GitInfo, ViewMode } from '../shared/types'
import styles from './App.module.css'
import AnnotationSummaryPopover from './components/AnnotationSummaryPopover'
import CodeViewer, { type CodeViewerRef } from './components/CodeViewer'
import CompletionScreen from './components/CompletionScreen'
import DiffViewer, { type DiffViewerRef } from './components/DiffViewer'
import EditorHeader from './components/EditorHeader'
import FileAnnotationFooter from './components/FileAnnotationFooter'
import FileTree from './components/FileTree'
import Header from './components/Header'
import IconToggle from './components/IconToggle'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import Sidebar from './components/Sidebar'
import { AnnotationProvider, useAnnotations } from './context/AnnotationContext'
import { LayoutProvider, useLayout } from './context/LayoutContext'
import { formatShortcut, getModifierKey } from './utils/keyboard'

// Delay to allow file content to load before scrolling
const NAVIGATION_SCROLL_DELAY_MS = 100

// Fullscreen mode configuration
const FULLSCREEN_HEADER_DIM_TIMEOUT_MS = 2000
const FULLSCREEN_HEADER_HOVER_ZONE_PX = 100
const FULLSCREEN_DEBOUNCE_MS = 50

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showChangedOnly, setShowChangedOnly] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('code')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [completionState, setCompletionState] = useState<CompletionType | null>(null)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [lineCount, setLineCount] = useState<number | undefined>(undefined)
  const [floatingHeaderDimmed, setFloatingHeaderDimmed] = useState(false)
  const floatingHeaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [modalAnnotationText, setModalAnnotationText] = useState('')
  const [isEditingModalAnnotation, setIsEditingModalAnnotation] = useState(false)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    formatAsXml,
    annotations,
    getFileAnnotation,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
  } = useAnnotations()
  const {
    clearSelection,
    setFileAnnotationExpanded,
    fileAnnotationExpanded,
    editorFullscreen,
    fullscreenHintShown,
    exitFullscreen,
  } = useLayout()

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
  const selectedFileInfo = gitInfo?.changedFiles.find((f) => f.path === selectedFile)

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
  }, [clearSelection])

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
  }, [gitInfo, hasChanges, showChangedOnly])

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
        setShortcutsModalOpen((prev) => !prev)
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
  }, [
    showChangedOnly,
    hasChanges,
    viewMode,
    canShowDiff,
    isNewFile,
    selectedFile,
    setFileAnnotationExpanded,
    handleSubmit,
    handleCancel,
    annotations,
  ])

  // Scroll to line in the current viewer
  const scrollToLine = useCallback(
    (line: number) => {
      if (viewMode === 'diff' && canShowDiff && !isNewFile) {
        diffViewerRef.current?.scrollToLine(line)
      } else {
        codeViewerRef.current?.scrollToLine(line)
      }
    },
    [viewMode, canShowDiff, isNewFile],
  )

  // Handle navigation from summary popover
  const handleNavigate = useCallback(
    (file: string, line?: number) => {
      setSelectedFile(file)
      if (line !== undefined && line > 0) {
        setTimeout(() => {
          scrollToLine(line)
        }, NAVIGATION_SCROLL_DELAY_MS)
      }
    },
    [scrollToLine],
  )

  // Handle line click from margin panel
  const handleLineClick = useCallback(
    (line: number) => {
      // File-level annotations (line 0) scroll to top (line 1)
      scrollToLine(Math.max(line, 1))
    },
    [scrollToLine],
  )

  // Auto-dim floating header in fullscreen after inactivity
  useEffect(() => {
    if (!editorFullscreen) {
      setFloatingHeaderDimmed(false)
      return
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    function resetDimTimer() {
      setFloatingHeaderDimmed(false)
      if (floatingHeaderTimeoutRef.current) {
        clearTimeout(floatingHeaderTimeoutRef.current)
      }
      floatingHeaderTimeoutRef.current = setTimeout(() => {
        setFloatingHeaderDimmed(true)
      }, FULLSCREEN_HEADER_DIM_TIMEOUT_MS)
    }

    // Initial timer
    resetDimTimer()

    // Debounced mouse move handler for better performance
    function handleMouseMove(e: MouseEvent) {
      if (e.clientY < FULLSCREEN_HEADER_HOVER_ZONE_PX) {
        if (debounceTimer) return
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          resetDimTimer()
        }, FULLSCREEN_DEBOUNCE_MS)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (floatingHeaderTimeoutRef.current) {
        clearTimeout(floatingHeaderTimeoutRef.current)
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [editorFullscreen])

  // Get file annotation for modal
  const fileAnnotation = selectedFile ? getFileAnnotation(selectedFile) : null

  // Reset modal state when opening/closing or file changes
  useEffect(() => {
    if (fileAnnotationExpanded && editorFullscreen && selectedFile) {
      if (fileAnnotation) {
        setModalAnnotationText(fileAnnotation.comment)
        setIsEditingModalAnnotation(false)
      } else {
        setModalAnnotationText('')
        setIsEditingModalAnnotation(true)
      }
      // Focus textarea after modal opens
      setTimeout(() => modalTextareaRef.current?.focus(), 100)
    }
  }, [fileAnnotationExpanded, editorFullscreen, selectedFile, fileAnnotation])

  // Modal handlers
  const handleModalSave = useCallback(() => {
    if (!selectedFile || !modalAnnotationText.trim()) return
    if (fileAnnotation) {
      updateAnnotation(fileAnnotation.id, modalAnnotationText.trim())
    } else {
      addAnnotation(selectedFile, 0, modalAnnotationText.trim())
    }
    setFileAnnotationExpanded(false)
    setIsEditingModalAnnotation(false)
  }, [
    selectedFile,
    modalAnnotationText,
    fileAnnotation,
    updateAnnotation,
    addAnnotation,
    setFileAnnotationExpanded,
  ])

  const handleModalDelete = useCallback(() => {
    if (fileAnnotation) {
      removeAnnotation(fileAnnotation.id)
    }
    setFileAnnotationExpanded(false)
    setIsEditingModalAnnotation(false)
    setModalAnnotationText('')
  }, [fileAnnotation, removeAnnotation, setFileAnnotationExpanded])

  const handleModalClose = useCallback(() => {
    setFileAnnotationExpanded(false)
    setIsEditingModalAnnotation(false)
  }, [setFileAnnotationExpanded])

  const handleModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleModalSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleModalClose()
      }
    },
    [handleModalSave, handleModalClose],
  )

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
          {selectedFile && <FileAnnotationFooter filePath={selectedFile} />}
        </div>
      </main>
      <AnnotationSummaryPopover onSubmit={handleSubmit} onNavigate={handleNavigate} />
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        canShowDiff={canShowDiff && !isNewFile}
        hasChanges={hasChanges}
        hasAnnotations={annotations.length > 0}
        hasSelectedFile={!!selectedFile}
      />
      {/* Fullscreen Mode Overlay */}
      {editorFullscreen && selectedFile && (
        <div className={styles.fullscreenOverlay}>
          {/* Floating header pill */}
          <div className={`${styles.floatingHeader} ${floatingHeaderDimmed ? styles.dimmed : ''}`}>
            <span className={styles.floatingFilePath}>{selectedFile}</span>
            {lineCount !== undefined && lineCount > 0 && (
              <span className={styles.floatingLineCount}>{lineCount} ln</span>
            )}
            {canShowDiff && !isNewFile && (
              <IconToggle
                variant="compact"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  {
                    value: 'diff',
                    icon: <FileDiff size={13} />,
                    title: `View changes (${formatShortcut('Ctrl+Cmd+X')})`,
                  },
                  {
                    value: 'code',
                    icon: <FileCode size={13} />,
                    title: `View source (${formatShortcut('Ctrl+Cmd+X')})`,
                  },
                ]}
              />
            )}
            <button
              type="button"
              className={styles.floatingExitBtn}
              onClick={exitFullscreen}
              title="Exit focus mode (Esc)"
            >
              <Minimize2 size={12} />
            </button>
          </div>

          {/* Main content area */}
          <div className={styles.fullscreenContent}>
            <div className={styles.fullscreenEditorPanel}>
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

            {/* Annotation modal — command palette style */}
            {fileAnnotationExpanded && (
              <div className={styles.annotationModalBackdrop} onClick={handleModalClose}>
                <div className={styles.annotationModal} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.annotationModalHeader}>
                    <div className={styles.annotationModalIcon}>
                      <FileText size={14} />
                    </div>
                    <span className={styles.annotationModalTitle}>File Annotation</span>
                    <button
                      type="button"
                      className={styles.annotationModalClose}
                      onClick={handleModalClose}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className={styles.annotationModalBody}>
                    {isEditingModalAnnotation || !fileAnnotation ? (
                      <textarea
                        ref={modalTextareaRef}
                        className={styles.annotationModalTextarea}
                        value={modalAnnotationText}
                        onChange={(e) => setModalAnnotationText(e.target.value)}
                        onKeyDown={handleModalKeyDown}
                        placeholder="Add a note about this file..."
                      />
                    ) : (
                      <>
                        <div className={styles.annotationModalContent}>
                          {fileAnnotation.comment}
                        </div>
                        <div className={styles.annotationModalContentActions}>
                          <button
                            type="button"
                            className={styles.annotationModalBtn}
                            onClick={() => {
                              setIsEditingModalAnnotation(true)
                              setModalAnnotationText(fileAnnotation.comment)
                              setTimeout(() => modalTextareaRef.current?.focus(), 50)
                            }}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.annotationModalBtn}
                            onClick={handleModalDelete}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {(isEditingModalAnnotation || !fileAnnotation) && (
                    <div className={styles.annotationModalFooter}>
                      <div className={styles.annotationModalHint}>
                        <kbd>{getModifierKey()}</kbd>
                        <span className={styles.hintSeparator}>+</span>
                        <kbd>Enter</kbd>
                      </div>
                      <div className={styles.annotationModalActions}>
                        <button
                          type="button"
                          className={styles.annotationModalBtn}
                          onClick={handleModalClose}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={`${styles.annotationModalBtn} ${styles.primary}`}
                          onClick={handleModalSave}
                          disabled={!modalAnnotationText.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ESC hint — only shown first time */}
          {!fullscreenHintShown && (
            <div className={styles.escHint}>
              <kbd>ESC</kbd>
              <span>to exit</span>
            </div>
          )}
        </div>
      )}
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
