# AI Agent Robustness Analysis & Suggestions

## Identified Issues

1. **Architectural Redundancy**: There are currently two disconnected implementations of agent logic (`src/renderer/src/components/rightbar/AgentExecutor.ts` and `src/renderer/src/services/agent/executor.ts`). The chat UI uses a primitive version that lacks RAG synchronization and advanced path resolution.
2. **Limited "Sensory" Input**: The agent is restricted to vault notes and lacks visibility into the active editor state (selection, cursor, diagnostics/lint errors) or terminal output.
3. **Weak Error Recovery**: Commands are executed sequentially without the ability for the AI to pivot or self-correct if an intermediate step fails.
4. **Brittle Command Parsing**: Regex-based parsing of `[RUN: ...]` tags is susceptible to failures with complex strings, quotes, or special characters in content.

## Recommendations for Robustness (Copilot-Level)

1. **Unify the Core**: Merge the redundant executor implementations into a single, high-level `AgentManager` that handles RAG indexing, UI state (tabs), and file operations consistently.
2. **Expanded Toolset**: Implement new agentic capabilities:
   - `[RUN: terminal ...]`: Execute shell commands/scripts.
   - `[RUN: search ...]`: Project-wide text searching.
   - `[RUN: read-editor]`: Pull content from the currently active tab.
3. **Rich Context Injection**: Automatically inject the following into every AI request:
   - Active file path and content.
   - Cursor position/selection.
   - Recent console/terminal errors.
   - Project structure overview.
4. **Incremental Feedback Loop**: Instead of executing a block of commands at once, execute them one-by-one and feed results back to the AI immediately. This allows the model to "think" between steps and fix errors as they happen.
5. **Human-in-the-Loop Integration**: Add a mandatory "Approve/Reject" UI for terminal commands or destructive file operations to ensure safety and alignment.
