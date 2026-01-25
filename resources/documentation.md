# KnowledgeHub: The Professional Manual

Welcome to **KnowledgeHub**, a high-performance, AI-enhanced environment designed for the intersection of **technical code and academic research**. This manual provides a deep dive into the architecture, features, and shortcuts that make KnowledgeHub the ultimate tool for managing sophisticated information at scale.

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

## 💻 Hub Intelligence Console

The **HUB Console** provides a direct command-line interface into your vault, allowing for keyboard-centric navigation and advanced querying without leaving your flow state.

**Access**: `Ctrl + J` (or `Ctrl + Shift + J`)

**Comparison with Other Tools:**

- **Quick Open (`Ctrl + P`)**: Best for simple fuzzy finding when you know the filename.
- **HUB Console (`Ctrl + J`)**: Best for **semantic actions**, analyzing vault statistics, and running complex queries that go beyond filename matching.

### ⚡ Console Commands

| Command            | Action                                                                       | Example                     |
| :----------------- | :--------------------------------------------------------------------------- | :-------------------------- |
| **`help`**         | data dump of all available commands                                          | `help`                      |
| **`open <query>`** | Intelligent open. Finds notes by ID or Title.                                | `open architecture`         |
| **`find <query>`** | **Semantic RAG Search**. Use natural language to find meaning-related notes. | `find memory leak patterns` |
| **`stats`**        | Displays vault telemetry (Note count, Tab count, Vault Path).                | `stats`                     |
| **`clear`**        | Wipes the console history for a clean slate.                                 | `clear`                     |
| **`close`**        | Hides the console panel.                                                     | `close`                     |

---

## 🏗️ Core Pillars

- **The Data Layer**: Standard `.md` files ensure your research is human-readable, portable, and perpetual. No proprietary formats.
- **The Intelligence Layer**: A local-first RAG pipeline that preserves privacy while providing Google-scale semantic search.
- **The Visualization Layer**: Interactive knowledge graphs that allow you to browse your vault spatially.

---

## ⌨️ Shortcut Master List

### 📋 Navigation & General

| Action                        | Shortcut                       |
| :---------------------------- | :----------------------------- |
| **Command Palette**           | `Ctrl + Shift + P`             |
| **Documentation Dashboard**   | `Ctrl + Shift + \`             |
| **Reload Vault / Refresh UI** | `Ctrl + Shift + R`             |
| **Choose Vault Folder**       | `Ctrl + Shift + V`             |
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
| **Knowledge Graph**        | `Alt + G`           |
| **Toggle AI Chat Sidebar** | `Ctrl + I`          |
| **Search Graph**           | `/` (in Graph view) |
| **Reset Graph Camera**     | `R` (in Graph view) |

---

## 🧠 The KnowledgeHub Way: Best Practices

1. **Atomic Note Taking**: Keep notes focused on a single concept. This makes RAG search 10x more effective.
2. **Link, Don't Categorize**: Links are better than folders. Use WikiLinks `[[ ]]` to create organic hierarchies.
3. **Daily Journaling**: Use the graph to see how your daily logs connect to your core projects.
4. **Interactive Graph**: Clicking a node instantly shifts your context to that note.

---

## 🔐 Data Privacy & Security

- **Local Embeddings**: Your note vectors stay in a local IndexedDB. They are never uploaded.
- **Offline Mode**: Semantic search works entirely offline once weights are cached.
- **Gist Sync**: Your notes are backed up to your _own_ private GitHub account.

---

_KnowledgeHub v0.1.5 • Built for Code and Research_
