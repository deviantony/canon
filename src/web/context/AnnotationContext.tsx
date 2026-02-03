import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { sortAnnotations, groupAnnotationsByFile } from '../utils/annotationUtils'

export interface Annotation {
  id: string
  file: string
  lineStart: number
  lineEnd?: number
  comment: string
}

interface AnnotationContextValue {
  annotations: Annotation[]
  addAnnotation: (file: string, lineStart: number, comment: string, lineEnd?: number) => void
  updateAnnotation: (id: string, comment: string) => void
  removeAnnotation: (id: string) => void
  getAnnotationsForFile: (file: string) => Annotation[]
  getSortedAnnotationsForFile: (file: string) => Annotation[]
  getAnnotationsGroupedByFile: () => Map<string, Annotation[]>
  getFileAnnotation: (file: string) => Annotation | undefined
  formatAsMarkdown: () => string
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null)

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const addAnnotation = useCallback(
    (file: string, lineStart: number, comment: string, lineEnd?: number) => {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        file,
        lineStart,
        lineEnd,
        comment,
      }
      setAnnotations((prev) => [...prev, annotation])
    },
    []
  )

  const updateAnnotation = useCallback((id: string, comment: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, comment } : a))
    )
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const getAnnotationsForFile = useCallback(
    (file: string) => annotations.filter((a) => a.file === file),
    [annotations]
  )

  const getSortedAnnotationsForFile = useCallback(
    (file: string) => sortAnnotations(annotations.filter((a) => a.file === file)),
    [annotations]
  )

  const getAnnotationsGroupedByFile = useCallback(
    () => groupAnnotationsByFile(annotations),
    [annotations]
  )

  const getFileAnnotation = useCallback(
    (file: string) => annotations.find((a) => a.file === file && a.lineStart === 0),
    [annotations]
  )

  const formatAsMarkdown = useCallback(() => {
    if (annotations.length === 0) return ''

    const byFile = groupAnnotationsByFile(annotations)
    let md = '## Code Review Feedback\n\n'

    for (const [file, fileAnnotations] of byFile) {
      md += `### ${file}\n\n`

      const sorted = sortAnnotations(fileAnnotations)

      for (const annotation of sorted) {
        if (annotation.lineStart === 0) {
          md += `**File:**\n`
        } else if (annotation.lineEnd && annotation.lineEnd !== annotation.lineStart) {
          md += `**Lines ${annotation.lineStart}-${annotation.lineEnd}:**\n`
        } else {
          md += `**Line ${annotation.lineStart}:**\n`
        }
        md += `> ${annotation.comment}\n\n`
      }
    }

    const fileCount = byFile.size
    md += `---\n*${annotations.length} annotation${annotations.length === 1 ? '' : 's'} across ${fileCount} file${fileCount === 1 ? '' : 's'}*\n`

    return md
  }, [annotations])

  return (
    <AnnotationContext.Provider
      value={{
        annotations,
        addAnnotation,
        updateAnnotation,
        removeAnnotation,
        getAnnotationsForFile,
        getSortedAnnotationsForFile,
        getAnnotationsGroupedByFile,
        getFileAnnotation,
        formatAsMarkdown,
      }}
    >
      {children}
    </AnnotationContext.Provider>
  )
}

export function useAnnotations() {
  const context = useContext(AnnotationContext)
  if (!context) {
    throw new Error('useAnnotations must be used within AnnotationProvider')
  }
  return context
}
