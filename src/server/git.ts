import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ChangedFile, GitInfo } from '../shared/types.js'

export type { ChangedFile, GitInfo }

// Internal type for accumulating diff statistics
interface DiffStats {
  additions: number
  deletions: number
}

// Run a git command and return stdout
async function runGit(
  workingDirectory: string,
  args: string[],
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
async function getChangedFiles(workingDirectory: string): Promise<ChangedFile[]> {
  // -uall lists individual untracked files instead of collapsing to directories
  const result = await runGit(workingDirectory, ['status', '--porcelain', '-uall'])
  if (result.exitCode !== 0) return []

  const files: ChangedFile[] = []
  const lines = result.stdout.split('\n').filter((l) => l.length > 0)

  for (const line of lines) {
    const file = parseStatusLine(line)
    if (file) files.push(file)
  }

  return files
}

// Get diff stats (additions/deletions) for all changed files
async function getDiffStats(workingDirectory: string): Promise<Map<string, DiffStats>> {
  const statsMap = new Map<string, DiffStats>()

  // Get stats for staged changes
  const stagedResult = await runGit(workingDirectory, ['diff', '--numstat', '--cached'])
  if (stagedResult.exitCode === 0) {
    parseDiffNumstat(stagedResult.stdout, statsMap)
  }

  // Get stats for unstaged changes (working tree vs index)
  const unstagedResult = await runGit(workingDirectory, ['diff', '--numstat'])
  if (unstagedResult.exitCode === 0) {
    parseDiffNumstat(unstagedResult.stdout, statsMap)
  }

  return statsMap
}

// Parse git diff --numstat output and add to stats map
function parseDiffNumstat(output: string, statsMap: Map<string, DiffStats>): void {
  const lines = output.split('\n').filter((l) => l.length > 0)

  for (const line of lines) {
    // Format: "additions\tdeletions\tfilepath"
    // Binary files show "-\t-\tfilepath"
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const [addStr, delStr, ...pathParts] = parts
    const filePath = pathParts.join('\t') // Handle paths with tabs

    // Skip binary files
    if (addStr === '-' || delStr === '-') continue

    const additions = parseInt(addStr, 10) || 0
    const deletions = parseInt(delStr, 10) || 0

    // Accumulate stats (file might have both staged and unstaged changes)
    const existing = statsMap.get(filePath)
    if (existing) {
      statsMap.set(filePath, {
        additions: existing.additions + additions,
        deletions: existing.deletions + deletions,
      })
    } else {
      statsMap.set(filePath, { additions, deletions })
    }
  }
}

// Get git info for the working directory
export async function getGitInfo(workingDirectory: string): Promise<GitInfo> {
  const isRepo = await isGitRepo(workingDirectory)

  if (!isRepo) {
    return { changedFiles: [] }
  }

  const [changedFiles, diffStats] = await Promise.all([
    getChangedFiles(workingDirectory),
    getDiffStats(workingDirectory),
  ])

  // Merge diff stats into changed files (only for modified files)
  const filesWithStats = changedFiles.map((file) => {
    if (file.status === 'modified') {
      const stats = diffStats.get(file.path)
      if (stats) {
        return { ...file, additions: stats.additions, deletions: stats.deletions }
      }
    }
    return file
  })

  return { changedFiles: filesWithStats }
}

// Get the original (HEAD) content of a file
export async function getOriginalContent(
  workingDirectory: string,
  filePath: string,
): Promise<{ content: string; error?: string }> {
  // Prevent directory traversal
  const fullPath = join(workingDirectory, filePath)
  const resolvedPath = resolve(fullPath)
  if (!resolvedPath.startsWith(resolve(workingDirectory))) {
    return { content: '', error: 'Invalid path' }
  }

  const result = await runGit(workingDirectory, ['show', `HEAD:${filePath}`])

  if (result.exitCode !== 0) {
    // File might not exist in HEAD (new file)
    return { content: '', error: 'File not found in HEAD' }
  }

  return { content: result.stdout }
}
