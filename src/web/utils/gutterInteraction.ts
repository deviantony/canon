import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, gutter, GutterMarker } from '@codemirror/view'
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'

// Effects for line selection
export const setLineSelection = StateEffect.define<{ start: number; end: number } | null>()
export const setAnnotatedLines = StateEffect.define<Set<number>>()

// State field to track current line selection
export const lineSelectionField = StateField.define<{ start: number; end: number } | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLineSelection)) {
        return effect.value
      }
    }
    return value
  },
})

// State field to track annotated lines
export const annotatedLinesField = StateField.define<Set<number>>({
  create() {
    return new Set()
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setAnnotatedLines)) {
        return effect.value
      }
    }
    return value
  },
})

// Decoration for selected lines
const selectedLineDecoration = Decoration.line({ class: 'cm-selectedAnnotationLine' })

// Plugin to apply selection highlight decorations
const selectionHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.state.field(lineSelectionField) !== update.startState.field(lineSelectionField)) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const selection = view.state.field(lineSelectionField)
      if (!selection) {
        return Decoration.none
      }

      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const startLine = Math.max(1, Math.min(selection.start, selection.end))
      const endLine = Math.min(doc.lines, Math.max(selection.start, selection.end))

      for (let line = startLine; line <= endLine; line++) {
        const lineInfo = doc.line(line)
        builder.add(lineInfo.from, lineInfo.from, selectedLineDecoration)
      }

      return builder.finish()
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// Gold bar marker for annotated lines
class AnnotationMarker extends GutterMarker {
  toDOM() {
    const marker = document.createElement('div')
    marker.className = 'cm-annotation-indicator'
    marker.style.height = '100%'
    return marker
  }
}

const annotationMarker = new AnnotationMarker()

// Gutter for annotation indicators
const annotationGutter = gutter({
  class: 'cm-annotation-gutter',
  lineMarker(view, line) {
    const lineNumber = view.state.doc.lineAt(line.from).number
    const annotatedLines = view.state.field(annotatedLinesField)
    if (annotatedLines.has(lineNumber)) {
      return annotationMarker
    }
    return null
  },
  initialSpacer: () => annotationMarker,
})

// Gutter interaction plugin for click/drag selection
interface GutterInteractionConfig {
  onSelectionComplete: (start: number, end: number) => void
  onIndicatorClick: (line: number) => void
}

function createGutterInteractionPlugin(config: GutterInteractionConfig) {
  return ViewPlugin.fromClass(
    class {
      private isDragging = false
      private startLine: number | null = null
      private view: EditorView

      constructor(view: EditorView) {
        this.view = view
        this.handleMouseDown = this.handleMouseDown.bind(this)
        this.handleMouseMove = this.handleMouseMove.bind(this)
        this.handleMouseUp = this.handleMouseUp.bind(this)

        // Attach listeners to the editor DOM
        view.dom.addEventListener('mousedown', this.handleMouseDown)
        window.addEventListener('mousemove', this.handleMouseMove)
        window.addEventListener('mouseup', this.handleMouseUp)
      }

      destroy() {
        this.view.dom.removeEventListener('mousedown', this.handleMouseDown)
        window.removeEventListener('mousemove', this.handleMouseMove)
        window.removeEventListener('mouseup', this.handleMouseUp)
      }

      private getLineFromEvent(e: MouseEvent): number | null {
        const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY })
        if (pos === null) return null
        return this.view.state.doc.lineAt(pos).number
      }

      private isGutterClick(e: MouseEvent): boolean {
        const target = e.target as HTMLElement
        // Check if click is on line numbers or gutter
        return !!(
          target.closest('.cm-lineNumbers') ||
          target.closest('.cm-gutterElement') ||
          target.closest('.cm-gutters')
        )
      }

      private isAnnotationIndicatorClick(e: MouseEvent): boolean {
        const target = e.target as HTMLElement
        return !!(target.closest('.cm-annotation-indicator') || target.closest('.cm-annotation-gutter'))
      }

      private handleMouseDown(e: MouseEvent) {
        // Check for annotation indicator click first
        if (this.isAnnotationIndicatorClick(e)) {
          const line = this.getLineFromEvent(e)
          if (line !== null) {
            const annotatedLines = this.view.state.field(annotatedLinesField)
            if (annotatedLines.has(line)) {
              e.preventDefault()
              config.onIndicatorClick(line)
              return
            }
          }
        }

        // Check if click is on gutter
        if (!this.isGutterClick(e)) return

        const line = this.getLineFromEvent(e)
        if (line === null) return

        e.preventDefault()
        this.isDragging = true
        this.startLine = line
        this.view.dom.classList.add('cm-line-selecting')

        // Set initial selection
        this.view.dispatch({
          effects: setLineSelection.of({ start: line, end: line }),
        })
      }

      private handleMouseMove(e: MouseEvent) {
        if (!this.isDragging || this.startLine === null) return

        const line = this.getLineFromEvent(e)
        if (line === null) return

        // Update selection
        this.view.dispatch({
          effects: setLineSelection.of({ start: this.startLine, end: line }),
        })
      }

      private handleMouseUp(e: MouseEvent) {
        if (!this.isDragging || this.startLine === null) {
          this.isDragging = false
          this.startLine = null
          return
        }

        this.view.dom.classList.remove('cm-line-selecting')

        const endLine = this.getLineFromEvent(e)
        const start = this.startLine
        const end = endLine !== null ? endLine : this.startLine

        this.isDragging = false
        this.startLine = null

        // Normalize the range
        const lineStart = Math.min(start, end)
        const lineEnd = Math.max(start, end)

        // Call the callback with the selection
        config.onSelectionComplete(lineStart, lineEnd)
      }

      update() {
        // No-op for now
      }
    }
  )
}

// Main export function to create all gutter interaction extensions
export function gutterInteraction(config: GutterInteractionConfig) {
  return [
    lineSelectionField,
    annotatedLinesField,
    selectionHighlightPlugin,
    annotationGutter,
    createGutterInteractionPlugin(config),
  ]
}

// Helper to update annotated lines from outside
export function updateAnnotatedLines(view: EditorView, lines: Set<number>) {
  view.dispatch({
    effects: setAnnotatedLines.of(lines),
  })
}

// Helper to clear selection from outside
export function clearLineSelection(view: EditorView) {
  view.dispatch({
    effects: setLineSelection.of(null),
  })
}

// Helper to scroll to a specific line
export function scrollToLine(view: EditorView, line: number) {
  const doc = view.state.doc
  if (line < 1 || line > doc.lines) return

  const lineInfo = doc.line(line)
  view.dispatch({
    effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
  })
}
