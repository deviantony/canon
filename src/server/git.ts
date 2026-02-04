import { existsSync } from 'fs'
import { join } from 'path'
import type { ChangedFile, GitInfo } from '../shared/types.js'

export type { ChangedFile, GitInfo }

// Run a git command and return stdout
async function runGit(
  workingDirectory: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: workingDirectory,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

// Check if directory is a git repository
async function isGitRepo(workingDirectory: string): Promise<boolean> {
  const gitDir = join(workingDirectory, '.git')
  if (existsSync(gitDir)) return true

  // Also check via git command (for worktrees, etc)
  const result = await runGit(workingDirectory, ['rev-parse', '--git-dir'])
  return result.exitCode === 0
}

// Get current branch name
async function getCurrentBranch(workingDirectory: string): Promise<string | null> {
  const result = await runGit(workingDirectory, ['branch', '--show-current'])
  if (result.exitCode !== 0) return null
  return result.stdout.trim() || null
}

// Combine staged and unstaged diff results
function combineDiffs(
  stagedResult: { exitCode: number; stdout: string },
  unstagedResult: { exitCode: number; stdout: string }
): string {
  let diff = ''

  if (stagedResult.exitCode === 0 && stagedResult.stdout) {
    diff += stagedResult.stdout
  }

  if (unstagedResult.exitCode === 0 && unstagedResult.stdout) {
    if (diff) diff += '\n'
    diff += unstagedResult.stdout
  }

  return diff
}

// Parse git status porcelain output
function parseStatusLine(line: string): ChangedFile | null {
  if (line.length < 4) return null

  const xy = line.substring(0, 2)
  const path = line.substring(3)

  // Handle renames (format: "R  old -> new")
  const arrowIndex = path.indexOf(' -> ')
  const filePath = arrowIndex >= 0 ? path.substring(arrowIndex + 4) : path

  // Determine status based on index (X) and worktree (Y) status
  const indexStatus = xy[0]
  const worktreeStatus = xy[1]

  // Untracked files
  if (xy === '??') {
    return { path: filePath, status: 'added' }
  }

  // Renamed
  if (indexStatus === 'R' || worktreeStatus === 'R') {
    return { path: filePath, status: 'renamed' }
  }

  // Deleted
  if (indexStatus === 'D' || worktreeStatus === 'D') {
    return { path: filePath, status: 'deleted' }
  }

  // Added (new file in index)
  if (indexStatus === 'A') {
    return { path: filePath, status: 'added' }
  }

  // Modified
  if (indexStatus === 'M' || worktreeStatus === 'M') {
    return { path: filePath, status: 'modified' }
  }

  // Other changes (copied, etc) - treat as modified
  if (indexStatus !== ' ' || worktreeStatus !== ' ') {
    return { path: filePath, status: 'modified' }
  }

  return null
}

// Get list of changed files (staged + unstaged)
export async function getChangedFiles(workingDirectory: string): Promise<ChangedFile[]> {
  const result = await runGit(workingDirectory, ['status', '--porcelain'])
  if (result.exitCode !== 0) return []

  const files: ChangedFile[] = []
  const lines = result.stdout.split('\n').filter((l) => l.length > 0)

  for (const line of lines) {
    const file = parseStatusLine(line)
    if (file) files.push(file)
  }

  return files
}

// Get git info for the working directory
export async function getGitInfo(workingDirectory: string): Promise<GitInfo> {
  const isRepo = await isGitRepo(workingDirectory)

  if (!isRepo) {
    return { isGitRepo: false, changedFiles: [] }
  }

  const [branch, changedFiles] = await Promise.all([
    getCurrentBranch(workingDirectory),
    getChangedFiles(workingDirectory),
  ])

  return {
    isGitRepo: true,
    branch: branch || undefined,
    changedFiles,
  }
}

// Get unified diff for all uncommitted changes
export async function getUnifiedDiff(workingDirectory: string): Promise<string> {
  const [stagedResult, unstagedResult] = await Promise.all([
    runGit(workingDirectory, ['diff', '--cached']),
    runGit(workingDirectory, ['diff']),
  ])

  return combineDiffs(stagedResult, unstagedResult)
}

// Get diff for a specific file
export async function getFileDiff(
  workingDirectory: string,
  filePath: string
): Promise<string> {
  const [stagedResult, unstagedResult] = await Promise.all([
    runGit(workingDirectory, ['diff', '--cached', '--', filePath]),
    runGit(workingDirectory, ['diff', '--', filePath]),
  ])

  return combineDiffs(stagedResult, unstagedResult)
}

// Get the original (HEAD) content of a file
export async function getOriginalContent(
  workingDirectory: string,
  filePath: string
): Promise<{ content: string; error?: string }> {
  const result = await runGit(workingDirectory, ['show', `HEAD:${filePath}`])

  if (result.exitCode !== 0) {
    // File might not exist in HEAD (new file)
    return { content: '', error: 'File not found in HEAD' }
  }

  return { content: result.stdout }
}
