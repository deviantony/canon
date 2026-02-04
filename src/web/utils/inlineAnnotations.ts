import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view'
import { StateField, StateEffect, EditorState } from '@codemirror/state'
import type { Annotation } from '../context/AnnotationContext'
import { formatLineBadge } from './annotationUtils'
import { getModifierKey } from './keyboard'

// Effects for managing annotations
export const setAnnotationsEffect = StateEffect.define<{
  annotations: Annotation[]
  filePath: string
}>()

export const setSelectedLinesEffect = StateEffect.define<{
  start: number
  end: number
} | null>()

// Callbacks interface for widget interactions
export interface AnnotationCallbacks {
  onSave: (lineStart: number, lineEnd: number | undefined, comment: string) => void
  onUpdate: (id: string, comment: string) => void
  onDelete: (id: string) => void
  onCancel: () => void
  onLineClick: (line: number) => void
}

let globalCallbacks: AnnotationCallbacks | null = null

export function setAnnotationCallbacks(callbacks: AnnotationCallbacks) {
  globalCallbacks = callbacks
}

// Widget for displaying an existing annotation
class AnnotationWidget extends WidgetType {
  constructor(
    readonly annotation: Annotation,
    readonly isHighlighted: boolean
  ) {
    super()
  }

  eq(other: AnnotationWidget) {
    return (
      other.annotation.id === this.annotation.id &&
      other.annotation.comment === this.annotation.comment &&
      other.isHighlighted === this.isHighlighted
    )
  }

  toDOM() {
    // Outer wrapper with padding - CodeMirror measures this for gutter alignment
    // Using padding instead of margin because margins aren't included in height calculations
    const outer = document.createElement('div')
    outer.className = 'inline-annotation-wrapper'

    const wrapper = document.createElement('div')
    wrapper.className = `inline-annotation ${this.isHighlighted ? 'highlighted' : ''}`

    const header = document.createElement('div')
    header.className = 'inline-annotation-header'

    const badge = document.createElement('span')
    badge.className = 'inline-annotation-badge'
    badge.textContent = formatLineBadge(this.annotation.lineStart, this.annotation.lineEnd)

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-actions'

    const editBtn = document.createElement('button')
    editBtn.className = 'inline-annotation-action'
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>'
    editBtn.title = 'Edit'
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.startEditing(wrapper)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'inline-annotation-action delete'
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>'
    deleteBtn.title = 'Delete'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      globalCallbacks?.onDelete(this.annotation.id)
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

  startEditing(inner: HTMLElement) {
    // Get the outer wrapper to replace when cancelling
    const outer = inner.parentElement!

    inner.innerHTML = ''
    inner.className = 'inline-annotation editing'

    const textarea = document.createElement('textarea')
    textarea.className = 'inline-annotation-textarea'
    textarea.value = this.annotation.comment
    textarea.placeholder = 'Edit your comment...'

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-edit-actions'

    const hint = document.createElement('span')
    hint.className = 'inline-annotation-hint'
    const kbd1 = document.createElement('kbd')
    kbd1.textContent = getModifierKey()
    const kbdPlus = document.createElement('span')
    kbdPlus.textContent = '+'
    kbdPlus.style.cssText = 'opacity: 0.5; margin: 0 2px;'
    const kbd2 = document.createElement('kbd')
    kbd2.textContent = 'Enter'
    hint.appendChild(kbd1)
    hint.appendChild(kbdPlus)
    hint.appendChild(kbd2)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'inline-annotation-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => {
      // Re-render the original widget (replaces outer wrapper)
      const newDom = this.toDOM()
      outer.replaceWith(newDom)
    })

    const saveBtn = document.createElement('button')
    saveBtn.className = 'inline-annotation-btn save'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => {
      const value = textarea.value.trim()
      if (value) {
        globalCallbacks?.onUpdate(this.annotation.id, value)
      }
    })

    actions.appendChild(hint)
    actions.appendChild(cancelBtn)
    actions.appendChild(saveBtn)

    inner.appendChild(textarea)
    inner.appendChild(actions)

    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    // Auto-resize
    const resize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
    textarea.addEventListener('input', resize)
    resize()

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const value = textarea.value.trim()
        if (value) {
          globalCallbacks?.onUpdate(this.annotation.id, value)
        }
      } else if (e.key === 'Escape') {
        const newDom = this.toDOM()
        outer.replaceWith(newDom)
      }
    })
  }

  ignoreEvent() {
    return false
  }
}

// Widget for creating a new annotation
class NewAnnotationWidget extends WidgetType {
  constructor(
    readonly lineStart: number,
    readonly lineEnd: number
  ) {
    super()
  }

  eq(other: NewAnnotationWidget) {
    return other.lineStart === this.lineStart && other.lineEnd === this.lineEnd
  }

  toDOM() {
    // Outer wrapper with padding - CodeMirror measures this for gutter alignment
    const outer = document.createElement('div')
    outer.className = 'inline-annotation-wrapper'

    const wrapper = document.createElement('div')
    wrapper.className = 'inline-annotation new'

    const badge = document.createElement('span')
    badge.className = 'inline-annotation-badge'
    badge.textContent = formatLineBadge(this.lineStart, this.lineEnd !== this.lineStart ? this.lineEnd : undefined)

    const textarea = document.createElement('textarea')
    textarea.className = 'inline-annotation-textarea'
    textarea.placeholder = 'Add your comment...'

    const actions = document.createElement('div')
    actions.className = 'inline-annotation-edit-actions'

    const hint = document.createElement('span')
    hint.className = 'inline-annotation-hint'
    const kbd1 = document.createElement('kbd')
    kbd1.textContent = getModifierKey()
    const kbdPlus = document.createElement('span')
    kbdPlus.textContent = '+'
    kbdPlus.style.cssText = 'opacity: 0.5; margin: 0 2px;'
    const kbd2 = document.createElement('kbd')
    kbd2.textContent = 'Enter'
    hint.appendChild(kbd1)
    hint.appendChild(kbdPlus)
    hint.appendChild(kbd2)

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'inline-annotation-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => {
      globalCallbacks?.onCancel()
    })

    const saveBtn = document.createElement('button')
    saveBtn.className = 'inline-annotation-btn save'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => {
      const value = textarea.value.trim()
      if (value) {
        const lineEnd = this.lineEnd !== this.lineStart ? this.lineEnd : undefined
        globalCallbacks?.onSave(this.lineStart, lineEnd, value)
      }
    })

    actions.appendChild(hint)
    actions.appendChild(cancelBtn)
    actions.appendChild(saveBtn)

    wrapper.appendChild(badge)
    wrapper.appendChild(textarea)
    wrapper.appendChild(actions)

    outer.appendChild(wrapper)

    // Focus after a tick to ensure it's in the DOM
    setTimeout(() => {
      textarea.focus()
    }, 0)

    // Auto-resize
    const resize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px'
    }
    textarea.addEventListener('input', resize)

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const value = textarea.value.trim()
        if (value) {
          const lineEnd = this.lineEnd !== this.lineStart ? this.lineEnd : undefined
          globalCallbacks?.onSave(this.lineStart, lineEnd, value)
        }
      } else if (e.key === 'Escape') {
        globalCallbacks?.onCancel()
      }
    })

    return outer
  }

  ignoreEvent() {
    return false
  }
}

// Build decorations from annotations and selected lines
function buildDecorations(
  state: EditorState,
  annotations: Annotation[],
  filePath: string,
  selectedLines: { start: number; end: number } | null
): DecorationSet {
  const decorations: Array<{ pos: number; decoration: Decoration }> = []

  // Filter to line-based annotations for this file (file-level shown in footer)
  const lineAnnotations = annotations
    .filter(a => a.file === filePath && a.lineStart > 0)
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

  return Decoration.set(
    decorations.map(d => d.decoration.range(d.pos))
  )
}

// State field to track annotations and selected lines
interface InlineAnnotationState {
  annotations: Annotation[]
  filePath: string
  selectedLines: { start: number; end: number } | null
}

export const inlineAnnotationField = StateField.define<InlineAnnotationState>({
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
      return buildDecorations(
        state,
        value.annotations,
        value.filePath,
        value.selectedLines
      )
    })
  },
})

// Helper to dispatch annotation updates to an editor view
export function updateInlineAnnotations(
  view: EditorView,
  annotations: Annotation[],
  filePath: string
) {
  view.dispatch({
    effects: setAnnotationsEffect.of({ annotations, filePath }),
  })
}

export function updateSelectedLines(
  view: EditorView,
  selectedLines: { start: number; end: number } | null
) {
  view.dispatch({
    effects: setSelectedLinesEffect.of(selectedLines),
  })
}

// Create the extension (just the StateField - block decorations must come from StateField)
export function inlineAnnotations() {
  return inlineAnnotationField
}
