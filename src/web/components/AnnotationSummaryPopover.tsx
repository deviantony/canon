import { useAnnotations, type Annotation } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { formatLineBadge, sortAnnotations } from '../utils/annotationUtils'
import { X, FileText, Trash2, MessageSquareShare, Eraser } from 'lucide-react'
import styles from './AnnotationSummaryPopover.module.css'
import baseStyles from '../styles/base.module.css'

interface AnnotationSummaryPopoverProps {
  onSubmit: () => void
  onNavigate: (file: string, line?: number) => void
}

export default function AnnotationSummaryPopover({
  onSubmit,
  onNavigate,
}: AnnotationSummaryPopoverProps) {
  const { annotations, removeAnnotation, clearAllAnnotations, getAnnotationsGroupedByFile } = useAnnotations()
  const { summaryPopoverOpen, setSummaryPopoverOpen } = useLayout()

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

  function handleDeleteClick(e: React.MouseEvent, annotationId: string) {
    e.stopPropagation()
    removeAnnotation(annotationId)
  }

  function handleSubmitClick() {
    setSummaryPopoverOpen(false)
    onSubmit()
  }

  function handleClearAll() {
    clearAllAnnotations()
    setSummaryPopoverOpen(false)
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.popover}>
        <div className={styles.header}>
          <span className={styles.title}>
            Review All ({annotations.length})
          </span>
          <button className={styles.closeBtn} onClick={handleClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.content}>
          {annotations.length === 0 ? (
            <div className={styles.empty}>
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
                <div key={file} className={styles.fileGroup}>
                  <div
                    className={styles.fileName}
                    onClick={() => handleFileClick(file)}
                    title={`Go to ${file}`}
                  >
                    {file}
                  </div>
                  {sorted.map((annotation) => (
                    <div
                      key={annotation.id}
                      className={styles.annotation}
                      onClick={() => handleAnnotationClick(annotation)}
                    >
                      <div className={styles.lineBadge}>
                        {annotation.lineStart === 0 && <FileText size={10} style={{ marginRight: 4 }} />}
                        {formatLineBadge(annotation.lineStart, annotation.lineEnd)}
                      </div>
                      <div className={styles.annotationText}>
                        {annotation.comment}
                      </div>
                      <div className={styles.annotationActions}>
                        <button
                          className={`${baseStyles.actionIcon} ${baseStyles.actionIconDelete}`}
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

        <div className={styles.footer}>
          <button
            className={baseStyles.btnSecondary}
            onClick={handleClearAll}
            disabled={annotations.length === 0}
            title="Clear all annotations"
          >
            <Eraser size={14} />
            Clear All
          </button>
          <button
            className={baseStyles.btnSubmit}
            onClick={handleSubmitClick}
            disabled={annotations.length === 0}
          >
            <MessageSquareShare size={14} />
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}
