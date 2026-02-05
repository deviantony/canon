import { FileDiff, FileCode, MessageSquare } from 'lucide-react'
import { useAnnotations } from '../context/AnnotationContext'
import IconToggle from './IconToggle'
import StatusBadge from './StatusBadge'
import { formatShortcut } from '../utils/keyboard'
import type { ChangedFile } from '../../shared/types'
import styles from './EditorHeader.module.css'

interface EditorHeaderProps {
  filePath: string | null
  canShowDiff: boolean
  viewMode: 'code' | 'diff'
  onViewModeChange: (mode: 'code' | 'diff') => void
  isNewFile?: boolean
  fileStatus?: ChangedFile['status']
  additions?: number
  deletions?: number
  lineCount?: number
}

function getChangesButtonTitle(isNewFile: boolean, canShowDiff: boolean): string {
  if (isNewFile) return 'New file - no changes to compare'
  if (!canShowDiff) return 'No changes to show'
  return `View changes (${formatShortcut('Ctrl+Cmd+X')})`
}

export default function EditorHeader({
  filePath,
  canShowDiff,
  viewMode,
  onViewModeChange,
  isNewFile = false,
  fileStatus,
  additions,
  deletions,
  lineCount,
}: EditorHeaderProps) {
  const { getAnnotationsForFile } = useAnnotations()

  // Get annotation count for this file
  const annotationCount = filePath ? getAnnotationsForFile(filePath).length : 0

  // Only show diff stats for modified files with actual changes
  const showDiffStats = fileStatus === 'modified' && (additions !== undefined || deletions !== undefined)

  if (!filePath) {
    return null
  }

  return (
    <div className={styles.editorHeader}>
      <span className={styles.filePath}>{filePath}</span>
      <div className={styles.metadata}>
        {showDiffStats && (
          <span className={styles.diffStats}>
            {additions !== undefined && additions > 0 && (
              <span className={styles.additions}>+{additions}</span>
            )}
            {deletions !== undefined && deletions > 0 && (
              <span className={styles.deletions}>−{deletions}</span>
            )}
          </span>
        )}
        {lineCount !== undefined && lineCount > 0 && (
          <span className={styles.lineCount}>{lineCount} ln</span>
        )}
        <StatusBadge status={fileStatus} />
        {annotationCount > 0 && (
          <span
            className={styles.annotationCount}
            title={`${annotationCount} annotation${annotationCount === 1 ? '' : 's'}`}
          >
            <MessageSquare size={12} />
            <span>{annotationCount}</span>
          </span>
        )}
        <IconToggle
          value={viewMode}
          onChange={onViewModeChange}
          options={[
            {
              value: 'diff',
              icon: <FileDiff size={15} />,
              title: getChangesButtonTitle(isNewFile, canShowDiff),
              disabled: !canShowDiff || isNewFile,
            },
            {
              value: 'code',
              icon: <FileCode size={15} />,
              title: canShowDiff && !isNewFile ? `View source (${formatShortcut('Ctrl+Cmd+X')})` : 'View source',
            },
          ]}
        />
      </div>
    </div>
  )
}
