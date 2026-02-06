import { MergeView } from '@codemirror/merge'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ChangedFile } from '../../shared/types'
import { useEditorInteraction } from '../hooks/useEditorInteraction'
import { useInlineAnnotations } from '../hooks/useInlineAnnotations'
import { cyberpunkSyntax, diffEditorTheme } from '../utils/codemirrorTheme'
import { scrollToLine as cmScrollToLine, gutterInteraction } from '../utils/gutterInteraction'
import { getLanguageExtension } from '../utils/languageExtensions'
import styles from './DiffViewer.module.css'

interface DiffViewerProps {
  filePath: string | null
  status?: ChangedFile['status']
  onLineClick?: (line: number) => void
}

export interface DiffViewerRef {
  scrollToLine: (line: number) => void
}

const DiffViewer = forwardRef<DiffViewerRef, DiffViewerProps>(function DiffViewer(
  { filePath, status, onLineClick },
  ref,
) {
  const [original, setOriginal] = useState<string>('')
  const [modified, setModified] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)

  const { handleSelectionComplete, updateAnnotations, clearSelectionIfNeeded } =
    useEditorInteraction({ filePath })

  const { extension: inlineAnnotationExtension, registerView } = useInlineAnnotations({
    filePath,
    onLineClick,
  })

  // Expose scrollToLine via ref
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (mergeViewRef.current) {
        cmScrollToLine(mergeViewRef.current.b, line)
      }
    },
  }))

  // Fetch both original (from git) and modified (current) content
  useEffect(() => {
    if (!filePath) {
      setOriginal('')
      setModified('')
      setError(null)
      return
    }

    const currentFilePath = filePath
    async function loadDiff() {
      setLoading(true)
      setError(null)
      try {
        // Get current file content
        const currentRes = await fetch(`/api/file/${encodeURIComponent(currentFilePath)}`)
        const currentData = await currentRes.json()

        if (currentData.error) {
          // File might be deleted
          if (status === 'deleted') {
            setModified('')
          } else {
            setError(currentData.error)
            return
          }
        } else {
          setModified(currentData.content)
        }

        // Get original content from git (HEAD version)
        const originalRes = await fetch(`/api/git/original/${encodeURIComponent(currentFilePath)}`)
        const originalData = await originalRes.json()

        if (originalData.error) {
          // File might be new (added) or otherwise not in HEAD
          setOriginal('')
        } else {
          setOriginal(originalData.content)
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadDiff()
  }, [filePath, status])

  // Create MergeView
  useEffect(() => {
    if (!containerRef.current || !filePath || error || loading) return

    // Clean up existing view
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy()
    }

    const baseExtensions: Extension[] = [
      lineNumbers(),
      EditorView.lineWrapping,
      cyberpunkSyntax,
      EditorState.readOnly.of(true),
      diffEditorTheme,
    ]

    // Add language extension if available
    const langExt = getLanguageExtension(filePath)
    if (langExt) {
      baseExtensions.push(langExt)
    }

    // Modified (right) side gets gutter interaction and inline annotations
    const modifiedExtensions: Extension[] = [
      ...baseExtensions,
      gutterInteraction({
        onSelectionComplete: handleSelectionComplete,
      }),
      inlineAnnotationExtension,
    ]

    const mergeView = new MergeView({
      a: {
        doc: original,
        extensions: baseExtensions,
      },
      b: {
        doc: modified,
        extensions: modifiedExtensions,
      },
      parent: containerRef.current,
      gutter: true,
    })

    mergeViewRef.current = mergeView

    // Update annotations immediately after creating editor
    updateAnnotations(mergeView.b)
    registerView(mergeView.b)

    return () => {
      mergeView.destroy()
    }
  }, [
    original,
    modified,
    filePath,
    error,
    loading,
    handleSelectionComplete,
    updateAnnotations,
    inlineAnnotationExtension,
    registerView,
  ])

  // Update annotated lines when annotations change (on modified side)
  useEffect(() => {
    if (mergeViewRef.current) {
      updateAnnotations(mergeViewRef.current.b)
    }
  }, [updateAnnotations])

  // Clear selection in editor when layout selection is cleared
  useEffect(() => {
    if (mergeViewRef.current) {
      clearSelectionIfNeeded(mergeViewRef.current.b)
    }
  }, [clearSelectionIfNeeded])

  if (!filePath) {
    return (
      <div className={styles.empty}>
        <p>Select a file to view its diff</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading diff for {filePath}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.diffViewer}>
      <div className={styles.diffContent} ref={containerRef} />
    </div>
  )
})

export default DiffViewer
