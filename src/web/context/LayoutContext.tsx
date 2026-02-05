import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { isMac } from '../utils/keyboard'

export interface LineSelection {
  start: number
  end: number
}

interface LayoutState {
  sidebarVisible: boolean
  sidebarWidth: number
  selectedLines: LineSelection | null
  editingAnnotationId: string | null
  fileAnnotationExpanded: boolean
  summaryPopoverOpen: boolean
  highlightedAnnotationId: string | null
  editorFullscreen: boolean
  fullscreenHintShown: boolean
}

interface LayoutContextValue extends LayoutState {
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSelectedLines: (lines: LineSelection | null) => void
  setEditingAnnotationId: (id: string | null) => void
  setFileAnnotationExpanded: (expanded: boolean) => void
  setSummaryPopoverOpen: (open: boolean) => void
  setHighlightedAnnotationId: (id: string | null) => void
  clearSelection: () => void
  toggleEditorFullscreen: () => void
  exitFullscreen: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

interface LayoutProviderProps {
  children: ReactNode
}

const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 220

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidthState] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [selectedLines, setSelectedLines] = useState<LineSelection | null>(null)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const [fileAnnotationExpanded, setFileAnnotationExpanded] = useState(false)
  const [summaryPopoverOpen, setSummaryPopoverOpen] = useState(false)
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<string | null>(null)
  const [editorFullscreen, setEditorFullscreen] = useState(false)
  const [fullscreenHintShown, setFullscreenHintShown] = useState(false)
  const sidebarWasVisibleRef = useRef(true)
  const sidebarVisibleRef = useRef(sidebarVisible)
  sidebarVisibleRef.current = sidebarVisible

  const toggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev)
  }, [])

  const setSidebarWidth = useCallback((width: number) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width))
    setSidebarWidthState(clamped)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedLines(null)
    setEditingAnnotationId(null)
    setHighlightedAnnotationId(null)
  }, [])

  const toggleEditorFullscreen = useCallback(() => {
    setEditorFullscreen(prev => {
      if (!prev) {
        // Entering fullscreen: remember sidebar state and hide it
        sidebarWasVisibleRef.current = sidebarVisibleRef.current
        setSidebarVisible(false)
      } else {
        // Exiting fullscreen: restore sidebar state
        setSidebarVisible(sidebarWasVisibleRef.current)
      }
      return !prev
    })
  }, [])

  const exitFullscreen = useCallback(() => {
    if (editorFullscreen) {
      setEditorFullscreen(false)
      setSidebarVisible(sidebarWasVisibleRef.current)
    }
  }, [editorFullscreen])

  // Global Escape key handler to clear selections or exit fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Don't interfere if user is typing in an input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        // Fullscreen exit takes priority
        if (editorFullscreen) {
          e.preventDefault()
          exitFullscreen()
          return
        }
        clearSelection()
        setSummaryPopoverOpen(false)
        setFileAnnotationExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection, editorFullscreen, exitFullscreen])

  // Ctrl+Cmd+S (macOS) / Ctrl+Alt+S (Windows/Linux) to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // macOS: Ctrl+Cmd+S, Windows/Linux: Ctrl+Alt+S
      const isShortcut = isMac
        ? (e.ctrlKey && e.metaKey && e.key.toLowerCase() === 's')
        : (e.ctrlKey && e.altKey && e.key.toLowerCase() === 's')

      if (isShortcut) {
        e.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  // Ctrl+Cmd+V (macOS) / Ctrl+Alt+V (Windows/Linux) to toggle fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isShortcut = isMac
        ? (e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'v')
        : (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v')

      if (isShortcut) {
        e.preventDefault()
        toggleEditorFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleEditorFullscreen])

  // Clear highlight after animation duration
  useEffect(() => {
    if (highlightedAnnotationId) {
      const timer = setTimeout(() => {
        setHighlightedAnnotationId(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedAnnotationId])

  // Mark fullscreen hint as shown after the animation completes (3s)
  useEffect(() => {
    if (editorFullscreen && !fullscreenHintShown) {
      const timer = setTimeout(() => {
        setFullscreenHintShown(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [editorFullscreen, fullscreenHintShown])

  return (
    <LayoutContext.Provider
      value={{
        sidebarVisible,
        sidebarWidth,
        selectedLines,
        editingAnnotationId,
        fileAnnotationExpanded,
        summaryPopoverOpen,
        highlightedAnnotationId,
        editorFullscreen,
        fullscreenHintShown,
        toggleSidebar,
        setSidebarWidth,
        setSelectedLines,
        setEditingAnnotationId,
        setFileAnnotationExpanded,
        setSummaryPopoverOpen,
        setHighlightedAnnotationId,
        clearSelection,
        toggleEditorFullscreen,
        exitFullscreen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider')
  }
  return context
}
