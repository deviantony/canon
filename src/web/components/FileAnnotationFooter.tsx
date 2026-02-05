import { useState, useRef, useEffect } from 'react'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import { FileText, Pencil, Trash2 } from 'lucide-react'
import { formatShortcut, getModifierKey } from '../utils/keyboard'
import styles from './FileAnnotationFooter.module.css'
import baseStyles from '../styles/base.module.css'

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [comment])

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
      <div className={styles.hasContent}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.badge}>
              <FileText size={10} />
              <span>File</span>
            </div>
            <div className={styles.actions}>
              <button
                className={baseStyles.actionIcon}
                onClick={handleEdit}
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                className={`${baseStyles.actionIcon} ${baseStyles.actionIconDelete}`}
                onClick={handleDelete}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className={baseStyles.cardText}>
            {fileAnnotation.comment}
          </div>
        </div>
      </div>
    )
  }

  // Editing mode
  if (fileAnnotationExpanded || isEditing) {
    return (
      <div className={styles.editing}>
        <div className={styles.editCard}>
          <div className={styles.badge}>
            <FileText size={10} />
            <span>File</span>
          </div>
          <textarea
            ref={textareaRef}
            className={baseStyles.cardTextarea}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note about this file..."
          />
          <div className={styles.editActions}>
            <span className={styles.hint}>
              <kbd>{getModifierKey()}</kbd>
              <span style={{ opacity: 0.5 }}>+</span>
              <kbd>Enter</kbd>
            </span>
            <button className={baseStyles.textBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button
              className={baseStyles.textBtnSave}
              onClick={handleSave}
              disabled={!comment.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state - clickable card placeholder
  return (
    <div className={styles.empty}>
      <div className={styles.inputBar} onClick={handleInputFocus}>
        <FileText size={14} className={styles.inputIcon} />
        <span className={styles.placeholder}>
          Annotate this file... ({formatShortcut('Ctrl+Cmd+C')})
        </span>
      </div>
    </div>
  )
}
