import { useRef, useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { updateAnnotatedLines, clearLineSelection } from '../utils/gutterInteraction'
import { getAnnotatedLineNumbers } from '../utils/annotationUtils'

interface UseEditorInteractionOptions {
  filePath: string | null
}

interface UseEditorInteractionReturn {
  /** Callback for when gutter selection completes */
  handleSelectionComplete: (start: number, end: number) => void
  /** Callback for clicking annotation indicator */
  handleIndicatorClick: (line: number) => void
  /** Callback for scroll events */
  handleScroll: (view: EditorView) => void
  /** Update annotated lines in the editor */
  updateAnnotations: (view: EditorView) => void
  /** Clear selection if layout selection is cleared */
  clearSelectionIfNeeded: (view: EditorView) => void
  /** Current annotations - use as effect dependency for annotation updates */
  annotations: ReturnType<typeof useAnnotations>['annotations']
}

/**
 * Shared hook for editor interaction logic between CodeViewer and DiffViewer
 */
export function useEditorInteraction({
  filePath,
}: UseEditorInteractionOptions): UseEditorInteractionReturn {
  const { getAnnotationsForFile, annotations } = useAnnotations()
  const { setSelectedLines, setHighlightedAnnotationId, selectedLines, setEditorScrollTop } = useLayout()

  // Store callbacks in refs to avoid recreating the editor when they change
  const getAnnotationsRef = useRef(getAnnotationsForFile)
  const setHighlightedRef = useRef(setHighlightedAnnotationId)
  const filePathRef = useRef(filePath)
  const annotationsRef = useRef(annotations)

  // Keep refs up to date
  useEffect(() => {
    getAnnotationsRef.current = getAnnotationsForFile
    setHighlightedRef.current = setHighlightedAnnotationId
    filePathRef.current = filePath
    annotationsRef.current = annotations
  })

  // Callback for when gutter selection completes
  const handleSelectionComplete = useCallback(
    (start: number, end: number) => {
      setSelectedLines({ start, end })
    },
    [setSelectedLines]
  )

  // Callback for clicking annotation indicator - uses refs to avoid dependency changes
  const handleIndicatorClick = useCallback((line: number) => {
    const currentFilePath = filePathRef.current
    if (!currentFilePath) return
    const fileAnnotations = getAnnotationsRef.current(currentFilePath)
    const annotation = fileAnnotations.find(
      (a) => line >= a.lineStart && line <= (a.lineEnd || a.lineStart)
    )
    if (annotation) {
      setHighlightedRef.current(annotation.id)
    }
  }, [])

  // Handle scroll for syncing with margin panel
  const handleScroll = useCallback(
    (view: EditorView) => {
      setEditorScrollTop(view.scrollDOM.scrollTop)
    },
    [setEditorScrollTop]
  )

  // Update annotated lines - uses refs to stay stable across annotation changes
  const updateAnnotations = useCallback(
    (view: EditorView) => {
      const currentFilePath = filePathRef.current
      if (!currentFilePath) return
      const fileAnnotations = getAnnotationsRef.current(currentFilePath)
      const lines = getAnnotatedLineNumbers(fileAnnotations)
      updateAnnotatedLines(view, lines)
    },
    []
  )

  // Clear selection in editor when layout selection is cleared
  const clearSelectionIfNeeded = useCallback(
    (view: EditorView) => {
      if (!selectedLines) {
        clearLineSelection(view)
      }
    },
    [selectedLines]
  )

  return {
    handleSelectionComplete,
    handleIndicatorClick,
    handleScroll,
    updateAnnotations,
    clearSelectionIfNeeded,
    annotations,
  }
}
