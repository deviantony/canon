import { startServer } from '../server/index.js'

const DEFAULT_PORT = 9847

async function main() {
  const port = process.env.CANON_PORT
    ? parseInt(process.env.CANON_PORT)
    : DEFAULT_PORT
  const isRemote = process.env.CANON_REMOTE === '1'
  const workingDirectory = process.cwd()

  const server = await startServer({
    port,
    workingDirectory,
    openBrowser: !isRemote,
  })

  console.error(`Canon server running at ${server.url}`)
  if (isRemote) {
    console.error('Remote mode: open the URL in your browser')
  }

  // Block until user submits or cancels
  const result = await server.waitForDecision()

  server.stop()

  // Output the feedback to stdout (captured by slash command)
  console.log(result.feedback)

  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
