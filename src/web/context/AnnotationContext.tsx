import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { sortAnnotations, groupAnnotationsByFile } from '../utils/annotationUtils'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

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
  clearAllAnnotations: () => void
  getAnnotationsForFile: (file: string) => Annotation[]
  getAnnotationsGroupedByFile: () => Map<string, Annotation[]>
  getFileAnnotation: (file: string) => Annotation | undefined
  formatAsXml: () => string
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

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([])
  }, [])

  const getAnnotationsForFile = useCallback(
    (file: string) => annotations.filter((a) => a.file === file),
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

  const formatAsXml = useCallback(() => {
    if (annotations.length === 0) return ''

    const byFile = groupAnnotationsByFile(annotations)
    let xml = '<code-review-feedback>\n'

    for (const [file, fileAnnotations] of byFile) {
      xml += `  <file path="${escapeXml(file)}">\n`

      const sorted = sortAnnotations(fileAnnotations)

      for (const annotation of sorted) {
        if (annotation.lineStart === 0) {
          xml += `    <annotation type="file">\n`
        } else if (annotation.lineEnd && annotation.lineEnd !== annotation.lineStart) {
          xml += `    <annotation type="range" start="${annotation.lineStart}" end="${annotation.lineEnd}">\n`
        } else {
          xml += `    <annotation type="line" line="${annotation.lineStart}">\n`
        }
        xml += `      <comment>${escapeXml(annotation.comment)}</comment>\n`
        xml += `    </annotation>\n`
      }

      xml += `  </file>\n`
    }

    const fileCount = byFile.size
    xml += `  <summary annotations="${annotations.length}" files="${fileCount}" />\n`
    xml += '</code-review-feedback>'

    return xml
  }, [annotations])

  return (
    <AnnotationContext.Provider
      value={{
        annotations,
        addAnnotation,
        updateAnnotation,
        removeAnnotation,
        clearAllAnnotations,
        getAnnotationsForFile,
        getAnnotationsGroupedByFile,
        getFileAnnotation,
        formatAsXml,
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
