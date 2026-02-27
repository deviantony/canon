import { type EditorState, Facet, StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import type { AnnotationKind } from '../../shared/types'
import type { CodeAnnotation } from '../context/AnnotationContext'
import { formatLineBadge } from './annotationUtils'
import { getModifierKey } from './keyboard'

// Effects for managing annotations
const setAnnotationsEffect = StateEffect.define<{
  annotations: CodeAnnotation[]
  filePath: string
}>()

const setSelectedLinesEffect = StateEffect.define<{
  start: number
  end: number
} | null>()

// Callbacks interface for widget interactions
export interface AnnotationCallbacks {
  onSave: (
    lineStart: number,
    lineEnd: number | undefined,
    comment: string,
    kind: AnnotationKind,
  ) => void
  onUpdate: (id: string, comment: string) => void
  onUpdateKind: (id: string, kind: AnnotationKind) => void
  onDelete: (id: string) => void
  onCancel: () => void
  onLineClick: (line: number) => void
}

// Facet to provide callbacks to widgets via EditorState (avoids global mutable state)
export const annotationCallbacksFacet = Facet.define<
  AnnotationCallbacks | null,
  AnnotationCallbacks | null
>({
  combine: (values) => values.find((v) => v != null) ?? null,
})

// --- Shared helpers ---

function createKeyboardHint(): HTMLSpanElement {
  const hint = document.createElement('span')
  hint.className = 'inline-annotation-hint'
  const kbd1 = document.createElement('kbd')
  kbd1.textContent = getModifierKey()
  const kbdPlus = document.createElement('span')
  kbdPlus.textContent = '+'
  kbdPlus.className = 'inline-annotation-hint-separator'
  const kbd2 = document.createElement('kbd')
  kbd2.textContent = 'Enter'
  hint.appendChild(kbd1)
  hint.appendChild(kbdPlus)
  hint.appendChild(kbd2)
  return hint
}

function setupTextareaAutoResize(textarea: HTMLTextAreaElement, minHeight?: number) {
  const resize = () => {
    textarea.style.height = 'auto'
    const height = minHeight ? Math.max(minHeight, textarea.scrollHeight) : textarea.scrollHeight
    textarea.style.height = `${height}px`
  }
  textarea.addEventListener('input', resize)
  resize()
}

// SVG paths for kind icons
const WRENCH_SVG =
  '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
const QUESTION_SVG =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'

function toggleKind(kind: AnnotationKind): AnnotationKind {
  return kind === 'action' ? 'question' : 'action'
}

function createMorphingBadge(
  kind: AnnotationKind,
  lineText: string,
  onToggle: () => void,
): HTMLSpanElement {
  const badge = document.createElement('span')
  badge.className = 'inline-annotation-badge'

  const icon = document.createElement('span')
  icon.className = 'inline-annotation-badge-icon'
  icon.innerHTML = kind === 'action' ? WRENCH_SVG : QUESTION_SVG

  const text = document.createElement('span')
  text.textContent = lineText

  const label = document.createElement('span')
  label.className = 'inline-annotation-badge-label'
  label.textContent = kind === 'action' ? 'action' : 'question'

  badge.appendChild(icon)
  badge.appendChild(text)
  badge.appendChild(label)

  badge.addEventListener('click', (e) => {
    e.stopPropagation()
    onToggle()
  })

  return badge
}

function updateMorphingBadge(badge: HTMLSpanElement, kind: AnnotationKind): void {
  const icon = badge.querySelector('.inline-annotation-badge-icon')
  if (icon) icon.innerHTML = kind === 'action' ? WRENCH_SVG : QUESTION_SVG
  const label = badge.querySelector('.inline-annotation-badge-label')
  if (label) label.textContent = kind === 'action' ? 'action' : 'question'
}

// Widget for displaying an existing annotation
class AnnotationWidget extends WidgetType {
  constructor(
    readonly annotation: CodeAnnotation,
    readonly isHighlighted: boolean,
  ) {
    super()
  }

  eq(other: AnnotationWidget) {
    return (
      other.annotation.id === this.annotation.id &&
      other.annotation.comment === this.annotation.comment &&
      other.annotation.kind === this.annotation.kind &&
      other.isHighlighted === this.isHighlighted
    )
  }

  toDOM(view: EditorView) {
    // Outer wrapper with padding - CodeMirror measures this for gutter alignment
    // Using padding instead of margin because margins aren't included in height calculations
    const outer = document.createElement('div')
    outer.className = 'inline-annotation-wrapper'

    const wrapper = document.createElement('div')
    const isQuestion = this.annotation.kind === 'question'
    wrapper.className = `inline-annotation ${this.isHighlighted ? 'highlighted' : ''} ${isQuestion ? 'question-mode' : ''}`

    const header = document.createElement('div')
    header.className = 'inline-annotation-header'

    const lineText = formatLineBadge(this.annotation.lineStart, this.annotation.lineEnd)
    const badge = createMorphingBadge(this.annotation.kind, lineText, () => {
      const newKind = toggleKind(this.annotation.kind)
      view.state.facet(annotationCallbacksFacet)?.onUpdateKind(this.annotation.id, newKind)
    })

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-actions'

    const editBtn = document.createElement('button')
    editBtn.className = 'inline-annotation-action'
    editBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>'
    editBtn.title = 'Edit'
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.startEditing(wrapper, view)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'inline-annotation-action delete'
    deleteBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>'
    deleteBtn.title = 'Delete'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      view.state.facet(annotationCallbacksFacet)?.onDelete(this.annotation.id)
    })

    actions.appendChild(editBtn)
    actions.appendChild(deleteBtn)

    header.appendChild(badge)
    header.appendChild(actions)

    const content = document.createElement('div')
    content.className = 'inline-annotation-content'
    content.textContent = this.annotation.comment

    wrapper.appendChild(header)
    wrapper.appendChild(content)

    outer.appendChild(wrapper)
    return outer
  }

  startEditing(inner: HTMLElement, view: EditorView) {
    // Get the outer wrapper to replace when cancelling
    const outer = inner.parentElement
    if (!outer) return

    const cancelEdit = () => {
      const newDom = this.toDOM(view)
      outer.replaceWith(newDom)
    }

    inner.innerHTML = ''
    const isQuestion = this.annotation.kind === 'question'
    inner.className = `inline-annotation editing ${isQuestion ? 'question-mode' : ''}`

    const textarea = document.createElement('textarea')
    textarea.className = 'inline-annotation-textarea'
    textarea.value = this.annotation.comment
    textarea.placeholder = 'Edit your comment...'

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-edit-actions'

    const hint = createKeyboardHint()

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'inline-annotation-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', cancelEdit)

    const saveBtn = document.createElement('button')
    saveBtn.className = 'inline-annotation-btn save'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => {
      const value = textarea.value.trim()
      if (value) {
        view.state.facet(annotationCallbacksFacet)?.onUpdate(this.annotation.id, value)
      }
    })

    actions.appendChild(hint)
    actions.appendChild(cancelBtn)
    actions.appendChild(saveBtn)

    inner.appendChild(textarea)
    inner.appendChild(actions)

    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    setupTextareaAutoResize(textarea)

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const value = textarea.value.trim()
        if (value) {
          view.state.facet(annotationCallbacksFacet)?.onUpdate(this.annotation.id, value)
        }
      } else if (e.key === 'Escape') {
        cancelEdit()
      }
    })
  }

  ignoreEvent() {
    return true
  }
}

// Widget for creating a new annotation
class NewAnnotationWidget extends WidgetType {
  private kind: AnnotationKind = 'action'

  constructor(
    readonly lineStart: number,
    readonly lineEnd: number,
  ) {
    super()
  }

  eq(other: NewAnnotationWidget) {
    return other.lineStart === this.lineStart && other.lineEnd === this.lineEnd
  }

  toDOM(view: EditorView) {
    // Outer wrapper with padding - CodeMirror measures this for gutter alignment
    const outer = document.createElement('div')
    outer.className = 'inline-annotation-wrapper'

    const wrapper = document.createElement('div')
    wrapper.className = 'inline-annotation new'

    const lineText = formatLineBadge(
      this.lineStart,
      this.lineEnd !== this.lineStart ? this.lineEnd : undefined,
    )

    const badge = createMorphingBadge(this.kind, lineText, () => {
      this.kind = toggleKind(this.kind)
      updateMorphingBadge(badge, this.kind)
      wrapper.classList.toggle('question-mode', this.kind === 'question')
    })

    const textarea = document.createElement('textarea')
    textarea.className = 'inline-annotation-textarea'
    textarea.placeholder = 'Add your comment...'

    const doSave = () => {
      const value = textarea.value.trim()
      if (value) {
        const lineEnd = this.lineEnd !== this.lineStart ? this.lineEnd : undefined
        view.state
          .facet(annotationCallbacksFacet)
          ?.onSave(this.lineStart, lineEnd, value, this.kind)
      }
    }

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-edit-actions'

    const hint = createKeyboardHint()

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'inline-annotation-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => {
      view.state.facet(annotationCallbacksFacet)?.onCancel()
    })

    const saveBtn = document.createElement('button')
    saveBtn.className = 'inline-annotation-btn save'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', doSave)

    actions.appendChild(hint)
    actions.appendChild(cancelBtn)
    actions.appendChild(saveBtn)

    wrapper.appendChild(badge)
    wrapper.appendChild(textarea)
    wrapper.appendChild(actions)

    outer.appendChild(wrapper)

    // Focus after a tick — unlike edit mode (where the textarea replaces existing DOM),
    // new annotation widgets are inserted by CodeMirror and need a frame to mount
    setTimeout(() => {
      textarea.focus()
    }, 0)

    setupTextareaAutoResize(textarea, 60)

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        doSave()
      } else if (e.key === 'Escape') {
        view.state.facet(annotationCallbacksFacet)?.onCancel()
      } else if (e.key === 'q' && textarea.value === '' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        this.kind = toggleKind(this.kind)
        updateMorphingBadge(badge, this.kind)
        wrapper.classList.toggle('question-mode', this.kind === 'question')
      }
    })

    return outer
  }

  ignoreEvent() {
    return true
  }
}

// Build decorations from annotations and selected lines
function buildDecorations(
  state: EditorState,
  annotations: CodeAnnotation[],
  filePath: string,
  selectedLines: { start: number; end: number } | null,
): DecorationSet {
  const decorations: Array<{ pos: number; decoration: Decoration }> = []

  // Filter to line-based annotations for this file (file-level shown in footer)
  const lineAnnotations = annotations
    .filter((a) => a.file === filePath && a.lineStart > 0)
    .sort((a, b) => a.lineStart - b.lineStart)

  for (const annotation of lineAnnotations) {
    // Position at the end of the annotated line (or range end)
    const targetLine = annotation.lineEnd || annotation.lineStart
    if (targetLine > state.doc.lines) continue

    const line = state.doc.line(targetLine)
    const widget = new AnnotationWidget(annotation, false)

    decorations.push({
      pos: line.to,
      decoration: Decoration.widget({
        widget,
        block: true,
        side: 1,
      }),
    })
  }

  // Add new annotation widget if lines are selected
  if (selectedLines && selectedLines.start > 0) {
    const targetLine = selectedLines.end
    if (targetLine <= state.doc.lines) {
      const line = state.doc.line(targetLine)
      const widget = new NewAnnotationWidget(selectedLines.start, selectedLines.end)

      decorations.push({
        pos: line.to,
        decoration: Decoration.widget({
          widget,
          block: true,
          side: 1,
        }),
      })
    }
  }

  // Sort by position and create RangeSet
  decorations.sort((a, b) => a.pos - b.pos)

  return Decoration.set(decorations.map((d) => d.decoration.range(d.pos)))
}

// State field to track annotations and selected lines
interface InlineAnnotationState {
  annotations: CodeAnnotation[]
  filePath: string
  selectedLines: { start: number; end: number } | null
}

const inlineAnnotationField = StateField.define<InlineAnnotationState>({
  create() {
    return {
      annotations: [],
      filePath: '',
      selectedLines: null,
    }
  },

  update(value, tr) {
    let newValue = value

    for (const effect of tr.effects) {
      if (effect.is(setAnnotationsEffect)) {
        newValue = {
          ...newValue,
          annotations: effect.value.annotations,
          filePath: effect.value.filePath,
        }
      } else if (effect.is(setSelectedLinesEffect)) {
        newValue = {
          ...newValue,
          selectedLines: effect.value,
        }
      }
    }

    return newValue
  },

  // Block decorations MUST be provided directly through StateField, not ViewPlugin
  provide(field) {
    return EditorView.decorations.compute([field], (state) => {
      const value = state.field(field)
      return buildDecorations(state, value.annotations, value.filePath, value.selectedLines)
    })
  },
})

// Helper to dispatch annotation updates to an editor view
export function updateInlineAnnotations(
  view: EditorView,
  annotations: CodeAnnotation[],
  filePath: string,
) {
  view.dispatch({
    effects: setAnnotationsEffect.of({ annotations, filePath }),
  })
}

export function updateSelectedLines(
  view: EditorView,
  selectedLines: { start: number; end: number } | null,
) {
  view.dispatch({
    effects: setSelectedLinesEffect.of(selectedLines),
  })
}

// Create the extension (just the StateField - block decorations must come from StateField)
export function inlineAnnotations() {
  return inlineAnnotationField
}
