import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface GitStatusResult {
  [path: string]: string
}

/**
 * Executes a git command and returns the stdout
 */
async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execAsync(`git ${args.join(' ')}`, {
    cwd,
    windowsHide: true,
    timeout: 5000 // 5 second timeout for git commands
  })
  return stdout.trim()
}

/**
 * Fetches the porcelain git status for a repository,
 * correctly handling subdirectories and path prefixes.
 */
export async function getGitStatus(rootPath: string): Promise<GitStatusResult> {
  if (!rootPath || !existsSync(rootPath)) {
    return {}
  }

  try {
    // 1. Verify we are in a git work tree
    try {
      const isInside = await runGit(['rev-parse', '--is-inside-work-tree'], rootPath)
      if (isInside !== 'true') return {}
    } catch {
      return {} // Not a git repo
    }

    // 2. Get the prefix (path from git root to vault root)
    const prefix = await runGit(['rev-parse', '--show-prefix'], rootPath)

    // 3. Get the porcelain status
    // -z to get NUL separated output (better for special characters)
    // --untracked-files=all to ensure all untracked files are listed
    const statusOutput = await runGit(['status', '--porcelain', '--untracked-files=all'], rootPath)

    if (!statusOutput) return {}

    const statusMap: GitStatusResult = {}
    const lines = statusOutput.split('\n')

    for (const line of lines) {
      if (!line || line.length < 4) continue

      const status = line.slice(0, 2)
      let rawPath = line.slice(3)

      // Handle renames
      if (status.startsWith('R')) {
        const parts = rawPath.split(' -> ')
        rawPath = parts[parts.length - 1]
      }

      // Cleanup path (remove quotes if any)
      let cleanPath = rawPath.replace(/^["']|["']$/g, '')

      // If we're in a subdirectory, check if the file belongs to our vault
      if (prefix) {
        if (cleanPath.startsWith(prefix)) {
          cleanPath = cleanPath.slice(prefix.length)
        } else {
          // File is outside the vault directory
          continue
        }
      }

      // Ensure consistent path separators (forward slashes)
      const normalizedPath = cleanPath.replace(/\\/g, '/')
      if (normalizedPath) {
        statusMap[normalizedPath] = status
      }
    }

    return statusMap
  } catch (error) {
    console.error('[Main:Git] Failed to fetch status:', error)
    return {}
  }
}
