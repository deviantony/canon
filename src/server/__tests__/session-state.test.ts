import { describe, expect, it } from 'bun:test'
import type {
  ClaudeAssistantMessage,
  ClaudeResultMessage,
  ClaudeStreamEvent,
  ClaudeSystemMessage,
  SessionInfo,
} from '../../shared/ide-types'
import { applySessionMessage } from '../session'

// -- Helpers --

function initialSnapshot(overrides?: Partial<SessionInfo>): SessionInfo {
  return {
    state: 'starting',
    sessionId: null,
    model: null,
    numTurns: 0,
    error: null,
    ...overrides,
  }
}

const systemInit: ClaudeSystemMessage = {
  type: 'system',
  subtype: 'init',
  session_id: 'sess-abc',
  model: 'claude-sonnet-4-6',
}

const streamEvent: ClaudeStreamEvent = {
  type: 'stream_event',
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
  session_id: 'sess-abc',
  parent_tool_use_id: null,
}

const assistantMsg: ClaudeAssistantMessage = {
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
    stop_reason: 'end_turn',
  },
  session_id: 'sess-abc',
}

function resultMsg(overrides?: Partial<ClaudeResultMessage>): ClaudeResultMessage {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 500,
    duration_api_ms: 400,
    num_turns: 1,
    session_id: 'sess-abc',
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 50,
      output_tokens: 25,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    result: 'Done',
    ...overrides,
  }
}

// -- Tests --

describe('applySessionMessage', () => {
  it('system:init — sets sessionId and model, state unchanged', () => {
    const snap = initialSnapshot()
    const next = applySessionMessage(snap, systemInit)
    expect(next.sessionId).toBe('sess-abc')
    expect(next.model).toBe('claude-sonnet-4-6')
    expect(next.state).toBe('starting') // unchanged
  })

  it('stream_event from starting — transitions to processing', () => {
    const snap = initialSnapshot({ state: 'starting' })
    const next = applySessionMessage(snap, streamEvent)
    expect(next.state).toBe('processing')
  })

  it('stream_event from ready — transitions to processing', () => {
    const snap = initialSnapshot({ state: 'ready' })
    const next = applySessionMessage(snap, streamEvent)
    expect(next.state).toBe('processing')
  })

  it('stream_event from processing — stays processing (no double-transition)', () => {
    const snap = initialSnapshot({ state: 'processing' })
    const next = applySessionMessage(snap, streamEvent)
    expect(next.state).toBe('processing')
    // Should return same reference since nothing changed
    expect(next).toBe(snap)
  })

  it('assistant from starting — transitions to processing', () => {
    const snap = initialSnapshot({ state: 'starting' })
    const next = applySessionMessage(snap, assistantMsg)
    expect(next.state).toBe('processing')
  })

  it('assistant from ready — transitions to processing', () => {
    const snap = initialSnapshot({ state: 'ready' })
    const next = applySessionMessage(snap, assistantMsg)
    expect(next.state).toBe('processing')
  })

  it('result success — transitions to ready, updates numTurns and sessionId', () => {
    const snap = initialSnapshot({ state: 'processing', sessionId: 'old-sess' })
    const next = applySessionMessage(snap, resultMsg({ num_turns: 3, session_id: 'sess-new' }))
    expect(next.state).toBe('ready')
    expect(next.numTurns).toBe(3)
    expect(next.sessionId).toBe('sess-new')
  })

  it('result error — transitions to error, sets error message', () => {
    const snap = initialSnapshot({ state: 'processing' })
    const next = applySessionMessage(
      snap,
      resultMsg({ is_error: true, subtype: 'error', error: 'Rate limited' }),
    )
    expect(next.state).toBe('error')
    expect(next.error).toBe('Rate limited')
  })

  it('result error with no error string — falls back to Unknown error', () => {
    const snap = initialSnapshot({ state: 'processing' })
    const next = applySessionMessage(
      snap,
      resultMsg({ is_error: true, subtype: 'error', error: undefined }),
    )
    expect(next.state).toBe('error')
    expect(next.error).toBe('Unknown error')
  })

  it('rate_limit_event — state unchanged (passthrough)', () => {
    const snap = initialSnapshot({ state: 'processing' })
    const next = applySessionMessage(snap, { type: 'rate_limit_event' })
    expect(next).toBe(snap) // reference equality — no change
  })

  it('full lifecycle: starting → processing → ready → processing → ready', () => {
    let snap = initialSnapshot()

    // system init
    snap = applySessionMessage(snap, systemInit)
    expect(snap.state).toBe('starting')
    expect(snap.sessionId).toBe('sess-abc')

    // stream event triggers processing
    snap = applySessionMessage(snap, streamEvent)
    expect(snap.state).toBe('processing')

    // result success → ready
    snap = applySessionMessage(snap, resultMsg({ num_turns: 1 }))
    expect(snap.state).toBe('ready')
    expect(snap.numTurns).toBe(1)

    // new stream event → processing again
    snap = applySessionMessage(snap, streamEvent)
    expect(snap.state).toBe('processing')

    // second result → ready again
    snap = applySessionMessage(snap, resultMsg({ num_turns: 2 }))
    expect(snap.state).toBe('ready')
    expect(snap.numTurns).toBe(2)
  })
})
