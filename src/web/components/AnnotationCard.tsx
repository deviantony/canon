import { useState, useRef, useEffect } from 'react'
import { FileText, Pencil, Trash2 } from 'lucide-react'
import { Annotation } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import { formatLineBadge } from '../utils/annotationUtils'
import { getModifierKey } from '../utils/keyboard'
import styles from './AnnotationCard.module.css'

interface AnnotationCardProps {
  annotation: Annotation
  onUpdate: (comment: string) => void
  onDelete: () => void
  onLineClick: (line: number) => void
}

export default function AnnotationCard({ annotation, onUpdate, onDelete, onLineClick }: AnnotationCardProps) {
  const { editingAnnotationId, setEditingAnnotationId, highlightedAnnotationId } = useLayout()
  const [editComment, setEditComment] = useState(annotation.comment)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEditing = editingAnnotationId === annotation.id
  const isHighlighted = highlightedAnnotationId === annotation.id
  const isFileLevel = annotation.lineStart === 0

  // Auto-resize textarea on content change
  useAutoResizeTextarea(textareaRef, isEditing ? editComment : '')

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [isEditing])

  function handleEdit() {
    setEditComment(annotation.comment)
    setEditingAnnotationId(annotation.id)
  }

  function handleSave() {
    if (editComment.trim()) {
      onUpdate(editComment.trim())
    } else {
      onDelete()
    }
    setEditingAnnotationId(null)
  }

  function handleCancel() {
    setEditComment(annotation.comment)
    setEditingAnnotationId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const cardClasses = [
    styles.card,
    isHighlighted ? styles.highlighted : '',
    isEditing ? styles.editing : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClasses}>
      <div className={styles.header}>
        <div
          className={styles.lineBadge}
          onClick={() => onLineClick(annotation.lineStart)}
          title={isFileLevel ? 'Scroll to top' : `Go to line ${annotation.lineStart}`}
        >
          {isFileLevel && <FileText size={12} style={{ marginRight: 4 }} />}
          {formatLineBadge(annotation.lineStart, annotation.lineEnd)}
        </div>
        {!isEditing && (
          <div className={styles.actions}>
            <button className={styles.action} onClick={handleEdit} title="Edit">
              <Pencil size={12} />
            </button>
            <button className={`${styles.action} ${styles.actionDelete}`} onClick={onDelete} title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className={styles.edit}>
          <textarea
            ref={textareaRef}
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your comment..."
          />
          <div className={styles.editFooter}>
            <span className={styles.hint}>{getModifierKey()}+Enter</span>
            <button className={styles.actionBtnDelete} onClick={onDelete} title="Delete">
              <Trash2 size={11} />
            </button>
            <button className={styles.actionBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button className={styles.actionBtnSave} onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.text}>
          {annotation.comment}
        </div>
      )}
    </div>
  )
}
