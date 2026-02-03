import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join, relative, basename } from 'path'

export interface FileNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

// Common patterns to ignore (fallback if no .gitignore)
const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.cache',
  'coverage',
  '__pycache__',
  '.DS_Store',
  'Thumbs.db',
]

// Parse .gitignore and return patterns
function parseGitignore(workingDirectory: string): string[] {
  const gitignorePath = join(workingDirectory, '.gitignore')
  const patterns = [...DEFAULT_IGNORE]

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip comments and empty lines
      if (trimmed && !trimmed.startsWith('#')) {
        // Remove leading slash for matching
        patterns.push(trimmed.replace(/^\//, ''))
      }
    }
  }

  return patterns
}

// Check if a path should be ignored
function shouldIgnore(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching - exact match or wildcard
    if (pattern === name) return true
    if (pattern.endsWith('/') && pattern.slice(0, -1) === name) return true
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1)
      if (name.endsWith(ext)) return true
    }
  }
  return false
}

// Build file tree recursively
function buildTree(
  dirPath: string,
  workingDirectory: string,
  ignorePatterns: string[],
  maxDepth: number = 10,
  currentDepth: number = 0
): FileNode[] {
  if (currentDepth >= maxDepth) return []

  const entries = readdirSync(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (shouldIgnore(entry.name, ignorePatterns)) continue

    const fullPath = join(dirPath, entry.name)
    const relativePath = relative(workingDirectory, fullPath)

    const node: FileNode = {
      id: relativePath,
      name: entry.name,
      path: relativePath,
      isDirectory: entry.isDirectory(),
    }

    if (entry.isDirectory()) {
      node.children = buildTree(
        fullPath,
        workingDirectory,
        ignorePatterns,
        maxDepth,
        currentDepth + 1
      )
    }

    nodes.push(node)
  }

  // Sort: directories first, then alphabetically
  nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export function getFileTree(workingDirectory: string): FileNode[] {
  const ignorePatterns = parseGitignore(workingDirectory)
  return buildTree(workingDirectory, workingDirectory, ignorePatterns)
}

export function getFileContent(
  workingDirectory: string,
  filePath: string
): { content: string; error?: string } {
  try {
    // Prevent directory traversal
    const fullPath = join(workingDirectory, filePath)
    const resolved = require('path').resolve(fullPath)
    if (!resolved.startsWith(require('path').resolve(workingDirectory))) {
      return { content: '', error: 'Invalid path' }
    }

    if (!existsSync(fullPath)) {
      return { content: '', error: 'File not found' }
    }

    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      return { content: '', error: 'Path is a directory' }
    }

    // Check if file is likely binary
    const content = readFileSync(fullPath)
    if (isBinary(content)) {
      return { content: '', error: 'Preview not supported for binary files' }
    }

    return { content: content.toString('utf-8') }
  } catch (err) {
    return { content: '', error: String(err) }
  }
}

// Simple binary detection - check for null bytes in first 8KB
function isBinary(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 8192)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}
