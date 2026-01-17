# Icon System Guide - How to Fix and Improve Icons

## Overview

The KnowledgeHub uses a dynamic icon system that recognizes different file and folder types, similar to VS Code. Icons are colored based on their type to make navigation easier.

## Current Icon System

### File Icons Location
- **Code**: `src/renderer/src/utils/codicons.ts`
- **CSS Styling**: `src/renderer/src/components/sidebar/sidebar-tree.css`
- **Rendering Logic**: `src/renderer/src/components/sidebar/sidebar-tree.ts`

### How It Works

1. **Folder Icons**: Detected by folder name (e.g., `src`, `config`, `settings`)
2. **File Icons**: Detected by file extension or special patterns in the title
3. **Colors**: Applied via CSS based on `data-folder-type` and `data-note-type` attributes

## Default Behavior

### For Notes (`.md` files)
- **Default**: All notes are treated as `.md` files and show the **markdown icon** (blue)
- **Special Cases**: Notes with patterns like `settings.json` (which becomes `settings.json.md`) show specialized icons

### For Folders
- **Root/Vault**: Blue (#42a5f5)
- **src/source/components**: Orange/Yellow (#e3a341)
- **config**: Blue (#42a5f5)
- **settings**: Purple (#ab47bc)
- **test**: Green (#66bb6a)
- **public/assets/pages**: Light Blue (#29b6f6)
- **lib/utils**: Red/Pink (#ef5350)
- **Default**: Orange/Yellow (#e3a341)

## Common Issues and Fixes

### Issue 1: Icons Not Showing Colors

**Problem**: Icons appear gray/white instead of colorful

**Fix**: Check that:
1. The `data-folder-type` or `data-note-type` attributes are being set in `sidebar-tree.ts`
2. The CSS selectors in `sidebar-tree.css` match the data attributes
3. The icon SVG uses `fill="currentColor"` so it inherits the CSS color

**Example Fix**:
```typescript
// In sidebar-tree.ts, make sure you're setting the data attribute:
icon.dataset.folderType = folderType
el.dataset.folderType = folderType
```

### Issue 2: Wrong Icon for File Type

**Problem**: A file shows the wrong icon (e.g., JSON file shows markdown icon)

**Fix**: Update the detection logic in `getFileIcon()` or `getNoteType()`:

```typescript
// In codicons.ts - getFileIcon()
if (name.includes('.json')) {
  return codicons.json  // Make sure this matches the pattern
}
```

### Issue 3: New File Type Not Recognized

**Problem**: A new file type (e.g., `.py.md` for Python notes) doesn't have an icon

**Fix**: Add detection in both functions:

1. **Add icon detection** in `codicons.ts`:
```typescript
export function getFileIcon(fileName: string): string {
  const name = fileName.toLowerCase()

  // Add your new type
  if (name.includes('.py')) {
    return codicons.fileCode  // or create a new icon
  }

  // ... rest of the function
}
```

2. **Add type detection** in `sidebar-tree.ts`:
```typescript
private getNoteType(noteName: string): string {
  const name = noteName.toLowerCase()

  // Add your new type
  if (name.includes('.py')) {
    return 'python'  // or 'code' if using existing type
  }

  // ... rest of the function
}
```

3. **Add CSS styling** in `sidebar-tree.css`:
```css
/* Python files - green */
.tree-item--note[data-note-type="python"] .tree-item__icon,
.tree-item--note .tree-item__icon[data-note-type="python"] {
  color: #3776ab;  /* Python blue */
}
```

### Issue 4: Folder Not Recognized

**Problem**: A folder like `docs` or `build` shows default icon instead of a special one

**Fix**: Add folder recognition in `getFolderIcon()` and `getFolderType()`:

1. **Add to icon mapping** in `codicons.ts`:
```typescript
const folderIcons: Record<string, string> = {
  // ... existing mappings
  docs: codicons.folderPublic,  // or create folderDocs icon
  build: codicons.folderConfig,
  dist: codicons.folderConfig,
}
```

2. **Add to type detection** in `sidebar-tree.ts`:
```typescript
private getFolderType(folderName: string): string {
  const name = folderName.toLowerCase()
  // ... existing checks
  if (name === 'docs' || name === 'documentation') return 'docs'
  if (name === 'build' || name === 'dist' || name === 'out') return 'build'
  return ''
}
```

3. **Add CSS** in `sidebar-tree.css`:
```css
/* Docs folders - light blue */
.tree-item--folder[data-folder-type="docs"] .tree-item__icon {
  color: #29b6f6;
}
```

## How to Improve Icons

### 1. Add More File Types

**Step 1**: Create or use existing SVG icons in `codicons.ts`:
```typescript
export const codicons = {
  // ... existing icons
  python: '<svg>...</svg>',  // Add new icon SVG
  rust: '<svg>...</svg>',
  go: '<svg>...</svg>',
}
```

**Step 2**: Update detection functions (as shown in Issue 3)

**Step 3**: Add CSS colors matching the language's brand colors

### 2. Improve Pattern Matching

**Current**: Simple string matching with `includes()`

**Better**: Use regex for more precise matching:
```typescript
// Instead of: name.includes('.json')
// Use: /\.json(\.md)?$/i.test(name)

if (/\.json(\.md)?$/i.test(name)) {
  return codicons.json
}
```

### 3. Add Icon Previews

Create a visual reference file showing all available icons and their colors.

### 4. Support Custom Icons

Allow users to define custom icons via settings:
```typescript
// In settings
customIcons: {
  'my-special-folder': '📁',
  'important-notes': '⭐'
}
```

### 5. Improve Performance

Cache icon lookups:
```typescript
const iconCache = new Map<string, string>()

export function getFileIcon(fileName: string): string {
  if (iconCache.has(fileName)) {
    return iconCache.get(fileName)!
  }

  const icon = computeIcon(fileName)
  iconCache.set(fileName, icon)
  return icon
}
```

## Color Reference

### VS Code-Inspired Colors
- **Markdown**: Blue (#42a5f5)
- **JavaScript**: Yellow (#f7df1e)
- **TypeScript**: Blue (#3178c6)
- **JSON**: Orange (#f59e0b)
- **HTML**: Orange/Red (#e34c26)
- **CSS**: Blue (#264de4)
- **Text**: Gray (#9ca3af)

### Folder Colors
- **Root**: Blue (#42a5f5)
- **Source**: Orange/Yellow (#e3a341)
- **Config**: Blue (#42a5f5)
- **Settings**: Purple (#ab47bc)
- **Test**: Green (#66bb6a)
- **Public**: Light Blue (#29b6f6)
- **Library**: Red/Pink (#ef5350)

## Testing Icons

1. **Create test files** with different patterns:
   - `test.md` (should show markdown icon)
   - `settings.json.md` (should show JSON icon)
   - `component.tsx.md` (should show TypeScript icon)

2. **Create test folders**:
   - `src` (should show orange source folder)
   - `config` (should show blue config folder)
   - `tests` (should show green test folder)

3. **Check in sidebar**: Icons should be colorful and match their types

## Quick Fix Checklist

- [ ] Icons not showing? → Check data attributes are set
- [ ] Wrong colors? → Check CSS selectors match data attributes
- [ ] Missing icon? → Add detection in `getFileIcon()` and `getNoteType()`
- [ ] New folder type? → Add to `getFolderType()` and CSS
- [ ] Performance issues? → Add caching
- [ ] Want custom icons? → Implement user settings

## File Structure

```
src/renderer/src/
├── utils/
│   └── codicons.ts          # Icon definitions and detection
├── components/
│   └── sidebar/
│       ├── sidebar-tree.ts   # Rendering and type detection
│       └── sidebar-tree.css  # Icon colors and styling
```

## Need Help?

If icons still don't work:
1. Check browser console for errors
2. Verify data attributes are in the DOM: `document.querySelector('.tree-item__icon').dataset`
3. Check CSS is loading: Inspect element and see if styles are applied
4. Clear cache and rebuild: `npm run build`
