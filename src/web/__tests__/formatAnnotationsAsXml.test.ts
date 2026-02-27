import { describe, expect, it } from 'bun:test'
import type { Annotation } from '../context/AnnotationContext'
import { groupAnnotationsByFile } from '../utils/annotationUtils'
import {
  formatAnnotationsAsXml,
  formatCodeSectionXml,
  formatConversationSectionXml,
} from '../utils/annotationXml'
import { codeAnn, convAnn, toolAnn } from './helpers'

// ─── formatAnnotationsAsXml ───────────────────────────────────────────────────

describe('formatAnnotationsAsXml', () => {
  it('returns empty string for empty annotations', () => {
    expect(formatAnnotationsAsXml([])).toBe('')
  })

  it('produces aurore-feedback root element', () => {
    const xml = formatAnnotationsAsXml([codeAnn()])
    expect(xml).toStartWith('<aurore-feedback>')
    expect(xml).toEndWith('</aurore-feedback>')
  })

  it('wraps code annotations in <code> section', () => {
    const xml = formatAnnotationsAsXml([codeAnn()])
    expect(xml).toContain('<code>')
    expect(xml).toContain('</code>')
  })

  it('does not produce <conversation> section when only code annotations exist', () => {
    const xml = formatAnnotationsAsXml([codeAnn()])
    expect(xml).not.toContain('<conversation>')
  })

  it('wraps conversation annotations in <conversation> section', () => {
    const xml = formatAnnotationsAsXml([convAnn()])
    expect(xml).toContain('<conversation>')
    expect(xml).toContain('</conversation>')
  })

  it('does not produce <code> section when only conversation annotations exist', () => {
    const xml = formatAnnotationsAsXml([convAnn()])
    expect(xml).not.toContain('<code>')
  })

  it('produces both sections for mixed annotations', () => {
    const xml = formatAnnotationsAsXml([codeAnn(), convAnn()])
    expect(xml).toContain('<code>')
    expect(xml).toContain('<conversation>')
  })

  it('includes summary with correct counts', () => {
    const anns: Annotation[] = [
      codeAnn({ kind: 'action' }),
      codeAnn({ kind: 'question', id: 'c2', lineStart: 20 }),
      convAnn({ kind: 'question' }),
    ]
    const xml = formatAnnotationsAsXml(anns)
    expect(xml).toContain('actions="1"')
    expect(xml).toContain('questions="2"')
    expect(xml).toContain('files="1"')
  })

  it('counts files correctly across multiple files', () => {
    const anns: Annotation[] = [
      codeAnn({ file: 'a.ts' }),
      codeAnn({ file: 'b.ts', id: 'c2' }),
      codeAnn({ file: 'a.ts', id: 'c3', lineStart: 20 }),
    ]
    const xml = formatAnnotationsAsXml(anns)
    expect(xml).toContain('files="2"')
  })

  it('escapes special characters in comments', () => {
    const xml = formatAnnotationsAsXml([codeAnn({ comment: 'Use <T> & "quotes"' })])
    expect(xml).toContain('Use &lt;T&gt; &amp; &quot;quotes&quot;')
  })

  it('escapes special characters in file paths', () => {
    const xml = formatAnnotationsAsXml([codeAnn({ file: 'src/components/App & Main.tsx' })])
    expect(xml).toContain('path="src/components/App &amp; Main.tsx"')
  })
})

// ─── formatCodeSectionXml ─────────────────────────────────────────────────────

describe('formatCodeSectionXml', () => {
  it('produces file-level annotation for lineStart=0', () => {
    const xml = formatCodeSectionXml(groupAnnotationsByFile([codeAnn({ lineStart: 0 })]), '')
    expect(xml).toContain('type="file"')
  })

  it('produces line annotation for single line', () => {
    const xml = formatCodeSectionXml(groupAnnotationsByFile([codeAnn({ lineStart: 42 })]), '')
    expect(xml).toContain('type="line"')
    expect(xml).toContain('line="42"')
  })

  it('produces range annotation for multi-line', () => {
    const xml = formatCodeSectionXml(
      groupAnnotationsByFile([codeAnn({ lineStart: 10, lineEnd: 20 })]),
      '',
    )
    expect(xml).toContain('type="range"')
    expect(xml).toContain('start="10"')
    expect(xml).toContain('end="20"')
  })

  it('treats lineEnd equal to lineStart as single line', () => {
    const xml = formatCodeSectionXml(
      groupAnnotationsByFile([codeAnn({ lineStart: 5, lineEnd: 5 })]),
      '',
    )
    expect(xml).toContain('type="line"')
    expect(xml).toContain('line="5"')
  })

  it('includes kind attribute', () => {
    const xml = formatCodeSectionXml(groupAnnotationsByFile([codeAnn({ kind: 'question' })]), '')
    expect(xml).toContain('kind="question"')
  })

  it('groups annotations by file', () => {
    const xml = formatCodeSectionXml(
      groupAnnotationsByFile([
        codeAnn({ file: 'a.ts', id: '1' }),
        codeAnn({ file: 'b.ts', id: '2' }),
      ]),
      '',
    )
    expect(xml).toContain('path="a.ts"')
    expect(xml).toContain('path="b.ts"')
  })

  it('applies indent correctly', () => {
    const xml = formatCodeSectionXml(groupAnnotationsByFile([codeAnn()]), '  ')
    expect(xml).toContain('  <file')
    expect(xml).toContain('    <annotation')
    expect(xml).toContain('      <comment>')
  })
})

// ─── formatConversationSectionXml ─────────────────────────────────────────────

describe('formatConversationSectionXml', () => {
  it('formats conversation annotation with message-id', () => {
    const xml = formatConversationSectionXml([convAnn()], '')
    expect(xml).toContain('message-id="msg-1"')
  })

  it('includes selection attribute when quote is present', () => {
    const xml = formatConversationSectionXml([convAnn({ quote: 'some text' })], '')
    expect(xml).toContain('selection="some text"')
  })

  it('omits selection attribute when quote is absent', () => {
    const xml = formatConversationSectionXml([convAnn({ quote: undefined })], '')
    expect(xml).not.toContain('selection=')
  })

  it('formats tool-call annotation with tool-use-id', () => {
    const xml = formatConversationSectionXml([toolAnn()], '')
    expect(xml).toContain('type="tool-call"')
    expect(xml).toContain('tool-use-id="tu-1"')
  })

  it('includes kind attribute on all annotations', () => {
    const xml = formatConversationSectionXml(
      [convAnn({ kind: 'question' }), toolAnn({ kind: 'action' })],
      '',
    )
    expect(xml).toContain('kind="question"')
    expect(xml).toContain('kind="action"')
  })

  it('escapes special characters in quote', () => {
    const xml = formatConversationSectionXml([convAnn({ quote: 'Use <T> & "quotes"' })], '')
    expect(xml).toContain('selection="Use &lt;T&gt; &amp; &quot;quotes&quot;"')
  })
})
