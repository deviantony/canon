import type { ClaudeMessage, SessionInfo } from '../shared/ide-types.js'

// -- Pure functions extracted for testability --

/**
 * Parse an NDJSON buffer: append a new chunk, split on newlines,
 * return completed lines and the remaining buffer.
 */
export function parseNdjsonBuffer(
  buffer: string,
  chunk: string,
): { lines: string[]; buffer: string } {
  const combined = buffer + chunk
  const parts = combined.split('\n')
  const remaining = parts.pop() ?? ''
  const lines = parts.filter((l) => l.trim() !== '')
  return { lines, buffer: remaining }
}

/**
 * Pure state-machine transition: given current state + a ClaudeMessage,
 * return the next state. Returns same reference if nothing changed.
 */
export function applySessionMessage(info: SessionInfo, msg: ClaudeMessage): SessionInfo {
  switch (msg.type) {
    case 'system':
      if (msg.subtype === 'init') {
        return { ...info, sessionId: msg.session_id, model: msg.model }
      }
      return info

    case 'stream_event':
    case 'assistant':
      if (info.state === 'starting' || info.state === 'ready') {
        return { ...info, state: 'processing' }
      }
      return info

    case 'result':
      if (msg.is_error) {
        return {
          ...info,
          state: 'error',
          error: msg.error ?? 'Unknown error',
          numTurns: msg.num_turns,
          sessionId: msg.session_id,
        }
      }
      return {
        ...info,
        state: 'ready',
        numTurns: msg.num_turns,
        sessionId: msg.session_id,
      }

    default:
      return info
  }
}

// -- Session interface --

export interface SessionCallbacks {
  onMessage: (msg: ClaudeMessage) => void
  onStderr: (text: string) => void
  onStateChange: (info: SessionInfo) => void
  onExit: (code: number) => void
}

export interface Session {
  sendPrompt: (prompt: string) => void
  kill: () => void
  getInfo: () => SessionInfo
}

export function createSession(
  workingDirectory: string,
  callbacks: SessionCallbacks,
  resumeSessionId?: string,
): Session {
  let info: SessionInfo = {
    state: 'starting',
    sessionId: null,
    model: null,
    numTurns: 0,
    error: null,
  }
  let proc: ReturnType<typeof Bun.spawn> | null = null

  // Build command args
  const args = [
    'claude',
    '-p',
    '--verbose',
    '--dangerously-skip-permissions',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--include-partial-messages',
  ]

  if (resumeSessionId) {
    args.push('--resume', resumeSessionId)
  }

  proc = Bun.spawn(args, {
    cwd: workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      IS_SANDBOX: '1',
    },
  })

  // Capture typed references to the streams before proc can be nulled
  const stdout = proc.stdout as ReadableStream<Uint8Array>
  const stderr = proc.stderr as ReadableStream<Uint8Array>
  const stdin = proc.stdin as import('bun').FileSink

  // Read stdout NDJSON stream
  const decoder = new TextDecoder()
  async function readStdout() {
    const reader = stdout.getReader()
    let ndjsonBuffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const parsed = parseNdjsonBuffer(ndjsonBuffer, chunk)
        ndjsonBuffer = parsed.buffer
        for (const line of parsed.lines) {
          try {
            const msg = JSON.parse(line) as ClaudeMessage
            handleMessage(msg)
          } catch {
            console.error('[session] unparseable:', line.slice(0, 200))
          }
        }
      }
      // Handle any remaining data in buffer
      if (ndjsonBuffer.trim()) {
        try {
          const msg = JSON.parse(ndjsonBuffer) as ClaudeMessage
          handleMessage(msg)
        } catch {
          console.error('[session] unparseable trailing:', ndjsonBuffer.slice(0, 200))
        }
      }
    } catch (err) {
      console.error('[session] stdout read error:', err)
    }
  }

  // Read stderr
  async function readStderr() {
    const reader = stderr.getReader()
    const stderrDecoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = stderrDecoder.decode(value, { stream: true })
        if (text.trim()) {
          callbacks.onStderr(text)
        }
      }
    } catch (err) {
      console.error('[session] stderr read error:', err)
    }
  }

  function handleMessage(msg: ClaudeMessage) {
    // Log non-stream messages (stream events are too noisy)
    if (msg.type !== 'stream_event') {
      const detail = 'subtype' in msg ? `:${msg.subtype}` : ''
      console.log(`[session] ${msg.type}${detail}`)
    }

    // Update state via pure function
    const next = applySessionMessage(info, msg)
    if (next !== info) {
      info = next
      callbacks.onStateChange(info)
    }

    callbacks.onMessage(msg)
  }

  // Handle process exit
  proc.exited.then((code) => {
    if (code === 0) {
      info = { ...info, state: 'exited' }
    } else {
      info = { ...info, state: 'error', error: `Process exited with code ${code}` }
    }
    callbacks.onStateChange(info)
    callbacks.onExit(code)
    proc = null
  })

  // Start reading streams
  readStdout()
  readStderr()

  function sendPrompt(prompt: string) {
    if (!proc) {
      console.error('[session] cannot send prompt: process not running')
      return
    }
    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: prompt },
    })
    stdin.write(`${msg}\n`)
  }

  function kill() {
    if (proc) {
      proc.kill()
      proc = null
    }
  }

  return {
    sendPrompt,
    kill,
    getInfo: () => info,
  }
}
