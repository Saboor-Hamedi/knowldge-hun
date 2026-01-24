# RAG Implementation Roadmap for KnowledgeHub

## Overview
This roadmap outlines the implementation of Retrieval-Augmented Generation (RAG) for the AI feature, including session management, note references, and robust IndexedDB storage.

---

## High-Level Architecture

### Core Components

1. **Vector Store**
   - Embed notes and conversations
   - Store embeddings in IndexedDB
   - Enable semantic search across knowledge base

2. **Retrieval System**
   - Semantic search over notes
   - Search past conversations
   - Rank and select most relevant context

3. **Context Assembly**
   - Combine retrieved notes with conversation history
   - Include explicitly referenced notes (#notename)
   - Structure context for optimal AI understanding

4. **Generation Layer**
   - Send enriched context to AI model
   - Generate contextual responses
   - Track which notes were used

---

## Phase 1: Foundation & Infrastructure

### IndexedDB Schema Design

**Sessions Table**
- `id` (string, primary key)
- `title` (string, user-defined or auto-generated)
- `messages` (array of message objects)
- `metadata` (object: tags, created_at, updated_at, note_references)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `is_archived` (boolean)

**Note Embeddings Table**
- `note_id` (string, foreign key to notes)
- `embedding` (Float32Array or serialized vector)
- `content` (string, original note content)
- `chunk_index` (number, for large notes split into chunks)
- `metadata` (object: title, path, last_modified)
- `indexed_at` (timestamp)

**Conversation Embeddings Table**
- `session_id` (string, foreign key to sessions)
- `message_id` (string)
- `embedding` (Float32Array)
- `content` (string, message text)
- `role` (string: 'user' | 'assistant')
- `indexed_at` (timestamp)

**Vector Index Table**
- Efficient storage for similarity search
- HNSW (Hierarchical Navigable Small World) structure
- Or simple cosine similarity index

### Embedding Service Setup

**Options to Consider:**
1. **Local Embeddings** (Privacy-focused)
   - Transformers.js (browser-based)
   - ONNX.js (optimized models)
   - Pros: Privacy, offline, no API costs
   - Cons: Larger bundle size, slower, lower quality

2. **API-based Embeddings** (Quality-focused)
   - OpenAI embeddings API
   - Cohere embeddings
   - Hugging Face Inference API
   - Pros: Better quality, faster, smaller bundle
   - Cons: Requires API key, costs, internet dependency

**Recommendation:** Start with API-based (OpenAI/Cohere) for MVP, add local option later

### Database Utilities
- Connection management
- Migration system for schema updates
- Backup/restore functionality
- Cleanup utilities for old data

---

## Phase 2: Note Indexing System

### Embedding Generation
- **Trigger Points:**
  - On note creation
  - On note update
  - On note deletion (remove embeddings)
  - Batch re-indexing option

### Chunking Strategy
- Split large notes into chunks (e.g., 500-1000 tokens)
- Maintain chunk relationships
- Store chunk metadata (position, parent note)

### Vector Storage
- Store embeddings efficiently in IndexedDB
- Implement vector similarity search
- Cache frequently accessed embeddings

### Indexing UI
- Progress indicator for indexing
- Manual re-index option
- Status display (X notes indexed, Y pending)

---

## Phase 3: Session Management System

### Session Storage
- Create new sessions
- Save conversations automatically
- Load existing sessions
- Delete/archive sessions

### Session Metadata
- Auto-generate titles from first message
- Allow manual title editing
- Tags for organization
- Search sessions by content

### Session UI Components
- **Session List Panel**
  - List all sessions (sidebar or modal)
  - Search/filter sessions
  - Sort by date, title, relevance
  - Recent sessions quick access

- **Session Actions**
  - Create new session
  - Rename session
  - Delete session
  - Archive session
  - Export session (JSON/Markdown)

### Auto-save Mechanism
- Save after each message exchange
- Debounce rapid saves
- Visual indicator for save status

---

## Phase 4: RAG Retrieval System

### Note Reference Parsing (#notename)
- **Detection:**
  - Parse `#notename` patterns in user messages
  - Support multiple references: `#note1 #note2`
  - Case-insensitive matching
  - Fuzzy matching for typos

- **Validation:**
  - Check if referenced notes exist
  - Handle missing notes gracefully
  - Suggest similar note names

### Semantic Search
- **Note Retrieval:**
  - Embed user query
  - Search note embeddings (cosine similarity)
  - Exclude already-referenced notes
  - Return top-k results (configurable, default 3-5)

- **Conversation Retrieval:**
  - Search past conversation snippets
  - Find relevant context from history
  - Limit to same session or cross-session

### Ranking & Selection
- **Scoring Algorithm:**
  - Combine similarity scores
  - Boost explicitly referenced notes
  - Consider recency (newer notes slightly higher)
  - Diversity: avoid too many similar notes

- **Context Limits:**
  - Maximum tokens/characters
  - Maximum number of notes
  - Prioritize referenced → retrieved → history

---

## Phase 5: Context Assembly

### Context Structure
```
System Prompt:
- Instructions for AI behavior
- Current conversation context

Referenced Notes (Explicit):
- #notename1: [full content]
- #notename2: [full content]

Retrieved Notes (Semantic):
- Note 1: [relevant excerpt]
- Note 2: [relevant excerpt]

Conversation History:
- Recent messages from current session
- Relevant snippets from past sessions

User Query:
- Current user message
```

### Token Management
- Count tokens for each component
- Prioritize components if limit exceeded
- Truncate intelligently (preserve important parts)
- Summarize older conversation if needed

### Context Quality
- Remove duplicate information
- Ensure logical flow
- Maintain note attribution
- Preserve formatting where possible

---

## Phase 6: UI/UX Enhancements

### Note Reference UI
- **Autocomplete Dropdown:**
  - Trigger on `#` character
  - Show matching notes as user types
  - Display note title, path, preview
  - Keyboard navigation (arrow keys, enter)

- **Visual Indicators:**
  - Highlight `#notename` in input
  - Show referenced notes as chips/badges
  - Click to view note
  - Remove reference option

### Response Display
- **Note Citations:**
  - Show which notes were used
  - Clickable links to referenced notes
  - Visual distinction: explicit vs. retrieved
  - Expandable "Sources" section

- **Context Transparency:**
  - Optional "Show context" button
  - Display what was retrieved
  - Explain why certain notes were selected

### Session UI
- **Session Sidebar:**
  - Collapsible panel
  - Session list with previews
  - Quick actions (new, delete, search)
  - Drag to reorder (optional)

- **Session Modal:**
  - Full-screen session browser
  - Advanced search
  - Bulk operations
  - Import/export

### Chat Interface
- **Message Display:**
  - Show note references in messages
  - Link to referenced notes
  - Display AI's used sources
  - Copy message with references

- **Input Enhancements:**
  - Rich text input (optional)
  - Markdown preview
  - Reference suggestions
  - Command palette (optional)

---

## Technical Considerations

### Embedding Model Selection

**For MVP (API-based):**
- OpenAI `text-embedding-3-small` or `text-embedding-ada-002`
- Cohere `embed-english-v3.0`
- Cost-effective, good quality

**For Future (Local):**
- `all-MiniLM-L6-v2` (Transformers.js)
- `Xenova/all-mpnet-base-v2`
- Privacy-focused, offline capable

### Vector Search Implementation

**Option 1: Simple Cosine Similarity**
- Calculate dot product of normalized vectors
- Suitable for small-medium vaults (<10k notes)
- Easy to implement
- No additional dependencies

**Option 2: HNSW Index**
- Use library like `hnswlib-node` (adapted for browser)
- Better for large vaults (>10k notes)
- Faster search
- More complex implementation

**Recommendation:** Start with Option 1, upgrade to Option 2 if needed

### Storage Strategy

- **IndexedDB Limits:**
  - Browser-dependent (usually 50MB-1GB+)
  - Monitor storage usage
  - Implement cleanup for old sessions

- **Incremental Indexing:**
  - Only index new/updated notes
  - Track last index time per note
  - Batch processing for initial index

- **Chunking Large Notes:**
  - Split notes >2000 tokens
  - Maintain chunk relationships
  - Retrieve multiple chunks if needed

### Context Window Management

- **Token Limits:**
  - Model-dependent (e.g., GPT-4: 8k, GPT-4 Turbo: 128k)
  - Reserve space for system prompt + response
  - Allocate remaining to context

- **Prioritization:**
  1. Explicitly referenced notes (full content)
  2. Top semantic matches (excerpts)
  3. Recent conversation history
  4. Relevant past conversation snippets

- **Truncation Strategy:**
  - Keep beginning and end of long notes
  - Summarize middle sections if needed
  - Preserve structure (headers, lists)

---

## User Experience Flow

### Starting a Conversation

1. User opens AI chat panel
2. System shows recent sessions or "New Session"
3. User types message, optionally with `#notename`
4. As user types `#`, autocomplete shows matching notes
5. User selects notes or continues typing
6. System highlights referenced notes visually

### During Conversation

1. User sends message
2. System shows "Searching relevant notes..." indicator
3. System:
   - Extracts `#notename` references
   - Performs semantic search
   - Retrieves relevant conversation history
   - Assembles context
4. AI generates response with enriched context
5. Response displays with note citations
6. Conversation auto-saves to session

### Managing Sessions

1. User opens session panel
2. Sees list of all sessions (sorted by recent)
3. Can search sessions by content
4. Click session to resume conversation
5. Can rename, delete, or archive sessions
6. Can export session for backup

---

## Benefits of This Implementation

### For Users
- **Context-Aware AI:** Responses use your actual notes
- **Persistent Memory:** Conversations saved and searchable
- **Explicit Control:** `#notename` gives direct control
- **Privacy:** Local storage, optional local embeddings
- **Scalability:** Works as vault grows

### For Development
- **Modular Design:** Each phase independent
- **Incremental Rollout:** Can release features progressively
- **Testable:** Clear separation of concerns
- **Extensible:** Easy to add features later

---

## Open Questions & Decisions Needed

### 1. Embedding Model
- **Question:** Local vs. API-based embeddings?
- **Options:**
  - Start with API (faster MVP, better quality)
  - Add local option later (privacy-focused users)
- **Recommendation:** Start with API, add local as option

### 2. Session Organization
- **Question:** How to organize sessions?
- **Options:**
  - Flat list with search
  - Folders/categories
  - Tags system
  - Timeline view
- **Recommendation:** Start with flat list + search, add organization later

### 3. Note Reference Scope
- **Question:** Which notes can be referenced?
- **Options:**
  - Only markdown files
  - All note types
  - Include folders (as context)
- **Recommendation:** All notes, with type indicators

### 4. Context Limits
- **Question:** How much context to include?
- **Options:**
  - Fixed limits (e.g., 5 notes, 10k tokens)
  - User-configurable
  - Adaptive based on query complexity
- **Recommendation:** Start with fixed, make configurable later

### 5. UI Placement
- **Question:** Where should AI chat live?
- **Options:**
  - Sidebar panel (like VS Code)
  - Modal/overlay
  - Dedicated view (tab)
  - Floating window
- **Recommendation:** Sidebar panel (consistent with app design)

### 6. Offline Support
- **Question:** Should RAG work offline?
- **Options:**
  - Full offline (requires local embeddings)
  - Hybrid (cached embeddings, online generation)
  - Online only (simpler)
- **Recommendation:** Start online, add offline later

### 7. Cost Management
- **Question:** How to handle API costs?
- **Options:**
  - User provides API key
  - Usage limits
  - Subscription tiers
  - Local-only mode
- **Recommendation:** User provides key, show usage stats

---

## Implementation Priority

### MVP (Minimum Viable Product)
1. ✅ Basic session storage (IndexedDB)
2. ✅ Note reference parsing (#notename)
3. ✅ Simple semantic search (API embeddings)
4. ✅ Context assembly and AI generation
5. ✅ Basic session UI (list, create, load)

### Phase 2 (Enhanced Features)
1. Session search and filtering
2. Note citation display
3. Autocomplete for note references
4. Conversation history retrieval
5. Session export/import

### Phase 3 (Advanced Features)
1. Local embedding option
2. Advanced vector search (HNSW)
3. Session organization (folders/tags)
4. Context optimization
5. Usage analytics

### Phase 4 (Polish)
1. Performance optimization
2. UI refinements
3. Error handling improvements
4. Documentation
5. User onboarding/tutorials

---

## Success Metrics

### Technical Metrics
- Indexing speed (notes per second)
- Search latency (milliseconds)
- Storage efficiency (MB per 1000 notes)
- Context assembly time

### User Metrics
- Session creation rate
- Note reference usage (#notename)
- Average session length
- User satisfaction (feedback)

---

## Risks & Mitigations

### Risk 1: IndexedDB Limitations
- **Risk:** Storage limits, performance issues
- **Mitigation:** Monitor usage, implement cleanup, compression

### Risk 2: Embedding Costs
- **Risk:** High API costs for large vaults
- **Mitigation:** Incremental indexing, caching, local option

### Risk 3: Context Quality
- **Risk:** Poor retrieval, irrelevant notes
- **Mitigation:** Tune similarity thresholds, user feedback loop

### Risk 4: Performance
- **Risk:** Slow search, laggy UI
- **Mitigation:** Optimize algorithms, background processing, caching

---

## Next Steps

1. **Review & Discuss:** Go through this roadmap together
2. **Decide on Key Questions:** Answer the open questions above
3. **Prioritize Features:** Agree on MVP scope
4. **Technical Spike:** Prototype embedding + search
5. **Begin Implementation:** Start with Phase 1

---

## Notes

- This roadmap is a living document
- Adjust based on user feedback and technical discoveries
- Keep implementation iterative and testable
- Focus on user value at each phase
