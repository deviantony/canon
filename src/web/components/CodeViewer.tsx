import { useState, useEffect, useRef } from 'react'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { getLanguageExtension } from '../utils/languageExtensions'
import { baseEditorTheme } from '../utils/codemirrorTheme'

interface CodeViewerProps {
  filePath: string | null
}

export default function CodeViewer({ filePath }: CodeViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

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
      highlightActiveLine(),
      oneDark,
      EditorState.readOnly.of(true),
      baseEditorTheme,
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

    return () => {
      view.destroy()
    }
  }, [content, filePath, error])

  if (!filePath) {
    return (
      <div className="code-viewer empty">
        <p>Select a file to view its contents</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="code-viewer loading">
        <p>Loading {filePath}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="code-viewer error">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="code-viewer">
      <div className="code-header">
        <span className="file-path">{filePath}</span>
      </div>
      <div className="code-content codemirror-container" ref={editorRef} />
    </div>
  )
}
