import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { formatLineBadge, sortAnnotations } from '../utils/annotationUtils'
import { X, FileText, Pencil, Trash2, Send } from 'lucide-react'

interface AnnotationSummaryPopoverProps {
  onSubmit: () => void
  onNavigate: (file: string, line?: number) => void
}

// Delay before opening edit mode after navigation
const EDIT_MODE_DELAY_MS = 100

export default function AnnotationSummaryPopover({
  onSubmit,
  onNavigate,
}: AnnotationSummaryPopoverProps) {
  const { annotations, removeAnnotation, getAnnotationsGroupedByFile } = useAnnotations()
  const { summaryPopoverOpen, setSummaryPopoverOpen, setEditingAnnotationId } = useLayout()

  if (!summaryPopoverOpen) {
    return null
  }

  const byFile = getAnnotationsGroupedByFile()
  const sortedFiles = Array.from(byFile.keys()).sort()

  function handleClose() {
    setSummaryPopoverOpen(false)
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  function handleFileClick(file: string) {
    setSummaryPopoverOpen(false)
    onNavigate(file)
  }

  function handleAnnotationClick(annotation: Annotation) {
    setSummaryPopoverOpen(false)
    onNavigate(annotation.file, annotation.lineStart)
  }

  function handleEditClick(e: React.MouseEvent, annotation: { id: string; file: string; lineStart: number }) {
    e.stopPropagation()
    setSummaryPopoverOpen(false)
    onNavigate(annotation.file, annotation.lineStart)
    setTimeout(() => {
      setEditingAnnotationId(annotation.id)
    }, EDIT_MODE_DELAY_MS)
  }

  function handleDeleteClick(e: React.MouseEvent, annotationId: string) {
    e.stopPropagation()
    removeAnnotation(annotationId)
  }

  function handleSubmitClick() {
    setSummaryPopoverOpen(false)
    onSubmit()
  }

  return (
    <div className="summary-popover-overlay" onClick={handleOverlayClick}>
      <div className="summary-popover">
        <div className="summary-popover-header">
          <span className="summary-popover-title">
            Review All ({annotations.length})
          </span>
          <button className="summary-popover-close" onClick={handleClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="summary-popover-content">
          {annotations.length === 0 ? (
            <div className="summary-empty">
              <p>No annotations yet</p>
              <p style={{ marginTop: 'var(--space-2)', fontSize: '13px' }}>
                Click line numbers in the code to add annotations
              </p>
            </div>
          ) : (
            sortedFiles.map((file) => {
              const fileAnnotations = byFile.get(file) || []
              const sorted = sortAnnotations(fileAnnotations)

              return (
                <div key={file} className="summary-file-group">
                  <div
                    className="summary-file-name"
                    onClick={() => handleFileClick(file)}
                    title={`Go to ${file}`}
                  >
                    {file}
                  </div>
                  {sorted.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="summary-annotation"
                      onClick={() => handleAnnotationClick(annotation)}
                    >
                      <div className="annotation-line-badge">
                        {annotation.lineStart === 0 && <FileText size={10} style={{ marginRight: 4 }} />}
                        {formatLineBadge(annotation.lineStart, annotation.lineEnd)}
                      </div>
                      <div className="summary-annotation-text">
                        {annotation.comment}
                      </div>
                      <div className="summary-annotation-actions">
                        <button
                          className="summary-annotation-action"
                          onClick={(e) => handleEditClick(e, annotation)}
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="summary-annotation-action delete"
                          onClick={(e) => handleDeleteClick(e, annotation.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>

        <div className="summary-popover-footer">
          <button
            className="btn submit"
            onClick={handleSubmitClick}
            disabled={annotations.length === 0}
          >
            <Send size={14} />
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}
