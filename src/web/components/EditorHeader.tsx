import { FileDiff, FileCode, MessageSquare } from 'lucide-react'
import { useAnnotations } from '../context/AnnotationContext'
import IconToggle from './IconToggle'

interface EditorHeaderProps {
  filePath: string | null
  canShowDiff: boolean
  viewMode: 'code' | 'diff'
  onViewModeChange: (mode: 'code' | 'diff') => void
  isNewFile?: boolean
}

function getChangesButtonTitle(isNewFile: boolean, canShowDiff: boolean): string {
  if (isNewFile) return 'New file - no changes to compare'
  if (!canShowDiff) return 'No changes to show'
  return 'View changes (⌃⌘X)'
}

export default function EditorHeader({
  filePath,
  canShowDiff,
  viewMode,
  onViewModeChange,
  isNewFile = false,
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
            title: canShowDiff && !isNewFile ? 'View source (⌃⌘X)' : 'View source',
          },
        ]}
      />
    </div>
  )
}
