## 📚 Console Tab Reference

### Core Commands

#### `help`

**Description**: Display all available commands with descriptions and usage examples.

**Usage**: `help`

---

#### `clear`

**Description**: Clear all console output for a clean slate.

**Usage**: `clear`

---

#### `close`

**Description**: Hide the console panel.

**Usage**: `close`

---

#### `stats`

**Description**: Show vault statistics (Note count, Tab count, Vault path).

**Usage**: `stats`

---

#### `ping`

**Description**: Test console latency.

**Usage**: `ping`

---

### Navigation & Vault Operations

#### `open <title>`

**Description**: Open a note by title (case-insensitive fuzzy match).

**Usage**: `open my-note`

---

#### `find <query>`

**Description**: **Semantic RAG Search** - Use natural language to find conceptually related notes. Or triggers global search if sidebar is active.

**Usage**: `find memory leak patterns`

---

#### `index-vault`

**Description**: Manually re-index all notes in your vault for AI search.

**Usage**: `index-vault`

---

#### `read <title|id>`

**Description**: Read the content of a note by title or ID.

**Usage**: `read introduction`

---

### File System Operations

#### `mkdir <name>`

**Description**: Create a new folder.

**Usage**: `mkdir project-alpha`

---

#### `touch <title>`

**Description**: Create a new empty note.

**Usage**: `touch new-idea`

---

#### `write <title> <content>`

**Description**: Write content to a new or existing note. Overwrites existing content.

**Usage**: `write "My Note" "This is the content."`

---

#### `append <title> <content>`

**Description**: Append content to the end of an existing note.

**Usage**: `append "Daily Log" "- Update docs"`

---

#### `move <s> <d>`

**Description**: Move a note or folder to a destination path.

**Usage**: `move my-note folder/subfolder`

---

#### `rename <old> <new>`

**Description**: Rename a note or folder.

**Usage**: `rename old-name new-name`

---

#### `rm <path>` / `delete <path>`

**Description**: Delete a note or folder permanently.

**Usage**: `rm junk-note`

---

### 🔒 Security Commands

#### `lock`

**Description**: Immediately lock the application. Requires a password if set.

**Usage**: `lock`

---

#### `unlock` (Alias: `de-protect`)

**Description**: Unlock the session or verify credentials to perform sensitive actions.

**Usage**: `unlock`

---

#### `disable-protection`

**Description**: Remove the master password and disable vault protection. Verified action.

**Usage**: `disable-protection`

---

### 🎯 Console Features

#### **Mode Switcher**

The Console footer features two icons to switch between operational modes:

- **Terminal Mode (λ)**: Ideal for executing built-in commands like `find`, `clear`, or `help`.
- **AI Agent Mode**: Transforms the console into a chat interface. The AI has access to your vault contents and can answer questions, summarize notes, or help with coding.

#### **AI Capabilities**

When in **Agent Mode**, a capability selector appears (next to the prompt):

- **Balanced**: Standard speed and reasoning.
- **Thinking**: High-reasoning mode for complex philosophical or architectural questions.
- **Code**: Optimized for technical tasks, refactoring, and debugging.
- **Precise**: Strict adherence to facts with minimal creative fluff.
- **Creative**: Best for brainstorming and creative writing.

---

### ⌨️ Interaction Tips

- **Command History**: Use Up/Down arrows to navigate previous commands.
- **Auto-expanding Input**: The input area grows vertically as you type long prompts.
- **Stop Generating**: Use the stop button (visible during AI response) to abort generation instantly.
- **Command Palette Integration**: Most console actions are also available via `Ctrl + Shift + P`.
