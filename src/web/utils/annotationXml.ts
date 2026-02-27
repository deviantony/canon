import type { AnnotationKind } from '../../shared/types'
import type {
  Annotation,
  CodeAnnotation,
  ConversationAnnotation,
  ToolCallAnnotation,
} from '../context/AnnotationContext'
import { groupAnnotationsByFile, sortAnnotations } from './annotationUtils'

// ─── XML escaping ─────────────────────────────────────────────────────────────

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── XML formatting (emitter) ─────────────────────────────────────────────────

export function formatCodeSectionXml(
  byFile: Map<string, CodeAnnotation[]>,
  indent: string,
): string {
  let xml = ''
  for (const [file, fileAnnotations] of byFile) {
    xml += `${indent}<file path="${escapeXml(file)}">\n`
    const sorted = sortAnnotations(fileAnnotations)
    for (const ann of sorted) {
      if (ann.lineStart === 0) {
        xml += `${indent}  <annotation type="file" kind="${ann.kind}">\n`
      } else if (ann.lineEnd && ann.lineEnd !== ann.lineStart) {
        xml += `${indent}  <annotation type="range" start="${ann.lineStart}" end="${ann.lineEnd}" kind="${ann.kind}">\n`
      } else {
        xml += `${indent}  <annotation type="line" line="${ann.lineStart}" kind="${ann.kind}">\n`
      }
      xml += `${indent}    <comment>${escapeXml(ann.comment)}</comment>\n`
      xml += `${indent}  </annotation>\n`
    }
    xml += `${indent}</file>\n`
  }
  return xml
}

export function formatConversationSectionXml(
  items: (ConversationAnnotation | ToolCallAnnotation)[],
  indent: string,
): string {
  let xml = ''
  for (const ann of items) {
    if (ann.target === 'conversation') {
      const selAttr = ann.quote ? ` selection="${escapeXml(ann.quote)}"` : ''
      xml += `${indent}<annotation message-id="${escapeXml(ann.messageId)}"${selAttr} kind="${ann.kind}">\n`
    } else {
      xml += `${indent}<annotation type="tool-call" tool-use-id="${escapeXml(ann.toolUseId)}" kind="${ann.kind}">\n`
    }
    xml += `${indent}  <comment>${escapeXml(ann.comment)}</comment>\n`
    xml += `${indent}</annotation>\n`
  }
  return xml
}

export function formatAnnotationsAsXml(annotations: Annotation[]): string {
  if (annotations.length === 0) return ''

  const codeAnns = annotations.filter((a): a is CodeAnnotation => a.target === 'code')
  const convAnns = annotations.filter(
    (a): a is ConversationAnnotation | ToolCallAnnotation => a.target !== 'code',
  )
  const actionCount = annotations.filter((a) => a.kind !== 'question').length
  const questionCount = annotations.filter((a) => a.kind === 'question').length
  const byFile = groupAnnotationsByFile(codeAnns)

  let xml = '<aurore-feedback>\n'

  if (codeAnns.length > 0) {
    xml += '  <code>\n'
    xml += formatCodeSectionXml(byFile, '    ')
    xml += '  </code>\n'
  }

  if (convAnns.length > 0) {
    xml += '  <conversation>\n'
    xml += formatConversationSectionXml(convAnns, '    ')
    xml += '  </conversation>\n'
  }

  xml += `  <summary actions="${actionCount}" questions="${questionCount}" files="${byFile.size}" />\n`
  xml += '</aurore-feedback>'
  return xml
}

// ─── XML parsing ──────────────────────────────────────────────────────────────

export interface ParsedAnnotation {
  file: string
  line: string
  type: string
  comment: string
  kind: AnnotationKind
  source: 'code' | 'conversation' | 'tool-call'
}

export interface ParsedFeedback {
  actions: ParsedAnnotation[]
  questions: ParsedAnnotation[]
  additionalContext: string
  summary: { actions: number; questions: number; files: number; conversationAnnotations: number }
}

export function isAuroreFeedback(content: string): boolean {
  return content.includes('<aurore-feedback>')
}

export function parseAnnotationXml(fullContent: string): ParsedFeedback | null {
  if (!isAuroreFeedback(fullContent)) return null

  const closeTag = '</aurore-feedback>'
  const xmlEndIdx = fullContent.indexOf(closeTag)
  const xml = xmlEndIdx > -1 ? fullContent.slice(0, xmlEndIdx + closeTag.length) : fullContent
  const additionalContext =
    xmlEndIdx > -1 ? fullContent.slice(xmlEndIdx + closeTag.length).trim() : ''

  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return null

  const actions: ParsedAnnotation[] = []
  const questions: ParsedAnnotation[] = []
  const files = new Set<string>()

  function pushAnnotation(ann: ParsedAnnotation) {
    if (ann.kind === 'question') {
      questions.push(ann)
    } else {
      actions.push(ann)
    }
  }

  const codeSection = doc.querySelector('code')
  if (codeSection) {
    for (const file of codeSection.querySelectorAll('file')) {
      const filePath = file.getAttribute('path') ?? ''
      files.add(filePath)
      for (const ann of file.querySelectorAll('annotation')) {
        pushAnnotation({
          file: filePath,
          line: ann.getAttribute('line') ?? ann.getAttribute('start') ?? '',
          type: ann.getAttribute('type') ?? '',
          comment: ann.querySelector('comment')?.textContent?.trim() ?? '',
          kind: (ann.getAttribute('kind') as AnnotationKind) ?? 'action',
          source: 'code',
        })
      }
    }
  }

  const convSection = doc.querySelector('conversation')
  if (convSection) {
    for (const ann of convSection.querySelectorAll('annotation')) {
      const isToolCall = ann.getAttribute('type') === 'tool-call'
      pushAnnotation({
        file: '',
        line: '',
        type: isToolCall ? 'tool-call' : 'conversation',
        comment: ann.querySelector('comment')?.textContent?.trim() ?? '',
        kind: (ann.getAttribute('kind') as AnnotationKind) ?? 'action',
        source: isToolCall ? 'tool-call' : 'conversation',
      })
    }
  }

  if (actions.length === 0 && questions.length === 0) return null

  return {
    actions,
    questions,
    additionalContext,
    summary: {
      actions: actions.length,
      questions: questions.length,
      files: files.size,
      conversationAnnotations:
        actions.filter((a) => a.source !== 'code').length +
        questions.filter((a) => a.source !== 'code').length,
    },
  }
}
