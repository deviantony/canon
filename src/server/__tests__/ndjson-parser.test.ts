import { describe, expect, it } from 'bun:test'
import { parseNdjsonBuffer } from '../session'

describe('parseNdjsonBuffer', () => {
  it('parses a complete line in one chunk', () => {
    const { lines, buffer } = parseNdjsonBuffer('', '{"type":"system"}\n')
    expect(lines).toEqual(['{"type":"system"}'])
    expect(buffer).toBe('')
  })

  it('parses multiple lines in one chunk', () => {
    const { lines, buffer } = parseNdjsonBuffer('', '{"a":1}\n{"b":2}\n')
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    expect(buffer).toBe('')
  })

  it('buffers data split across chunks', () => {
    // First chunk: incomplete line
    const first = parseNdjsonBuffer('', '{"ty')
    expect(first.lines).toEqual([])
    expect(first.buffer).toBe('{"ty')

    // Second chunk: completes the line
    const second = parseNdjsonBuffer(first.buffer, 'pe":"system"}\n')
    expect(second.lines).toEqual(['{"type":"system"}'])
    expect(second.buffer).toBe('')
  })

  it('skips empty lines between objects', () => {
    const { lines, buffer } = parseNdjsonBuffer('', '{"a":1}\n\n\n{"b":2}\n')
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    expect(buffer).toBe('')
  })

  it('keeps trailing data without newline in buffer', () => {
    const { lines, buffer } = parseNdjsonBuffer('', '{"a":1}\n{"partial')
    expect(lines).toEqual(['{"a":1}'])
    expect(buffer).toBe('{"partial')
  })

  it('returns raw string for malformed JSON lines (caller handles parse)', () => {
    const { lines, buffer } = parseNdjsonBuffer('', 'not json at all\n')
    // parseNdjsonBuffer doesn't parse JSON — it just splits lines
    expect(lines).toEqual(['not json at all'])
    expect(buffer).toBe('')
  })

  it('handles a large chunk with many lines', () => {
    const count = 100
    const chunk = `${Array.from({ length: count }, (_, i) => `{"i":${i}}`).join('\n')}\n`
    const { lines, buffer } = parseNdjsonBuffer('', chunk)
    expect(lines).toHaveLength(count)
    expect(lines[0]).toBe('{"i":0}')
    expect(lines[99]).toBe('{"i":99}')
    expect(buffer).toBe('')
  })

  it('returns empty lines and unchanged buffer for empty chunk', () => {
    const { lines, buffer } = parseNdjsonBuffer('existing', '')
    expect(lines).toEqual([])
    expect(buffer).toBe('existing')
  })

  it('handles chunk that is just a newline', () => {
    const { lines, buffer } = parseNdjsonBuffer('{"a":1}', '\n')
    expect(lines).toEqual(['{"a":1}'])
    expect(buffer).toBe('')
  })

  it('handles completely empty initial state and empty chunk', () => {
    const { lines, buffer } = parseNdjsonBuffer('', '')
    expect(lines).toEqual([])
    expect(buffer).toBe('')
  })
})
