# KnowledgeHub - Antigravity Development Guide

## Project Overview

**KnowledgeHub** is an Electron-based knowledge management application built with TypeScript, featuring a robust markdown editor, AI-powered assistance, and advanced note organization capabilities. The project follows a **DRY (Don't Repeat Yourself)** approach with a modular, component-based architecture.

**Version**: 0.0.7  
**Tech Stack**: Electron, TypeScript, Monaco Editor, D3.js, Lucide Icons  
**Architecture**: Main Process (Node.js) + Renderer Process (Browser)

---

## Core Architecture Principles

### 1. **DRY (Don't Repeat Yourself)**

- **No duplicate code**: Every feature is implemented once and reused
- **No redundancy**: Shared logic lives in services, utilities, or handlers
- **Robust implementation**: Code is maintainable, testable, and scalable

### 2. **Component-Based Structure**

Every UI component follows this **strict folder structure**:

```
component-name/
├── ComponentName.ts       # Main component logic (TypeScript class)
├── component-name.css     # Component-specific styles
└── [additional files]     # Helper files if needed (e.g., utils, types)
```

**Example: Header Component**

```
window-header/
├── window-header.ts       # WindowHeader class
└── window-header.css      # Header styles
```

**Rules:**

- **Folder name**: lowercase with hyphens (e.g., `fuzzy-finder`)
- **Main file**: PascalCase class name (e.g., `FuzzyFinder.ts`)
- **CSS file**: matches folder name (e.g., `fuzzy-finder.css`)
- **Class export**: Always export the main class (e.g., `export class FuzzyFinder`)

### 3. **Service Layer Pattern**

Services handle business logic and data operations:

```
services/
├── aiService.ts              # AI/RAG functionality
├── noteService.ts            # Note CRUD operations
├── tabService.ts             # Tab management
├── vaultService.ts           # Vault operations
├── sessionStorageService.ts  # IndexedDB session storage
└── sync/
    └── gistSyncService.ts    # GitHub Gist sync
```

**Service Singleton Pattern:**

```typescript
export class MyService {
  // Service implementation
}

export const myService = new MyService()
```

### 4. **State Management**

Centralized application state in `core/state.ts`:

```typescript
export const state: AppState = {
  notes: [], // All notes metadata
  tree: [], // Hierarchical tree structure
  expandedFolders: new Set(), // Expanded folder IDs
  openTabs: [], // Currently open tabs
  activeId: '', // Active note ID
  isDirty: false, // Unsaved changes flag
  pinnedTabs: new Set(), // Pinned tab IDs
  selectedIds: new Set(), // Multi-selected items
  cursorPositions: new Map() // Cursor positions per note
  // ... more state properties
}
```

**State is the single source of truth** - components read from and update state.

---

## Project Structure

```
knowledgeHub/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Main entry, window creation
│   │   ├── vault.ts             # File system operations
│   │   └── settings.ts          # Settings persistence
│   │
│   ├── preload/                 # Electron preload scripts
│   │   ├── index.ts             # IPC bridge
│   │   └── index.d.ts           # TypeScript definitions
│   │
│   └── renderer/src/            # Browser/UI process
│       ├── app.ts               # Main application class
│       ├── window-header-init.ts # Window controls initialization
│       │
│       ├── components/          # UI Components (see below)
│       ├── core/                # Core systems
│       ├── services/            # Business logic services
│       ├── handlers/            # Event handlers
│       └── utils/               # Utility functions
│
├── build/                       # Build assets (icons)
├── resources/                   # App resources
├── scripts/                     # Build/publish scripts
└── notes/                       # Documentation notes
```

---

## Components Architecture

### Component Categories

#### 1. **Layout Components**

- **`window-header/`**: Custom window controls, title bar
- **`activitybar/`**: Left sidebar with icons (Explorer, Search, Settings, etc.)
- **`sidebar/`**: File tree explorer with drag-drop
- **`tabbar/`**: Multi-tab interface with pinning
- **`editor/`**: Monaco-based markdown editor with live preview
- **`statusbar/`**: Bottom status bar (word count, cursor position)
- **`rightbar/`**: AI chat panel with session management

#### 2. **Modal Components**

- **`modal/`**: Base modal system with drag/resize
- **`fuzzy-finder/`**: Quick file search (Ctrl+P)
- **`command-palette/`**: Command search (Ctrl+Shift+P)
- **`settings/`**: Settings panel with tabs
- **`theme-modal/`**: Theme selector
- **`vault-picker/`**: Vault selection dialog
- **`details-modal/`**: Note metadata viewer
- **`graph/`**: Knowledge graph visualization (D3.js)

#### 3. **Utility Components**

- **`contextmenu/`**: Right-click context menus
- **`notification/`**: Toast notifications
- **`preview/`**: Markdown preview renderer
- **`wikilink/`**: WikiLink support ([[note-name]])
- **`updateApp/`**: Auto-update system

---

## Implemented Features

### ✅ **Core Features**

#### 1. **Vault Management**

- Create/select vault directories
- Recent vaults tracking
- Vault migration support
- File system watching (Chokidar)

#### 2. **Note Management**

- Create/edit/delete notes and folders
- Hierarchical folder structure
- Drag-and-drop organization
- Duplicate name prevention
- Multi-selection support
- Note metadata (created, updated, word count, tags)

#### 3. **Editor**

- Monaco Editor integration
- Markdown syntax highlighting
- Live preview mode
- Reading mode (full-width preview)
- Source mode (code editor)
- Auto-save functionality
- WikiLink support with autocomplete
- Hashtag highlighting
- Cursor position persistence
- Drag-and-drop file/folder insertion

#### 4. **Tab System**

- Multi-tab workspace
- Tab pinning
- Tab reordering
- Dirty state indicators
- Close tab with unsaved changes prompt
- Tab context menu (close others, close all, pin)
- Tab overflow handling
- File-type icons per tab

#### 5. **Search & Navigation**

- Fuzzy finder (Ctrl+P) - quick file search
- Command palette (Ctrl+Shift+P)
- Sidebar search/filter
- Search mode with highlighting
- WikiLink navigation (Ctrl+Click)

#### 6. **Knowledge Graph**

- D3.js force-directed graph
- Node clustering by tags/folders
- Interactive zoom/pan
- Node hover with connections
- Particle animations on hover
- Search and filter nodes
- Local graph mode (show connections from active note)
- Path finding between notes
- Export graph (SVG/PNG/JSON)
- Graph statistics

#### 7. **AI Features (RAG-based)**

- DeepSeek API integration
- Context-aware chat with notes
- Session management (IndexedDB)
- Chat modes (Balanced, Thinking, Creative, Coding)
- Note citations in responses
- Lazy-loading note content
- TF-IDF relevance scoring
- Streaming responses
- Session search and filtering
- Message feedback (thumbs up/down)

#### 8. **Themes**

- Multiple built-in themes
- Custom theme support
- Theme variables (CSS custom properties)
- Dark/light mode variants
- Theme persistence

#### 9. **Settings**

- Vault path configuration
- Editor settings (font size, line numbers, word wrap, minimap)
- Auto-save settings
- API key management (DeepSeek, GitHub Gist)
- Window bounds persistence
- Right panel width/visibility
- Caret settings (max width)

#### 10. **Sync (Gist)**

- GitHub Gist integration
- Vault backup to Gist
- Restore from Gist
- Conflict resolution

#### 11. **Auto-Update**

- Electron-updater integration
- GitHub releases integration
- Update notifications
- Download progress
- Install on quit

#### 12. **HUB Console**

- Secure, sandboxed terminal for system commands
- Command history (Arrow Up/Down)
- Tab-completion for commands with cycling support
- Persistent, resizable UI with drag-knob
- Custom prompt with user/vault info
- Multi-maximize/restore functionality

---

## Key Technologies

### **Frontend**

- **Monaco Editor**: Code editor (VS Code's editor)
- **D3.js**: Graph visualization
- **Lucide Icons**: Modern icon library
- **IndexedDB**: Client-side storage (sessions)

### **Backend (Main Process)**

- **Electron**: Desktop app framework
- **Chokidar**: File system watcher
- **Electron-updater**: Auto-update system

### **Build Tools**

- **Electron-Vite**: Fast Vite-based build
- **Electron-Builder**: App packaging
- **TypeScript**: Type safety

---

## Component Communication Patterns

### 1. **Handler Pattern**

Components use handlers for event delegation:

```typescript
// In component
private onNoteSelect?: (id: string) => void

setNoteSelectHandler(handler: (id: string) => void): void {
  this.onNoteSelect = handler
}

// In app.ts
sidebar.setNoteSelectHandler((id) => {
  this.openNote(id)
})
```

### 2. **Service Pattern**

Services are singletons imported where needed:

```typescript
import { noteService } from './services/noteService'

const note = await noteService.getNote(id)
```

### 3. **State Updates**

Components update state and trigger re-renders:

```typescript
state.activeId = noteId
state.isDirty = true
this.tabBar.render()
this.sidebar.updateSelection(noteId)
```

---

## Styling Guidelines

### **CSS Architecture**

- **Component-scoped styles**: Each component has its own CSS file
- **BEM-like naming**: `.component__element--modifier`
- **CSS Variables**: Use theme variables for colors
- **No global styles**: Except in `index.css` for resets

### **Example Component CSS**

```css
/* sidebar/sidebar-tree.css */
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
}

.sidebar__header {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar__item {
  padding: 4px 8px;
  cursor: pointer;
}

.sidebar__item--active {
  background: var(--item-active-bg);
}
```

---

## File Naming Conventions

### **TypeScript Files**

- **Components**: `ComponentName.ts` (PascalCase)
- **Services**: `serviceName.ts` (camelCase)
- **Utils**: `utilName.ts` (camelCase)
- **Types**: `types.ts`

### **CSS Files**

- **Component styles**: `component-name.css` (kebab-case)

### **Folders**

- **All folders**: `folder-name` (kebab-case)

---

## Development Workflow

### **Adding a New Component**

1. **Create folder structure**:

   ```
   components/my-component/
   ├── MyComponent.ts
   └── my-component.css
   ```

2. **Implement component class**:

   ```typescript
   export class MyComponent {
     private container: HTMLElement

     constructor(containerId: string) {
       this.container = document.getElementById(containerId)!
       this.render()
     }

     render(): void {
       this.container.innerHTML = `
         <div class="my-component">
           <!-- Component markup -->
         </div>
       `
     }
   }
   ```

3. **Add styles**:

   ```css
   .my-component {
     /* Component styles */
   }
   ```

4. **Import in app.ts**:

   ```typescript
   import { MyComponent } from './components/my-component/MyComponent'

   // In App constructor
   this.myComponent = new MyComponent('my-component-container')
   ```

### **Adding a New Service**

1. **Create service file**: `services/myService.ts`

2. **Implement service**:

   ```typescript
   export class MyService {
     async doSomething(): Promise<void> {
       // Service logic
     }
   }

   export const myService = new MyService()
   ```

3. **Import where needed**:
   ```typescript
   import { myService } from './services/myService'
   ```

---

## IPC Communication

### **Renderer → Main**

```typescript
// Renderer
const result = await window.api.vault.readNote(id, path)

// Main (in vault.ts)
ipcMain.handle('vault:read-note', async (_, id, path) => {
  return await vault.readNote(id, path)
})
```

### **Main → Renderer**

```typescript
// Main
mainWindow.webContents.send('vault:changed')

// Renderer
window.api.vault.onChanged(() => {
  // Handle vault change
})
```

---

## Testing Strategy

### **Manual Testing**

- Test all features after changes
- Check for console errors
- Verify state persistence
- Test edge cases (empty vault, large files, etc.)

### **Build Testing**

```bash
npm run build        # Type check + build
npm run dev          # Development mode
npm run build:win    # Windows build
```

---

## Common Patterns

### **1. Lazy Initialization**

```typescript
private editor: Monaco | null = null

async ensureEditor(): Promise<void> {
  if (!this.editor) {
    this.editor = await this.loadMonaco()
  }
}
```

### **2. Event Delegation**

```typescript
private handleClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement
  const button = target.closest('.my-button')
  if (button) {
    // Handle click
  }
}
```

### **3. Debouncing**

```typescript
private saveTimeout?: NodeJS.Timeout

scheduleSave(): void {
  clearTimeout(this.saveTimeout)
  this.saveTimeout = setTimeout(() => this.save(), 500)
}
```

---

## Performance Optimizations

1. **Virtual Scrolling**: Large file trees use efficient rendering
2. **Lazy Loading**: Monaco editor loads on-demand
3. **Debounced Saves**: Auto-save uses debouncing
4. **IndexedDB**: Fast client-side storage for sessions
5. **Incremental Rendering**: Graph updates incrementally
6. **Memoization**: Expensive calculations are cached

---

## Security Considerations

1. **Content Security Policy**: Strict CSP in production
2. **Context Isolation**: Enabled in Electron
3. **Node Integration**: Disabled in renderer
4. **IPC Validation**: All IPC calls validated
5. **API Keys**: Stored securely in settings

---

## Build & Distribution

### **Development**

```bash
npm run dev          # Start dev server
```

### **Production Build**

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### **Publishing**

```bash
npm run dist:publish # Build + publish to GitHub
```

---

## Troubleshooting

### **Common Issues**

1. **Monaco not loading**: Check worker configuration
2. **State not persisting**: Verify `persistWorkspace()` calls
3. **Tabs not updating**: Ensure `tabBar.render()` is called
4. **Graph not rendering**: Check D3.js import and SVG container

### **Debug Tools**

- **DevTools**: F12 in app
- **Console logs**: Check for errors
- **State inspection**: Log `state` object
- **IPC debugging**: Enable IPC logging

---

## Future Enhancements (See ROADMAP.md)

- Local embeddings for offline RAG
- Advanced vector search (HNSW)
- Session organization (folders/tags)
- Mobile responsive design
- Plugin system
- Collaborative editing

---

## Contributing Guidelines

1. **Follow DRY principles**: No duplicate code
2. **Use component structure**: Folder per component
3. **Type everything**: No `any` types
4. **Document complex logic**: Add comments
5. **Test thoroughly**: Manual testing required
6. **Keep it simple**: Avoid over-engineering

---

## Key Files Reference

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `src/renderer/src/app.ts`                             | Main application orchestrator |
| `src/main/index.ts`                                   | Electron main process         |
| `src/main/vault.ts`                                   | File system operations        |
| `src/renderer/src/core/state.ts`                      | Global state                  |
| `src/renderer/src/core/types.ts`                      | TypeScript types              |
| `src/renderer/src/services/aiService.ts`              | AI/RAG logic                  |
| `src/renderer/src/components/editor/editor.ts`        | Monaco editor                 |
| `src/renderer/src/components/sidebar/sidebar-tree.ts` | File tree                     |
| `src/renderer/src/components/graph/graph.ts`          | Knowledge graph               |

---

## Summary

**KnowledgeHub** is a well-architected, modular Electron application following strict DRY principles. Every component is self-contained, services handle business logic, and state management is centralized. The codebase is maintainable, scalable, and follows modern TypeScript best practices.

**When working with other AI models**, share this document to ensure they understand:

- The component structure (folder/file naming)
- The service layer pattern
- The state management approach
- The DRY philosophy
- The existing feature set

This ensures consistent, high-quality contributions to the project.
