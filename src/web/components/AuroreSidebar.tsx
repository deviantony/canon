import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangedFile, FileNode, GitInfo } from '../../shared/types'
import styles from './AuroreSidebar.module.css'

interface AuroreSidebarProps {
  onSelectFile: (path: string) => void
  selectedFile: string | null
  gitInfo: GitInfo | null
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
      }
      return changedPaths.has(node.path) ? node : null
    })
    .filter((n): n is FileNode => n !== null)
}

// Status badge component
function StatusBadge({ status }: { status?: ChangedFile['status'] }) {
  if (!status) return null

  const labels: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
  }

  const badgeStyles: Record<string, string> = {
    modified: styles.treeBadgeModified,
    added: styles.treeBadgeAdded,
    deleted: styles.treeBadgeDeleted,
    renamed: styles.treeBadgeRenamed,
  }

  return (
    <span className={`${styles.treeBadge} ${badgeStyles[status] ?? ''}`}>
      {labels[status] ?? '?'}
    </span>
  )
}

// Flatten tree for rendering with depth tracking
interface FlatNode {
  node: FileNode
  depth: number
  isOpen: boolean
}

function flattenTree(nodes: FileNode[], openDirs: Set<string>, depth: number): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    const isOpen = openDirs.has(node.path)
    result.push({ node, depth, isOpen })
    if (node.isDirectory && isOpen && node.children) {
      result.push(...flattenTree(node.children, openDirs, depth + 1))
    }
  }
  return result
}

export default function AuroreSidebar({ onSelectFile, selectedFile, gitInfo }: AuroreSidebarProps) {
  const [allFiles, setAllFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showChangedOnly, setShowChangedOnly] = useState(false)
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set())

  const changedCount = gitInfo?.changedFiles?.length ?? 0
  const hasChanges = changedCount > 0

  // Auto-switch to changes view if there are changes
  useEffect(() => {
    if (hasChanges) {
      setShowChangedOnly(true)
    }
  }, [hasChanges])

  // Load file tree
  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch('/api/files')
        if (!res.ok) throw new Error('Failed to load files')
        const tree = await res.json()
        setAllFiles(tree)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [])

  // Build display tree
  const displayTree = useMemo(() => {
    let tree = allFiles
    if (gitInfo?.changedFiles) {
      tree = mergeGitStatus(tree, gitInfo.changedFiles)
    }
    if (showChangedOnly && gitInfo?.changedFiles) {
      const changedPaths = new Set(gitInfo.changedFiles.map((f) => f.path))
      tree = filterToChanged(tree, changedPaths)
    }
    return tree
  }, [allFiles, gitInfo, showChangedOnly])

  // Auto-open directories in changes view
  useEffect(() => {
    if (showChangedOnly && displayTree.length > 0) {
      const dirs = new Set<string>()
      function collectDirs(nodes: FileNode[]) {
        for (const node of nodes) {
          if (node.isDirectory) {
            dirs.add(node.path)
            if (node.children) collectDirs(node.children)
          }
        }
      }
      collectDirs(displayTree)
      setOpenDirs(dirs)
    }
  }, [showChangedOnly, displayTree])

  const flatNodes = useMemo(() => flattenTree(displayTree, openDirs, 0), [displayTree, openDirs])

  const toggleDir = useCallback((path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  return (
    <div className={styles.sidebar}>
      {/* Header with toggle buttons */}
      <div className={styles.header}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!showChangedOnly ? styles.toggleBtnActive : ''}`}
          onClick={() => setShowChangedOnly(false)}
          title="All files"
        >
          {/* Grid icon */}
          <svg viewBox="0 0 24 24" role="img" aria-label="All files">
            <title>All files</title>
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${showChangedOnly ? styles.toggleBtnActive : ''}`}
          onClick={() => hasChanges && setShowChangedOnly(true)}
          title="Git changes"
        >
          {/* Git branch icon */}
          <svg viewBox="0 0 24 24" role="img" aria-label="Git changes">
            <title>Git changes</title>
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 0 0 9 9" />
          </svg>
          {changedCount > 0 && <span className={styles.toggleBadge}>{changedCount}</span>}
        </button>
      </div>

      {/* File tree */}
      <div className={styles.content}>
        {loading && <div className={styles.empty}>Loading...</div>}
        {!loading && flatNodes.length === 0 && (
          <div className={styles.empty}>{showChangedOnly ? 'No changes detected' : 'No files'}</div>
        )}
        {flatNodes.map(({ node, depth, isOpen }) => {
          const isDir = node.isDirectory
          const isActive = !isDir && node.path === selectedFile
          const paddingLeft = 16 + depth * 16

          return (
            <div
              key={node.path}
              className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
              style={{ paddingLeft }}
              onClick={() => {
                if (isDir) {
                  toggleDir(node.path)
                } else {
                  onSelectFile(node.path)
                }
              }}
            >
              {isDir ? (
                <span className={`${styles.treeIcon} ${styles.treeIconFolder}`}>
                  {isOpen ? '\u25BE' : '\u25B8'}
                </span>
              ) : (
                <span className={styles.treeIcon}>{'\u25A0'}</span>
              )}
              <span className={styles.treeName}>
                {node.name}
                {isDir ? '/' : ''}
              </span>
              {!isDir && <StatusBadge status={node.status} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
