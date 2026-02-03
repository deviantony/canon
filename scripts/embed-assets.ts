// This script reads the built dist files and generates a TypeScript file
// that embeds them as strings, so they're included in the compiled binary

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const distDir = join(import.meta.dir, '../dist')
const outFile = join(import.meta.dir, '../src/server/embedded-assets.ts')

// Read all files from dist
const files: Record<string, { content: string; contentType: string }> = {}

function getContentType(filename: string): string {
  if (filename.endsWith('.html')) return 'text/html'
  if (filename.endsWith('.css')) return 'text/css'
  if (filename.endsWith('.js')) return 'application/javascript'
  if (filename.endsWith('.json')) return 'application/json'
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function readDir(dir: string, prefix: string = '') {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const urlPath = prefix + '/' + entry.name

    if (entry.isDirectory()) {
      readDir(fullPath, urlPath)
    } else {
      const content = readFileSync(fullPath, 'utf-8')
      files[urlPath] = {
        content,
        contentType: getContentType(entry.name),
      }
    }
  }
}

readDir(distDir)

// Generate TypeScript file
let output = `// Auto-generated - do not edit
// Run: bun run scripts/embed-assets.ts

export const embeddedAssets: Record<string, { content: string; contentType: string }> = {\n`

for (const [path, { content, contentType }] of Object.entries(files)) {
  // Escape backticks and ${} in content
  const escaped = content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  output += `  "${path}": {\n`
  output += `    content: \`${escaped}\`,\n`
  output += `    contentType: "${contentType}",\n`
  output += `  },\n`
}

output += `};\n`

writeFileSync(outFile, output)
console.log(`Generated ${outFile} with ${Object.keys(files).length} files`)
