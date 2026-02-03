import { useState, useEffect } from 'react'

interface CodeViewerProps {
  filePath: string | null
}

export default function CodeViewer({ filePath }: CodeViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!filePath) {
      setContent('')
      setError(null)
      return
    }

    async function loadFile() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/file/${encodeURIComponent(filePath)}`)
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

  // Add line numbers
  const lines = content.split('\n')

  return (
    <div className="code-viewer">
      <div className="code-header">
        <span className="file-path">{filePath}</span>
      </div>
      <div className="code-content">
        <pre>
          <code>
            {lines.map((line, i) => (
              <div key={i} className="code-line">
                <span className="line-number">{i + 1}</span>
                <span className="line-content">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
