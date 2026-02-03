import { Tree, NodeRendererProps } from 'react-arborist'
import { useState, useEffect, useMemo } from 'react'
import type { FileNode, ChangedFile, GitInfo } from '../../shared/types'

export type { FileNode }

interface FileTreeProps {
  onSelectFile: (path: string) => void
  selectedFile: string | null
  showChangedOnly: boolean
}

function FileIcon({ isDirectory, isOpen }: { isDirectory: boolean; isOpen: boolean }) {
  if (isDirectory) {
    return <span className="file-icon">{isOpen ? '📂' : '📁'}</span>
  }
  return <span className="file-icon">📄</span>
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null

  const labels: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
  }

  const colors: Record<string, string> = {
    modified: '#f59e0b',
    added: '#22c55e',
    deleted: '#ef4444',
    renamed: '#8b5cf6',
  }

  return (
    <span
      className="status-badge"
      style={{ color: colors[status] || '#71717a' }}
      title={status}
    >
      {labels[status] || '?'}
    </span>
  )
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
      <StatusBadge status={data.status} />
    </div>
  )
}

// Merge git status into file tree
function mergeGitStatus(nodes: FileNode[], changedFiles: ChangedFile[]): FileNode[] {
  const statusMap = new Map<string, ChangedFile['status']>()
  for (const file of changedFiles) {
    statusMap.set(file.path, file.status)
  }

  function addStatus(node: FileNode): FileNode {
    const status = statusMap.get(node.path)
    const children = node.children?.map(addStatus)
    return { ...node, status, children }
  }

  return nodes.map(addStatus)
}

// Filter tree to only show changed files and their parent directories
function filterToChanged(nodes: FileNode[], changedPaths: Set<string>): FileNode[] {
  return nodes
    .map((node) => {
      if (node.isDirectory) {
        const filteredChildren = filterToChanged(node.children || [], changedPaths)
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren }
        }
        return null
      } else {
        return changedPaths.has(node.path) ? node : null
      }
    })
    .filter((n): n is FileNode => n !== null)
}

export default function FileTree({ onSelectFile, selectedFile, showChangedOnly }: FileTreeProps) {
  const [allFiles, setAllFiles] = useState<FileNode[]>([])
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [filesRes, gitRes] = await Promise.all([
          fetch('/api/files'),
          fetch('/api/git/info'),
        ])

        if (!filesRes.ok) throw new Error('Failed to load files')

        const tree = await filesRes.json()
        setAllFiles(tree)

        if (gitRes.ok) {
          const info = await gitRes.json()
          setGitInfo(info)
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Compute display tree based on view mode and git status
  const displayTree = useMemo(() => {
    let tree = allFiles

    // Merge git status if available
    if (gitInfo?.changedFiles) {
      tree = mergeGitStatus(tree, gitInfo.changedFiles)
    }

    // Filter to changed files if requested
    if (showChangedOnly && gitInfo?.changedFiles) {
      const changedPaths = new Set(gitInfo.changedFiles.map((f) => f.path))
      tree = filterToChanged(tree, changedPaths)
    }

    return tree
  }, [allFiles, gitInfo, showChangedOnly])

  if (loading) {
    return <div className="file-tree-loading">Loading files...</div>
  }

  if (error) {
    return <div className="file-tree-error">{error}</div>
  }

  if (showChangedOnly && displayTree.length === 0) {
    return (
      <div className="file-tree-empty">
        <p>No changes detected</p>
      </div>
    )
  }

  return (
    <div className="file-tree">
      <Tree
        data={displayTree}
        openByDefault={showChangedOnly}
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
