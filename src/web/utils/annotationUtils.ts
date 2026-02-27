import type { CodeAnnotation } from '../context/AnnotationContext'

/**
 * Format a line badge string for display (e.g., "File", "L42", "L10-15")
 */
export function formatLineBadge(lineStart: number, lineEnd?: number): string {
  if (lineStart === 0) return 'File'
  if (lineEnd && lineEnd !== lineStart) return `L${lineStart}-${lineEnd}`
  return `L${lineStart}`
}

/**
 * Sort code annotations: file-level (lineStart=0) first, then by line number
 */
export function sortAnnotations(annotations: CodeAnnotation[]): CodeAnnotation[] {
  return [...annotations].sort((a, b) => {
    if (a.lineStart === 0 && b.lineStart !== 0) return -1
    if (b.lineStart === 0 && a.lineStart !== 0) return 1
    return a.lineStart - b.lineStart
  })
}

/**
 * Group code annotations by file path
 */
export function groupAnnotationsByFile(
  annotations: CodeAnnotation[],
): Map<string, CodeAnnotation[]> {
  const byFile = new Map<string, CodeAnnotation[]>()
  for (const annotation of annotations) {
    const existing = byFile.get(annotation.file) || []
    existing.push(annotation)
    byFile.set(annotation.file, existing)
  }
  return byFile
}

/**
 * Get the set of annotated line numbers for a file (excluding file-level annotations)
 */
export function getAnnotatedLineNumbers(annotations: CodeAnnotation[]): Set<number> {
  const lines = new Set<number>()
  for (const ann of annotations) {
    if (ann.lineStart === 0) continue // Skip file-level annotations
    for (let line = ann.lineStart; line <= (ann.lineEnd || ann.lineStart); line++) {
      lines.add(line)
    }
  }
  return lines
}
