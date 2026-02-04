import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'

// Effects for line selection
const setLineSelection = StateEffect.define<{ start: number; end: number } | null>()
const setAnnotatedLines = StateEffect.define<Set<number>>()

// State field to track current line selection
const lineSelectionField = StateField.define<{ start: number; end: number } | null>({
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
const annotatedLinesField = StateField.define<Set<number>>({
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

// Gutter interaction plugin for click/drag selection
interface GutterInteractionConfig {
  onSelectionComplete: (start: number, end: number) => void
}

// Create the floating range indicator element
function createRangeIndicator(): HTMLElement {
  const indicator = document.createElement('div')
  indicator.className = 'line-selection-indicator'
  indicator.innerHTML = `
    <span class="line-selection-indicator-icon">
      <svg viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
    <span class="line-selection-indicator-text"></span>
  `
  document.body.appendChild(indicator)
  return indicator
}

function createGutterInteractionPlugin(config: GutterInteractionConfig) {
  return ViewPlugin.fromClass(
    class {
      private isDragging = false
      private startLine: number | null = null
      private currentEndLine: number | null = null
      private view: EditorView
      private rangeIndicator: HTMLElement | null = null
      private lastLineCount: number = 0

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
        this.cleanupIndicator()
      }

      private cleanupIndicator() {
        if (this.rangeIndicator) {
          this.rangeIndicator.remove()
          this.rangeIndicator = null
        }
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

      private updateGutterStyles(startLine: number, endLine: number) {
        // Get all gutter elements
        const gutterElements = this.view.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')

        const minLine = Math.min(startLine, endLine)
        const maxLine = Math.max(startLine, endLine)

        gutterElements.forEach((el) => {
          const lineNum = parseInt(el.textContent || '0', 10)
          if (isNaN(lineNum)) return

          // Remove previous classes
          el.classList.remove('selection-start', 'selection-active')

          // Add appropriate classes
          if (lineNum === startLine) {
            el.classList.add('selection-start')
          }
          if (lineNum >= minLine && lineNum <= maxLine) {
            el.classList.add('selection-active')
          }
        })
      }

      private clearGutterStyles() {
        const gutterElements = this.view.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')
        gutterElements.forEach((el) => {
          el.classList.remove('selection-start', 'selection-active')
        })
      }

      private updateRangeIndicator(e: MouseEvent, startLine: number, endLine: number) {
        if (!this.rangeIndicator) {
          this.rangeIndicator = createRangeIndicator()
        }

        const minLine = Math.min(startLine, endLine)
        const maxLine = Math.max(startLine, endLine)
        const lineCount = maxLine - minLine + 1
        const lineText = lineCount === 1 ? 'Line' : 'Lines'

        // Update text
        const textEl = this.rangeIndicator.querySelector('.line-selection-indicator-text')
        if (textEl) {
          textEl.textContent = `${lineText} ${minLine}${lineCount > 1 ? `–${maxLine}` : ''}`
        }

        // Trigger pulse animation when count changes
        if (lineCount !== this.lastLineCount) {
          this.rangeIndicator.classList.remove('counting')
          // Force reflow to restart animation
          void this.rangeIndicator.offsetWidth
          this.rangeIndicator.classList.add('counting')
          this.lastLineCount = lineCount
        }

        // Position near cursor
        this.rangeIndicator.style.left = `${e.clientX}px`
        this.rangeIndicator.style.top = `${e.clientY}px`
        this.rangeIndicator.classList.add('visible')
      }

      private hideRangeIndicator() {
        if (this.rangeIndicator) {
          this.rangeIndicator.classList.remove('visible', 'counting')
        }
        this.lastLineCount = 0
      }

      private handleMouseDown(e: MouseEvent) {
        // Check if click is on gutter
        if (!this.isGutterClick(e)) return

        const line = this.getLineFromEvent(e)
        if (line === null) return

        e.preventDefault()
        this.isDragging = true
        this.startLine = line
        this.currentEndLine = line
        this.view.dom.classList.add('cm-line-selecting')

        // Update visual feedback
        this.updateGutterStyles(line, line)
        this.updateRangeIndicator(e, line, line)

        // Set initial selection
        this.view.dispatch({
          effects: setLineSelection.of({ start: line, end: line }),
        })
      }

      private handleMouseMove(e: MouseEvent) {
        if (!this.isDragging || this.startLine === null) return

        const line = this.getLineFromEvent(e)
        if (line === null) return

        this.currentEndLine = line

        // Update visual feedback
        this.updateGutterStyles(this.startLine, line)
        this.updateRangeIndicator(e, this.startLine, line)

        // Update selection
        this.view.dispatch({
          effects: setLineSelection.of({ start: this.startLine, end: line }),
        })
      }

      private handleMouseUp(e: MouseEvent) {
        if (!this.isDragging || this.startLine === null) {
          this.isDragging = false
          this.startLine = null
          this.currentEndLine = null
          return
        }

        this.view.dom.classList.remove('cm-line-selecting')
        this.clearGutterStyles()
        this.hideRangeIndicator()

        const endLine = this.getLineFromEvent(e)
        const start = this.startLine
        const end = endLine !== null ? endLine : this.startLine

        this.isDragging = false
        this.startLine = null
        this.currentEndLine = null

        // Normalize the range
        const lineStart = Math.min(start, end)
        const lineEnd = Math.max(start, end)

        // Call the callback with the selection
        config.onSelectionComplete(lineStart, lineEnd)
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
