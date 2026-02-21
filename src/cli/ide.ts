import { startIdeServer } from '../server/ide-server.js'

const DEFAULT_PORT = 9848

async function main(): Promise<void> {
  const port = process.env.CANON_IDE_PORT ? parseInt(process.env.CANON_IDE_PORT, 10) : DEFAULT_PORT
  const isRemote = process.env.CANON_REMOTE === '1'
  const workingDirectory = process.cwd()

  const server = startIdeServer({
    port,
    workingDirectory,
    openBrowser: !isRemote,
  })

  console.error(`Canon IDE server running at ${server.url}`)
  if (isRemote) {
    console.error('Remote mode: open the URL in your browser')
  }

  // Handle SIGINT — kill active session and exit
  process.on('SIGINT', () => {
    console.error('\nShutting down...')
    server.stop()
    process.exit(0)
  })

  // Keep process alive
  await new Promise(() => {})
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
