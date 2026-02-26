import type { ServerWebSocket } from 'bun'
import type { ClientMessage, ServerMessage } from '../shared/ide-types.js'
import { embeddedAssets } from './embedded-assets.js'
import { getFileContent, getFileTree } from './files.js'
import { getGitInfo, getOriginalContent } from './git.js'
import { createSession, type Session } from './session.js'

export interface AuroreServerOptions {
  port: number
  workingDirectory: string
  openBrowser: boolean
}

export interface AuroreServer {
  url: string
  stop: () => void
}

export function extractPathParam(url: URL, prefix: string): string {
  return decodeURIComponent(url.pathname.slice(prefix.length))
}

export function isLocalOrigin(req: Request, port: number): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  const allowed = [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
  return allowed.includes(origin)
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

export async function startAuroreServer(options: AuroreServerOptions): Promise<AuroreServer> {
  const { port, workingDirectory, openBrowser } = options

  let activeSession: Session | null = null
  const clients = new Set<ServerWebSocket<unknown>>()

  function broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg)
    for (const ws of clients) {
      ws.send(data)
    }
  }

  function startSession(prompt: string, resumeSessionId?: string) {
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
      resumeSessionId,
    )

    broadcast({ type: 'session:state', info: activeSession.getInfo() })

    if (prompt) {
      activeSession.sendPrompt(prompt)
    }
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

  let server: ReturnType<typeof Bun.serve<unknown>>
  try {
    server = Bun.serve<unknown>({
      port,
      async fetch(req, server) {
        const url = new URL(req.url)

        // WebSocket upgrade
        if (url.pathname === '/ws') {
          const upgraded = server.upgrade(req, { data: {} })
          if (!upgraded) {
            return new Response('WebSocket upgrade failed', { status: 400 })
          }
          return undefined
        }

        // Block cross-origin requests to prevent CSRF
        if (!isLocalOrigin(req, port)) {
          return new Response('Forbidden', { status: 403 })
        }

        // API: Get working directory info
        if (url.pathname === '/api/info' && req.method === 'GET') {
          return Response.json({ workingDirectory })
        }

        // API: Get file tree
        if (url.pathname === '/api/files' && req.method === 'GET') {
          const tree = getFileTree(workingDirectory)
          return Response.json(tree)
        }

        // API: Get file content
        if (url.pathname.startsWith('/api/file/') && req.method === 'GET') {
          const filePath = extractPathParam(url, '/api/file/')
          const result = getFileContent(workingDirectory, filePath)
          if (result.error) {
            return Response.json({ error: result.error }, { status: 400 })
          }
          return Response.json({
            content: result.content,
            path: filePath,
            lineCount: result.lineCount,
          })
        }

        // API: Get git info (changed files)
        if (url.pathname === '/api/git/info' && req.method === 'GET') {
          const info = await getGitInfo(workingDirectory)
          return Response.json(info)
        }

        // API: Get original (HEAD) content of a file
        if (url.pathname.startsWith('/api/git/original/') && req.method === 'GET') {
          const filePath = extractPathParam(url, '/api/git/original/')
          const result = await getOriginalContent(workingDirectory, filePath)
          if (result.error) {
            return Response.json({ error: result.error, content: '' }, { status: 400 })
          }
          return Response.json({ content: result.content, path: filePath })
        }

        // Serve embedded assets (production)
        const assetPath = url.pathname
        let asset = embeddedAssets[assetPath]

        if (!asset && (url.pathname === '/' || url.pathname === '/index.html')) {
          asset = embeddedAssets['/index.html']
        }

        if (asset) {
          return new Response(asset.content, {
            headers: { 'Content-Type': asset.contentType },
          })
        }

        return new Response('Not Found', { status: 404 })
      },
      websocket: {
        open(ws: ServerWebSocket<unknown>) {
          clients.add(ws)
          if (activeSession) {
            ws.send(JSON.stringify({ type: 'session:state', info: activeSession.getInfo() }))
          }
        },
        message(ws: ServerWebSocket<unknown>, message: string | Buffer) {
          try {
            const msg = JSON.parse(
              typeof message === 'string' ? message : message.toString(),
            ) as ClientMessage
            handleClientMessage(msg)
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
          }
        },
        close(ws: ServerWebSocket<unknown>) {
          clients.delete(ws)
        },
      },
    })
  } catch {
    throw new Error(
      `Port ${port} is already in use. Only one Aurore session is allowed at a time.\n` +
        'Please finish working with your existing session before starting a new one.',
    )
  }

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
