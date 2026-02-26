import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { type ConversationEntry, useSession } from '../context/SessionContext'
import styles from './ConversationPanel.module.css'

// ─── XML annotation parser ───────────────────────────────────────────────────

interface ParsedAnnotation {
  file: string
  line: string
  type: string
  comment: string
}

interface ParsedFeedback {
  actions: ParsedAnnotation[]
  questions: ParsedAnnotation[]
  additionalContext: string
  summary: { actions: number; questions: number; files: number }
}

function parseAnnotationXml(fullContent: string): ParsedFeedback | null {
  if (!fullContent.includes('<code-review-feedback>')) return null

  const xmlEndIdx = fullContent.indexOf('</code-review-feedback>')
  const xml =
    xmlEndIdx > -1
      ? fullContent.slice(0, xmlEndIdx + '</code-review-feedback>'.length)
      : fullContent
  const additionalContext =
    xmlEndIdx > -1 ? fullContent.slice(xmlEndIdx + '</code-review-feedback>'.length).trim() : ''

  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return null

  const actions: ParsedAnnotation[] = []
  const questions: ParsedAnnotation[] = []
  const files = new Set<string>()

  function parseSection(sectionName: string, target: ParsedAnnotation[]) {
    const section = doc.querySelector(sectionName)
    if (!section) return
    for (const file of section.querySelectorAll('file')) {
      const filePath = file.getAttribute('path') ?? ''
      files.add(filePath)
      for (const ann of file.querySelectorAll('annotation')) {
        target.push({
          file: filePath,
          line: ann.getAttribute('line') ?? '',
          type: ann.getAttribute('type') ?? '',
          comment: ann.querySelector('comment')?.textContent?.trim() ?? '',
        })
      }
    }
  }

  parseSection('actions', actions)
  parseSection('questions', questions)

  if (actions.length === 0 && questions.length === 0) return null

  return {
    actions,
    questions,
    additionalContext,
    summary: { actions: actions.length, questions: questions.length, files: files.size },
  }
}

function shortenPath(path: string): string {
  const parts = path.split('/')
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : path
}

// ─── Tool call helpers ───────────────────────────────────────────────────────

function getToolTarget(entry: ConversationEntry): string {
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
        targets.push(getToolTarget(messages[j]))
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

// ─── Message components ──────────────────────────────────────────────────────

function AnnotationMessage({ content }: { content: string }) {
  const parsed = parseAnnotationXml(content)
  if (!parsed) {
    return <div className={styles.msgText}>{content}</div>
  }

  return (
    <div className={styles.annotationFeedback}>
      <div className={styles.annotationHeader}>
        Review
        <span className={styles.annotationMeta}>
          {parsed.summary.files} {parsed.summary.files === 1 ? 'file' : 'files'}
        </span>
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
            <div key={`action-${i}-${a.line}`} className={styles.annotationItem}>
              <span className={styles.annotationFileChip}>
                {shortenPath(a.file)}:{a.line}
              </span>
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
            <div key={`question-${i}-${q.line}`} className={styles.annotationItem}>
              <span className={`${styles.annotationFileChip} ${styles.annotationFileChipQuestion}`}>
                {shortenPath(q.file)}:{q.line}
              </span>
              <span className={styles.annotationComment}>{q.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolRow({ tool }: { tool: MergedToolEntry }) {
  const [expanded, setExpanded] = useState(false)
  const verb = getToolVerb(tool.toolName)
  const count = tool.targets.length

  let label: string
  if (tool.toolName === 'Bash') {
    label = tool.targets[0] ?? 'command'
  } else if (count > 1) {
    label = `${count} ${tool.toolName === 'Read' ? 'files' : 'targets'}`
  } else {
    label = tool.targets[0] ? shortenPath(tool.targets[0]) : ''
  }

  return (
    <div className={styles.toolRow}>
      <button
        className={styles.toolRowHeader}
        type="button"
        onClick={() => count > 1 && setExpanded(!expanded)}
        style={{ cursor: count > 1 ? 'pointer' : 'default' }}
      >
        <span className={styles.toolVerb}>{verb}</span>
        <span className={styles.toolLabel}>{label}</span>
        {count > 1 && <span className={styles.toolExpand}>{expanded ? '\u25B4' : '\u25BE'}</span>}
        <span
          className={`${styles.toolBadge} ${
            tool.status === 'done'
              ? styles.toolBadgeDone
              : tool.status === 'error'
                ? styles.toolBadgeError
                : styles.toolBadgeRunning
          }`}
        >
          {tool.status === 'done' ? 'Done' : tool.status === 'error' ? 'Error' : 'Running'}
        </span>
      </button>

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

function MessageEntry({ entry }: { entry: ConversationEntry | MergedToolEntry }) {
  if ('kind' in entry && entry.kind === 'tool') {
    return <ToolRow tool={entry} />
  }

  const msg = entry as ConversationEntry

  switch (msg.type) {
    case 'user-prompt': {
      const isAnnotation = msg.content.includes('<code-review-feedback>')
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

    case 'assistant':
      return (
        <div className={styles.msg}>
          <div className={`${styles.msgRole} ${styles.roleAssistant}`}>Claude</div>
          <div className={styles.mdContent}>
            <MarkdownContent content={msg.content} />
          </div>
        </div>
      )

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

  const merged = useMemo(() => mergeToolEntries(messages), [messages])

  // Auto-scroll to bottom when messages or streaming text change
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingText used as triggers
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, streamingText])

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
      <div className={styles.centered}>
        {merged.map((entry) => (
          <MessageEntry key={entry.id} entry={entry} />
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
