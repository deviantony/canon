import { Tree, NodeRendererProps } from 'react-arborist'
import { useState, useEffect } from 'react'

export interface FileNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface FileTreeProps {
  onSelectFile: (path: string) => void
  selectedFile: string | null
}

function FileIcon({ isDirectory, isOpen }: { isDirectory: boolean; isOpen: boolean }) {
  if (isDirectory) {
    return <span className="file-icon">{isOpen ? '📂' : '📁'}</span>
  }
  return <span className="file-icon">📄</span>
}

function Node({ node, style, dragHandle }: NodeRendererProps<FileNode>) {
  const data = node.data

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`tree-node ${node.isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (data.isDirectory) {
          node.toggle()
        } else {
          node.select()
        }
      }}
    >
      <FileIcon isDirectory={data.isDirectory} isOpen={node.isOpen} />
      <span className="file-name">{data.name}</span>
    </div>
  )
}

export default function FileTree({ onSelectFile, selectedFile }: FileTreeProps) {
  const [data, setData] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch('/api/files')
        if (!res.ok) throw new Error('Failed to load files')
        const tree = await res.json()
        setData(tree)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [])

  if (loading) {
    return <div className="file-tree-loading">Loading files...</div>
  }

  if (error) {
    return <div className="file-tree-error">{error}</div>
  }

  return (
    <div className="file-tree">
      <Tree
        data={data}
        openByDefault={false}
        width="100%"
        height={600}
        indent={16}
        rowHeight={28}
        onSelect={(nodes) => {
          const selected = nodes[0]
          if (selected && !selected.data.isDirectory) {
            onSelectFile(selected.data.path)
          }
        }}
      >
        {Node}
      </Tree>
    </div>
  )
}
