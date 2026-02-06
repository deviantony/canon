import { ListCheck, MessageSquareShare, PanelLeft } from 'lucide-react'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import baseStyles from '../styles/base.module.css'
import { formatShortcut } from '../utils/keyboard'
import CountBadge from './CountBadge'
import styles from './Header.module.css'
import KeyboardHint from './KeyboardHint'

interface HeaderProps {
  onSubmit: () => void
  onCancel: () => void
  onShowShortcuts: () => void
}

export default function Header({ onSubmit, onCancel, onShowShortcuts }: HeaderProps) {
  const { sidebarVisible, toggleSidebar, setSummaryPopoverOpen } = useLayout()
  const { annotations } = useAnnotations()

  const canSubmit = annotations.length > 0

  function handleReviewAll() {
    setSummaryPopoverOpen(true)
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={toggleSidebar}
          title={
            sidebarVisible
              ? `Hide sidebar (${formatShortcut('Ctrl+Cmd+S')})`
              : `Show sidebar (${formatShortcut('Ctrl+Cmd+S')})`
          }
        >
          <PanelLeft size={16} />
        </button>
        <span className={styles.logoWordmark}>Canon</span>
        <span className={styles.versionBadge}>v{__APP_VERSION__}</span>
        <KeyboardHint onClick={onShowShortcuts} />
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={baseStyles.btnReviewAll}
          onClick={handleReviewAll}
          disabled={!canSubmit}
          title="Review all annotations"
        >
          <ListCheck size={14} />
          <span>Review All</span>
          {canSubmit && <CountBadge count={annotations.length} variant="header" />}
        </button>
        <button
          type="button"
          className={baseStyles.btnSubmit}
          onClick={onSubmit}
          disabled={!canSubmit}
          title={
            !canSubmit
              ? 'Add annotations to submit'
              : `Submit review (${formatShortcut('Ctrl+Cmd+Enter')})`
          }
        >
          <MessageSquareShare size={14} />
          <span>Submit</span>
        </button>
        <button
          type="button"
          className={baseStyles.btnCancel}
          onClick={onCancel}
          title={`Cancel review (${formatShortcut('Ctrl+Cmd+Backspace')})`}
        >
          Cancel
        </button>
      </div>
    </header>
  )
}
