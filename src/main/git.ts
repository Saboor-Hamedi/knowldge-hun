import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface GitStatusResult {
  [path: string]: string
}

export interface GitMetadata {
  branch: string
  remote?: string
  repoName?: string
}

export interface GitInfo {
  status: GitStatusResult
  metadata: GitMetadata
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
 * Fetches the porcelain git status and repository metadata.
 */
export async function getGitInfo(rootPath: string): Promise<GitInfo> {
  const defaultInfo: GitInfo = {
    status: {},
    metadata: { branch: '' }
  }

  if (!rootPath || !existsSync(rootPath)) {
    return defaultInfo
  }

  try {
    // 1. Verify we are in a git work tree
    try {
      const isInside = await runGit(['rev-parse', '--is-inside-work-tree'], rootPath)
      if (isInside !== 'true') return defaultInfo
    } catch {
      return defaultInfo // Not a git repo
    }

    // 2. Get Metadata (Branch, Remote) - Parallelize for performance
    const metadataPromise = (async (): Promise<GitMetadata> => {
      try {
        const [branch, remoteUrl] = await Promise.all([
          runGit(['branch', '--show-current'], rootPath).catch(() => ''),
          runGit(['remote', 'get-url', 'origin'], rootPath).catch(() => '')
        ])

        let repoName = ''
        if (remoteUrl) {
          // Extract repo name from URL (e.g. https://github.com/user/repo.git -> repo)
          const parts = remoteUrl.split('/')
          repoName = parts[parts.length - 1].replace(/\.git$/, '')
        } else {
          // Fallback to directory name
          repoName = join(rootPath).split(/[\\/]/).pop() || ''
        }

        return { branch, remote: remoteUrl, repoName }
      } catch {
        return { branch: '' }
      }
    })()

    // 3. Get Status with prefix handling
    const statusPromise = (async (): Promise<GitStatusResult> => {
      try {
        const prefix = await runGit(['rev-parse', '--show-prefix'], rootPath)
        const statusOutput = await runGit(
          ['status', '--porcelain', '--untracked-files=all'],
          rootPath
        )

        if (!statusOutput) return {}

        const statusMap: GitStatusResult = {}
        const lines = statusOutput.split('\n')

        for (const line of lines) {
          if (!line || line.length < 4) continue

          const status = line.slice(0, 2)
          let rawPath = line.slice(3)

          if (status.startsWith('R')) {
            const parts = rawPath.split(' -> ')
            rawPath = parts[parts.length - 1]
          }

          let cleanPath = rawPath.replace(/^["']|["']$/g, '')

          if (prefix) {
            if (cleanPath.startsWith(prefix)) {
              cleanPath = cleanPath.slice(prefix.length)
            } else {
              continue
            }
          }

          const normalizedPath = cleanPath.replace(/\\/g, '/')
          if (normalizedPath) {
            statusMap[normalizedPath] = status
          }
        }
        return statusMap
      } catch {
        return {}
      }
    })()

    const [status, metadata] = await Promise.all([statusPromise, metadataPromise])

    return { status, metadata }
  } catch (error) {
    console.error('[Main:Git] Failed to fetch git info:', error)
    return defaultInfo
  }
}

/**
 * Legacy support for just status
 */
export async function getGitStatus(rootPath: string): Promise<GitStatusResult> {
  const info = await getGitInfo(rootPath)
  return info.status
}
