import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { writeFile, readdir } from 'fs/promises'
import { join, dirname, basename, isAbsolute, resolve } from 'path'

const execFileAsync = promisify(execFile)

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

export interface GitHistoryItem {
  hash: string
  parents: string[]
  timestamp: number
  author: string
  subject: string
}

/**
 * Executes a git command and returns the stdout
 */
async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout: 5000
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
        // Helper to get remote URL with fallbacks
        const getRemoteUrl = async (): Promise<string> => {
          try {
            // Priority 1: standard 'origin'
            return await runGit(['remote', 'get-url', 'origin'], rootPath)
          } catch (e1) {
            console.warn('[Main:Git] Failed to get origin url:', e1)
            try {
              // Priority 2: config (older git versions)
              return await runGit(['config', '--get', 'remote.origin.url'], rootPath)
            } catch {
              // Priority 3: any remote
              try {
                const remotes = await runGit(['remote'], rootPath)
                const firstRemote = remotes.split('\n')[0]?.trim()
                if (firstRemote) {
                  return await runGit(['remote', 'get-url', firstRemote], rootPath)
                }
              } catch (e3) {
                console.warn('[Main:Git] Failed to get any remote:', e3)
              }
            }
          }
          return ''
        }

        const [branch, remoteUrl] = await Promise.all([
          runGit(['branch', '--show-current'], rootPath).catch((e) => {
            console.warn('[Main:Git] Failed to get branch:', e)
            return ''
          }),
          getRemoteUrl()
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
      } catch (err) {
        console.error('[Main:Git] Metadata parsing error:', err)
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
 * Initializes a new git repository in the given path and adds a default .gitignore.
 */
export async function initGit(rootPath: string): Promise<boolean> {
  if (!rootPath || !existsSync(rootPath)) {
    return false
  }

  try {
    await runGit(['init'], rootPath)

    // Add default .gitignore if it doesn't exist
    const ignorePath = join(rootPath, '.gitignore')
    if (!existsSync(ignorePath)) {
      const defaultIgnore = `# KnowledgeHub\n.config.json\nassets/\n.DS_Store\nThumbs.db\n*.tmp\n`
      await writeFile(ignorePath, defaultIgnore)
    }

    return true
  } catch (error) {
    console.error('[Main:Git] Failed to initialize git repository:', error)
    return false
  }
}

/**
 * Returns the history of a specific file, including graph data.
 */
export async function getFileHistory(
  rootPath: string,
  filePath: string
): Promise<GitHistoryItem[]> {
  if (!rootPath || !existsSync(rootPath)) return []
  try {
    const fullPath = isAbsolute(filePath) ? filePath : resolve(rootPath, filePath)
    const fileDir = dirname(fullPath)

    if (!existsSync(fileDir)) {
      console.warn(`[Main:Git] File directory does not exist: ${fileDir}`)
      return []
    }

    // Use a unique separator to avoid issues with tabs in subjects/authors
    const separator = '||KH_SEP||'
    const formatString = `--format=%H${separator}%P${separator}%at${separator}%an${separator}%s`

    console.log(`[Main:Git] Fetching history for ${basename(fullPath)} from ${fileDir}`)

    const output = await runGit(
      ['log', '--max-count=100', formatString, '--', basename(fullPath)],
      fileDir
    )
    console.log(`[Main:Git] Log output length: ${output?.length || 0} characters`)

    if (!output || output.trim().length === 0) {
      console.log('[Main:Git] No log output received')
      return []
    }

    const lines = output.split(/\r?\n/).filter((line) => line.trim())
    console.log(`[Main:Git] Found ${lines.length} lines in log`)

    return lines
      .map((line) => {
        const parts = line.split(separator)
        if (parts.length < 5) {
          console.warn(
            `[Main:Git] Malformed log line (expected 5 parts, got ${parts.length}):`,
            line
          )
          return null
        }
        const [hash, parents, timestampStr, author, subject] = parts
        const timestamp = parseInt(timestampStr)

        if (isNaN(timestamp)) {
          console.warn(`[Main:Git] Invalid timestamp "${timestampStr}" in line:`, line)
        }

        return {
          hash: hash || '',
          parents: parents ? parents.split(' ').filter((p) => p.length > 0) : [],
          timestamp: (timestamp || 0) * 1000,
          author: author || 'unknown',
          subject: subject || 'no subject'
        }
      })
      .filter((c): c is GitHistoryItem => c !== null)
  } catch (err) {
    console.error('[Main:Git] Failed to fetch file history:', err)
    return []
  }
}

/**
 * Returns the global repository history with graph data.
 */
export async function getRepoHistory(rootPath: string): Promise<GitHistoryItem[]> {
  if (!rootPath || !existsSync(rootPath)) return []
  try {
    const separator = '||KH_SEP||'
    const formatString = `--format=%H${separator}%P${separator}%at${separator}%an${separator}%s`

    let runDir = rootPath
    try {
      await runGit(['rev-parse', '--is-inside-work-tree'], rootPath)
    } catch {
      console.log(`[Main:Git] Checking subdirectories of ${rootPath} for .git folder...`)
      const entries = await readdir(rootPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const checkPath = join(rootPath, entry.name)
          if (existsSync(join(checkPath, '.git'))) {
            console.log(`[Main:Git] Found Git repository in subdirectory: ${checkPath}`)
            runDir = checkPath
            break
          }
        }
      }
    }

    console.log(`[Main:Git] Running repo history log in ${runDir}`)

    const output = await runGit(
      ['log', '--max-count=200', '--all', '--topo-order', formatString],
      runDir
    )
    console.log(`[Main:Git] Repo log output length: ${output?.length || 0} characters`)

    if (!output || output.trim().length === 0) return []

    const lines = output.split(/\r?\n/).filter((line) => line.trim())
    console.log(`[Main:Git] Found ${lines.length} lines in repo log`)

    return lines
      .map((line) => {
        const parts = line.split(separator)
        if (parts.length < 5) {
          console.warn(
            `[Main:Git] Malformed repo log line (expected 5 parts, got ${parts.length}):`,
            line
          )
          return null
        }
        const [hash, parents, timestampStr, author, subject] = parts
        const timestamp = parseInt(timestampStr)

        if (isNaN(timestamp)) {
          console.warn(`[Main:Git] Invalid timestamp "${timestampStr}" in repo line:`, line)
        }

        return {
          hash: hash || '',
          parents: parents ? parents.split(' ').filter((p) => p.length > 0) : [],
          timestamp: (timestamp || 0) * 1000,
          author: author || 'unknown',
          subject: subject || 'no subject'
        }
      })
      .filter((c): c is GitHistoryItem => c !== null)
  } catch (err) {
    console.error('[Main:Git] Failed to fetch repo history:', err)
    return []
  }
}

/**
 * Returns the content of a file at a specific commit.
 */
export async function getFileContentAtCommit(
  rootPath: string,
  filePath: string,
  hash: string
): Promise<string> {
  if (!rootPath || !existsSync(rootPath)) return ''
  try {
    return await runGit(['show', `${hash}:${filePath}`], rootPath)
  } catch (err) {
    console.error('[Main:Git] Failed to get file content at commit:', err)
    return ''
  }
}

/**
 * Legacy support for just status
 */
export async function getGitStatus(rootPath: string): Promise<GitStatusResult> {
  const info = await getGitInfo(rootPath)
  return info.status
}
