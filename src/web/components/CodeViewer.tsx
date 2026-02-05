import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { getLanguageExtension } from '../utils/languageExtensions'
import { baseEditorTheme, cyberpunkSyntax } from '../utils/codemirrorTheme'
import { gutterInteraction, scrollToLine as cmScrollToLine } from '../utils/gutterInteraction'
import { useEditorInteraction } from '../hooks/useEditorInteraction'
import { useInlineAnnotations } from '../hooks/useInlineAnnotations'
import styles from './CodeViewer.module.css'

interface CodeViewerProps {
  filePath: string | null
  onLineClick?: (line: number) => void
}

export interface CodeViewerRef {
  scrollToLine: (line: number) => void
}

const CodeViewer = forwardRef<CodeViewerRef, CodeViewerProps>(function CodeViewer({
  filePath,
  onLineClick,
}, ref) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const {
    handleSelectionComplete,
    updateAnnotations,
    clearSelectionIfNeeded,
    annotations,
  } = useEditorInteraction({ filePath })

  const { extension: inlineAnnotationExtension, registerView } = useInlineAnnotations({
    filePath,
    onLineClick,
  })

  // Expose scrollToLine via ref
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (viewRef.current) {
        cmScrollToLine(viewRef.current, line)
      }
    },
  }))

  // Fetch file content
  useEffect(() => {
    if (!filePath) {
      setContent('')
      setError(null)
      return
    }

    const currentFilePath = filePath
    async function loadFile() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/file/${encodeURIComponent(currentFilePath)}`)
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          setContent('')
        } else {
          setContent(data.content)
        }
      } catch (err) {
        setError(String(err))
        setContent('')
      } finally {
        setLoading(false)
      }
    }
    loadFile()
  }, [filePath])

  // Create/update CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !filePath || error) return

    // Clean up existing editor
    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const extensions: Extension[] = [
      lineNumbers(),
      EditorView.lineWrapping,
      highlightActiveLine(),
      cyberpunkSyntax,
      EditorState.readOnly.of(true),
      baseEditorTheme,
      gutterInteraction({
        onSelectionComplete: handleSelectionComplete,
      }),
      inlineAnnotationExtension,
    ]

    // Add language extension if available
    const langExt = getLanguageExtension(filePath)
    if (langExt) {
      extensions.push(langExt)
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    // Update annotations immediately after creating editor
    updateAnnotations(view)
    registerView(view)

    return () => {
      view.destroy()
    }
  }, [content, filePath, error, handleSelectionComplete, updateAnnotations, inlineAnnotationExtension, registerView])

  // Update annotated lines when annotations change
  useEffect(() => {
    if (viewRef.current) {
      updateAnnotations(viewRef.current)
    }
  }, [annotations, updateAnnotations])

  // Clear selection in editor when layout selection is cleared
  useEffect(() => {
    if (viewRef.current) {
      clearSelectionIfNeeded(viewRef.current)
    }
  }, [clearSelectionIfNeeded])

  if (!filePath) {
    return (
      <div className={styles.empty}>
        <p>Select a file to view its contents</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading {filePath}...</p>
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
    <div className={styles.codeViewer}>
      <div className={`${styles.codeContent} ${styles.codemirrorContainer}`} ref={editorRef} />
    </div>
  )
})

export default CodeViewer
