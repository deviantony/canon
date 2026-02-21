import type { ClaudeMessage, SessionInfo, SessionState } from '../shared/ide-types.js'

export interface SessionCallbacks {
  onMessage: (msg: ClaudeMessage) => void
  onStderr: (text: string) => void
  onStateChange: (info: SessionInfo) => void
  onExit: (code: number) => void
}

export interface SessionOptions {
  resumeSessionId?: string
}

export interface Session {
  sendPrompt: (prompt: string) => void
  kill: () => void
  getInfo: () => SessionInfo
}

export function createSession(
  workingDirectory: string,
  callbacks: SessionCallbacks,
  options?: SessionOptions,
): Session {
  let state: SessionState = 'starting'
  let sessionId: string | null = null
  let model: string | null = null
  let numTurns = 0
  let error: string | null = null
  let proc: ReturnType<typeof Bun.spawn> | null = null

  function getInfo(): SessionInfo {
    return { sessionId, state, model, numTurns, error }
  }

  function setState(newState: SessionState, errorMsg?: string) {
    state = newState
    if (errorMsg !== undefined) error = errorMsg
    callbacks.onStateChange(getInfo())
  }

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
    '--replay-user-messages',
    '--include-partial-messages',
  ]

  if (options?.resumeSessionId) {
    args.push('--resume', options.resumeSessionId)
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
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line) as ClaudeMessage
            handleMessage(msg)
          } catch {
            console.error('[session] unparseable:', line.slice(0, 200))
          }
        }
      }
      // Handle any remaining data in buffer
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer) as ClaudeMessage
          handleMessage(msg)
        } catch {
          console.error('[session] unparseable trailing:', buffer.slice(0, 200))
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
    // Update state based on message type
    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') {
          sessionId = msg.session_id
          model = msg.model
        }
        break

      case 'stream_event':
      case 'assistant':
        if (state === 'starting' || state === 'ready') {
          setState('processing')
        }
        break

      case 'result':
        numTurns = msg.num_turns
        sessionId = msg.session_id
        if (msg.is_error) {
          setState('error', msg.error ?? 'Unknown error')
        } else {
          setState('ready')
        }
        break
    }

    callbacks.onMessage(msg)
  }

  // Handle process exit
  proc.exited.then((code) => {
    if (code === 0) {
      setState('exited')
    } else {
      setState('error', `Process exited with code ${code}`)
    }
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

  return { sendPrompt, kill, getInfo }
}
