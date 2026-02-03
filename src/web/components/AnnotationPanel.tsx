import { useState, useRef, useEffect } from 'react'
import { useAnnotations, Annotation } from '../context/AnnotationContext'

interface AnnotationPanelProps {
  filePath: string
  onLineClick?: (line: number) => void
}

export default function AnnotationPanel({ filePath, onLineClick }: AnnotationPanelProps) {
  const { getAnnotationsForFile, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations()
  const annotations = getAnnotationsForFile(filePath)

  const [addingAtLine, setAddingAtLine] = useState<number | null>(null)
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editComment, setEditComment] = useState('')

  const addInputRef = useRef<HTMLTextAreaElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (addingAtLine !== null && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [addingAtLine])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  function handleAddStart(line: number) {
    setAddingAtLine(line)
    setNewComment('')
    setEditingId(null)
  }

  function handleAddSave() {
    if (newComment.trim() && addingAtLine !== null) {
      addAnnotation(filePath, addingAtLine, newComment.trim())
    }
    setAddingAtLine(null)
    setNewComment('')
  }

  function handleEditStart(annotation: Annotation) {
    setEditingId(annotation.id)
    setEditComment(annotation.comment)
    setAddingAtLine(null)
  }

  function handleEditSave() {
    if (editingId) {
      if (editComment.trim()) {
        updateAnnotation(editingId, editComment.trim())
      } else {
        removeAnnotation(editingId)
      }
    }
    setEditingId(null)
    setEditComment('')
  }

  function handleKeyDown(e: React.KeyboardEvent, onSave: () => void, onCancel: () => void) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  // Sort annotations by line
  const sortedAnnotations = [...annotations].sort((a, b) => a.lineStart - b.lineStart)

  return (
    <div className="annotation-panel">
      <div className="annotation-panel-header">
        <span>Annotations</span>
        <button
          className="add-annotation-global"
          onClick={() => handleAddStart(1)}
          title="Add annotation"
        >
          +
        </button>
      </div>

      <div className="annotation-list">
        {sortedAnnotations.length === 0 && addingAtLine === null && (
          <div className="annotation-empty">
            <p>No annotations yet</p>
            <p className="hint">Click a line number in the code to add one</p>
          </div>
        )}

        {sortedAnnotations.map((annotation) => (
          <div key={annotation.id} className="annotation-item">
            {editingId === annotation.id ? (
              <div className="annotation-edit">
                <div className="annotation-line-badge">L{annotation.lineStart}</div>
                <textarea
                  ref={editInputRef}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(
                      e,
                      handleEditSave,
                      () => setEditingId(null)
                    )
                  }
                  rows={3}
                />
                <div className="annotation-actions">
                  <span className="hint">⌘+Enter to save</span>
                  <button className="btn-small delete" onClick={() => removeAnnotation(annotation.id)}>
                    Delete
                  </button>
                  <button className="btn-small cancel" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="btn-small save" onClick={handleEditSave}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="annotation-view" onClick={() => handleEditStart(annotation)}>
                <div
                  className="annotation-line-badge clickable"
                  onClick={(e) => {
                    e.stopPropagation()
                    onLineClick?.(annotation.lineStart)
                  }}
                  title="Go to line"
                >
                  L{annotation.lineStart}
                </div>
                <div className="annotation-content">{annotation.comment}</div>
              </div>
            )}
          </div>
        ))}

        {addingAtLine !== null && (
          <div className="annotation-item adding">
            <div className="annotation-edit">
              <div className="annotation-line-input">
                <span>Line:</span>
                <input
                  type="number"
                  min="1"
                  value={addingAtLine}
                  onChange={(e) => setAddingAtLine(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <textarea
                ref={addInputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    handleAddSave,
                    () => setAddingAtLine(null)
                  )
                }
                placeholder="Add your comment..."
                rows={3}
              />
              <div className="annotation-actions">
                <span className="hint">⌘+Enter to save</span>
                <button className="btn-small cancel" onClick={() => setAddingAtLine(null)}>
                  Cancel
                </button>
                <button
                  className="btn-small save"
                  onClick={handleAddSave}
                  disabled={!newComment.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
