import type { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useRef } from 'react'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { getAnnotatedLineNumbers } from '../utils/annotationUtils'
import { clearLineSelection, updateAnnotatedLines } from '../utils/gutterInteraction'

interface UseEditorInteractionOptions {
  filePath: string | null
}

interface UseEditorInteractionReturn {
  /** Callback for when gutter selection completes */
  handleSelectionComplete: (start: number, end: number) => void
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
  const { setSelectedLines, selectedLines } = useLayout()

  // Store callbacks in refs to avoid recreating the editor when they change
  const getAnnotationsRef = useRef(getAnnotationsForFile)
  const filePathRef = useRef(filePath)

  // Keep refs up to date
  useEffect(() => {
    getAnnotationsRef.current = getAnnotationsForFile
    filePathRef.current = filePath
  })

  // Callback for when gutter selection completes
  const handleSelectionComplete = useCallback(
    (start: number, end: number) => {
      setSelectedLines({ start, end })
    },
    [setSelectedLines],
  )

  // Update annotated lines - uses refs to stay stable across annotation changes
  const updateAnnotations = useCallback((view: EditorView) => {
    const currentFilePath = filePathRef.current
    if (!currentFilePath) return
    const fileAnnotations = getAnnotationsRef.current(currentFilePath)
    const lines = getAnnotatedLineNumbers(fileAnnotations)
    updateAnnotatedLines(view, lines)
  }, [])

  // Clear selection in editor when layout selection is cleared
  const clearSelectionIfNeeded = useCallback(
    (view: EditorView) => {
      if (!selectedLines) {
        clearLineSelection(view)
      }
    },
    [selectedLines],
  )

  return {
    handleSelectionComplete,
    updateAnnotations,
    clearSelectionIfNeeded,
    annotations,
  }
}
