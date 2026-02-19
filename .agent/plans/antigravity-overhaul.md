# Task: Antigravity Overhaul - High-Performance AI Engine

Project: Knowledge Hub
Goal: Implement zero-redundancy, high-precision AI interaction model ("Antigravity").

## 1. Analysis & Requirements

- **Problem**: AI currently spends double the tokens by showing code in chat AND inside commands.
- **Problem**: File modifications (`patch`) are fragile and fail on minor formatting differences.
- **Problem**: AI sometimes "guesses" paths instead of verifying.
- **Requirement**: Zero conversational repetition of code inside `[RUN:]` tags.
- **Requirement**: Robust patching logic (Match-Block with context).
- **Requirement**: Path discovery protocol (proactive `ls`/`tree`).

## 2. Proposed Changes

### Phase 1: Core Prompting (aiService.ts)

- [x] Move "PEER PROGRAMMER" and "NO REDUNDANCY" rules to the top of `IDE_AGENT_INSTRUCTIONS`.
- [x] Add strict instruction: "TERMINATE PROSE immediately once a [RUN:] tag is opened."
- [x] Optimize `prepareMessages` to include the user's `@mentions` context more effectively.

### Phase 2: Surgical Patching Engine (agentService.ts & executor.ts)

- [x] Upgrade `AgentService.executeCommand('patch')` to handle multi-line context blocks.
- [x] Implement `AgentExecutor.patchNote` with whitespace-insensitive matching for the "Search" block.
- [x] Add a safety check in `AgentExecutor.writeNote` to prevent overwriting existing files without `propose`.

### Phase 3: UI Redundancy Filter (MessageFormatter.ts)

- [x] Implement a logic in `MessageFormatter.format` to detect if a Markdown code block's content is also present in a `[RUN:]` tag in the same message.
- [x] If detected, hide the Markdown block to save UI space and mental load.

## 3. Verification Plan

- [x] **Test Case 1**: Ask AI to "Add a comment to aiService.ts". Verify it only shows the command and no code in the chat.
- [x] **Test Case 2**: Ask AI to "Create a new file in a nested folder". Verify it runs `ls` first if the folder isn't in the tree sample.
- [x] **Test Case 3**: Verify `patch` works even if there are slight indent differences between AI's "Search" and the actual file.
