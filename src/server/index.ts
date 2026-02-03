import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getFileTree, getFileContent } from './files.js'
import { getGitInfo, getUnifiedDiff, getFileDiff } from './git.js'

export interface ServerOptions {
  port: number
  workingDirectory: string
  openBrowser: boolean
}

export interface FeedbackResult {
  feedback: string
  cancelled: boolean
}

export interface Server {
  url: string
  waitForDecision: () => Promise<FeedbackResult>
  stop: () => void
}

export async function startServer(options: ServerOptions): Promise<Server> {
  const { port, workingDirectory, openBrowser } = options

  let resolveDecision: (result: FeedbackResult) => void
  const decisionPromise = new Promise<FeedbackResult>((resolve) => {
    resolveDecision = resolve
  })

  // Try to load built HTML, fallback to dev message
  let htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Canon</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            background: #1a1a1a;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            gap: 20px;
          }
          h1 { margin: 0; }
          button {
            padding: 12px 24px;
            font-size: 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button:hover { opacity: 0.9; }
          .submit {
            background: #3b82f6;
            color: white;
          }
          .cancel {
            background: #4b5563;
            color: white;
          }
          .buttons { display: flex; gap: 12px; }
        </style>
      </head>
      <body>
        <h1>Canon</h1>
        <p>Code Review Tool - Minimal Test UI</p>
        <div class="buttons">
          <button class="cancel" onclick="cancel()">Cancel</button>
          <button class="submit" onclick="submit()">Submit Feedback</button>
        </div>
        <script>
          async function submit() {
            await fetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                feedback: '## Code Review Feedback\\n\\nTest annotation from minimal UI.',
                cancelled: false
              })
            });
            document.body.innerHTML = '<h1>Feedback Submitted</h1><p>You can close this tab.</p>';
          }
          async function cancel() {
            await fetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                feedback: 'User cancelled review. Ask what they\\'d like to do next.',
                cancelled: true
              })
            });
            document.body.innerHTML = '<h1>Review Cancelled</h1><p>You can close this tab.</p>';
          }
        </script>
      </body>
    </html>
  `

  // Check for built dist/index.html
  const distPath = join(import.meta.dir, '../../dist/index.html')
  if (existsSync(distPath)) {
    htmlContent = readFileSync(distPath, 'utf-8')
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
        const filePath = decodeURIComponent(url.pathname.slice('/api/file/'.length))
        const result = getFileContent(workingDirectory, filePath)
        if (result.error) {
          return Response.json({ error: result.error }, { status: 400 })
        }
        return Response.json({ content: result.content, path: filePath })
      }

      // API: Get git info (changed files, branch, etc)
      if (url.pathname === '/api/git/info' && req.method === 'GET') {
        const info = await getGitInfo(workingDirectory)
        return Response.json(info)
      }

      // API: Get unified diff for all changes
      if (url.pathname === '/api/git/diff' && req.method === 'GET') {
        const diff = await getUnifiedDiff(workingDirectory)
        return Response.json({ diff })
      }

      // API: Get diff for a specific file
      if (url.pathname.startsWith('/api/git/diff/') && req.method === 'GET') {
        const filePath = decodeURIComponent(url.pathname.slice('/api/git/diff/'.length))
        const diff = await getFileDiff(workingDirectory, filePath)
        return Response.json({ diff, path: filePath })
      }

      // Serve HTML for root
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(htmlContent, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Serve static assets from dist
      if (url.pathname.startsWith('/assets/')) {
        const assetPath = join(import.meta.dir, '../../dist', url.pathname)
        if (existsSync(assetPath)) {
          const content = readFileSync(assetPath)
          const contentType = getContentType(url.pathname)
          return new Response(content, {
            headers: { 'Content-Type': contentType },
          })
        }
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

function getContentType(pathname: string): string {
  if (pathname.endsWith('.js')) return 'application/javascript'
  if (pathname.endsWith('.css')) return 'text/css'
  if (pathname.endsWith('.html')) return 'text/html'
  if (pathname.endsWith('.json')) return 'application/json'
  if (pathname.endsWith('.svg')) return 'image/svg+xml'
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

function openInBrowser(url: string) {
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
    // Silently fail - user can open URL manually
  }
}
