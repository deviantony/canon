import { describe, expect, it } from 'bun:test'
import {
  formatLineBadge,
  getAnnotatedLineNumbers,
  groupAnnotationsByFile,
  sortAnnotations,
} from '../utils/annotationUtils'
import { codeAnn } from './helpers'

// ─── formatLineBadge ──────────────────────────────────────────────────────────

describe('formatLineBadge', () => {
  it('returns "File" for lineStart 0', () => {
    expect(formatLineBadge(0)).toBe('File')
  })

  it('returns single line format', () => {
    expect(formatLineBadge(42)).toBe('L42')
  })

  it('returns single line when lineEnd equals lineStart', () => {
    expect(formatLineBadge(10, 10)).toBe('L10')
  })

  it('returns range format', () => {
    expect(formatLineBadge(10, 15)).toBe('L10-15')
  })

  it('returns single line when lineEnd is undefined', () => {
    expect(formatLineBadge(5, undefined)).toBe('L5')
  })
})

// ─── sortAnnotations ─────────────────────────────────────────────────────────

describe('sortAnnotations', () => {
  it('puts file-level annotations first', () => {
    const anns = [codeAnn({ lineStart: 5 }), codeAnn({ lineStart: 0 })]
    const sorted = sortAnnotations(anns)
    expect(sorted[0].lineStart).toBe(0)
    expect(sorted[1].lineStart).toBe(5)
  })

  it('sorts by lineStart ascending', () => {
    const anns = [
      codeAnn({ lineStart: 30 }),
      codeAnn({ lineStart: 10 }),
      codeAnn({ lineStart: 20 }),
    ]
    const sorted = sortAnnotations(anns)
    expect(sorted.map((a) => a.lineStart)).toEqual([10, 20, 30])
  })

  it('does not mutate the original array', () => {
    const anns = [codeAnn({ lineStart: 20 }), codeAnn({ lineStart: 10 })]
    sortAnnotations(anns)
    expect(anns[0].lineStart).toBe(20)
  })

  it('handles empty array', () => {
    expect(sortAnnotations([])).toEqual([])
  })
})

// ─── groupAnnotationsByFile ───────────────────────────────────────────────────

describe('groupAnnotationsByFile', () => {
  it('groups annotations by file path', () => {
    const anns = [
      codeAnn({ file: 'a.ts', id: '1' }),
      codeAnn({ file: 'b.ts', id: '2' }),
      codeAnn({ file: 'a.ts', id: '3' }),
    ]
    const grouped = groupAnnotationsByFile(anns)
    expect(grouped.size).toBe(2)
    expect(grouped.get('a.ts')?.length).toBe(2)
    expect(grouped.get('b.ts')?.length).toBe(1)
  })

  it('returns empty map for empty input', () => {
    expect(groupAnnotationsByFile([]).size).toBe(0)
  })
})

// ─── getAnnotatedLineNumbers ──────────────────────────────────────────────────

describe('getAnnotatedLineNumbers', () => {
  it('returns line numbers for single-line annotations', () => {
    const lines = getAnnotatedLineNumbers([codeAnn({ lineStart: 5 }), codeAnn({ lineStart: 10 })])
    expect(lines).toEqual(new Set([5, 10]))
  })

  it('expands ranges', () => {
    const lines = getAnnotatedLineNumbers([codeAnn({ lineStart: 3, lineEnd: 6 })])
    expect(lines).toEqual(new Set([3, 4, 5, 6]))
  })

  it('skips file-level annotations (lineStart=0)', () => {
    const lines = getAnnotatedLineNumbers([codeAnn({ lineStart: 0 }), codeAnn({ lineStart: 5 })])
    expect(lines).toEqual(new Set([5]))
  })

  it('returns empty set for empty input', () => {
    expect(getAnnotatedLineNumbers([])).toEqual(new Set())
  })
})
