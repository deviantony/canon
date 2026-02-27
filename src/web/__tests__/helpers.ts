import type {
  CodeAnnotation,
  ConversationAnnotation,
  ToolCallAnnotation,
} from '../context/AnnotationContext'

export function codeAnn(overrides: Partial<CodeAnnotation> = {}): CodeAnnotation {
  return {
    id: 'ann-1',
    target: 'code',
    file: 'src/index.ts',
    lineStart: 10,
    comment: 'Fix this',
    kind: 'action',
    ...overrides,
  }
}

export function convAnn(overrides: Partial<ConversationAnnotation> = {}): ConversationAnnotation {
  return {
    id: 'conv-1',
    target: 'conversation',
    messageId: 'msg-1',
    comment: 'Why?',
    kind: 'question',
    ...overrides,
  }
}

export function toolAnn(overrides: Partial<ToolCallAnnotation> = {}): ToolCallAnnotation {
  return {
    id: 'tool-1',
    target: 'tool-call',
    toolUseId: 'tu-1',
    toolLabel: 'Write index.ts',
    comment: 'Should use const',
    kind: 'action',
    ...overrides,
  }
}
