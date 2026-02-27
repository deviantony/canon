import { describe, expect, it } from 'bun:test'
import type {
  ClaudeAssistantMessage,
  ClaudeResultMessage,
  ClaudeStreamEvent,
  ClaudeSystemMessage,
  ClaudeUserMessage,
  SessionInfo,
} from '../../shared/ide-types'
import {
  processClaudeMessage,
  type SessionContextState,
  sessionReducer,
} from '../context/SessionContext'

// -- Helpers --

function emptyState(): SessionContextState {
  return { sessionInfo: null, messages: [], streamingText: '' }
}

function stateWithInfo(overrides?: Partial<SessionInfo>): SessionContextState {
  return {
    ...emptyState(),
    sessionInfo: {
      sessionId: 'sess-1',
      state: 'ready',
      model: 'claude-sonnet-4-6',
      numTurns: 0,
      error: null,
      ...overrides,
    },
  }
}

function textDelta(text: string): ClaudeStreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    },
    session_id: 'sess-1',
    parent_tool_use_id: null,
  }
}

function assistantSnapshot(
  content: ClaudeAssistantMessage['message']['content'],
): ClaudeAssistantMessage {
  return {
    type: 'assistant',
    message: { role: 'assistant', content, stop_reason: 'end_turn' },
    session_id: 'sess-1',
  }
}

function resultSuccess(overrides?: Partial<ClaudeResultMessage>): ClaudeResultMessage {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 1234,
    duration_api_ms: 1000,
    num_turns: 1,
    session_id: 'sess-1',
    total_cost_usd: 0.05,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    result: 'Done',
    ...overrides,
  }
}

function resultError(error?: string): ClaudeResultMessage {
  return {
    ...resultSuccess(),
    subtype: 'error',
    is_error: true,
    result: undefined,
    error,
  }
}

function userToolResult(toolUseId: string, content: string, isError = false): ClaudeUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
    },
    session_id: 'sess-1',
  }
}

// -- Tests --

describe('processClaudeMessage', () => {
  describe('streaming accumulation & flush', () => {
    it('accumulates text deltas from stream_event into streamingText', () => {
      let state = emptyState()
      state = processClaudeMessage(state, textDelta('Hello'))
      state = processClaudeMessage(state, textDelta(' world'))
      expect(state.streamingText).toBe('Hello world')
      expect(state.messages).toHaveLength(0)
    })

    it('flushes streamingText into a permanent assistant entry on assistant message', () => {
      let state = emptyState()
      state = processClaudeMessage(state, textDelta('Hello world'))
      state = processClaudeMessage(
        state,
        assistantSnapshot([{ type: 'text', text: 'Hello world' }]),
      )
      expect(state.streamingText).toBe('')
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].type).toBe('assistant')
      expect(state.messages[0].content).toBe('Hello world')
    })

    it('commits only streamingText content, ignoring snapshot text blocks', () => {
      let state = emptyState()
      // Stream partial text
      state = processClaudeMessage(state, textDelta('streamed'))
      // Snapshot has different text (this is the full text, but we use streamed version)
      state = processClaudeMessage(
        state,
        assistantSnapshot([{ type: 'text', text: 'snapshot text differs' }]),
      )
      // The committed content should be the streamed text, not the snapshot
      expect(state.messages[0].content).toBe('streamed')
    })

    it('falls back to content blocks when no stream_event deltas arrived', () => {
      const state = emptyState() // no streamingText
      const result = processClaudeMessage(
        state,
        assistantSnapshot([{ type: 'text', text: 'Hello! How can I help?' }]),
      )
      expect(result.streamingText).toBe('')
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('assistant')
      expect(result.messages[0].content).toBe('Hello! How can I help?')
    })

    it('falls back to content blocks joining multiple text blocks', () => {
      const state = emptyState()
      const result = processClaudeMessage(
        state,
        assistantSnapshot([
          { type: 'text', text: 'First paragraph.' },
          { type: 'text', text: 'Second paragraph.' },
        ]),
      )
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content).toBe('First paragraph.\n\nSecond paragraph.')
    })

    it('falls back to content blocks with mixed text and tool_use', () => {
      const state = emptyState()
      const result = processClaudeMessage(
        state,
        assistantSnapshot([
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tu-1', name: 'Read', input: { path: '/a.ts' } },
        ]),
      )
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].type).toBe('assistant')
      expect(result.messages[0].content).toBe('Let me check.')
      expect(result.messages[1].type).toBe('tool-use')
    })

    it('flushes orphaned streamingText on result when assistant is absent', () => {
      let state = emptyState()
      state = processClaudeMessage(state, textDelta('orphaned'))
      // No assistant message — result acts as fallback flush
      state = processClaudeMessage(state, resultSuccess())
      // Should have flushed assistant + result entries
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0].type).toBe('assistant')
      expect(state.messages[0].content).toBe('orphaned')
      expect(state.messages[1].type).toBe('result')
    })

    it('does not create empty assistant entry when result has no leftover streamingText', () => {
      let state = emptyState()
      // No streaming text accumulated
      state = processClaudeMessage(state, resultSuccess())
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].type).toBe('result')
    })
  })

  describe('message type processing', () => {
    it('system message — state unchanged', () => {
      const systemMsg: ClaudeSystemMessage = {
        type: 'system',
        subtype: 'init',
        session_id: 'sess-1',
        model: 'claude-sonnet-4-6',
      }
      const before = emptyState()
      const after = processClaudeMessage(before, systemMsg)
      expect(after).toBe(before) // reference equality — no change
    })

    it('assistant with only tool_use blocks produces tool-use entries, no assistant entry', () => {
      const state = emptyState() // no streamingText
      const result = processClaudeMessage(
        state,
        assistantSnapshot([
          { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: '/tmp' } },
        ]),
      )
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('tool-use')
      expect(result.messages[0].toolName).toBe('Read')
      expect(result.messages[0].toolId).toBe('tool-1')
    })

    it('assistant with text + tool_use produces both entry types', () => {
      let state = emptyState()
      state = processClaudeMessage(state, textDelta('Let me read that file.'))
      state = processClaudeMessage(
        state,
        assistantSnapshot([
          { type: 'text', text: 'Let me read that file.' },
          { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: '/a.ts' } },
        ]),
      )
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0].type).toBe('assistant')
      expect(state.messages[1].type).toBe('tool-use')
    })

    it('user with tool_result blocks produces tool-result entries', () => {
      const state = emptyState()
      const result = processClaudeMessage(state, userToolResult('tool-1', 'file contents'))
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('tool-result')
      expect(result.messages[0].content).toBe('file contents')
      expect(result.messages[0].toolId).toBe('tool-1')
    })

    it('user with only text blocks — state unchanged', () => {
      const userTextMsg: ClaudeUserMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'some context' }],
        },
        session_id: 'sess-1',
      }
      const before = emptyState()
      const after = processClaudeMessage(before, userTextMsg)
      expect(after).toBe(before)
    })

    it('result success — adds result entry with cost/duration/turns', () => {
      const state = emptyState()
      const result = processClaudeMessage(
        state,
        resultSuccess({ total_cost_usd: 0.12, duration_ms: 5000, num_turns: 3 }),
      )
      const entry = result.messages[0]
      expect(entry.type).toBe('result')
      expect(entry.costUsd).toBe(0.12)
      expect(entry.durationMs).toBe(5000)
      expect(entry.numTurns).toBe(3)
    })

    it('result error — result entry content contains error message', () => {
      const state = emptyState()
      const result = processClaudeMessage(state, resultError('Rate limit exceeded'))
      const entry = result.messages[0]
      expect(entry.type).toBe('result')
      expect(entry.content).toBe('Rate limit exceeded')
    })

    it('rate_limit_event — state unchanged', () => {
      const before = emptyState()
      const after = processClaudeMessage(before, {
        type: 'rate_limit_event',
      })
      expect(after).toBe(before)
    })
  })
})

describe('sessionReducer', () => {
  describe('reducer actions', () => {
    it('session:state — replaces sessionInfo', () => {
      const info: SessionInfo = {
        sessionId: 'sess-2',
        state: 'processing',
        model: 'claude-sonnet-4-6',
        numTurns: 1,
        error: null,
      }
      const result = sessionReducer(emptyState(), { type: 'session:state', info })
      expect(result.sessionInfo).toEqual(info)
    })

    it('user-prompt — appends user-prompt entry and sets state to processing', () => {
      const state = stateWithInfo({ state: 'ready' })
      const result = sessionReducer(state, { type: 'user-prompt', prompt: 'Fix the bug' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('user-prompt')
      expect(result.messages[0].content).toBe('Fix the bug')
      expect(result.sessionInfo?.state).toBe('processing')
    })

    it('user-prompt when sessionInfo is null — appends entry, sessionInfo stays null', () => {
      const state = emptyState()
      const result = sessionReducer(state, { type: 'user-prompt', prompt: 'Hello' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('user-prompt')
      expect(result.sessionInfo).toBeNull()
    })

    it('error — appends error entry', () => {
      const state = emptyState()
      const result = sessionReducer(state, { type: 'error', message: 'Connection lost' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].type).toBe('error')
      expect(result.messages[0].content).toBe('Connection lost')
    })
  })

  describe('integration scenario', () => {
    it('full turn without streaming: assistant → result (Claude Code ≥2.1.59)', () => {
      let state = stateWithInfo()

      // User sends prompt
      state = sessionReducer(state, { type: 'user-prompt', prompt: 'hello' })
      expect(state.messages).toHaveLength(1)

      // No stream_event deltas — assistant arrives directly with text in content blocks
      state = sessionReducer(state, {
        type: 'claude:message',
        message: assistantSnapshot([{ type: 'text', text: 'Hello! How can I help you today?' }]),
      })
      expect(state.streamingText).toBe('')
      expect(state.messages).toHaveLength(2)
      expect(state.messages[1].type).toBe('assistant')
      expect(state.messages[1].content).toBe('Hello! How can I help you today?')

      // Result wraps up
      state = sessionReducer(state, {
        type: 'claude:message',
        message: resultSuccess({ num_turns: 1 }),
      })
      expect(state.messages).toHaveLength(3)
      expect(state.messages[2].type).toBe('result')
    })

    it('full turn: stream deltas → assistant → user tool results → result', () => {
      let state = stateWithInfo()

      // User sends prompt
      state = sessionReducer(state, { type: 'user-prompt', prompt: 'Read file.ts' })
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].type).toBe('user-prompt')

      // Stream deltas arrive
      state = sessionReducer(state, { type: 'claude:message', message: textDelta('Let me ') })
      state = sessionReducer(state, {
        type: 'claude:message',
        message: textDelta('read that.'),
      })
      expect(state.streamingText).toBe('Let me read that.')

      // Assistant snapshot flushes + adds tool use
      state = sessionReducer(state, {
        type: 'claude:message',
        message: assistantSnapshot([
          { type: 'text', text: 'Let me read that.' },
          { type: 'tool_use', id: 'tu-1', name: 'Read', input: { path: 'file.ts' } },
        ]),
      })
      expect(state.streamingText).toBe('')
      // user-prompt + assistant + tool-use = 3
      expect(state.messages).toHaveLength(3)
      expect(state.messages[1].type).toBe('assistant')
      expect(state.messages[2].type).toBe('tool-use')

      // User tool result arrives
      state = sessionReducer(state, {
        type: 'claude:message',
        message: userToolResult('tu-1', 'const x = 1'),
      })
      expect(state.messages).toHaveLength(4)
      expect(state.messages[3].type).toBe('tool-result')

      // Result wraps up the turn
      state = sessionReducer(state, {
        type: 'claude:message',
        message: resultSuccess({ num_turns: 1, total_cost_usd: 0.03 }),
      })
      expect(state.messages).toHaveLength(5)
      expect(state.messages[4].type).toBe('result')
      expect(state.messages[4].costUsd).toBe(0.03)
    })
  })
})
