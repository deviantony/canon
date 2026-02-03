import { EditorView } from '@codemirror/view'

export const baseEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  },
  '.cm-gutters': {
    backgroundColor: '#18181b',
    borderRight: '1px solid #27272a',
  },
})

export const diffEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  },
  '.cm-gutters': {
    backgroundColor: '#18181b',
    borderRight: '1px solid #27272a',
  },
  '.cm-changedLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  '.cm-insertedChunk': {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
})
