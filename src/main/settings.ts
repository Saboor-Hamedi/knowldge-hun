import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

const settingsFile = join(app.getPath('userData'), 'settings.json')

export type Settings = {
  vaultPath?: string
  theme?: string
  sidebarVisible?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
  fontSize?: number
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  recentVaults?: string[]
  lastOpenedNote?: string
  expandedFolders?: string[]
  openTabs?: { id: string; path?: string; title?: string }[]
  activeId?: string
  activeView?: 'notes' | 'search' | 'settings'
  windowBounds?: { width: number; height: number; x?: number; y?: number }
  deepseekApiKey?: string
  openaiApiKey?: string
  claudeApiKey?: string
  grokApiKey?: string
  ollamaBaseUrl?: string
  aiProvider?: 'deepseek' | 'openai' | 'claude' | 'grok' | 'ollama'
  aiModel?: string
  gistToken?: string
  gistId?: string
  rightPanelWidth?: number
  rightPanelVisible?: boolean
  // Caret settings
  caretEnabled?: boolean
  caretMaxWidth?: number
  cursorPositions?: Record<string, { lineNumber: number; column: number }>
  graphTheme?: string
  fireWall?: {
    passwordHash?: string | null
    lockScreenAlignment?: 'left' | 'center' | 'right'
    lockScreenName?: string
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoSave: true,
  autoSaveDelay: 800,
  fontSize: 14,
  lineNumbers: true,
  wordWrap: true,
  minimap: false,
  // sensible defaults for caret
  caretEnabled: true,
  caretMaxWidth: 2,
  recentVaults: [],
  expandedFolders: [],
  sidebarVisible: true,
  rightPanelVisible: false,
  graphTheme: 'default',
  fireWall: {
    passwordHash: null,
    lockScreenAlignment: 'center',
    lockScreenName: ''
  }
}

export function loadSettings(): Settings {
  try {
    if (!existsSync(settingsFile)) {
      saveSettings(DEFAULT_SETTINGS)
      return { ...DEFAULT_SETTINGS }
    }

    const raw = readFileSync(settingsFile, 'utf-8')
    const loaded = JSON.parse(raw) as Partial<Settings>
    const merged: Settings = { ...DEFAULT_SETTINGS, ...loaded }

    if (merged.autoSaveDelay && (merged.autoSaveDelay < 100 || merged.autoSaveDelay > 5000)) {
      merged.autoSaveDelay = DEFAULT_SETTINGS.autoSaveDelay
    }

    if (merged.fontSize && (merged.fontSize < 8 || merged.fontSize > 32)) {
      merged.fontSize = DEFAULT_SETTINGS.fontSize
    }

    if (!merged.recentVaults) merged.recentVaults = []
    if (!merged.expandedFolders) merged.expandedFolders = []

    // Validate caret settings
    if (merged.caretEnabled === undefined) merged.caretEnabled = DEFAULT_SETTINGS.caretEnabled
    if (merged.caretMaxWidth && (merged.caretMaxWidth < 1 || merged.caretMaxWidth > 10)) {
      merged.caretMaxWidth = DEFAULT_SETTINGS.caretMaxWidth
    }

    // Migrate old settings to fireWall
    if (!merged.fireWall) {
      merged.fireWall = { ...DEFAULT_SETTINGS.fireWall }
    } else {
      // Ensure sub-keys exist
      merged.fireWall = { ...DEFAULT_SETTINGS.fireWall, ...merged.fireWall }
    }

    const oldKeys = ['passwordHash', 'lockScreenAlignment', 'lockScreenName']
    const loadedAny = loaded as Record<string, unknown>
    const mergedAny = merged as Record<string, unknown>
    const firewallAny = merged.fireWall as Record<string, unknown>

    oldKeys.forEach((key) => {
      if (loadedAny[key] !== undefined) {
        firewallAny[key] = loadedAny[key]
        delete mergedAny[key]
      }
    })

    return merged
  } catch (error) {
    console.warn('Failed to read settings, using defaults', error)
    saveSettings(DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save settings', error)
  }
}

export function updateSettings(updates: Partial<Settings>): Settings {
  const current = loadSettings()
  const updated = { ...current, ...updates }

  // Deep merge fireWall if both exist
  if (updates.fireWall && current.fireWall) {
    updated.fireWall = {
      ...current.fireWall,
      ...updates.fireWall
    }
  }

  saveSettings(updated)
  return updated
}
