# Component Structure Quick Reference

## Component Naming Convention

```
component-name/
├── ComponentName.ts       # Main TypeScript class (PascalCase)
├── component-name.css     # Component styles (kebab-case)
└── [helpers]              # Optional helper files
```

## All Components in KnowledgeHub

### Layout Components

| Component       | Folder           | Main File          | Purpose                                     |
| --------------- | ---------------- | ------------------ | ------------------------------------------- |
| WindowHeader    | `window-header/` | `window-header.ts` | Custom window controls, title bar           |
| ActivityBar     | `activitybar/`   | `activitybar.ts`   | Left sidebar icons (Explorer, Search, etc.) |
| SidebarTree     | `sidebar/`       | `sidebar-tree.ts`  | File tree explorer with drag-drop           |
| TabBar          | `tabbar/`        | `tabbar.ts`        | Multi-tab interface with pinning            |
| EditorComponent | `editor/`        | `editor.ts`        | Monaco-based markdown editor                |
| StatusBar       | `statusbar/`     | `statusbar.ts`     | Bottom status bar (stats, cursor)           |
| RightBar        | `rightbar/`      | `rightbar.ts`      | AI chat panel                               |

### Modal Components

| Component      | Folder             | Main File          | Purpose                         |
| -------------- | ------------------ | ------------------ | ------------------------------- |
| Modal          | `modal/`           | `modal.ts`         | Base modal system (drag/resize) |
| FuzzyFinder    | `fuzzy-finder/`    | `fuzzy-finder.ts`  | Quick file search (Ctrl+P)      |
| CommandPalette | `command-palette/` | (integrated)       | Command search (Ctrl+Shift+P)   |
| SettingsView   | `settings/`        | `settings-view.ts` | Settings panel                  |
| ThemeModal     | `theme-modal/`     | `theme-modal.ts`   | Theme selector                  |
| VaultPicker    | `vault-picker/`    | `vault-picker.ts`  | Vault selection dialog          |
| DetailsModal   | `details-modal/`   | `details-modal.ts` | Note metadata viewer            |
| GraphView      | `graph/`           | `graph.ts`         | Knowledge graph (D3.js)         |

### Utility Components

| Component           | Folder          | Main File            | Purpose                   |
| ------------------- | --------------- | -------------------- | ------------------------- |
| ContextMenu         | `contextmenu/`  | `contextmenu.ts`     | Right-click menus         |
| NotificationManager | `notification/` | `notification.ts`    | Toast notifications       |
| PreviewComponent    | `preview/`      | `preview.ts`         | Markdown preview renderer |
| WikiLinkService     | `wikilink/`     | `wikilinkService.ts` | WikiLink support          |
| UpdateApp           | `updateApp/`    | `updateRender.ts`    | Auto-update UI            |

### RightBar Sub-Components

| Component      | Folder      | Main File            | Purpose             |
| -------------- | ----------- | -------------------- | ------------------- |
| SessionSidebar | `rightbar/` | `session-sidebar.ts` | AI session list     |
| AIMenu         | `rightbar/` | `ai-menu.ts`         | AI chat interface   |
| Avatar         | `rightbar/` | `avatar.ts`          | User avatar display |

### Graph Sub-Components

| Component     | Folder   | Main File           | Purpose             |
| ------------- | -------- | ------------------- | ------------------- |
| GraphControls | `graph/` | `graph-controls.ts` | Graph control panel |
| GraphUtils    | `graph/` | `graph-utils.ts`    | Graph utilities     |

## Services

| Service               | File                                | Purpose              |
| --------------------- | ----------------------------------- | -------------------- |
| AIService             | `services/aiService.ts`             | AI/RAG functionality |
| NoteService           | `services/noteService.ts`           | Note CRUD operations |
| TabService            | `services/tabService.ts`            | Tab management       |
| VaultService          | `services/vaultService.ts`          | Vault operations     |
| SessionStorageService | `services/sessionStorageService.ts` | IndexedDB sessions   |
| GistSyncService       | `services/sync/gistSyncService.ts`  | GitHub Gist sync     |

## Handlers

| Handler         | File                          | Purpose                |
| --------------- | ----------------------------- | ---------------------- |
| TabHandlersImpl | `handlers/tabHandlers.ts`     | Tab event handlers     |
| PreviewHandlers | `handlers/previewHandlers.ts` | Preview event handlers |

## Core Systems

| System          | File                      | Purpose                     |
| --------------- | ------------------------- | --------------------------- |
| State           | `core/state.ts`           | Global application state    |
| Types           | `core/types.ts`           | TypeScript type definitions |
| ThemeManager    | `core/themeManager.ts`    | Theme management            |
| Themes          | `core/themes.ts`          | Theme definitions           |
| KeyboardManager | `core/keyboardManager.ts` | Keyboard shortcuts          |

## Utilities

| Utility         | File                       | Purpose           |
| --------------- | -------------------------- | ----------------- |
| Codicons        | `utils/codicons.ts`        | VS Code icons     |
| FileIconMappers | `utils/fileIconMappers.ts` | File type icons   |
| Helpers         | `utils/helpers.ts`         | Helper functions  |
| TreeUtils       | `utils/tree-utils.ts`      | Tree manipulation |
| ErrorHandler    | `utils/error-handler.ts`   | Error handling    |
| VersionFetcher  | `utils/versionFetcher.ts`  | Version checking  |

## Example: Creating a New Component

### 1. Create Folder Structure

```bash
mkdir src/renderer/src/components/my-component
```

### 2. Create TypeScript File

**File**: `src/renderer/src/components/my-component/MyComponent.ts`

```typescript
import './my-component.css'

export class MyComponent {
  private container: HTMLElement

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!
    this.render()
  }

  render(): void {
    this.container.innerHTML = `
      <div class="my-component">
        <h2 class="my-component__title">My Component</h2>
        <div class="my-component__content">
          <!-- Content here -->
        </div>
      </div>
    `
  }
}
```

### 3. Create CSS File

**File**: `src/renderer/src/components/my-component/my-component.css`

```css
.my-component {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--bg-primary);
}

.my-component__title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.my-component__content {
  flex: 1;
  overflow: auto;
}
```

### 4. Import in App

**File**: `src/renderer/src/app.ts`

```typescript
import { MyComponent } from './components/my-component/MyComponent'

// In App class constructor
this.myComponent = new MyComponent('my-component-container')
```

## Naming Rules Summary

| Type            | Convention       | Example                            |
| --------------- | ---------------- | ---------------------------------- |
| Folder          | kebab-case       | `my-component/`                    |
| TypeScript File | PascalCase       | `MyComponent.ts`                   |
| CSS File        | kebab-case       | `my-component.css`                 |
| Class Name      | PascalCase       | `class MyComponent`                |
| Service File    | camelCase        | `myService.ts`                     |
| Utility File    | camelCase        | `myUtil.ts`                        |
| CSS Class       | kebab-case + BEM | `.my-component__element--modifier` |

## CSS Naming (BEM-like)

```css
.component {
} /* Block */
.component__element {
} /* Element */
.component__element--modifier {
} /* Modifier */
.component--variant {
} /* Block variant */
```

**Example**:

```css
.sidebar {
}
.sidebar__header {
}
.sidebar__item {
}
.sidebar__item--active {
}
.sidebar--collapsed {
}
```

## State Access Pattern

```typescript
import { state } from '../../core/state'

// Read state
const activeNote = state.notes.find((n) => n.id === state.activeId)

// Update state
state.activeId = newId
state.isDirty = true

// Trigger re-render
this.render()
```

## Service Usage Pattern

```typescript
import { noteService } from '../../services/noteService'

// Use service
const note = await noteService.getNote(id)
await noteService.saveNote(note)
```

## Handler Pattern

```typescript
// Define handler type
private onItemClick?: (id: string) => void

// Setter method
setItemClickHandler(handler: (id: string) => void): void {
  this.onItemClick = handler
}

// Call handler
if (this.onItemClick) {
  this.onItemClick(itemId)
}
```

---

**Remember**: This structure ensures DRY (Don't Repeat Yourself) principles and maintains consistency across the entire codebase.
