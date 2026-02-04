import { useState, useRef, useEffect } from 'react'
import { FileText, Pencil, Trash2 } from 'lucide-react'
import { Annotation } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import { formatLineBadge } from '../utils/annotationUtils'

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

  return (
    <div className={`annotation-card ${isHighlighted ? 'highlighted' : ''} ${isEditing ? 'editing' : ''}`}>
      <div className="annotation-card-header">
        <div
          className="annotation-line-badge clickable"
          onClick={() => onLineClick(annotation.lineStart)}
          title={isFileLevel ? 'Scroll to top' : `Go to line ${annotation.lineStart}`}
        >
          {isFileLevel && <FileText size={12} style={{ marginRight: 4 }} />}
          {formatLineBadge(annotation.lineStart, annotation.lineEnd)}
        </div>
        {!isEditing && (
          <div className="annotation-card-actions">
            <button className="annotation-card-action" onClick={handleEdit} title="Edit">
              <Pencil size={12} />
            </button>
            <button className="annotation-card-action delete" onClick={onDelete} title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="annotation-card-edit">
          <textarea
            ref={textareaRef}
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your comment..."
          />
          <div className="annotation-card-edit-footer">
            <span className="hint">⌘+Enter</span>
            <button className="annotation-action-btn delete" onClick={onDelete} title="Delete">
              <Trash2 size={11} />
            </button>
            <button className="annotation-action-btn" onClick={handleCancel}>
              Cancel
            </button>
            <button className="annotation-action-btn save" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="annotation-card-text">
          {annotation.comment}
        </div>
      )}
    </div>
  )
}

interface NewAnnotationCardProps {
  lineStart: number
  lineEnd: number
  onSave: (comment: string) => void
  onCancel: () => void
  style?: React.CSSProperties
}

export function NewAnnotationCard({ lineStart, lineEnd, onSave, onCancel, style }: NewAnnotationCardProps) {
  const [comment, setComment] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useAutoResizeTextarea(textareaRef, comment, 48)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleSave() {
    if (comment.trim()) {
      onSave(comment.trim())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const hasContent = comment.trim().length > 0

  return (
    <div className={`new-annotation-whisper ${isFocused ? 'focused' : ''}`} style={style}>
      <div className="new-annotation-whisper__accent" />

      <div className="new-annotation-whisper__body">
        <div className="new-annotation-whisper__line-marker">
          {formatLineBadge(lineStart, lineEnd)}
        </div>

        <textarea
          ref={textareaRef}
          className="new-annotation-whisper__input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Add your thoughts..."
          spellCheck={false}
        />

        <div className={`new-annotation-whisper__actions ${hasContent ? 'visible' : ''}`}>
          <div className="new-annotation-whisper__hint">
            <kbd>⌘</kbd>
            <span>+</span>
            <kbd>Enter</kbd>
          </div>
          <button
            className="new-annotation-whisper__btn new-annotation-whisper__btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="new-annotation-whisper__btn new-annotation-whisper__btn--primary"
            onClick={handleSave}
            disabled={!hasContent}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
