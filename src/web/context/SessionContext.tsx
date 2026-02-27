import { createContext, type ReactNode, useCallback, useContext, useReducer } from 'react'
import type { ClaudeMessage, ServerMessage, SessionInfo } from '../../shared/ide-types'
import { useSessionSocket } from '../hooks/useSessionSocket'

// Message types visible in the conversation log
type ConversationEntryType =
  | 'user-prompt'
  | 'assistant'
  | 'tool-use'
  | 'tool-result'
  | 'result'
  | 'error'

export interface ConversationEntry {
  id: string
  type: ConversationEntryType
  content: string
  timestamp: number
  // For tool-use entries
  toolName?: string
  toolInput?: Record<string, unknown>
  toolId?: string
  // For tool-result entries
  isError?: boolean
  // For result entries
  costUsd?: number
  durationMs?: number
  numTurns?: number
}

export interface SessionContextState {
  sessionInfo: SessionInfo | null
  messages: ConversationEntry[]
  streamingText: string
}

type SessionAction =
  | { type: 'session:state'; info: SessionInfo }
  | { type: 'claude:message'; message: ClaudeMessage }
  | { type: 'user-prompt'; prompt: string }
  | { type: 'error'; message: string }

export function sessionReducer(
  state: SessionContextState,
  action: SessionAction,
): SessionContextState {
  switch (action.type) {
    case 'session:state':
      return { ...state, sessionInfo: action.info }

    case 'user-prompt':
      return {
        ...state,
        // Optimistic: set state to processing so dot pulses immediately
        sessionInfo: state.sessionInfo
          ? { ...state.sessionInfo, state: 'processing' }
          : state.sessionInfo,
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            type: 'user-prompt',
            content: action.prompt,
            timestamp: Date.now(),
          },
        ],
      }

    case 'claude:message':
      return processClaudeMessage(state, action.message)

    case 'error':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            type: 'error',
            content: action.message,
            timestamp: Date.now(),
          },
        ],
      }

    default:
      return state
  }
}

export function processClaudeMessage(
  state: SessionContextState,
  msg: ClaudeMessage,
): SessionContextState {
  switch (msg.type) {
    case 'system':
      // System init messages update session info only — don't clutter conversation
      return state

    case 'stream_event': {
      const evt = msg.event
      if (
        evt.type === 'content_block_delta' &&
        evt.delta?.type === 'text_delta' &&
        evt.delta.text
      ) {
        // Append text delta to streaming display
        return { ...state, streamingText: state.streamingText + evt.delta.text }
      }
      // Ignore thinking_delta, input_json_delta, and lifecycle events
      return state
    }

    case 'assistant': {
      // The assistant message is a final snapshot after stream_event deltas.
      // Flush accumulated streamingText as an assistant entry, then commit tool-use blocks.
      const blocks = msg.message.content
      const committed: ConversationEntry[] = []

      // Prefer streamed text, but fall back to text from content blocks
      // (handles cases where stream_event deltas are absent or format changed)
      let text = state.streamingText.trim()
      if (!text) {
        text = blocks
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('\n\n')
          .trim()
      }
      if (text) {
        committed.push({
          id: crypto.randomUUID(),
          type: 'assistant',
          content: text,
          timestamp: Date.now(),
        })
      }

      // Commit tool-use blocks from the snapshot
      for (const block of blocks) {
        if (block.type === 'tool_use') {
          committed.push({
            id: crypto.randomUUID(),
            type: 'tool-use',
            content: block.name,
            toolName: block.name,
            toolId: block.id,
            toolInput: block.input,
            timestamp: Date.now(),
          })
        }
      }

      return {
        ...state,
        streamingText: '',
        messages: committed.length > 0 ? [...state.messages, ...committed] : state.messages,
      }
    }

    case 'user': {
      // Tool results from the subprocess
      const blocks = msg.message.content
      const newMessages: ConversationEntry[] = []
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          newMessages.push({
            id: crypto.randomUUID(),
            type: 'tool-result',
            content: block.content,
            toolId: block.tool_use_id,
            isError: block.is_error,
            timestamp: Date.now(),
          })
        }
      }
      if (newMessages.length > 0) {
        return { ...state, messages: [...state.messages, ...newMessages] }
      }
      return state
    }

    case 'result': {
      // Safety net: flush orphaned streamingText that wasn't committed by an assistant message.
      // This can happen if the stream is interrupted or the assistant message is dropped.
      const flushed: ConversationEntry[] = []
      if (state.streamingText) {
        flushed.push({
          id: crypto.randomUUID(),
          type: 'assistant',
          content: state.streamingText,
          timestamp: Date.now(),
        })
      }
      flushed.push({
        id: crypto.randomUUID(),
        type: 'result',
        content: msg.result ?? (msg.is_error ? (msg.error ?? 'Unknown error') : 'Completed'),
        costUsd: msg.total_cost_usd,
        durationMs: msg.duration_ms,
        numTurns: msg.num_turns,
        timestamp: Date.now(),
      })
      return {
        ...state,
        streamingText: '',
        messages: [...state.messages, ...flushed],
      }
    }

    default:
      return state
  }
}

interface SessionContextValue {
  sessionInfo: SessionInfo | null
  messages: ConversationEntry[]
  streamingText: string
  startSession: (prompt: string) => void
  sendPrompt: (prompt: string) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const initialState: SessionContextState = {
  sessionInfo: null,
  messages: [],
  streamingText: '',
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState)

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'claude:stderr') {
      console.debug('[claude:stderr]', msg.text)
      return
    }
    // All other ServerMessage types map directly to SessionAction types
    dispatch(msg as SessionAction)
  }, [])

  const { send } = useSessionSocket({
    onMessage: handleServerMessage,
  })

  const startSession = useCallback(
    (prompt: string) => {
      dispatch({ type: 'user-prompt', prompt })
      send({ type: 'session:start', prompt })
    },
    [send],
  )

  const sendPrompt = useCallback(
    (prompt: string) => {
      dispatch({ type: 'user-prompt', prompt })
      send({ type: 'session:prompt', prompt })
    },
    [send],
  )

  return (
    <SessionContext.Provider
      value={{
        sessionInfo: state.sessionInfo,
        messages: state.messages,
        streamingText: state.streamingText,
        startSession,
        sendPrompt,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
