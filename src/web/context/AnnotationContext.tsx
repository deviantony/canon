import { createContext, type ReactNode, useCallback, useContext, useState } from 'react'
import type { AnnotationKind } from '../../shared/types'
import { groupAnnotationsByFile, sortAnnotations } from '../utils/annotationUtils'

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
  kind: AnnotationKind
}

function formatAnnotationXml(items: Annotation[], indent: string): string {
  const byFile = groupAnnotationsByFile(items)
  let xml = ''
  for (const [file, fileAnnotations] of byFile) {
    xml += `${indent}<file path="${escapeXml(file)}">\n`
    const sorted = sortAnnotations(fileAnnotations)
    for (const annotation of sorted) {
      if (annotation.lineStart === 0) {
        xml += `${indent}  <annotation type="file">\n`
      } else if (annotation.lineEnd && annotation.lineEnd !== annotation.lineStart) {
        xml += `${indent}  <annotation type="range" start="${annotation.lineStart}" end="${annotation.lineEnd}">\n`
      } else {
        xml += `${indent}  <annotation type="line" line="${annotation.lineStart}">\n`
      }
      xml += `${indent}    <comment>${escapeXml(annotation.comment)}</comment>\n`
      xml += `${indent}  </annotation>\n`
    }
    xml += `${indent}</file>\n`
  }
  return xml
}

interface AnnotationContextValue {
  annotations: Annotation[]
  addAnnotation: (
    file: string,
    lineStart: number,
    comment: string,
    lineEnd?: number,
    kind?: AnnotationKind,
  ) => void
  updateAnnotation: (id: string, comment: string) => void
  updateAnnotationKind: (id: string, kind: AnnotationKind) => void
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
    (
      file: string,
      lineStart: number,
      comment: string,
      lineEnd?: number,
      kind: AnnotationKind = 'action',
    ) => {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        file,
        lineStart,
        lineEnd,
        comment,
        kind,
      }
      setAnnotations((prev) => [...prev, annotation])
    },
    [],
  )

  const updateAnnotation = useCallback((id: string, comment: string) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, comment } : a)))
  }, [])

  const updateAnnotationKind = useCallback((id: string, kind: AnnotationKind) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, kind } : a)))
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([])
  }, [])

  const getAnnotationsForFile = useCallback(
    (file: string) => annotations.filter((a) => a.file === file),
    [annotations],
  )

  const getAnnotationsGroupedByFile = useCallback(
    () => groupAnnotationsByFile(annotations),
    [annotations],
  )

  const getFileAnnotation = useCallback(
    (file: string) => annotations.find((a) => a.file === file && a.lineStart === 0),
    [annotations],
  )

  const formatAsXml = useCallback(() => {
    if (annotations.length === 0) return ''

    const actions = annotations.filter((a) => a.kind !== 'question')
    const questions = annotations.filter((a) => a.kind === 'question')

    const byFile = groupAnnotationsByFile(annotations)
    const actionCount = actions.length
    const questionCount = questions.length
    const fileCount = byFile.size

    let xml = '<code-review-feedback>\n'

    if (actionCount > 0) {
      xml += '  <actions>\n'
      xml += formatAnnotationXml(actions, '    ')
      xml += '  </actions>\n'
    }

    if (questionCount > 0) {
      xml += '  <questions>\n'
      xml += formatAnnotationXml(questions, '    ')
      xml += '  </questions>\n'
    }

    xml += `  <summary actions="${actionCount}" questions="${questionCount}" files="${fileCount}" />\n`
    xml += '</code-review-feedback>'

    return xml
  }, [annotations])

  return (
    <AnnotationContext.Provider
      value={{
        annotations,
        addAnnotation,
        updateAnnotation,
        updateAnnotationKind,
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
