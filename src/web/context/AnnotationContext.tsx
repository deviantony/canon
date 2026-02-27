import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import type { AnnotationKind } from '../../shared/types'
import { groupAnnotationsByFile } from '../utils/annotationUtils'
import { formatAnnotationsAsXml } from '../utils/annotationXml'

// ─── Discriminated union annotation types ─────────────────────────────────────

interface BaseAnnotation {
  id: string
  comment: string
  kind: AnnotationKind
}

export interface CodeAnnotation extends BaseAnnotation {
  target: 'code'
  file: string
  lineStart: number
  lineEnd?: number
}

export interface ConversationAnnotation extends BaseAnnotation {
  target: 'conversation'
  messageId: string
  quote?: string
}

export interface ToolCallAnnotation extends BaseAnnotation {
  target: 'tool-call'
  toolUseId: string
  toolLabel: string
}

export type Annotation = CodeAnnotation | ConversationAnnotation | ToolCallAnnotation

// ─── Context interface ────────────────────────────────────────────────────────

interface AnnotationContextValue {
  annotations: Annotation[]
  codeAnnotations: CodeAnnotation[]
  addAnnotation: (
    file: string,
    lineStart: number,
    comment: string,
    lineEnd?: number,
    kind?: AnnotationKind,
  ) => void
  addConversationAnnotation: (
    messageId: string,
    comment: string,
    quote?: string,
    kind?: AnnotationKind,
  ) => void
  addToolCallAnnotation: (
    toolUseId: string,
    toolLabel: string,
    comment: string,
    kind?: AnnotationKind,
  ) => void
  updateAnnotation: (id: string, comment: string) => void
  updateAnnotationKind: (id: string, kind: AnnotationKind) => void
  removeAnnotation: (id: string) => void
  clearAllAnnotations: () => void
  getAnnotationsForFile: (file: string) => CodeAnnotation[]
  getAnnotationsGroupedByFile: () => Map<string, CodeAnnotation[]>
  getFileAnnotation: (file: string) => CodeAnnotation | undefined
  getAnnotationsForMessage: (messageId: string) => (ConversationAnnotation | ToolCallAnnotation)[]
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
      const annotation: CodeAnnotation = {
        id: crypto.randomUUID(),
        target: 'code',
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

  const addConversationAnnotation = useCallback(
    (messageId: string, comment: string, quote?: string, kind: AnnotationKind = 'action') => {
      const annotation: ConversationAnnotation = {
        id: crypto.randomUUID(),
        target: 'conversation',
        messageId,
        quote,
        comment,
        kind,
      }
      setAnnotations((prev) => [...prev, annotation])
    },
    [],
  )

  const addToolCallAnnotation = useCallback(
    (toolUseId: string, toolLabel: string, comment: string, kind: AnnotationKind = 'action') => {
      const annotation: ToolCallAnnotation = {
        id: crypto.randomUUID(),
        target: 'tool-call',
        toolUseId,
        toolLabel,
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

  const codeAnnotations = useMemo(
    () => annotations.filter((a): a is CodeAnnotation => a.target === 'code'),
    [annotations],
  )

  const getAnnotationsForFile = useCallback(
    (file: string) => codeAnnotations.filter((a) => a.file === file),
    [codeAnnotations],
  )

  const getAnnotationsGroupedByFile = useCallback(
    () => groupAnnotationsByFile(codeAnnotations),
    [codeAnnotations],
  )

  const getFileAnnotation = useCallback(
    (file: string) => codeAnnotations.find((a) => a.file === file && a.lineStart === 0),
    [codeAnnotations],
  )

  const getAnnotationsForMessage = useCallback(
    (messageId: string): (ConversationAnnotation | ToolCallAnnotation)[] =>
      annotations.filter(
        (a): a is ConversationAnnotation | ToolCallAnnotation =>
          (a.target === 'conversation' && a.messageId === messageId) ||
          (a.target === 'tool-call' && a.toolUseId === messageId),
      ),
    [annotations],
  )

  const formatAsXml = useCallback(() => formatAnnotationsAsXml(annotations), [annotations])

  return (
    <AnnotationContext.Provider
      value={{
        annotations,
        codeAnnotations,
        addAnnotation,
        addConversationAnnotation,
        addToolCallAnnotation,
        updateAnnotation,
        updateAnnotationKind,
        removeAnnotation,
        clearAllAnnotations,
        getAnnotationsForFile,
        getAnnotationsGroupedByFile,
        getFileAnnotation,
        getAnnotationsForMessage,
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
