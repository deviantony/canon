import { GitCompareArrows, FileCode, MessageSquare } from 'lucide-react'
import { useAnnotations } from '../context/AnnotationContext'

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
  return 'View changes'
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
  const fileAnnotations = filePath ? getAnnotationsForFile(filePath) : []
  const annotationCount = fileAnnotations.length

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
      <div className="view-mode-toggle">
        <button
          className={`view-mode-btn ${viewMode === 'diff' ? 'active' : ''}`}
          onClick={() => onViewModeChange('diff')}
          disabled={!canShowDiff || isNewFile}
          title={getChangesButtonTitle(isNewFile, canShowDiff)}
        >
          <GitCompareArrows size={14} />
          <span>Changes</span>
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'code' ? 'active' : ''}`}
          onClick={() => onViewModeChange('code')}
          title="View source"
        >
          <FileCode size={14} />
          <span>Source</span>
        </button>
      </div>
    </div>
  )
}
