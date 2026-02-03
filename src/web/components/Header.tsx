import { useLayout } from '../context/LayoutContext'
import { useAnnotations } from '../context/AnnotationContext'
import { PanelLeft, ListChecks, Send } from 'lucide-react'

interface HeaderProps {
  onSubmit: () => void
  onCancel: () => void
}

export default function Header({
  onSubmit,
  onCancel,
}: HeaderProps) {
  const { sidebarVisible, toggleSidebar, setSummaryPopoverOpen } = useLayout()
  const { annotations } = useAnnotations()

  const canSubmit = annotations.length > 0

  function handleReviewAll() {
    setSummaryPopoverOpen(true)
  }

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={sidebarVisible ? 'Hide sidebar (⌃⌘S)' : 'Show sidebar (⌃⌘S)'}
        >
          <PanelLeft size={16} />
        </button>
        <h1>Canon</h1>
      </div>
      <div className="header-actions">
        <button
          className="btn review-all"
          onClick={handleReviewAll}
          disabled={!canSubmit}
          title="Review all annotations"
        >
          <ListChecks size={14} />
          <span>Review All</span>
          {canSubmit && <span className="badge">{annotations.length}</span>}
        </button>
        <button
          className="btn submit"
          onClick={onSubmit}
          disabled={!canSubmit}
          title={!canSubmit ? 'Add annotations to submit' : 'Submit review'}
        >
          <Send size={14} />
          <span>Submit</span>
        </button>
        <button className="btn cancel" onClick={onCancel} title="Cancel review">
          Cancel
        </button>
      </div>
    </header>
  )
}
