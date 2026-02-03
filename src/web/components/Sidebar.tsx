import { ReactNode, useRef, useCallback, useEffect, useState } from 'react'
import { useLayout } from '../context/LayoutContext'
import { FolderGit2, Files } from 'lucide-react'

interface SidebarProps {
  children: ReactNode
  showChangedOnly: boolean
  setShowChangedOnly: (show: boolean) => void
  hasChanges: boolean
  changedCount: number
}

export default function Sidebar({ children, showChangedOnly, setShowChangedOnly, hasChanges, changedCount }: SidebarProps) {
  const { sidebarVisible, sidebarWidth, setSidebarWidth } = useLayout()
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    setSidebarWidth(newWidth)
  }, [isResizing, setSidebarWidth])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  if (!sidebarVisible) {
    return null
  }

  return (
    <aside
      ref={sidebarRef}
      className="sidebar"
      style={{ width: sidebarWidth }}
    >
      <div className="sidebar-header">
        <div className="sidebar-filter-toggle">
          <button
            className={`filter-btn ${showChangedOnly ? 'active' : ''}`}
            onClick={() => setShowChangedOnly(true)}
            title="Show changed files only"
            disabled={!hasChanges}
          >
            <FolderGit2 size={14} />
            <span>Changed</span>
            {changedCount > 0 && <span className="filter-badge">{changedCount}</span>}
          </button>
          <button
            className={`filter-btn ${!showChangedOnly ? 'active' : ''}`}
            onClick={() => setShowChangedOnly(false)}
            title="Show all files"
          >
            <Files size={14} />
            <span>All</span>
          </button>
        </div>
      </div>
      <div className="sidebar-content">
        {children}
      </div>
      <div
        className={`sidebar-resize-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </aside>
  )
}
