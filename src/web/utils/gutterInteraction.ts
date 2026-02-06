import type { Extension } from '@codemirror/state'
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

// Effects for line selection and annotation tracking
const setLineSelection = StateEffect.define<{ start: number; end: number } | null>()
const setAnnotatedLines = StateEffect.define<Set<number>>()

// --- Shared helpers ---

function queryGutterElements(view: EditorView) {
  return view.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')
}

function parseLineNumber(el: Element): number | null {
  const num = parseInt(el.textContent || '0', 10)
  return Number.isNaN(num) ? null : num
}

function normalizeLineRange(start: number, end: number) {
  return { min: Math.min(start, end), max: Math.max(start, end) }
}

// --- State fields ---

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
      if (
        update.docChanged ||
        update.state.field(lineSelectionField) !== update.startState.field(lineSelectionField)
      ) {
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
      const { min, max } = normalizeLineRange(selection.start, selection.end)
      const startLine = Math.max(1, min)
      const endLine = Math.min(doc.lines, max)

      for (let line = startLine; line <= endLine; line++) {
        const lineInfo = doc.line(line)
        builder.add(lineInfo.from, lineInfo.from, selectedLineDecoration)
      }

      return builder.finish()
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

// Plugin to apply gutter indicator classes for both annotations and selections
const gutterIndicatorPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.updateGutterClasses(view)
    }

    update(update: ViewUpdate) {
      this.updateGutterClasses(update.view)
    }

    private updateGutterClasses(view: EditorView) {
      const gutterElements = queryGutterElements(view)
      const annotatedLines = view.state.field(annotatedLinesField)
      const selection = view.state.field(lineSelectionField)
      const { min: minLine, max: maxLine } = selection
        ? normalizeLineRange(selection.start, selection.end)
        : { min: 0, max: 0 }

      gutterElements.forEach((el) => {
        const lineNum = parseLineNumber(el)
        if (lineNum === null) return

        el.classList.toggle('annotated', annotatedLines.has(lineNum))
        el.classList.toggle(
          'selected',
          selection !== null && lineNum >= minLine && lineNum <= maxLine,
        )
      })
    }
  },
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
        const gutterElements = queryGutterElements(this.view)
        const { min: minLine, max: maxLine } = normalizeLineRange(startLine, endLine)

        gutterElements.forEach((el) => {
          const lineNum = parseLineNumber(el)
          if (lineNum === null) return

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
        queryGutterElements(this.view).forEach((el) => {
          el.classList.remove('selection-start', 'selection-active')
        })
      }

      private updateRangeIndicator(e: MouseEvent, startLine: number, endLine: number) {
        if (!this.rangeIndicator) {
          this.rangeIndicator = createRangeIndicator()
        }

        const { min: minLine, max: maxLine } = normalizeLineRange(startLine, endLine)
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
        const { min: lineStart, max: lineEnd } = normalizeLineRange(start, end)

        // Call the callback with the selection
        config.onSelectionComplete(lineStart, lineEnd)
      }
    },
  )
}

// Main export function to create all gutter interaction extensions
export function gutterInteraction(config: GutterInteractionConfig): Extension[] {
  return [
    lineSelectionField,
    annotatedLinesField,
    selectionHighlightPlugin,
    gutterIndicatorPlugin,
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
