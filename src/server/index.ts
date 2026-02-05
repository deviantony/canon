import { getFileTree, getFileContent } from './files.js'
import { getGitInfo, getOriginalContent } from './git.js'
import { embeddedAssets } from './embedded-assets.js'
import type { FeedbackResult } from '../shared/types.js'

export type { FeedbackResult }

export interface ServerOptions {
  port: number
  workingDirectory: string
  openBrowser: boolean
}

export interface Server {
  url: string
  waitForDecision: () => Promise<FeedbackResult>
  stop: () => void
}

function extractPathParam(url: URL, prefix: string): string {
  return decodeURIComponent(url.pathname.slice(prefix.length))
}

export async function startServer(options: ServerOptions): Promise<Server> {
  const { port, workingDirectory, openBrowser } = options

  let resolveDecision: (result: FeedbackResult) => void
  const decisionPromise = new Promise<FeedbackResult>((resolve) => {
    resolveDecision = resolve
  })

  // Check if port is already in use - only one Canon session allowed
  const portCheck = await checkPort(port)
  if (!portCheck.available) {
    throw new Error(
      `Port ${port} is already in use. Only one Canon session is allowed at a time.\n` +
      `Please finish working with your existing session before starting a new one.`
    )
  }

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      // API: Submit feedback
      if (url.pathname === '/api/feedback' && req.method === 'POST') {
        const body = (await req.json()) as FeedbackResult
        resolveDecision(body)
        return Response.json({ ok: true })
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

      // Serve embedded assets
      // Try exact path first
      let assetPath = url.pathname
      let asset = embeddedAssets[assetPath]

      // For root, serve index.html
      if (!asset && (url.pathname === '/' || url.pathname === '/index.html')) {
        asset = embeddedAssets['/index.html']
      }

      if (asset) {
        return new Response(asset.content, {
          headers: { 'Content-Type': asset.contentType },
        })
      }

      // 404 for everything else
      return new Response('Not Found', { status: 404 })
    },
  })

  const serverUrl = `http://localhost:${port}`

  // Auto-open browser
  if (openBrowser) {
    openInBrowser(serverUrl)
  }

  return {
    url: serverUrl,
    waitForDecision: () => decisionPromise,
    stop: () => server.stop(),
  }
}

async function checkPort(port: number): Promise<{ available: boolean }> {
  try {
    const testServer = Bun.serve({
      port,
      fetch() {
        return new Response('test')
      },
    })
    testServer.stop()
    return { available: true }
  } catch {
    return { available: false }
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
    // Linux - try xdg-open, fall back to printing URL
    cmd = ['xdg-open', url]
  }

  try {
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    console.warn(`Could not open browser automatically. Please visit ${url} manually.`)
  }
}
