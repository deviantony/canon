import { useState, useEffect, useRef } from 'react'
import { lineNumbers } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { MergeView } from '@codemirror/merge'
import { getLanguageExtension } from '../utils/languageExtensions'
import { diffEditorTheme } from '../utils/codemirrorTheme'
import type { ChangedFile } from '../../shared/types'

interface DiffViewerProps {
  filePath: string | null
  status?: ChangedFile['status']
}

export default function DiffViewer({ filePath, status }: DiffViewerProps) {
  const [original, setOriginal] = useState<string>('')
  const [modified, setModified] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)

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

    const extensions: Extension[] = [
      lineNumbers(),
      oneDark,
      EditorState.readOnly.of(true),
      diffEditorTheme,
    ]

    // Add language extension if available
    const langExt = getLanguageExtension(filePath)
    if (langExt) {
      extensions.push(langExt)
    }

    const mergeView = new MergeView({
      a: {
        doc: original,
        extensions,
      },
      b: {
        doc: modified,
        extensions,
      },
      parent: containerRef.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
      gutter: true,
    })

    mergeViewRef.current = mergeView

    return () => {
      mergeView.destroy()
    }
  }, [original, modified, filePath, error, loading])

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
      <div className="diff-header">
        <span className="file-path">{filePath}</span>
        <span className="diff-labels">
          <span className="label original">Original</span>
          <span className="label modified">Modified</span>
        </span>
      </div>
      <div className="diff-content" ref={containerRef} />
    </div>
  )
}
