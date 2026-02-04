import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
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
}

interface LayoutContextValue extends LayoutState {
  toggleSidebar: () => void
  setSidebarVisible: (visible: boolean) => void
  setSidebarWidth: (width: number) => void
  setSelectedLines: (lines: LineSelection | null) => void
  setEditingAnnotationId: (id: string | null) => void
  setFileAnnotationExpanded: (expanded: boolean) => void
  setSummaryPopoverOpen: (open: boolean) => void
  setHighlightedAnnotationId: (id: string | null) => void
  clearSelection: () => void
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

  // Global Escape key handler to clear selections
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Don't clear if user is typing in an input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        clearSelection()
        setSummaryPopoverOpen(false)
        setFileAnnotationExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection])

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

  // Clear highlight after animation duration
  useEffect(() => {
    if (highlightedAnnotationId) {
      const timer = setTimeout(() => {
        setHighlightedAnnotationId(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedAnnotationId])

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
        toggleSidebar,
        setSidebarVisible,
        setSidebarWidth,
        setSelectedLines,
        setEditingAnnotationId,
        setFileAnnotationExpanded,
        setSummaryPopoverOpen,
        setHighlightedAnnotationId,
        clearSelection,
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
