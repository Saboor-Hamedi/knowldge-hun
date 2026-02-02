# KnowledgeHub: The Professional Manual

Welcome to **KnowledgeHub**, a high-performance, AI-enhanced environment designed for the intersection of **technical code and academic research**. This manual provides a deep dive into the architecture, features, and shortcuts that make KnowledgeHub the ultimate tool for managing sophisticated information at scale.

---

## 📑 Table of Contents

1. [Project Pipeline & Architecture](#-project-pipeline--architecture)
2. [HUB Console](#-hub-console-command-line-interface)
3. [Core Features](#-core-features)
4. [Keyboard Shortcuts](#-keyboard-shortcuts)
5. [Best Practices](#-the-knowledgehub-way-best-practices)
6. [Vault Security & Firewall](#-vault-security--firewall)
7. [Data Privacy](#-data-privacy)

---

## 🚀 Project Pipeline & Architecture

### 1. The RAG Intelligence Pipeline

This diagram illustrates the lifecycle of a note, from a simple text file to a semantically searchable intelligence unit.

```text
[ Markdown File (.md) ]
          |
          | (1) Watcher Engine (chokidar) detects disk changes
          v
[ Hot Reload & Ingestion ]
          |
          +----------------------------------------------+
          |                                              |
(2) Link Extraction                         (3) Semantic Embedding
          |                                              |
          v                                              v
[ Knowledge Graph View ]                     [ Local AI Transformer (MiniLM) ]
(Force-Directed Edges)                         (384-Dimensional Vectoring)
          |                                              |
          v                                              v
[ Relational Mapping ]                        [ Local Vector Database (IndexedDB) ]
(Backlinks & Discovery)                        (High-speed Retrieval Store)
          |                                              |
          +-----------------------+----------------------+
                                  |
               (4) Synthesis: Querying the nearest semantic neighbors
                                  v
                    [ Smart Search & AI Suggestions ]
```

**Pipeline Details:**

- **Ingestion**: Unlike traditional apps, KnowledgeHub doesn't "import" data. It maps your folders.
- **Embedding**: We use a local transformer to turn your words into numbers. Two notes that are "similar" in meaning will have vectors that point in a similar direction.
- **Retrieval**: When you search for "productivity", the system finds vectors close to the "productivity" concept, even if the word itself isn't in the note.

---

### 2. Multi-Process Architecture

KnowledgeHub is split into three distinct layers to ensure that heavy AI computations never freeze your typing experience.

```text
   MAIN PROCESS              PRELOAD BRIDGE           RENDERER PROCESS
  (System/Node.js)          (Security Layer)           (UI/Chromium)
  +--------------+          +--------------+          +---------------+
  | File System  | <------> |  Api Bridge  | <------> | Monaco Editor |
  | IPC Handlers |          | (window.api) |          | Graph Engine  |
  | App Settings |          +--------------+          | App State     |
  +--------------+                 ^                  +---------------+
         ^                         |                         ^
         |                         |                         |
         +-------------------------+-------------------------+
                                   |
                         +-----------------------+
                         |  BACKGROUND WORKER    |
                         | (RAG Transformer AI)  |
                         +-----------------------+
```

**Architecture Benefits:**

- **Security**: The Renderer (UI) cannot access your files directly; it must request them through the "Preload Bridge".
- **Performance**: The "Background Worker" runs on a separate CPU thread. Even if the AI is processing 1,000 notes, your editor stays at a silky smooth 60fps.
- **Stability**: If the AI model crashes, the rest of the application remains functional.

---

## 💻 Terminal Panel: Unified Command Center

The **Terminal Panel** is the command center of KnowledgeHub, seamlessly integrating a standard system terminal with the AI-powered HUB Console.

### Opening the Panel

**Keyboard Shortcut**: `Ctrl + J`

**Alternative Methods**:

- Click the terminal icon in the status bar
- Use Command Palette (`Ctrl + Shift + P`) → "Toggle Terminal"

### Interface Overview

The panel features two main tabs:

1. **TERMINAL**: A fully functional system shell (PowerShell, CMD, Bash, etc.)
2. **CONSOLE**: The AI-powered HUB Console for semantic search and vault management

**Key Features**:

- **Tabbed Interface**: Switch instantly between system operations and AI commands
- **Resize Knob**: Drag the top edge handle to resize the panel smoothly
- **Split View**: Run multiple terminal sessions side-by-side
- **Session Management**: Create, rename, and color-code terminal sessions
- **Consistent Shortcut**: `Ctrl + J` toggles the entire panel visibility

---

## 📚 Console Tab Reference

### Core Commands

#### `help`

**Description**: Display all available commands with descriptions and usage examples.

**Usage**:

```bash
help
```

**Output**:

```
Available Commands:
  help                  - Show this help message
  clear                 - Clear console output
  find <query>          - Semantic search across vault
  index-vault           - Re-index all notes for RAG
  close                 - Close the console
```

---

#### `clear`

**Description**: Clear all console output for a clean slate.

**Usage**:

```bash
clear
```

**Use Cases**:

- Clean up after long command outputs
- Reset console before starting new task
- Remove clutter from debugging sessions

---

#### `close`

**Description**: Hide the console panel (same as pressing `Ctrl + J`).

**Usage**:

```bash
close
```

---

### Search & Discovery Commands

#### `find <query>`

**Description**: **Semantic RAG Search** - Use natural language to find conceptually related notes, even if they don't contain the exact search terms.

**How It Works**:

1. Your query is converted to a 384-dimensional vector using Transformers.js
2. The system searches the vector database for similar note embeddings
3. Results are ranked by cosine similarity (0-100% match)
4. Top 5 most relevant notes are displayed

**Usage**:

```bash
find <natural language query>
```

**Examples**:

```bash
# Find notes about memory management
find memory leak patterns

# Find notes about productivity
find how to stay focused

# Find technical documentation
find API authentication flow

# Find research notes
find quantum computing basics
```

**Output Format**:

```
Searching for: "memory leak patterns"
Found 3 relevant notes:

1. debugging-guide.md (87% match)
   Path: /technical/debugging-guide.md
   Snippet: "Common memory leak patterns in JavaScript include..."

2. performance-optimization.md (76% match)
   Path: /notes/performance-optimization.md
   Snippet: "Memory profiling tools can help identify..."

3. best-practices.md (65% match)
   Path: /best-practices.md
   Snippet: "Avoid circular references to prevent memory..."
```

**Advanced Features**:

- **Fuzzy Matching**: Finds conceptually similar notes
- **Context Awareness**: Understands synonyms and related concepts
- **Multi-word Queries**: Supports complex natural language queries
- **Ranked Results**: Shows similarity percentage for each result

**Performance**:

- Search latency: ~50-200ms (depending on vault size)
- Works offline once notes are indexed
- No external API calls required

---

#### `index-vault`

**Description**: Manually re-index all notes in your vault for semantic search. This command is useful when:

- You've added many new notes
- Notes were modified outside KnowledgeHub
- Search results seem outdated
- You want to force a fresh index

**Usage**:

```bash
index-vault
```

**Process**:

1. Scans all markdown files in vault
2. Generates embeddings for each note
3. Stores vectors in IndexedDB
4. Updates search index

**Output**:

```
Starting full vault re-indexing...
Found 42 notes to index
Indexed 5/42...
Indexed 10/42...
...
Indexed 42/42...
Indexing complete. Successfully indexed 42/42 notes.
```

**Notes**:

- Skips empty notes automatically
- Shows progress every 5 notes
- Handles errors gracefully
- Can take 1-5 minutes for large vaults (1000+ notes)

**Auto-Indexing**:

- Notes are automatically indexed on creation/modification
- Background indexing runs on app startup
- Manual re-indexing is rarely needed

---

## 🔒 Console Security Model

The HUB Console is designed with security as a top priority. Unlike a real terminal, it **cannot** execute arbitrary code or system commands.

### What the Console CANNOT Do

❌ **No Arbitrary Code Execution**

- Cannot run JavaScript code
- Cannot execute shell scripts
- Cannot run system commands (`rm`, `del`, `curl`, etc.)

❌ **No File System Access**

- Cannot access files outside vault directory
- Cannot delete system files
- Cannot modify system settings

❌ **No Network Access**

- Cannot make HTTP requests
- Cannot download files
- Cannot execute remote code

❌ **No Code Injection**

- No `eval()` or `Function()` calls
- No shell expansion
- Input is sanitized as plain strings

### What the Console CAN Do

✅ **Whitelisted Commands Only**

- Only pre-registered commands can execute
- Commands are defined by the application
- No dynamic command registration

✅ **Sandboxed Environment**

- Runs in Electron renderer process
- Limited permissions by design
- Cannot escalate privileges

✅ **Safe Operations**

- Search notes semantically
- Display vault statistics
- Clear console output
- Toggle UI elements

### Security Architecture

```text
User Input → Command Parser → Whitelist Check → Safe Execution
                                     ↓
                              Unknown Command?
                                     ↓
                            "Unknown command" Error
```

**Key Security Features**:

1. **Command Whitelist**: Only registered commands execute
2. **Input Sanitization**: Arguments parsed as strings only
3. **IPC Validation**: All file operations validated by main process
4. **No Shell Access**: Cannot spawn child processes
5. **Scoped Permissions**: Limited to app functionality only

**Conclusion**: The console is **completely safe** for users to type anything. Worst case is an "Unknown command" error.

---

## 🎯 Console Features

### Command History

Navigate through previously executed commands using arrow keys:

- **Up Arrow (↑)**: Previous command
- **Down Arrow (↓)**: Next command
- **Enter**: Execute current command

**Example**:

```bash
saboor@KnowledgeHub λ find memory leaks
saboor@KnowledgeHub λ clear
saboor@KnowledgeHub λ ↑  # Shows "clear"
saboor@KnowledgeHub λ ↑  # Shows "find memory leaks"
```

### Command Queuing

The console prevents concurrent command execution to ensure stability:

**Behavior**:

- Only one command runs at a time
- Input is disabled while command executes
- Placeholder changes to "Command running..."
- Attempting another command shows: "Command already running. Please wait..."

**Visual Feedback**:

```bash
saboor@KnowledgeHub λ index-vault
Starting full vault re-indexing...
[Input disabled: "Command running..."]
```

### Dynamic Prompt

The prompt shows your system username and current vault name:

**Format**: `username@vaultname λ`

**Examples**:

```bash
saboor@KnowledgeHub λ
john@ResearchNotes λ
alice@CodeDocs λ
```

**Updates Automatically**:

- When you switch vaults
- When vault is renamed
- Real-time synchronization

### Console States

**Minimized**: Shows only input line at bottom
**Normal**: Shows ~300px of output history
**Maximized**: Expands to fill available vertical space

**Toggle States**:

- Click chevron (⌄) to minimize/restore
- Click maximize (□) to expand/collapse
- State persists across sessions

---

## 🏗️ Core Features

### The Data Layer

- **Standard `.md` files** ensure your research is human-readable, portable, and perpetual
- **No proprietary formats** - your data is always accessible
- **Plain text** - works with any text editor
- **Git-friendly** - version control compatible

### The Intelligence Layer

- **Local-first RAG pipeline** preserves privacy while providing Google-scale semantic search
- **Transformers.js** - runs AI models directly in the browser
- **IndexedDB storage** - fast, offline-capable vector database
- **Web Worker processing** - non-blocking embeddings

### The Visualization Layer

- **Interactive knowledge graphs** allow spatial browsing of your vault
- **Force-directed layout** - organically arranges related notes
- **Real-time updates** - graph updates as you create/link notes
- **Cluster detection** - automatically groups related concepts

---

## ⌨️ Keyboard Shortcuts

### 📋 Navigation & General

| Action                        | Shortcut                       |
| :---------------------------- | :----------------------------- |
| **Command Palette**           | `Ctrl + Shift + P`             |
| **HUB Console**               | `Ctrl + J`                     |
| **Documentation Dashboard**   | `Ctrl + Shift + \`             |
| **AI Configuration**          | `Ctrl + Alt + S`               |
| **Reload Vault / Refresh UI** | `Ctrl + Shift + R`             |
| **Choose Vault Folder**       | `Ctrl + Shift + V`             |
| **Instant Lock Application**  | `Ctrl + L` / `Alt + L`         |
| **Sync Now (GitHub Gist)**    | `Ctrl + S (while in Settings)` |

### ✍️ Editor Operations

| Action                      | Shortcut   |
| :-------------------------- | :--------- |
| **New Note**                | `Ctrl + N` |
| **Quick Open Note**         | `Ctrl + P` |
| **Save Note**               | `Ctrl + S` |
| **Toggle Markdown Preview** | `Ctrl + \` |
| **Rename Active Note**      | `Ctrl + R` |
| **Delete Active Note**      | `Ctrl + D` |

### 🔭 Visual Discovery

| Action                     | Shortcut            |
| :------------------------- | :------------------ |
| **Knowledge Graph Modal**  | `Alt + G`           |
| **Knowledge Graph Tab**    | `Ctrl + Shift + G`  |
| **Toggle AI Chat Sidebar** | `Ctrl + I`          |
| **Search Graph**           | `/` (in Graph view) |
| **Reset Graph Camera**     | `R` (in Graph view) |

### 💻 Terminal & Console Shortcuts

| Action                    | Shortcut                            |
| :------------------------ | :---------------------------------- |
| **Toggle Terminal Panel** | `Ctrl + J`                          |
| **New Terminal Tab**      | `Ctrl + Shift + T`                  |
| **Previous Command**      | `↑` (Up Arrow)                      |
| **Next Command**          | `↓` (Down)                          |
| **Clear**                 | `clear` (Console) / `Ctrl+L` (Term) |
| **Close Panel**           | `Esc` (if focused)                  |

---

## 🧠 The KnowledgeHub Way: Best Practices

### 1. Atomic Note Taking

Keep notes focused on a single concept. This makes RAG search 10x more effective.

**Good**:

```markdown
# Memory Leaks in JavaScript

Common patterns that cause memory leaks...
```

**Bad**:

```markdown
# JavaScript Notes

Memory leaks, closures, promises, async/await...
```

### 2. Link, Don't Categorize

Links are better than folders. Use WikiLinks `[[ ]]` to create organic hierarchies.

**Example**:

```markdown
# Project Alpha

Related: [[Architecture]], [[API Design]], [[Database Schema]]
```

### 3. Use the Console for Discovery

Instead of browsing folders, use semantic search:

```bash
find authentication implementation
find database migration strategy
find performance optimization tips
```

### 4. Regular Re-indexing

After bulk imports or external edits:

```bash
index-vault
```

### 5. Interactive Graph

Clicking a node instantly shifts your context to that note. Use the graph to:

- Discover unexpected connections
- Find orphaned notes
- Visualize project structure

---

---

## 🔐 Vault Security & Firewall

KnowledgeHub features a professional-grade **Airlock Security Architecture** designed to protect your sensitive technical data and research from unauthorized access, even if your machine is left unattended.

### 1. The Firewall Overlay

When a master password is set, KnowledgeHub activates a high-performance, hardware-accelerated firewall overlay on startup and session lock.

- **Airlock Event Isolation**: When locked, the system intercepts keyboard and mouse events at the "Capture Phase," preventing them from ever reaching the underlying application logic.
- **Visual Privacy**: The application background is processed with a 20px Gaussian blur and grayscale filter, ensuring no fragments of your notes are visible while locked.
- **Circuit Breakers**: Global keyboard shortcuts (Sidebar toggles, Console, etc.) are physically disconnected in the `KeyboardManager` until a valid unlock occurs.

### 2. Cryptographic Implementation

- **Zero Cloud Footprint**: Your password is never sent to any server. Authentication happens entirely on your local hardware.
- **SHA-256 Hashing**: We use the Industry-Standard SHA-256 algorithm to hash your password. We only store the hash, never the plain-text password.
- **One-Way Protection**: There is no "Forgot Password" feature by design. If you lose your master password, your vault remains physically on disk but the application will require a fresh configuration to access it.

### 3. Session Management

- **Instant Lock**: Use the sidebar lock icon or the `Ctrl + L` / `Alt + L` hotkeys to immediately secure your workspace.
- **Sensitive Action Verification**: Certain high-risk operations (like deleting items or removing vault protection) require a secondary password verification prompt to prevent accidental data loss.

---

## 🛡️ Data Privacy

### Local-First Architecture

- **Local Embeddings**: Your note vectors stay in a local IndexedDB. They are never uploaded.
- **Offline Mode**: Semantic search works entirely offline once weights are cached.
- **No Telemetry**: KnowledgeHub doesn't track your usage or send analytics.

### Sync Security

- **Gist Sync**: Your notes are backed up to your _own_ private GitHub account.
- **Encrypted Storage**: GitHub Gists support private repositories.
- **Token Control**: You control the API token and can revoke access anytime.

---

## 🔄 Version History

### v0.1.5 - Current

- ✅ HUB Console with semantic search
- ✅ Vault Firewall Protection (Airlock)
- ✅ Master Password Encryption (SHA-256)
- ✅ RAG-powered AI chat
- ✅ Vector database integration
- ✅ Advanced Knowledge Graph (Tab & Modal views)
- ✅ Graph Search & Filtering
- ✅ Command queuing and history
- ✅ Dynamic prompt with vault name

### Coming Soon

- ⏳ Session export/import
- ⏳ Offline AI mode (Ollama)
- ⏳ Chat-Graph integration
- ⏳ Advanced vector search (HNSW)

---

_KnowledgeHub v0.1.5 • Built for Code and Research_
_Documentation last updated: 2026-01-31_
