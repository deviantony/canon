import { Maximize2, Minimize2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitInfo, ViewMode } from '../shared/types'
import styles from './AuroreApp.module.css'
import AnnotationOverlay from './components/AnnotationOverlay'
import AuroreSidebar from './components/AuroreSidebar'
import ChromeBar, { type PillarId } from './components/ChromeBar'
import CodeViewer, { type CodeViewerRef } from './components/CodeViewer'
import ConversationPanel from './components/ConversationPanel'
import DiffViewer, { type DiffViewerRef } from './components/DiffViewer'
import PromptBar from './components/PromptBar'
import SessionDots from './components/SessionDots'
import { AnnotationProvider } from './context/AnnotationContext'
import { LayoutProvider, useLayout } from './context/LayoutContext'
import { SessionProvider, useSession } from './context/SessionContext'

declare const __APP_VERSION__: string

function useDimAfterDelay(active: boolean, delayMs = 3000) {
  const [dimmed, setDimmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setDimmed(false)
    clearTimeout(timerRef.current)
    if (!active) return
    timerRef.current = setTimeout(() => setDimmed(true), delayMs)
    return () => clearTimeout(timerRef.current)
  }, [active, delayMs])

  const pause = useCallback(() => {
    clearTimeout(timerRef.current)
    setDimmed(false)
  }, [])

  const resume = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDimmed(true), delayMs)
  }, [delayMs])

  return { dimmed, pause, resume }
}

function AuroreContent() {
  const [activePillar, setActivePillar] = useState<PillarId>('conv')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('code')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [annotationOverlayOpen, setAnnotationOverlayOpen] = useState(false)
  const [lineCount, setLineCount] = useState<number | null>(null)

  const { sessionInfo, sendPrompt } = useSession()
  const { clearSelection, toggleEditorFullscreen, editorFullscreen, exitFullscreen } = useLayout()

  const fsPill = useDimAfterDelay(editorFullscreen)
  const focusBtn = useDimAfterDelay(activePillar === 'code')

  const codeViewerRef = useRef<CodeViewerRef>(null)
  const diffViewerRef = useRef<DiffViewerRef>(null)
  const fsCodeViewerRef = useRef<CodeViewerRef>(null)
  const fsDiffViewerRef = useRef<DiffViewerRef>(null)

  // Load git info
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

  const selectedFileInfo = gitInfo?.changedFiles.find((f) => f.path === selectedFile)
  const selectedFileStatus = selectedFileInfo?.status
  const canShowDiff = !!selectedFileStatus
  const isNewFile = selectedFileStatus === 'added'

  // Clear selection and line count when file changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedFile used as trigger
  useEffect(() => {
    clearSelection()
    setLineCount(null)
  }, [selectedFile, clearSelection])

  // Auto-switch to 'code' for new files
  useEffect(() => {
    if (isNewFile && viewMode === 'diff') {
      setViewMode('code')
    }
  }, [isNewFile, viewMode])

  // Line click handler for code/diff viewer
  const handleLineClick = useCallback(
    (line: number) => {
      const showDiff = viewMode === 'diff' && canShowDiff && !isNewFile
      if (showDiff) {
        diffViewerRef.current?.scrollToLine(Math.max(line, 1))
      } else {
        codeViewerRef.current?.scrollToLine(Math.max(line, 1))
      }
    },
    [viewMode, canShowDiff, isNewFile],
  )

  // Annotation overlay submit handler (bridge to session)
  const handleAnnotationSubmit = useCallback(
    (annotationsXml: string, additionalContext: string) => {
      let prompt = annotationsXml
      if (additionalContext) {
        prompt += `\n\n${additionalContext}`
      }
      sendPrompt(prompt)
      // Switch to conversation to see the response
      setActivePillar('conv')
    },
    [sendPrompt],
  )

  const showDiffViewer = viewMode === 'diff' && canShowDiff && !isNewFile

  return (
    <div className={styles.app}>
      <ChromeBar
        activePillar={activePillar}
        onPillarChange={setActivePillar}
        gitInfo={gitInfo}
        version={__APP_VERSION__}
      />

      <SessionDots
        sessionState={sessionInfo?.state ?? null}
        onAnnotationClick={() => setAnnotationOverlayOpen(true)}
      />

      <div className={styles.surfaces}>
        {/* Conversation surface */}
        <div
          className={`${styles.surface} ${styles.conversationSurface} ${activePillar === 'conv' ? styles.surfaceActive : ''}`}
        >
          <ConversationPanel />
        </div>

        {/* Code surface */}
        <div
          className={`${styles.surface} ${styles.codeSurface} ${activePillar === 'code' ? styles.surfaceActive : ''}`}
        >
          <AuroreSidebar
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
            gitInfo={gitInfo}
          />
          <div className={styles.codeContentArea}>
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
                  onLineCount={setLineCount}
                />
              )}
            </div>
            <button
              type="button"
              className={`${styles.focusBtn} ${focusBtn.dimmed ? styles.focusBtnDimmed : ''}`}
              onClick={toggleEditorFullscreen}
              title="Focus mode"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <PromptBar />

      <AnnotationOverlay
        open={annotationOverlayOpen}
        onClose={() => setAnnotationOverlayOpen(false)}
        onSubmit={handleAnnotationSubmit}
      />

      {/* Fullscreen overlay */}
      <div
        className={`${styles.fsOverlay} ${editorFullscreen && selectedFile ? styles.fsOverlayOpen : ''}`}
      >
        {/* Hover zone — reveals pill + ESC hint when mouse enters top area */}
        <div
          className={styles.fsHoverZone}
          onMouseEnter={fsPill.pause}
          onMouseLeave={fsPill.resume}
        >
          <div className={`${styles.fsPill} ${fsPill.dimmed ? styles.fsPillDimmed : ''}`}>
            <span className={styles.fsPillPath}>{selectedFile}</span>
            {lineCount != null && <span className={styles.fsPillCount}>{lineCount} ln</span>}
            <button
              type="button"
              className={styles.fsPillExit}
              onClick={exitFullscreen}
              title="Exit focus mode (Esc)"
            >
              <Minimize2 size={12} />
            </button>
          </div>
        </div>
        <div className={styles.fsContent}>
          {editorFullscreen &&
            selectedFile &&
            (showDiffViewer ? (
              <DiffViewer
                ref={fsDiffViewerRef}
                filePath={selectedFile}
                status={selectedFileStatus}
                onLineClick={handleLineClick}
              />
            ) : (
              <CodeViewer
                ref={fsCodeViewerRef}
                filePath={selectedFile}
                onLineClick={handleLineClick}
                onLineCount={setLineCount}
              />
            ))}
        </div>
        <div className={`${styles.fsEscHint} ${fsPill.dimmed ? styles.fsEscHintHidden : ''}`}>
          <kbd>ESC</kbd>
          <span>to exit</span>
        </div>
      </div>
    </div>
  )
}

export default function AuroreApp() {
  return (
    <AnnotationProvider>
      <LayoutProvider>
        <SessionProvider>
          <AuroreContent />
        </SessionProvider>
      </LayoutProvider>
    </AnnotationProvider>
  )
}
