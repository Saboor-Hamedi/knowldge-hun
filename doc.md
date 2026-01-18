# Knowledge Hub — Documentation

## Project Overview

Knowledge Hub is a minimal Electron application written in TypeScript for managing a simple local "vault" of notes (Markdown and text files). It provides a desktop UI with an editor, sidebar tree, tabs, search, a knowledge graph, and sync/backup features.

## Quick Start

- Requirements: Node.js (16+ recommended), npm, Git.
- Install dependencies:

```bash
npm install
```

- Run in development mode:

```bash
npm run dev
```

- Run the packaged app (preview):

```bash
npm run start
```

- Build and package:

```bash
npm run build      # typecheck + build
npm run build:win  # Windows installer
npm run build:mac  # macOS
npm run build:linux # Linux
```

- Useful scripts (from `package.json`):
  - `npm run dev` — start dev server
  - `npm run build` — run type checks and build
  - `npm run format` — run Prettier
  - `npm run lint` — run ESLint
  - `npm run dist:publish` — build and run publish flow

See [package.json](package.json) for the full scripts list.

## Repository Layout

- [src/main/index.ts](src/main/index.ts) — Electron main process entry. Sets up windows, IPC handlers, vault initialization, and update integration.
- [src/main/vault.ts](src/main/vault.ts) — Vault manager: file indexing, watcher, note operations (create, save, rename, move, delete, search, backlinks, graph links).
- [src/main/settings.ts](src/main/settings.ts) — Settings storage and defaults, saved to the app's userData directory.
- [src/preload/index.ts](src/preload/index.ts) — Preload script that exposes a safe `api` to the renderer via `contextBridge`.
- [src/renderer/src](src/renderer/src) — Renderer UI code (components, services, handlers, and the main app bootstrap in `app.ts`).
- [resources/] — Application icons and static assets.
- [build/] — Build outputs and tooling artifacts.

## Architecture Overview

The app follows a standard Electron architecture with three main layers:

1. Main process
   - Entry: [src/main/index.ts](src/main/index.ts)
   - Responsibilities: window lifecycle, IPC handlers, vault initialization, file-system operations are delegated to `VaultManager`.
   - Exposes IPC channels (handled via `ipcMain.handle`) to the renderer for notes, folders, vaults, settings, sync, and window controls.

2. Preload
   - File: [src/preload/index.ts](src/preload/index.ts)
   - Purpose: Exposes a small, safe `api` object that the renderer uses to interact with the main process. All IPC calls are routed through these methods.

3. Renderer
   - Entry: [src/renderer/src/app.ts](src/renderer/src/app.ts)
   - Structure: component-based UI (activity bar, sidebar tree, editor, tabs, right panel, status bar, modals).
   - Services: `noteService`, `vaultService`, `tabService`, `aiService`, etc., orchestrate interactions between UI components and the `api`.

## Vault and Notes

- Vault root contains notes and folders. Notes are plain files with extensions: `.md` and `.txt`.
- Note identity: a note's `id` is the file path relative to the vault root with the extension removed. Example: `notes/today.md` → id `notes/today`.
- Folders are represented by relative paths and exposed as `type: 'folder'` in the tree.
- The vault manager maintains in-memory caches of notes, folders, and simple link graphs (wiki links `[[note]]`).
- The vault watcher (via `chokidar`) tracks file adds/changes/deletes and notifies the renderer via `vault-changed` events.

## Settings

Default settings are defined in [src/main/settings.ts](src/main/settings.ts) as `DEFAULT_SETTINGS`. Settings are saved in `settings.json` under the platform-specific `app.getPath('userData')` folder. Exposed settings include theme, autoSave, fontSize, vaultPath, recentVaults, openTabs, and sync tokens (gist token/id).

## IPC API (Preload `api`)

The preload exposes the following methods (short summary):

- Vault & Notes
  - `listNotes()` -> Promise<TreeItem[]> — list all notes and folders
  - `loadNote(id, path?)` -> Promise<NotePayload|null> — read note content
  - `createNote(title?, path?)` -> Promise<NoteMeta>
  - `saveNote(payload)` -> Promise<NoteMeta>
  - `deleteNote(id, path?)` -> Promise<{ id }>
  - `moveNote(id, fromPath?, toPath?)` -> Promise<NoteMeta>
  - `renameNote(id, newId, path?)` -> Promise<NoteMeta>
  - `importNote(filePath, folderPath?)` -> Promise<NoteMeta>
  - `searchNotes(query)` -> Promise<NoteMeta[]>
  - `getBacklinks(id)` -> Promise<string[]>
  - `getGraph()` -> Promise<{ links: { source, target }[] }>
  - `createFolder(name, parentPath?)` -> Promise<{ name, path }>
  - `deleteFolder(path)` -> Promise<{ path }>
  - `renameFolder(path, newName)` -> Promise<{ path }>
  - `moveFolder(source, target)` -> Promise<{ path }>

- Vault management
  - `getVault()` -> Promise<{ path, name }>
  - `chooseVault()` -> Promise<{ path, name, changed }>
  - `setVault(dir)` -> Promise<{ path, name, changed }>
  - `revealVault()` -> Promise<void>
  - `validateVaultPath(path)` -> Promise<{ exists, lastOpened? }>
  - `locateMovedVault(originalPath)` -> Promise<{ foundPath | null }>

- Assets
  - `saveAsset(buffer, name)` -> Promise<string> — saves into `assets/` under vault root and returns relative path.

- Settings
  - `getSettings()` -> Promise<AppSettings>
  - `updateSettings(updates)` -> Promise<AppSettings>
  - `resetSettings()` -> Promise<AppSettings>

- Window controls
  - `window.minimize()/maximize()/unmaximize()/isMaximized()/close()`

- App info & updates
  - `getAppIcon()` -> Promise<string>
  - `getAppVersion()` -> Promise<string>
  - `requestUpdate()` — triggers update check (main sends update events to renderer)

- Sync (GitHub Gist)
  - `syncBackup(token, gistId, vaultData)`
  - `syncRestore(token, gistId)`
  - `syncTestToken(token)`

- Events
  - `onVaultChanged(callback)` — subscribe to `vault:changed` events (preload uses `ipcRenderer.on`).

See the implementation in [src/preload/index.ts](src/preload/index.ts) and the handlers in [src/main/index.ts](src/main/index.ts).

## Features

- Local vault of Markdown/Text notes with folders
- Live filesystem watcher and automatic indexing
- Editor powered by `monaco-editor` with settings (font size, word wrap, line numbers)
- Tabs with pinning and workspace persistence
- Quick open/fuzzy finder
- Knowledge graph derived from simple wiki-links `[[target]]`
- Backup/restore using GitHub Gist (token-based)
- Drag-and-drop import of files and vaults
- Basic asset saving into `assets/` folder inside the vault

## Developer Guide

- TypeScript configuration splits Node/main and web/renderer builds: `tsconfig.node.json`, `tsconfig.web.json`.
- Linting and formatting: `eslint` and `prettier` are configured. Use:

```bash
npm run lint
npm run format
```

- Run type checks only:

```bash
npm run typecheck
```

- The renderer uses a component structure at `src/renderer/src/components` and services at `src/renderer/src/services`.

- Main-process responsibilities (file system) live under `src/main/` (not bundled into renderer). Keep file-system and privileged APIs only in main/preload.

- When adding IPC handlers, update both:
  1. `src/main/index.ts` to provide `ipcMain.handle(...)`
  2. `src/preload/index.ts` to add a safe wrapper method
  3. `src/renderer` code to call the method via `window.api` or `window.electron`

## Contributing

- Fork and open a PR.
- Keep changes scoped and run the linter and formatter before committing.

## Troubleshooting & Notes

- If the vault path is missing or moved, the app attempts to locate it in common directories and offers a vault picker.
- Settings are stored under the Electron `userData` location in `settings.json` (see [src/main/settings.ts](src/main/settings.ts)).
- On Windows, moving/renaming folders may require stopping and restarting the watcher; the code handles restarting the watcher where necessary.
- If you see missing-note errors after renames, try `Reload Vault` (Ctrl+Shift+R) or `Reload Window`.

## Where to look in the code

- Main process: [src/main/index.ts](src/main/index.ts)
- Vault logic: [src/main/vault.ts](src/main/vault.ts)
- Settings: [src/main/settings.ts](src/main/settings.ts)
- Preload API: [src/preload/index.ts](src/preload/index.ts)
- Renderer entry: [src/renderer/src/app.ts](src/renderer/src/app.ts)
- Renderer components: [src/renderer/src/components](src/renderer/src/components)
- Renderer services: [src/renderer/src/services](src/renderer/src/services)

## Next steps / Suggestions

- Add unit and integration tests for `VaultManager` behaviors.
- Add documentation comments and TypeDoc generation for public APIs.
- Add automated CI to run `npm run lint`, `npm run typecheck`, and `npm run test` (if tests are added).

---

Generated documentation for local developer use. If you want, I can expand any section (API reference, component docs, examples, or a CONTRIBUTING guide).