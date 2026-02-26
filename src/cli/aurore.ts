import { startAuroreServer } from '../server/aurore-server.js'

const DEFAULT_PORT = 9847

async function main(): Promise<void> {
  const port = process.env.AURORE_PORT ? parseInt(process.env.AURORE_PORT, 10) : DEFAULT_PORT
  const isRemote = process.env.AURORE_REMOTE === '1'
  const workingDirectory = process.cwd()

  const server = await startAuroreServer({
    port,
    workingDirectory,
    openBrowser: !isRemote,
  })

  console.error(`Aurore server running at ${server.url}`)
  if (isRemote) {
    console.error('Remote mode: open the URL in your browser')
  }

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
