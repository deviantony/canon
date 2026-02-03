import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { lineNumbers, EditorView } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { getLanguageExtension } from '../utils/languageExtensions'
import { diffEditorTheme, cyberpunkSyntax } from '../utils/codemirrorTheme'
import { gutterInteraction, scrollToLine as cmScrollToLine } from '../utils/gutterInteraction'
import { useEditorInteraction } from '../hooks/useEditorInteraction'
import type { ChangedFile } from '../../shared/types'

interface DiffViewerProps {
  filePath: string | null
  status?: ChangedFile['status']
}

export interface DiffViewerRef {
  scrollToLine: (line: number) => void
  getScrollTop: () => number
}

const DiffViewer = forwardRef<DiffViewerRef, DiffViewerProps>(function DiffViewer({
  filePath,
  status,
}, ref) {
  const [original, setOriginal] = useState<string>('')
  const [modified, setModified] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)

  const {
    handleSelectionComplete,
    handleIndicatorClick,
    handleScroll,
    updateAnnotations,
    clearSelectionIfNeeded,
  } = useEditorInteraction({ filePath })

  // Expose scrollToLine via ref
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (mergeViewRef.current) {
        cmScrollToLine(mergeViewRef.current.b, line)
      }
    },
    getScrollTop: () => {
      return mergeViewRef.current?.b.scrollDOM.scrollTop ?? 0
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
      cyberpunkSyntax,
      EditorState.readOnly.of(true),
      diffEditorTheme,
    ]

    // Add language extension if available
    const langExt = getLanguageExtension(filePath)
    if (langExt) {
      baseExtensions.push(langExt)
    }

    // Modified (right) side gets gutter interaction
    const modifiedExtensions: Extension[] = [
      ...baseExtensions,
      gutterInteraction({
        onSelectionComplete: handleSelectionComplete,
        onIndicatorClick: handleIndicatorClick,
      }),
      EditorView.domEventHandlers({
        scroll: () => handleScroll(mergeViewRef.current!.b),
      }),
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
      collapseUnchanged: { margin: 3, minSize: 4 },
      gutter: true,
    })

    mergeViewRef.current = mergeView

    return () => {
      mergeView.destroy()
    }
  }, [original, modified, filePath, error, loading, handleSelectionComplete, handleIndicatorClick, handleScroll])

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
      <div className="diff-viewer empty">
        <p>Select a file to view its diff</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="diff-viewer loading">
        <p>Loading diff for {filePath}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="diff-viewer error">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="diff-viewer">
      <div className="diff-content" ref={containerRef} />
    </div>
  )
})

export default DiffViewer
