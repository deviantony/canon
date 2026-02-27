import { describe, expect, it } from 'bun:test'
import { escapeXml } from '../utils/annotationXml'

describe('escapeXml', () => {
  it('escapes ampersands', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeXml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('escapes single quotes (apostrophes)', () => {
    expect(escapeXml("it's")).toBe('it&apos;s')
  })

  it('escapes all special characters in one string', () => {
    expect(escapeXml(`<p class="x">'a' & 'b'</p>`)).toBe(
      '&lt;p class=&quot;x&quot;&gt;&apos;a&apos; &amp; &apos;b&apos;&lt;/p&gt;',
    )
  })

  it('returns empty string unchanged', () => {
    expect(escapeXml('')).toBe('')
  })

  it('returns string without special chars unchanged', () => {
    expect(escapeXml('hello world 123')).toBe('hello world 123')
  })

  it('handles multiple consecutive ampersands', () => {
    expect(escapeXml('&&')).toBe('&amp;&amp;')
  })
})
