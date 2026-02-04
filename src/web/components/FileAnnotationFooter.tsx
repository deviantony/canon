import { useState, useRef, useEffect } from 'react'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { FileText, Pencil, Trash2 } from 'lucide-react'
import { formatShortcut, getModifierKey } from '../utils/keyboard'

interface FileAnnotationFooterProps {
  filePath: string
}

export default function FileAnnotationFooter({ filePath }: FileAnnotationFooterProps) {
  const { getFileAnnotation, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations()
  const { fileAnnotationExpanded, setFileAnnotationExpanded } = useLayout()
  const [comment, setComment] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fileAnnotation = getFileAnnotation(filePath)

  // Reset state when file changes
  useEffect(() => {
    setIsEditing(false)
    setComment('')
    setFileAnnotationExpanded(false)
  }, [filePath, setFileAnnotationExpanded])

  // Focus textarea when expanded or editing
  useEffect(() => {
    if ((fileAnnotationExpanded || isEditing) && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [fileAnnotationExpanded, isEditing])

  function handleInputFocus() {
    if (fileAnnotation) {
      setIsEditing(true)
      setComment(fileAnnotation.comment)
    } else {
      setFileAnnotationExpanded(true)
      setComment('')
    }
  }

  function handleSave() {
    if (comment.trim()) {
      if (fileAnnotation) {
        updateAnnotation(fileAnnotation.id, comment.trim())
      } else {
        // lineStart: 0 indicates file-level annotation
        addAnnotation(filePath, 0, comment.trim())
      }
    }
    setFileAnnotationExpanded(false)
    setIsEditing(false)
    setComment('')
  }

  function handleCancel() {
    setFileAnnotationExpanded(false)
    setIsEditing(false)
    setComment('')
  }

  function handleEdit() {
    if (fileAnnotation) {
      setIsEditing(true)
      setComment(fileAnnotation.comment)
    }
  }

  function handleDelete() {
    if (fileAnnotation) {
      removeAnnotation(fileAnnotation.id)
    }
    setFileAnnotationExpanded(false)
    setIsEditing(false)
    setComment('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // View mode: has existing annotation, not editing
  if (fileAnnotation && !isEditing) {
    return (
      <div className="file-annotation-footer has-content">
        <div className="file-annotation-bar">
          <div className="file-annotation-badge">
            <FileText size={12} />
            <span>File</span>
          </div>
          <div className="file-annotation-text">
            {fileAnnotation.comment}
          </div>
          <div className="file-annotation-actions">
            <button
              className="file-annotation-action"
              onClick={handleEdit}
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              className="file-annotation-action delete"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Editing mode
  if (fileAnnotationExpanded || isEditing) {
    return (
      <div className="file-annotation-footer editing">
        <div className="file-annotation-edit">
          <div className="file-annotation-badge">
            <FileText size={12} />
            <span>File</span>
          </div>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note about this file..."
            rows={2}
          />
          <div className="file-annotation-edit-actions">
            <span className="hint">{getModifierKey()}+Enter to save</span>
            <button className="btn-small cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-small save" onClick={handleSave} disabled={!comment.trim()}>
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state - just show clickable input
  return (
    <div className="file-annotation-footer empty">
      <div className="file-annotation-input-bar" onClick={handleInputFocus}>
        <FileText size={14} className="file-annotation-input-icon" />
        <span className="file-annotation-placeholder">Annotate this file... ({formatShortcut('Ctrl+Cmd+C')})</span>
      </div>
    </div>
  )
}
