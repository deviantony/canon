import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import type { ClientMessage, ServerMessage } from '../shared/ide-types.js'
import { createSession, type Session } from './session.js'

export interface IdeServerOptions {
  port: number
  workingDirectory: string
  openBrowser: boolean
}

export interface IdeServer {
  url: string
  stop: () => void
}

interface WsData {
  id: string
}

export function startIdeServer(options: IdeServerOptions): IdeServer {
  const { port, workingDirectory, openBrowser } = options

  let activeSession: Session | null = null
  const clients = new Set<ServerWebSocket<WsData>>()

  function broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg)
    for (const ws of clients) {
      ws.send(data)
    }
  }

  function startSession(prompt: string, resumeSessionId?: string) {
    // Kill existing session if any
    if (activeSession) {
      activeSession.kill()
      activeSession = null
    }

    activeSession = createSession(
      workingDirectory,
      {
        onMessage: (message) => broadcast({ type: 'claude:message', message }),
        onStderr: (text) => broadcast({ type: 'claude:stderr', text }),
        onStateChange: (info) => broadcast({ type: 'session:state', info }),
        onExit: (_code) => {
          activeSession = null
        },
      },
      resumeSessionId ? { resumeSessionId } : undefined,
    )

    // Send initial state to all clients
    broadcast({ type: 'session:state', info: activeSession.getInfo() })

    // Send the initial prompt
    activeSession.sendPrompt(prompt)
  }

  function handleClientMessage(msg: ClientMessage) {
    switch (msg.type) {
      case 'session:start':
        startSession(msg.prompt)
        break

      case 'session:prompt':
        if (activeSession) {
          activeSession.sendPrompt(msg.prompt)
        } else {
          broadcast({ type: 'error', message: 'No active session' })
        }
        break

      case 'session:resume':
        startSession(msg.prompt ?? '', msg.sessionId)
        break
    }
  }

  // Resolve the HTML file path relative to this source file
  const htmlPath = join(import.meta.dir, '..', '..', 'src', 'ide.html')

  const server = Bun.serve<WsData>({
    port,
    async fetch(req, server) {
      const url = new URL(req.url)

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const id = crypto.randomUUID()
        const upgraded = server.upgrade(req, { data: { id } })
        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 })
        }
        return undefined
      }

      // Serve the HTML page
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const file = Bun.file(htmlPath)
        const exists = await file.exists()
        if (!exists) {
          return new Response('ide.html not found', { status: 404 })
        }
        return new Response(file, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        clients.add(ws)
        // Send current session state if session exists
        if (activeSession) {
          ws.send(JSON.stringify({ type: 'session:state', info: activeSession.getInfo() }))
        }
      },
      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        try {
          const msg = JSON.parse(
            typeof message === 'string' ? message : message.toString(),
          ) as ClientMessage
          handleClientMessage(msg)
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
        }
      },
      close(ws: ServerWebSocket<WsData>) {
        clients.delete(ws)
      },
    },
  })

  const serverUrl = `http://localhost:${port}`

  if (openBrowser) {
    openInBrowser(serverUrl)
  }

  return {
    url: serverUrl,
    stop: () => {
      if (activeSession) {
        activeSession.kill()
        activeSession = null
      }
      server.stop()
    },
  }
}

function openInBrowser(url: string): void {
  const platform = process.platform
  let cmd: string[]

  if (platform === 'darwin') {
    cmd = ['open', url]
  } else if (platform === 'win32') {
    cmd = ['cmd', '/c', 'start', url]
  } else {
    cmd = ['xdg-open', url]
  }

  try {
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    console.warn(`Could not open browser automatically. Please visit ${url} manually.`)
  }
}
