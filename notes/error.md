# Fixing Monaco Autocomplete Clutter

If you see extra text appearing directly under the note titles in the autocomplete dropdown (labels like "WikiLink", "Mention", or folder paths), it is caused by the `detail` and `documentation` fields in Monaco's `CompletionItem`.

## How to Fix

In the `registerCompletionItemProvider` (found in `wikilink.ts`), ensure that both `detail` and `documentation` are set to empty strings:

```typescript
return {
  label: name,
  kind: monaco.languages.CompletionItemKind.File,
  insertText: name,
  detail: '', // Must be empty to hide extra help text
  documentation: '', // Must be empty to hide description
  range: range
  // ... other properties
}
```

This prevents Monaco from injecting "helpful" but cluttered information into the UI.
