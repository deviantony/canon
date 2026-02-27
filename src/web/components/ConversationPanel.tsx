import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AnnotationKind } from '../../shared/types'
import {
  type ConversationAnnotation,
  type ToolCallAnnotation,
  useAnnotations,
} from '../context/AnnotationContext'
import { type ConversationEntry, useSession } from '../context/SessionContext'
import { isAuroreFeedback, type ParsedAnnotation, parseAnnotationXml } from '../utils/annotationXml'
import styles from './ConversationPanel.module.css'

function shortenPath(path: string): string {
  const parts = path.split('/')
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : path
}

// ─── Tool call helpers ───────────────────────────────────────────────────────

function extractToolTarget(entry: ConversationEntry): string {
  if (!entry.toolInput) return ''
  const input = entry.toolInput
  return (
    (input.file_path as string) ??
    (input.path as string) ??
    (input.command as string) ??
    (input.pattern as string) ??
    (input.url as string) ??
    ''
  )
}

function getToolVerb(name: string): string {
  switch (name) {
    case 'Read':
      return 'Read'
    case 'Write':
      return 'Wrote'
    case 'Edit':
      return 'Edited'
    case 'Bash':
      return 'Ran'
    case 'Glob':
      return 'Searched'
    case 'Grep':
      return 'Searched'
    case 'WebFetch':
      return 'Fetched'
    case 'WebSearch':
      return 'Searched'
    default:
      return name
  }
}

function getToolTarget(tool: MergedToolEntry): string {
  if (tool.toolName === 'Bash') return tool.targets[0] ?? 'command'
  if (tool.targets.length > 1)
    return `${tool.targets.length} ${tool.toolName === 'Read' ? 'files' : 'targets'}`
  return tool.targets[0] ? shortenPath(tool.targets[0]) : tool.toolName
}

function getToolLabel(tool: MergedToolEntry): string {
  return `${getToolVerb(tool.toolName)} ${getToolTarget(tool)}`
}

function getStatusInfo(status: 'running' | 'done' | 'error'): { className: string; label: string } {
  switch (status) {
    case 'done':
      return { className: styles.toolBadgeDone, label: 'Done' }
    case 'error':
      return { className: styles.toolBadgeError, label: 'Error' }
    case 'running':
      return { className: styles.toolBadgeRunning, label: 'Running' }
  }
}

// ─── Markdown components ─────────────────────────────────────────────────────

const markdownComponents = {
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  p: ({ children }: any) => <p className={styles.mdP}>{children}</p>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  pre: ({ node, children }: any) => {
    // Extract language from child <code> element's className
    let lang = ''
    const codeChild = node?.children?.[0]
    if (codeChild?.type === 'element' && Array.isArray(codeChild.properties?.className)) {
      const langClass = codeChild.properties.className.find(
        (c: string) => typeof c === 'string' && c.startsWith('language-'),
      )
      if (langClass) lang = langClass.replace('language-', '')
    }
    return (
      <div className={styles.mdCodeBlock}>
        {lang && <div className={styles.mdCodeLang}>{lang}</div>}
        <pre className={styles.mdPre}>{children}</pre>
      </div>
    )
  },
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  code: ({ children }: any) => <code className={styles.mdInlineCode}>{children}</code>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  ul: ({ children }: any) => <ul className={styles.mdList}>{children}</ul>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  ol: ({ children }: any) => <ol className={styles.mdList}>{children}</ol>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  li: ({ children }: any) => <li className={styles.mdLi}>{children}</li>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  strong: ({ children }: any) => <strong className={styles.mdStrong}>{children}</strong>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  h1: ({ children }: any) => <h3 className={styles.mdHeading}>{children}</h3>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  h2: ({ children }: any) => <h3 className={styles.mdHeading}>{children}</h3>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  h3: ({ children }: any) => <h3 className={styles.mdHeading}>{children}</h3>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  blockquote: ({ children }: any) => (
    <blockquote className={styles.mdBlockquote}>{children}</blockquote>
  ),
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  hr: (_props: any) => <hr className={styles.mdHr} />,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  table: ({ children }: any) => (
    <div className={styles.mdTableWrap}>
      <table className={styles.mdTable}>{children}</table>
    </div>
  ),
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  th: ({ children }: any) => <th className={styles.mdTh}>{children}</th>,
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown component props
  td: ({ children }: any) => <td className={styles.mdTd}>{children}</td>,
}

// ─── Merged tool entries ─────────────────────────────────────────────────────

interface MergedToolEntry {
  kind: 'tool'
  id: string
  toolName: string
  targets: string[]
  status: 'running' | 'done' | 'error'
  errorContent?: string
}

function mergeToolEntries(messages: ConversationEntry[]): (ConversationEntry | MergedToolEntry)[] {
  const result: (ConversationEntry | MergedToolEntry)[] = []
  const toolResultMap = new Map<string, ConversationEntry>()

  // Build a map of tool results by their toolId
  for (const entry of messages) {
    if (entry.type === 'tool-result' && entry.toolId) {
      toolResultMap.set(entry.toolId, entry)
    }
  }

  // Group consecutive same-name tool calls
  let i = 0
  while (i < messages.length) {
    const entry = messages[i]

    if (entry.type === 'tool-use') {
      const toolName = entry.toolName ?? 'Unknown'
      const targets: string[] = []
      const toolIds: string[] = []
      let j = i

      // Collect consecutive tool-use entries with the same name
      while (
        j < messages.length &&
        messages[j].type === 'tool-use' &&
        messages[j].toolName === toolName
      ) {
        targets.push(extractToolTarget(messages[j]))
        if (messages[j].toolId) toolIds.push(messages[j].toolId as string)
        j++
      }

      // Skip any tool-result entries that follow (they're merged into the tool row)
      while (j < messages.length && messages[j].type === 'tool-result') {
        j++
      }

      // Determine status from results
      let status: 'running' | 'done' | 'error' = 'running'
      let errorContent: string | undefined
      const hasAllResults = toolIds.every((id) => toolResultMap.has(id))
      if (hasAllResults && toolIds.length > 0) {
        const hasError = toolIds.some((id) => toolResultMap.get(id)?.isError)
        status = hasError ? 'error' : 'done'
        if (hasError) {
          const errResult = toolIds.map((id) => toolResultMap.get(id)).find((r) => r?.isError)
          errorContent = errResult?.content
        }
      }

      result.push({
        kind: 'tool',
        id: entry.id,
        toolName,
        targets: targets.filter(Boolean),
        status,
        errorContent,
      })

      i = j
    } else if (entry.type === 'tool-result') {
      // Skip standalone tool results (already merged above)
      i++
    } else {
      result.push(entry)
      i++
    }
  }

  return result
}

// ─── Annotation widget ───────────────────────────────────────────────────────

interface AnnotationWidgetProps {
  badge: string
  quote?: string
  initialKind?: AnnotationKind
  onSave: (comment: string, kind: AnnotationKind) => void
  onCancel: () => void
}

function AnnotationWidget({
  badge,
  quote,
  initialKind = 'action',
  onSave,
  onCancel,
}: AnnotationWidgetProps) {
  const [comment, setComment] = useState('')
  const [kind, setKind] = useState<AnnotationKind>(initialKind)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (comment.trim()) onSave(comment.trim(), kind)
    } else if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'q' && comment === '' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      setKind((k) => (k === 'action' ? 'question' : 'action'))
    }
  }

  const isQuestion = kind === 'question'

  return (
    <div className={`${styles.annWidget} ${isQuestion ? styles.annWidgetQuestion : ''}`}>
      <div className={styles.annWidgetHead}>
        <button
          type="button"
          className={`${styles.annBadge} ${isQuestion ? styles.annBadgeQuestion : ''}`}
          onClick={() => setKind((k) => (k === 'action' ? 'question' : 'action'))}
        >
          {isQuestion ? '?' : '\u270E'} {badge}
        </button>
      </div>
      {quote && <div className={styles.annQuote}>{quote}</div>}
      <textarea
        ref={textareaRef}
        className={styles.annInput}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isQuestion ? 'Ask a question...' : 'Add your comment...'}
      />
      <div className={styles.annFoot}>
        <span className={styles.annKeys}>
          <kbd>{navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}</kbd>+<kbd>Enter</kbd> save
        </span>
        <div className={styles.annBtns}>
          <button type="button" className={styles.btnCancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnSave}
            onClick={() => comment.trim() && onSave(comment.trim(), kind)}
            disabled={!comment.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Saved annotation card ───────────────────────────────────────────────────

function SavedAnnotationCard({
  annotation,
  onDelete,
}: {
  annotation: ConversationAnnotation | ToolCallAnnotation
  onDelete: (id: string) => void
}) {
  const badge = annotation.target === 'conversation' ? 'CONV' : annotation.toolLabel
  const isQuestion = annotation.kind === 'question'

  return (
    <div className={styles.annSaved}>
      <span className={`${styles.annBadge} ${isQuestion ? styles.annBadgeQuestion : ''}`}>
        {badge}
      </span>
      <span className={styles.annSavedText}>{annotation.comment}</span>
      <div className={styles.annSavedActions}>
        <button
          type="button"
          className={`${styles.annSavedBtn} ${styles.annSavedBtnDel}`}
          onClick={() => onDelete(annotation.id)}
          title="Delete"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}

// ─── Message components ──────────────────────────────────────────────────────

function AnnotationChip({ ann, isQuestion }: { ann: ParsedAnnotation; isQuestion: boolean }) {
  const questionClass = isQuestion ? styles.annotationChipQuestion : ''
  if (ann.source === 'code') {
    return (
      <span className={`${styles.annotationChip} ${styles.annotationFileChip} ${questionClass}`}>
        {shortenPath(ann.file)}:{ann.line}
      </span>
    )
  }
  // Conversation or tool-call annotation
  const label = ann.source === 'tool-call' ? 'Tool' : 'Conv'
  return (
    <span className={`${styles.annotationChip} ${styles.annotationConvChip} ${questionClass}`}>
      {label}
    </span>
  )
}

function AnnotationMessage({ content }: { content: string }) {
  const parsed = parseAnnotationXml(content)
  if (!parsed) {
    return <div className={styles.msgText}>{content}</div>
  }

  const { files, conversationAnnotations } = parsed.summary
  const metaParts: string[] = []
  if (files > 0) metaParts.push(`${files} ${files === 1 ? 'file' : 'files'}`)
  if (conversationAnnotations > 0)
    metaParts.push(
      `${conversationAnnotations} conversation ${conversationAnnotations === 1 ? 'note' : 'notes'}`,
    )

  return (
    <div className={styles.annotationFeedback}>
      <div className={styles.annotationHeader}>
        Review
        {metaParts.length > 0 && (
          <span className={styles.annotationMeta}>{metaParts.join(' \u00B7 ')}</span>
        )}
      </div>

      {parsed.additionalContext && (
        <div className={styles.annotationContext}>{parsed.additionalContext}</div>
      )}

      {parsed.actions.length > 0 && (
        <div className={styles.annotationSection}>
          <div className={styles.annotationSectionLabel}>
            <span className={styles.annotationDot} />
            Actions
            <span className={styles.annotationCount}>{parsed.actions.length}</span>
          </div>
          {parsed.actions.map((a, i) => (
            <div key={`action-${i}-${a.line}-${a.source}`} className={styles.annotationItem}>
              <AnnotationChip ann={a} isQuestion={false} />
              <span className={styles.annotationComment}>{a.comment}</span>
            </div>
          ))}
        </div>
      )}

      {parsed.questions.length > 0 && (
        <div className={`${styles.annotationSection} ${styles.annotationSectionQuestion}`}>
          <div className={styles.annotationSectionLabel}>
            <span className={`${styles.annotationDot} ${styles.annotationDotQuestion}`} />
            Questions
            <span className={`${styles.annotationCount} ${styles.annotationCountQuestion}`}>
              {parsed.questions.length}
            </span>
          </div>
          {parsed.questions.map((q, i) => (
            <div key={`question-${i}-${q.line}-${q.source}`} className={styles.annotationItem}>
              <AnnotationChip ann={q} isQuestion />
              <span className={styles.annotationComment}>{q.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolRow({
  tool,
  onAnnotate,
}: {
  tool: MergedToolEntry
  onAnnotate: (toolId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const verb = getToolVerb(tool.toolName)
  const label = getToolTarget(tool)
  const count = tool.targets.length
  const statusInfo = getStatusInfo(tool.status)

  return (
    <div className={styles.toolRow}>
      <div className={styles.toolRowInner}>
        <button
          type="button"
          className={styles.toolLeftAnn}
          onClick={(e) => {
            e.stopPropagation()
            onAnnotate(tool.id)
          }}
          title="Annotate this tool call"
        >
          &#9998;
        </button>
        <button
          className={styles.toolRowHeader}
          type="button"
          onClick={() => count > 1 && setExpanded(!expanded)}
          style={{ cursor: count > 1 ? 'pointer' : 'default' }}
        >
          <span className={styles.toolVerb}>{verb}</span>
          <span className={styles.toolLabel}>{label}</span>
          {count > 1 && <span className={styles.toolExpand}>{expanded ? '\u25B4' : '\u25BE'}</span>}
          <span className={`${styles.toolBadge} ${statusInfo.className}`}>{statusInfo.label}</span>
        </button>
      </div>

      {expanded && count > 1 && (
        <div className={styles.toolExpandedList}>
          {tool.targets.map((t) => (
            <div key={t} className={styles.toolExpandedItem}>
              {shortenPath(t)}
            </div>
          ))}
        </div>
      )}

      {tool.status === 'error' && tool.errorContent && (
        <div className={styles.toolErrorContent}>
          {tool.errorContent.slice(0, 200)}
          {tool.errorContent.length > 200 ? '...' : ''}
        </div>
      )}
    </div>
  )
}

const remarkPlugins = [remarkGfm]

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
      {content}
    </Markdown>
  )
})

// ─── Selection toolbar ───────────────────────────────────────────────────────

function SelectionToolbar({
  convRef,
  onAnnotate,
}: {
  convRef: React.RefObject<HTMLDivElement | null>
  onAnnotate: (quote: string, kind: AnnotationKind, messageId: string) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const selDataRef = useRef<{ quote: string; messageId: string } | null>(null)

  const position = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !convRef.current || !barRef.current) {
      setVisible(false)
      return
    }

    // Check selection is inside an annotatable message body
    const range = sel.getRangeAt(0)
    const msgBody = (range.commonAncestorContainer as Element).closest
      ? (range.commonAncestorContainer as Element).closest(`.${styles.mdContent}`)
      : range.commonAncestorContainer.parentElement?.closest(`.${styles.mdContent}`)
    if (!msgBody) {
      setVisible(false)
      return
    }

    // Walk up to find the message container with data-message-id
    const msgEl = msgBody.closest(`[data-message-id]`)
    if (!msgEl) {
      setVisible(false)
      return
    }

    const quote = sel.toString().trim()
    if (!quote) {
      setVisible(false)
      return
    }

    const messageId = msgEl.getAttribute('data-message-id') as string
    selDataRef.current = { quote, messageId }

    const rects = range.getClientRects()
    const firstRect = rects[0]
    const convRect = convRef.current.getBoundingClientRect()

    const bar = barRef.current
    bar.style.left = `${firstRect.left - convRect.left + firstRect.width / 2}px`
    bar.style.top = `${firstRect.top - convRect.top - 36}px`
    setVisible(true)
  }, [convRef])

  useEffect(() => {
    document.addEventListener('mouseup', position)
    return () => document.removeEventListener('mouseup', position)
  }, [position])

  // Hide on scroll
  useEffect(() => {
    const el = convRef.current?.closest(`.${styles.panel}`)
    if (!el) return
    const hide = () => setVisible(false)
    el.addEventListener('scroll', hide, { passive: true })
    return () => el.removeEventListener('scroll', hide)
  }, [convRef])

  function handleClick(kind: AnnotationKind) {
    if (!selDataRef.current) return
    const { quote, messageId } = selDataRef.current
    window.getSelection()?.removeAllRanges()
    setVisible(false)
    onAnnotate(quote, kind, messageId)
  }

  return (
    <div ref={barRef} className={`${styles.selBar} ${visible ? styles.selBarShow : ''}`}>
      <button type="button" className={styles.selBtn} onClick={() => handleClick('action')}>
        <span className={`${styles.selIco} ${styles.selIcoGold}`}>&#9998;</span> Annotate
      </button>
      <div className={styles.selSep} />
      <button type="button" className={styles.selBtn} onClick={() => handleClick('question')}>
        <span className={`${styles.selIco} ${styles.selIcoBlue}`}>?</span> Question
      </button>
    </div>
  )
}

// ─── Message entry with annotation support ───────────────────────────────────

type OpenWidget =
  | { type: 'msg'; id: string; quote?: string; kind?: AnnotationKind }
  | { type: 'tool'; id: string }

function MessageEntry({
  entry,
  openWidget,
  onOpenWidget,
  onCloseWidget,
  onToolAnnotate,
}: {
  entry: ConversationEntry | MergedToolEntry
  openWidget: OpenWidget | null
  onOpenWidget: (id: string) => void
  onCloseWidget: () => void
  onToolAnnotate: (toolId: string) => void
}) {
  const {
    addConversationAnnotation,
    addToolCallAnnotation,
    getAnnotationsForMessage,
    removeAnnotation,
  } = useAnnotations()

  if ('kind' in entry && entry.kind === 'tool') {
    const toolAnnotations = getAnnotationsForMessage(entry.id)
    const showToolWidget = openWidget?.type === 'tool' && openWidget.id === entry.id

    return (
      <>
        <ToolRow tool={entry} onAnnotate={onToolAnnotate} />
        {showToolWidget && (
          <div className={styles.annSlot}>
            <AnnotationWidget
              badge={getToolLabel(entry)}
              onSave={(comment, kind) => {
                addToolCallAnnotation(entry.id, getToolLabel(entry), comment, kind)
                onCloseWidget()
              }}
              onCancel={onCloseWidget}
            />
          </div>
        )}
        {toolAnnotations.map((ann) => (
          <div key={ann.id} className={styles.annSlot}>
            <SavedAnnotationCard annotation={ann} onDelete={removeAnnotation} />
          </div>
        ))}
      </>
    )
  }

  const msg = entry as ConversationEntry

  switch (msg.type) {
    case 'user-prompt': {
      const isAnnotation = isAuroreFeedback(msg.content)
      return (
        <div className={styles.msg}>
          <div className={`${styles.msgRole} ${styles.roleUser}`}>You</div>
          {isAnnotation ? (
            <AnnotationMessage content={msg.content} />
          ) : (
            <div className={styles.msgText}>{msg.content}</div>
          )}
        </div>
      )
    }

    case 'assistant': {
      const messageAnnotations = getAnnotationsForMessage(msg.id)
      const isThisMsg = openWidget?.type === 'msg' && openWidget.id === msg.id
      const showWidget = isThisMsg && !openWidget.quote
      const showQuoteWidget = isThisMsg && !!openWidget.quote
      const widgetQuote = isThisMsg ? openWidget.quote : undefined
      const widgetKind = isThisMsg ? (openWidget.kind ?? 'action') : 'action'

      return (
        <div className={`${styles.msg} ${styles.msgAnnotatable}`} data-message-id={msg.id}>
          <div className={`${styles.msgRole} ${styles.roleAssistant}`}>
            Claude
            <button
              type="button"
              className={styles.roleAnn}
              title="Annotate this message"
              onClick={() => onOpenWidget(msg.id)}
            >
              &#9998;
            </button>
          </div>
          <div className={styles.mdContent}>
            <MarkdownContent content={msg.content} />
          </div>
          {(showWidget || showQuoteWidget) && (
            <div className={styles.annSlot}>
              <AnnotationWidget
                badge="CONV"
                quote={widgetQuote}
                initialKind={showQuoteWidget ? widgetKind : 'action'}
                onSave={(comment, kind) => {
                  addConversationAnnotation(msg.id, comment, widgetQuote, kind)
                  onCloseWidget()
                }}
                onCancel={onCloseWidget}
              />
            </div>
          )}
          {messageAnnotations.map((ann) => (
            <div key={ann.id} className={styles.annSlot}>
              <SavedAnnotationCard annotation={ann} onDelete={removeAnnotation} />
            </div>
          ))}
        </div>
      )
    }

    case 'result':
      return (
        <div className={styles.resultSummary}>
          {msg.numTurns != null && <span className={styles.resultMeta}>{msg.numTurns} turns</span>}
          {msg.durationMs != null && (
            <span className={styles.resultMeta}>{(msg.durationMs / 1000).toFixed(1)}s</span>
          )}
          {msg.costUsd != null && (
            <span className={styles.resultMeta}>${msg.costUsd.toFixed(4)}</span>
          )}
        </div>
      )

    case 'error':
      return (
        <div className={styles.msg}>
          <div className={`${styles.msgRole} ${styles.roleError}`}>Error</div>
          <div className={styles.msgText}>{msg.content}</div>
        </div>
      )

    default:
      return null
  }
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function ConversationPanel() {
  const { messages, streamingText, sessionInfo } = useSession()
  const scrollRef = useRef<HTMLDivElement>(null)
  const convRef = useRef<HTMLDivElement>(null)
  const [openWidget, setOpenWidget] = useState<OpenWidget | null>(null)

  const merged = useMemo(() => mergeToolEntries(messages), [messages])

  // Auto-scroll to bottom when messages or streaming text change
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingText used as triggers
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, streamingText])

  const handleOpenWidget = useCallback((id: string) => {
    setOpenWidget({ type: 'msg', id })
  }, [])

  const handleCloseWidget = useCallback(() => {
    setOpenWidget(null)
  }, [])

  const handleToolAnnotate = useCallback((toolId: string) => {
    setOpenWidget({ type: 'tool', id: toolId })
  }, [])

  const handleSelectionAnnotate = useCallback(
    (quote: string, kind: AnnotationKind, messageId: string) => {
      setOpenWidget({ type: 'msg', id: messageId, quote, kind })
    },
    [],
  )

  if (!sessionInfo && messages.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Start a session to begin</div>
      </div>
    )
  }

  const isStarting = sessionInfo?.state === 'starting'
  const isProcessing = sessionInfo?.state === 'processing'
  const showWaiting = (isStarting || isProcessing) && !streamingText

  return (
    <div className={styles.panel} ref={scrollRef}>
      <div className={styles.centered} ref={convRef}>
        <SelectionToolbar convRef={convRef} onAnnotate={handleSelectionAnnotate} />
        {merged.map((entry) => (
          <MessageEntry
            key={entry.id}
            entry={entry}
            openWidget={openWidget}
            onOpenWidget={handleOpenWidget}
            onCloseWidget={handleCloseWidget}
            onToolAnnotate={handleToolAnnotate}
          />
        ))}
        {streamingText && (
          <div className={styles.msg}>
            <div className={`${styles.msgRole} ${styles.roleAssistant}`}>Claude</div>
            <div className={styles.mdContent}>
              <MarkdownContent content={streamingText} />
            </div>
          </div>
        )}
        {showWaiting && (
          <div className={styles.waiting}>
            <span className={styles.waitingDot} />
            {isStarting ? 'Starting session...' : 'Thinking...'}
          </div>
        )}
      </div>
    </div>
  )
}
