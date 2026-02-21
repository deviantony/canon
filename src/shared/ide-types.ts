// Shared types for the Canon IDE WebSocket protocol

// -- Claude Code stream-json message types --

export interface ClaudeSystemMessage {
  type: 'system'
  subtype: 'init'
  session_id: string
  tools: string[]
  mcp_servers: { name: string; status: string }[]
  model: string
  cwd: string
  permission_mode: string
}

export interface ClaudeRateLimitEvent {
  type: 'rate_limit_event'
  retry_after: number
}

export interface ClaudeStreamEvent {
  type: 'stream_event'
  event: string
  data: Record<string, unknown>
}

export interface ClaudeAssistantMessage {
  type: 'assistant'
  message: {
    role: 'assistant'
    content: AssistantContentBlock[]
    model?: string
    stop_reason?: string | null
  }
  session_id: string
}

export type AssistantContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'thinking'; thinking: string }

export interface ClaudeUserMessage {
  type: 'user'
  message: {
    role: 'user'
    content: UserContentBlock[]
  }
  session_id: string
}

export type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ClaudeResultMessage {
  type: 'result'
  subtype: 'success' | 'error' | 'error_max_turns'
  is_error: boolean
  duration_ms: number
  duration_api_ms: number
  num_turns: number
  session_id: string
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    cache_creation_input_tokens: number
  }
  result?: string
  error?: string
}

export type ClaudeMessage =
  | ClaudeSystemMessage
  | ClaudeRateLimitEvent
  | ClaudeStreamEvent
  | ClaudeAssistantMessage
  | ClaudeUserMessage
  | ClaudeResultMessage

// -- Session state --

export type SessionState = 'starting' | 'ready' | 'processing' | 'error' | 'exited'

export interface SessionInfo {
  sessionId: string | null
  state: SessionState
  model: string | null
  numTurns: number
  error: string | null
}

// -- WebSocket protocol --

export type ServerMessage =
  | { type: 'session:state'; info: SessionInfo }
  | { type: 'claude:message'; message: ClaudeMessage }
  | { type: 'claude:stderr'; text: string }
  | { type: 'error'; message: string }

export type ClientMessage =
  | { type: 'session:start'; prompt: string; workingDirectory?: string }
  | { type: 'session:prompt'; prompt: string }
  | { type: 'session:resume'; sessionId: string; prompt?: string }
