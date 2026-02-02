# Terminal Module

A comprehensive terminal emulator module for Knowledge Hub, built with xterm.js and node-pty.

## Architecture

### Main Process (`src/main/modules/terminal/`)

**Purpose**: Manages PTY (pseudo-terminal) processes and IPC communication

#### Files:

- **`index.ts`** - Main entry point, exports public API
- **`terminal-manager.ts`** - Core PTY process management
- **`terminal-handlers.ts`** - IPC handlers for renderer communication
- **`terminal.types.ts`** - TypeScript interfaces and types

#### Key Features:

- ✅ Multi-session PTY management
- ✅ Cross-platform shell support (PowerShell, CMD, Bash, WSL, Zsh)
- ✅ Data buffering for initial output
- ✅ Graceful cleanup on app shutdown
- ✅ Environment sanitization for Windows shells

---

### Renderer Process (`src/renderer/src/components/terminal/`)

**Purpose**: Frontend terminal UI using xterm.js

#### Files:

- **`index.ts`** - Component exports
- **`real-terminal.ts`** - Main terminal component (legacy, to be refactored)
- **`terminal.types.ts`** - TypeScript interfaces
- **`terminal-shell.service.ts`** - Shell detection and utilities
- **`terminal.css`** - Styles

#### Key Features:

- ✅ Multi-session terminal tabs
- ✅ Split view support
- ✅ Session customization (names, colors)
- ✅ Search functionality (Ctrl+F)
- ✅ Hardware acceleration (WebGL → Canvas fallback)
- ✅ Session persistence with localStorage
- ✅ Console integration (TERMINAL/CONSOLE tabs)

---

## Usage

### Main Process

```typescript
import { registerTerminalHandlers, cleanupTerminals } from './modules/terminal'

// During app initialization
app.whenReady().then(() => {
  registerTerminalHandlers()
})

// During app shutdown
app.on('quit', () => {
  cleanupTerminals()
})
```

### Renderer Process

```typescript
import { RealTerminalComponent } from './components/terminal/real-terminal'

// Initialize terminal
const terminal = new RealTerminalComponent('terminalHost')

// Create new session
await terminal.createNewTerminal('powershell', 'C:\\Users\\username')

// Toggle visibility
terminal.toggle()
```

---

## IPC API

### `terminal:create`

Create a new terminal session

```typescript
await window.api.invoke('terminal:create', sessionId, cwd, shellType, cols, rows)
```

### `terminal:write`

Write data to terminal

```typescript
window.api.send('terminal:write', sessionId, data)
```

### `terminal:resize`

Resize terminal dimensions

```typescript
window.api.send('terminal:resize', sessionId, cols, rows)
```

### `terminal:kill`

Kill a terminal session

```typescript
await window.api.invoke('terminal:kill', sessionId)
```

### `terminal:restart`

Restart a terminal session

```typescript
await window.api.invoke('terminal:restart', sessionId, cwd, shellType, cols, rows)
```

### `terminal:get-available-shells`

Get list of available shells

```typescript
const shells = await window.api.invoke('terminal:get-available-shells')
// Returns: [{ value: 'powershell', label: 'PowerShell' }, ...]
```

---

## Supported Shells

### Windows

- **PowerShell** (`powershell`)
- **PowerShell Core** (`pwsh`)
- **Command Prompt** (`cmd`)
- **Git Bash** (`bash`)
- **WSL** (`wsl` or `wsl:Ubuntu`, `wsl:Debian`, etc.)

### macOS

- **Zsh** (`zsh`) - Default
- **Bash** (`bash`)

### Linux

- **Bash** (`bash`) - Default
- **Zsh** (`zsh`)

---

## Session Persistence

Terminal sessions are persisted across app restarts:

1. **Session Metadata**: Stored in `localStorage` as `terminal_sessions`
2. **Active Session**: Tracked in `terminal_active_session`
3. **Buffer History**: Saved as `terminal_buffer_{sessionId}`
4. **Custom Names/Colors**: Stored in vault's `.config.json`

---

## Keyboard Shortcuts

| Shortcut      | Action                |
| ------------- | --------------------- |
| `Ctrl + ``    | Toggle terminal panel |
| `Ctrl + F`    | Open search           |
| `Ctrl + C`    | Copy selected text    |
| `Ctrl + V`    | Paste                 |
| `Right Click` | Paste from clipboard  |

---

## Future Improvements

### Planned Refactoring:

1. ✅ **Modular Structure** - Separate concerns into dedicated files
2. ⏳ **Session Manager** - Extract session management logic
3. ⏳ **UI Renderer** - Separate UI rendering from business logic
4. ⏳ **Event Handler** - Dedicated event handling class
5. ⏳ **Settings Manager** - Centralized settings management

### Enhancements:

- [ ] Terminal themes support
- [ ] Custom keybindings
- [ ] Terminal profiles
- [ ] Command history persistence
- [ ] Terminal recording/playback
- [ ] Better error recovery

---

## Troubleshooting

### Terminal not appearing

- Check if `terminalHost` element exists in DOM
- Verify IPC handlers are registered
- Check console for errors

### Shell not found

- Ensure shell is installed and in PATH
- Check `terminal:get-available-shells` response
- Verify shell executable permissions

### Performance issues

- Disable WebGL if causing problems
- Reduce terminal buffer size
- Limit number of active sessions

---

## Contributing

When modifying the terminal module:

1. **Maintain backward compatibility** with existing IPC API
2. **Update types** in `terminal.types.ts`
3. **Test on all platforms** (Windows, macOS, Linux)
4. **Document changes** in this README
5. **Follow existing code style** and patterns

---

## License

Part of Knowledge Hub - See main LICENSE file
