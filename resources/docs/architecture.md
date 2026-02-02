## 🚀 Project Pipeline & Architecture

KnowledgeHub is engineered for high performance and strict security. It employs a multi-process architecture to decouple the UI from heavy processing tasks like file watching, semantic indexing, and AI computations.

### 1. Multi-Process Architecture

The application is split into three primary layers, ensuring a fluid 60FPS user experience even during intensive operations.

```text
       MAIN PROCESS (Node.js)          PRELOAD BRIDGE               RENDERER PROCESS (UI)
      +-----------------------+      +------------------+      +-----------------------------+
      |  VaultManager         |      |                  |      |  App Orchestrator (app.ts)  |
      |  (Chokidar Watcher)   | <--> |  Secure IPC      | <--> |  Handler-Processor Logic    |
      |  Native File Ops      |      |  (window.api)    |      |  Modular components         |
      |  Terminal / PTY       |      |                  |      |  Monaco Editor / GraphView  |
      +-----------------------+      +------------------+      +-----------------------------+
                                                                             ^
                                                                             |
                                                                    +-------------------+
                                                                    |   WEB WORKER      |
                                                                    | (RAG Transformer) |
                                                                    +-------------------+
```

- **Main Process**: The "Brain". Handles system-level access, manages terminal sessions (node-pty), and maintains the "Single Source of Truth" for files via the `VaultManager`.
- **Preload Bridge**: The "Firewall". Ensures the Renderer only has access to a white-listed set of secure functions.
- **Renderer Process**: The "Stage". An orchestrator manages modular UI components. Logic is decoupled into **Handlers** (e.g., `VaultHandler`, `FileOperationHandler`) to keep components focused on presentation.
- **Web Worker**: The "Factory". Heavy semantic computations (embeddings) run in a separate worker thread to prevent UI freezing.

---

### 2. The RAG Intelligence Pipeline

The lifecycle of a note involves transformation from flat text to a semantically enriched intelligence unit.

1.  **Ingestion & Synchronous Indexing**:
    - **Chokidar Watcher**: Real-time monitoring of the disk.
    - **VaultManager**: Automatically maps filesystem changes to an in-memory unified ID system (relative paths).
    - **Link Extraction**: `[[Wikilinks]]` are extracted synchronously to maintain the knowledge graph topology.

2.  **Asynchronous Semantic Processing**:
    - **Embedding**: The `RagService` dispatches notes to a background worker.
    - **Local Transformers**: We use a local transformer model (e.g., MiniLM) to generate 384-dimensional vectors.
    - **Vector Store**: Embeddings are stored in IndexedDB for lightning-fast semantic retrieval.

3.  **Synthesis & Retrieval**:
    - **Semantic Search**: Unlike keyword search, semantic search finds conceptual neighbors.
    - **AI Context**: High-relevance note chunks are fed into AI models (Agent mode) to provide grounded, factual responses based on your own knowledge.

---

### 3. Modular System Design

- **Decoupled Logic**: We use a `Handler` pattern. For example, `FileOperationHandler` manages creation/deletion/renaming, while `SidebarTree` only handles the display of the tree data.
- **Reactive State**: A centralized, observable state object ensures data consistency across all views (Explorer, Graph, Editor).
- **Extensible Commands**: A registry-based command system allows for easy addition of terminal and agent capabilities with full type safety.
