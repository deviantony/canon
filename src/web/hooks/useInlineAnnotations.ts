import { useEffect, useCallback, useRef, useMemo } from 'react'
import { EditorView } from '@codemirror/view'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import {
  setAnnotationCallbacks,
  updateInlineAnnotations,
  updateSelectedLines,
  inlineAnnotations,
} from '../utils/inlineAnnotations'

interface UseInlineAnnotationsProps {
  filePath: string | null
  onLineClick?: (line: number) => void
}

export function useInlineAnnotations({ filePath, onLineClick }: UseInlineAnnotationsProps) {
  const { annotations, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations()
  const { selectedLines, setSelectedLines } = useLayout()
  const viewRef = useRef<EditorView | null>(null)

  // Store values in refs to avoid recreating callbacks that would trigger editor recreation
  const annotationsRef = useRef(annotations)
  const selectedLinesRef = useRef(selectedLines)
  const filePathRef = useRef(filePath)

  // Keep refs up to date
  useEffect(() => {
    annotationsRef.current = annotations
    selectedLinesRef.current = selectedLines
    filePathRef.current = filePath
  })

  // Set up callbacks for the widgets
  useEffect(() => {
    setAnnotationCallbacks({
      onSave: (lineStart, lineEnd, comment) => {
        if (filePath) {
          addAnnotation(filePath, lineStart, comment, lineEnd)
          setSelectedLines(null)
        }
      },
      onUpdate: (id, comment) => {
        updateAnnotation(id, comment)
      },
      onDelete: (id) => {
        removeAnnotation(id)
      },
      onCancel: () => {
        setSelectedLines(null)
      },
      onLineClick: (line) => {
        onLineClick?.(line)
      },
    })
  }, [filePath, addAnnotation, updateAnnotation, removeAnnotation, setSelectedLines, onLineClick])

  // Register the view and sync state - stable callback that uses refs
  const registerView = useCallback((view: EditorView) => {
    viewRef.current = view
    if (filePathRef.current) {
      updateInlineAnnotations(view, annotationsRef.current, filePathRef.current)
      updateSelectedLines(view, selectedLinesRef.current)
    }
  }, [])

  // Update annotations when they change
  useEffect(() => {
    if (viewRef.current && filePath) {
      updateInlineAnnotations(viewRef.current, annotations, filePath)
    }
  }, [annotations, filePath])

  // Update selected lines when they change
  useEffect(() => {
    if (viewRef.current) {
      updateSelectedLines(viewRef.current, selectedLines)
    }
  }, [selectedLines])

  // Memoize the extension so it doesn't change on every render
  const extension = useMemo(() => inlineAnnotations(), [])

  return {
    extension,
    registerView,
  }
}
