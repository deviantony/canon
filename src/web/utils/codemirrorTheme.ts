import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

// Terminal Luxury color palette - warm, refined, sophisticated
const colors = {
  // Backgrounds
  void: '#0c0c0c',
  surface: '#111111',
  elevated: '#161616',

  // Accent
  gold: '#d4a574',
  goldMuted: '#9c7a58',
  goldDim: 'rgba(212, 165, 116, 0.15)',

  // Text
  textPrimary: '#e8e8e8',
  textSecondary: '#888888',
  textTertiary: '#555555',
  textMuted: '#3a3a3a',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.1)',
}

export const baseEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: colors.void,
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
    lineHeight: '1.7',
  },
  '.cm-content': {
    caretColor: colors.gold,
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: colors.gold,
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: colors.goldDim,
  },
  '.cm-activeLine': {
    backgroundColor: colors.elevated,
  },
  '.cm-gutters': {
    backgroundColor: colors.surface,
    borderRight: `1px solid ${colors.borderSubtle}`,
    color: colors.textMuted,
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 16px 0 12px',
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: colors.elevated,
    color: colors.textTertiary,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: colors.elevated,
    border: `1px solid ${colors.borderDefault}`,
    color: colors.textTertiary,
    borderRadius: '4px',
    padding: '0 8px',
  },
  '.cm-tooltip': {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: colors.elevated,
      color: colors.textPrimary,
    },
  },
  '.cm-searchMatch': {
    backgroundColor: colors.goldDim,
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(212, 165, 116, 0.3)',
  },
})

export const diffEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: colors.void,
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
    lineHeight: '1.7',
  },
  '.cm-content': {
    caretColor: colors.gold,
    padding: '12px 0',
  },
  '.cm-gutters': {
    backgroundColor: colors.surface,
    borderRight: `1px solid ${colors.borderSubtle}`,
    color: colors.textMuted,
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 16px 0 12px',
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: colors.elevated,
    color: colors.textTertiary,
  },
  // Diff-specific styles - subtle, refined
  '.cm-changedLine': {
    backgroundColor: 'rgba(212, 165, 116, 0.04)',
  },
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(196, 122, 122, 0.1)',
  },
  '.cm-insertedChunk': {
    backgroundColor: 'rgba(125, 159, 125, 0.1)',
  },
  '.cm-deletedText': {
    backgroundColor: 'rgba(196, 122, 122, 0.2)',
  },
  '.cm-insertedText': {
    backgroundColor: 'rgba(125, 159, 125, 0.2)',
  },
  // Merge view specific
  '.cm-mergeView': {
    height: '100%',
  },
  '.cm-mergeViewEditor': {
    borderRight: `1px solid ${colors.borderSubtle}`,
  },
  '.cm-mergeViewEditor:last-child': {
    borderRight: 'none',
  },
})

// Terminal Luxury syntax highlighting - warm, balanced, readable
const luxuryHighlight = HighlightStyle.define([
  // Comments - subtle, don't compete
  { tag: tags.comment, color: colors.textMuted, fontStyle: 'italic' },
  { tag: tags.lineComment, color: colors.textMuted, fontStyle: 'italic' },
  { tag: tags.blockComment, color: colors.textMuted, fontStyle: 'italic' },

  // Strings - warm green, readable
  { tag: tags.string, color: '#a3be8c' },
  { tag: tags.special(tags.string), color: '#a3be8c' },

  // Numbers - soft orange
  { tag: tags.number, color: '#d08770' },
  { tag: tags.integer, color: '#d08770' },
  { tag: tags.float, color: '#d08770' },

  // Keywords - gold accent (the star)
  { tag: tags.keyword, color: colors.gold },
  { tag: tags.controlKeyword, color: colors.gold },
  { tag: tags.operatorKeyword, color: colors.gold },
  { tag: tags.moduleKeyword, color: colors.gold },

  // Operators - subtle
  { tag: tags.operator, color: colors.textSecondary },
  { tag: tags.compareOperator, color: colors.textSecondary },
  { tag: tags.arithmeticOperator, color: colors.textSecondary },
  { tag: tags.logicOperator, color: colors.textSecondary },

  // Functions - soft blue
  { tag: tags.function(tags.variableName), color: '#81a1c1' },
  { tag: tags.definition(tags.function(tags.variableName)), color: '#81a1c1' },

  // Variables - clean white
  { tag: tags.variableName, color: colors.textPrimary },
  { tag: tags.definition(tags.variableName), color: colors.textPrimary },
  { tag: tags.local(tags.variableName), color: colors.textPrimary },

  // Properties - warm tone
  { tag: tags.propertyName, color: '#b48ead' },
  { tag: tags.definition(tags.propertyName), color: '#b48ead' },

  // Types - soft purple
  { tag: tags.typeName, color: '#8fbcbb' },
  { tag: tags.className, color: '#8fbcbb' },
  { tag: tags.namespace, color: '#8fbcbb' },

  // Constants - gold muted
  { tag: tags.constant(tags.variableName), color: colors.goldMuted },
  { tag: tags.bool, color: '#d08770' },
  { tag: tags.null, color: '#d08770' },

  // Tags (HTML/XML) - soft red
  { tag: tags.tagName, color: '#bf616a' },
  { tag: tags.angleBracket, color: colors.textTertiary },

  // Attributes
  { tag: tags.attributeName, color: '#8fbcbb' },
  { tag: tags.attributeValue, color: '#a3be8c' },

  // Punctuation - very subtle
  { tag: tags.punctuation, color: colors.textTertiary },
  { tag: tags.bracket, color: colors.textTertiary },
  { tag: tags.paren, color: colors.textTertiary },
  { tag: tags.squareBracket, color: colors.textTertiary },
  { tag: tags.brace, color: colors.textTertiary },

  // Regex
  { tag: tags.regexp, color: '#ebcb8b' },

  // Meta
  { tag: tags.meta, color: colors.textTertiary },

  // Links - gold
  { tag: tags.link, color: colors.gold, textDecoration: 'underline' },
  { tag: tags.url, color: colors.gold, textDecoration: 'underline' },

  // Headings (markdown)
  { tag: tags.heading1, color: colors.textPrimary, fontWeight: 'bold' },
  { tag: tags.heading2, color: colors.textPrimary, fontWeight: 'bold' },
  { tag: tags.heading3, color: colors.textPrimary, fontWeight: 'bold' },
  { tag: tags.heading, color: colors.textPrimary, fontWeight: 'bold' },

  // Emphasis
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])

export const cyberpunkSyntax = syntaxHighlighting(luxuryHighlight)
