import { FileDiff, FileCode, MessageSquare } from 'lucide-react'
import { useAnnotations } from '../context/AnnotationContext'
import IconToggle from './IconToggle'
import StatusBadge from './StatusBadge'
import { formatShortcut } from '../utils/keyboard'
import type { ChangedFile } from '../../shared/types'

interface EditorHeaderProps {
  filePath: string | null
  canShowDiff: boolean
  viewMode: 'code' | 'diff'
  onViewModeChange: (mode: 'code' | 'diff') => void
  isNewFile?: boolean
  fileStatus?: ChangedFile['status']
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
}: EditorHeaderProps) {
  const { getAnnotationsForFile } = useAnnotations()

  // Get annotation count for this file
  const annotationCount = filePath ? getAnnotationsForFile(filePath).length : 0

  if (!filePath) {
    return null
  }

  return (
    <div className="editor-header">
      <div className="file-info">
        <span className="file-path">{filePath}</span>
        <StatusBadge status={fileStatus} />
        {annotationCount > 0 && (
          <span
            className="file-annotation-count"
            title={`${annotationCount} annotation${annotationCount === 1 ? '' : 's'}`}
          >
            <MessageSquare size={12} />
            <span>{annotationCount}</span>
          </span>
        )}
      </div>
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
  )
}
