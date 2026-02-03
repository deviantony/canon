import { Tree, NodeRendererProps } from 'react-arborist'
import { useState, useEffect, useMemo } from 'react'
import { File, Folder, FolderOpen, MessageSquare } from 'lucide-react'
import type { FileNode, ChangedFile, GitInfo } from '../../shared/types'
import { useAnnotations } from '../context/AnnotationContext'

export type { FileNode }

interface FileTreeProps {
  onSelectFile: (path: string) => void
  selectedFile: string | null
  showChangedOnly: boolean
  gitInfo: GitInfo | null
}

function FileIcon({ isDirectory, isOpen }: { isDirectory: boolean; isOpen: boolean }) {
  if (isDirectory) {
    return isOpen ? (
      <FolderOpen size={14} className="file-icon" />
    ) : (
      <Folder size={14} className="file-icon" />
    )
  }
  return <File size={14} className="file-icon" />
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null

  const labels: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
  }

  return (
    <span className={`status-badge ${status}`} title={status}>
      {labels[status] || '?'}
    </span>
  )
}

function AnnotationBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <span className="annotation-badge" title={`${count} annotation${count === 1 ? '' : 's'}`}>
      <MessageSquare size={10} />
      <span>{count}</span>
    </span>
  )
}

function Node({ node, style, dragHandle }: NodeRendererProps<FileNode & { annotationCount?: number }>) {
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
      {!data.isDirectory && <AnnotationBadge count={data.annotationCount || 0} />}
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

export default function FileTree({ onSelectFile, selectedFile, showChangedOnly, gitInfo }: FileTreeProps) {
  const [allFiles, setAllFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getAnnotationsForFile } = useAnnotations()

  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch('/api/files')
        if (!res.ok) throw new Error('Failed to load files')
        const tree = await res.json()
        setAllFiles(tree)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [])

  // Add annotation counts to nodes
  function addAnnotationCounts(nodes: FileNode[]): FileNode[] {
    return nodes.map((node) => {
      if (node.isDirectory) {
        return { ...node, children: node.children ? addAnnotationCounts(node.children) : undefined }
      }
      const annotations = getAnnotationsForFile(node.path)
      return { ...node, annotationCount: annotations.length }
    })
  }

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

    // Add annotation counts
    tree = addAnnotationCounts(tree)

    return tree
  }, [allFiles, gitInfo, showChangedOnly, getAnnotationsForFile])

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
