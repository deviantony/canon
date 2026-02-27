import { beforeAll, describe, expect, it } from 'bun:test'
import { DOMParser } from 'linkedom'
import { isAuroreFeedback, parseAnnotationXml } from '../utils/annotationXml'

// Set up DOMParser from linkedom for non-browser environment
beforeAll(() => {
  globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser
})

// ─── isAuroreFeedback ─────────────────────────────────────────────────────────

describe('isAuroreFeedback', () => {
  it('returns true for aurore-feedback content', () => {
    expect(isAuroreFeedback('<aurore-feedback>...</aurore-feedback>')).toBe(true)
  })

  it('returns true when tag is embedded in larger text', () => {
    expect(isAuroreFeedback('some text <aurore-feedback> more text')).toBe(true)
  })

  it('returns false for non-feedback content', () => {
    expect(isAuroreFeedback('Hello, how are you?')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAuroreFeedback('')).toBe(false)
  })
})

// ─── parseAnnotationXml ───────────────────────────────────────────────────────

describe('parseAnnotationXml', () => {
  it('returns null for non-feedback content', () => {
    expect(parseAnnotationXml('Hello world')).toBeNull()
  })

  it('returns null for malformed XML', () => {
    expect(parseAnnotationXml('<aurore-feedback><unclosed')).toBeNull()
  })

  it('returns null when no annotations are present', () => {
    const xml = '<aurore-feedback><summary actions="0" questions="0" files="0" /></aurore-feedback>'
    expect(parseAnnotationXml(xml)).toBeNull()
  })

  // ─── Code annotations ────────────────────────────────────────────

  it('parses code annotations from <code> section', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="src/index.ts">
      <annotation type="line" line="10" kind="action">
        <comment>Fix this</comment>
      </annotation>
    </file>
  </code>
  <summary actions="1" questions="0" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result).not.toBeNull()
    expect(result!.actions).toHaveLength(1)
    expect(result!.actions[0].file).toBe('src/index.ts')
    expect(result!.actions[0].line).toBe('10')
    expect(result!.actions[0].type).toBe('line')
    expect(result!.actions[0].comment).toBe('Fix this')
    expect(result!.actions[0].kind).toBe('action')
    expect(result!.actions[0].source).toBe('code')
  })

  it('parses range annotations', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="range" start="5" end="10" kind="action">
        <comment>Refactor</comment>
      </annotation>
    </file>
  </code>
  <summary actions="1" questions="0" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.actions[0].line).toBe('5')
  })

  it('parses file-level annotations', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="file" kind="question">
        <comment>Why this file?</comment>
      </annotation>
    </file>
  </code>
  <summary actions="0" questions="1" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.questions).toHaveLength(1)
    expect(result!.questions[0].type).toBe('file')
    expect(result!.questions[0].kind).toBe('question')
  })

  it('parses multiple files', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="line" line="1" kind="action"><comment>A</comment></annotation>
    </file>
    <file path="b.ts">
      <annotation type="line" line="2" kind="action"><comment>B</comment></annotation>
    </file>
  </code>
  <summary actions="2" questions="0" files="2" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.actions).toHaveLength(2)
    expect(result!.summary.files).toBe(2)
  })

  // ─── Conversation annotations ────────────────────────────────────

  it('parses conversation annotations', () => {
    const xml = `<aurore-feedback>
  <conversation>
    <annotation message-id="msg-1" kind="question">
      <comment>Why this approach?</comment>
    </annotation>
  </conversation>
  <summary actions="0" questions="1" files="0" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.questions).toHaveLength(1)
    expect(result!.questions[0].source).toBe('conversation')
    expect(result!.questions[0].kind).toBe('question')
    expect(result!.questions[0].comment).toBe('Why this approach?')
  })

  it('parses tool-call annotations', () => {
    const xml = `<aurore-feedback>
  <conversation>
    <annotation type="tool-call" tool-use-id="tu-1" kind="action">
      <comment>Should use const</comment>
    </annotation>
  </conversation>
  <summary actions="1" questions="0" files="0" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.actions).toHaveLength(1)
    expect(result!.actions[0].source).toBe('tool-call')
    expect(result!.actions[0].type).toBe('tool-call')
  })

  // ─── Mixed annotations ──────────────────────────────────────────

  it('parses mixed code and conversation annotations', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="src/index.ts">
      <annotation type="line" line="10" kind="action">
        <comment>Fix bug</comment>
      </annotation>
    </file>
  </code>
  <conversation>
    <annotation message-id="msg-1" kind="question">
      <comment>Why?</comment>
    </annotation>
    <annotation type="tool-call" tool-use-id="tu-1" kind="action">
      <comment>Check output</comment>
    </annotation>
  </conversation>
  <summary actions="2" questions="1" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.actions).toHaveLength(2)
    expect(result!.questions).toHaveLength(1)
    expect(result!.summary.files).toBe(1)
    expect(result!.summary.conversationAnnotations).toBe(2)
  })

  // ─── Additional context ─────────────────────────────────────────

  it('extracts additional context after closing tag', () => {
    const content = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="line" line="1" kind="action"><comment>Fix</comment></annotation>
    </file>
  </code>
  <summary actions="1" questions="0" files="1" />
</aurore-feedback>
Please also check the tests.`

    const result = parseAnnotationXml(content)
    expect(result!.additionalContext).toBe('Please also check the tests.')
  })

  it('returns empty additionalContext when nothing follows', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="line" line="1" kind="action"><comment>Fix</comment></annotation>
    </file>
  </code>
  <summary actions="1" questions="0" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.additionalContext).toBe('')
  })

  // ─── Summary computation ────────────────────────────────────────

  it('computes summary from parsed content, not XML attributes', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="line" line="1" kind="action"><comment>A1</comment></annotation>
      <annotation type="line" line="2" kind="question"><comment>Q1</comment></annotation>
    </file>
    <file path="b.ts">
      <annotation type="line" line="5" kind="action"><comment>A2</comment></annotation>
    </file>
  </code>
  <conversation>
    <annotation message-id="m1" kind="question"><comment>Q2</comment></annotation>
  </conversation>
  <summary actions="999" questions="999" files="999" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    // Summary is computed from actual parsed annotations, not from XML attributes
    expect(result!.summary.actions).toBe(2)
    expect(result!.summary.questions).toBe(2)
    expect(result!.summary.files).toBe(2)
    expect(result!.summary.conversationAnnotations).toBe(1)
  })

  // ─── Kind sorting ──────────────────────────────────────────────

  it('sorts annotations into actions and questions by kind attribute', () => {
    const xml = `<aurore-feedback>
  <code>
    <file path="a.ts">
      <annotation type="line" line="1" kind="action"><comment>Do this</comment></annotation>
      <annotation type="line" line="2" kind="question"><comment>Why this?</comment></annotation>
      <annotation type="line" line="3" kind="action"><comment>And this</comment></annotation>
    </file>
  </code>
  <summary actions="2" questions="1" files="1" />
</aurore-feedback>`

    const result = parseAnnotationXml(xml)
    expect(result!.actions).toHaveLength(2)
    expect(result!.questions).toHaveLength(1)
    expect(result!.actions[0].comment).toBe('Do this')
    expect(result!.actions[1].comment).toBe('And this')
    expect(result!.questions[0].comment).toBe('Why this?')
  })
})
