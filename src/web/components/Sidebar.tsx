import { ReactNode, useRef, useCallback, useEffect, useState } from 'react'
import { useLayout } from '../context/LayoutContext'
import { Diff, FolderTree } from 'lucide-react'
import IconToggle from './IconToggle'
import { formatShortcut } from '../utils/keyboard'

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
    if (!isResizing) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

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
        <IconToggle
          value={showChangedOnly ? 'changed' : 'all'}
          onChange={(v) => setShowChangedOnly(v === 'changed')}
          options={[
            {
              value: 'changed',
              icon: <Diff size={15} />,
              title: `Changed files (${formatShortcut('Ctrl+Cmd+Z')})`,
              disabled: !hasChanges,
              badge: changedCount,
            },
            {
              value: 'all',
              icon: <FolderTree size={15} />,
              title: `All files (${formatShortcut('Ctrl+Cmd+Z')})`,
            },
          ]}
        />
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
