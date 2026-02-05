import { useLayout } from '../context/LayoutContext'
import { useAnnotations } from '../context/AnnotationContext'
import { PanelLeft, ListCheck, MessageSquareShare } from 'lucide-react'
import CountBadge from './CountBadge'
import KeyboardHint from './KeyboardHint'
import { formatShortcut } from '../utils/keyboard'
import styles from './Header.module.css'
import baseStyles from '../styles/base.module.css'

interface HeaderProps {
  onSubmit: () => void
  onCancel: () => void
  onShowShortcuts: () => void
}

export default function Header({
  onSubmit,
  onCancel,
  onShowShortcuts,
}: HeaderProps) {
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
          className={styles.sidebarToggle}
          onClick={toggleSidebar}
          title={sidebarVisible ? `Hide sidebar (${formatShortcut('Ctrl+Cmd+S')})` : `Show sidebar (${formatShortcut('Ctrl+Cmd+S')})`}
        >
          <PanelLeft size={16} />
        </button>
        <span className={styles.logoWordmark}>Canon</span>
        <span className={styles.versionBadge}>v{__APP_VERSION__}</span>
        <KeyboardHint onClick={onShowShortcuts} />
      </div>
      <div className={styles.headerActions}>
        <button
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
          className={baseStyles.btnSubmit}
          onClick={onSubmit}
          disabled={!canSubmit}
          title={!canSubmit ? 'Add annotations to submit' : `Submit review (${formatShortcut('Ctrl+Cmd+Enter')})`}
        >
          <MessageSquareShare size={14} />
          <span>Submit</span>
        </button>
        <button className={baseStyles.btnCancel} onClick={onCancel} title={`Cancel review (${formatShortcut('Ctrl+Cmd+Backspace')})`}>
          Cancel
        </button>
      </div>
    </header>
  )
}
