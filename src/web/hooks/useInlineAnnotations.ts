import { useEffect, useCallback, useRef, useMemo } from 'react'
import { EditorView } from '@codemirror/view'
import { Compartment } from '@codemirror/state'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import {
  annotationCallbacksFacet,
  updateInlineAnnotations,
  updateSelectedLines,
  inlineAnnotations,
} from '../utils/inlineAnnotations'
import type { AnnotationCallbacks } from '../utils/inlineAnnotations'

interface UseInlineAnnotationsProps {
  filePath: string | null
  onLineClick?: (line: number) => void
}

export function useInlineAnnotations({ filePath, onLineClick }: UseInlineAnnotationsProps) {
  const { annotations, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations()
  const { selectedLines, setSelectedLines } = useLayout()
  const viewRef = useRef<EditorView | null>(null)
  const callbacksCompartment = useRef(new Compartment()).current

  // Store values in refs to avoid recreating callbacks that would trigger editor recreation
  const annotationsRef = useRef(annotations)
  const selectedLinesRef = useRef(selectedLines)
  const filePathRef = useRef(filePath)
  const callbacksRef = useRef<AnnotationCallbacks | null>(null)

  // Keep refs up to date
  useEffect(() => {
    annotationsRef.current = annotations
    selectedLinesRef.current = selectedLines
    filePathRef.current = filePath
  })

  // Set up callbacks for the widgets via facet reconfiguration
  useEffect(() => {
    const callbacks: AnnotationCallbacks = {
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
    }
    callbacksRef.current = callbacks
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: callbacksCompartment.reconfigure(
          annotationCallbacksFacet.of(callbacks)
        )
      })
    }
  }, [filePath, addAnnotation, updateAnnotation, removeAnnotation, setSelectedLines, onLineClick, callbacksCompartment])

  // Register the view and sync state - stable callback that uses refs
  const registerView = useCallback((view: EditorView) => {
    viewRef.current = view
    // Apply current callbacks to the newly created view
    if (callbacksRef.current) {
      view.dispatch({
        effects: callbacksCompartment.reconfigure(
          annotationCallbacksFacet.of(callbacksRef.current)
        )
      })
    }
    if (filePathRef.current) {
      updateInlineAnnotations(view, annotationsRef.current, filePathRef.current)
      updateSelectedLines(view, selectedLinesRef.current)
    }
  }, [callbacksCompartment])

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
  const extension = useMemo(() => [
    inlineAnnotations(),
    callbacksCompartment.of(annotationCallbacksFacet.of(null)),
  ], [callbacksCompartment])

  return {
    extension,
    registerView,
  }
}
