import {
  createElement,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderGit2,
  FolderCode,
  FolderCog,
  FolderCheck,
  FolderArchive,
  FolderRoot,
  FolderDot,
  Keyboard
} from 'lucide'

/**
 * Helper to create Lucide icon SVG string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lucideIcon(IconComponent: any, size: number = 16, strokeWidth: number = 1.5): string {
  const svgElement = createElement(IconComponent, {
    width: size,
    height: size,
    'stroke-width': strokeWidth,
    stroke: 'currentColor',
    fill: 'none'
  })
  return svgElement.outerHTML
}

/**
 * VS Code Codicon system
 * SVG-based icons matching VS Code's icon set
 */

export const codicons = {
  // File types
  file: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.85 2.15l-3-2A.5.5 0 0 0 10.5 0h-6a.5.5 0 0 0-.5.5v15a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.15-.35zM11 1.5l2.5 2.5H11V1.5zM13 15H5V1h5v3.5a.5.5 0 0 0 .5.5H13v10z"/></svg>',
  fileCode:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10.5 14l4-4-4-4-.71.71L13.09 10l-3.3 3.29.71.71z"/><path d="M5.5 14l-4-4 4-4 .71.71L2.91 10l3.3 3.29-.71.71z"/></svg>',
  json: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 2.5c-.8 0-1.5.7-1.5 1.5v8c0 .8.7 1.5 1.5 1.5.3 0 .5-.2.5-.5s-.2-.5-.5-.5c-.3 0-.5-.2-.5-.5V4c0-.3.2-.5.5-.5.3 0 .5-.2.5-.5s-.2-.5-.5-.5z"/><path d="M12.5 2.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5-.3 0-.5-.2-.5-.5s.2-.5.5-.5c.3 0 .5-.2.5-.5V4c0-.3-.2-.5-.5-.5-.3 0-.5-.2-.5-.5s.2-.5.5-.5z"/><path d="M6 5.5h4v1H6v-1zm0 2.5h4v1H6V8zm0 2.5h4v1H6v-1z"/></svg>',
  markdown:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V3h12v10zM11 11l-1.5-1.5L8 11V5h3v6zM4 7h1v2h1V7h1v3H6V8H5v2H4V7z"/></svg>',
  html: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.09 8l3.29-3.29-.71-.71L2.51 8l4.16 4 .71-.71L4.09 8z"/><path d="M11.91 8L8.62 11.29l.71.71L13.49 8l-4.16-4-.71.71L11.91 8z"/></svg>',
  css: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 2l.5.5v11l-.5.5h11l.5-.5v-11L13.5 2h-11zM13 13H3V3h10v10z"/><path d="M5 5h6v1H5V5zm0 2h6v1H5V7zm0 2h6v1H5V9z"/></svg>',

  // UI elements
  chevronRight:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4V4z"/></svg>',
  chevronDown:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4H4z"/></svg>',
  close:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>',
  add: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v12M2 8h12"/></svg>',
  refresh:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8A6.5 6.5 0 0 1 8 1.5c2.5 0 4.6 1.5 5.5 3.5M14.5 8A6.5 6.5 0 0 1 8 14.5c-2.5 0-4.6-1.5-5.5-3.5M1.5 8h3m6.5 0h3"/></svg>',
  ellipsis:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12.5" cy="8" r="1.5"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z"/></svg>',
  trash:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11 1H4.5l-.5.5v3h1V2h6v9h-1v1h1.5l.5-.5v-10l-.5-.5z"/><path d="M10.5 4h-7l-.5.5v10l.5.5h7l.5-.5v-10l-.5-.5zM10 14H4V5h6v9z"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.35 10.35a.5.5 0 01-.7-.7l.35-.35A2.5 2.5 0 018.5 5H11a2.5 2.5 0 012.5 2.5v2.5A2.5 2.5 0 0111 12.5H8.5a2.5 2.5 0 01-2.5-2.5v-.5h1v.5a1.5 1.5 0 001.5 1.5H11a1.5 1.5 0 001.5-1.5V7.5A1.5 1.5 0 0011 6H8.5a1.5 1.5 0 00-1.5 1.5v.15l-.65.7z" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
  cloudDownload:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 7l-4.5 4.5L4 7h3V2h3v5h3zm-8 6h10v1H5v-1z" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
  cloudUpload:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2l-4.5 4.5L8 11h-3v5h6v-5H8zm8 6h-3v1h3v-1z" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
  calendar:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 2H3l-1 1v11l1 1h10l1-1V3l-1-1zM3 3h10v2H3V3zm10 11H3V6h10v8zM4 7h2v2H4V7zm3 0h2v2H7V7zm3 0h2v2h-2V7zm-6 4h2v2H4v-2zm3 0h2v2H7v-2zm3 0h2v2h-2v-2z" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
  pin: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 2H4.5l-.5.5v3l-1.5 4L2 10v4l.5.5H6v2.5l2-1.5 2 1.5V14.5h3.5l.5-.5V10l-.5-.5-1.5-4V2.5l-.5-.5z"/></svg>',

  // Folders - Using Lucide icons
  folder: lucideIcon(Folder),
  folderOpened: lucideIcon(FolderOpen),
  newFolder: lucideIcon(FolderPlus),
  // Outline versions for action buttons
  folderOpenedOutline: lucideIcon(FolderOpen),
  newFolderOutline: lucideIcon(FolderPlus),

  // Folder types (semantic) - Lucide folder variants
  folderRoot: lucideIcon(FolderRoot),
  folderSrc: lucideIcon(FolderCode),
  folderConfig: lucideIcon(FolderCog),
  folderTest: lucideIcon(FolderCheck),
  folderSettings: lucideIcon(FolderCog),
  folderPublic: lucideIcon(FolderDot),
  folderLib: lucideIcon(FolderArchive),
  // Git/GitHub folder - use FolderGit2 for better visibility
  folderGit: lucideIcon(FolderGit2),

  // Activity bar - Simple, clean outline icons
  // Files/Explorer - clean file icon
  files:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 1H7l-.85.85L5.5 1.5H1.5l-.5.5v13l.5.5h13l.5-.5v-13l-.5-.5z"/><path d="M14 14H2V2h3.5l.5.5.71.71L7.5 3.5l.71.71.71-.71.5-.5H14v11z"/><path d="M12 6H4M12 8H4M8 10H4"/></svg>',
  // Search - clean search icon
  search:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="3.5"/><path d="m10.5 10.5 3 3"/></svg>',
  // Settings gear - simple gear icon
  settingsGear:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M3 8H1m14 0h-2M12.66 3.34l-1.41 1.41M4.75 11.25l-1.41 1.41M12.66 12.66l-1.41-1.41M4.75 4.75l-1.41-1.41"/></svg>',
  // Palette - simple palette icon
  palette:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1a7 7 0 0 0-7 7c0 1.5.5 2.9 1.3 4L1 15l3-1c1.1.8 2.5 1.3 4 1.3a7 7 0 0 0 7-7 7 7 0 0 0-7-7z"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="8" cy="5" r="1" fill="currentColor"/><circle cx="11" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="8" r="1" fill="currentColor"/></svg>',
  check:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.86 3.66a.75.75 0 0 0-1.06-.02L6.5 9.8 3.2 6.5a.75.75 0 0 0-1.06 1.06l3.83 3.83a.75.75 0 0 0 1.06 0l6.83-6.83a.75.75 0 0 0 0-1.06z"/></svg>',
  paintbrush:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14.54 1.46l-.07-.07-.07-.07-.58-.22h-.08l-.27.07-.43.21-.19.14-8.02 8.02-.14.19-.21.43-.07.28v.07l.22.58.07.07.07.07.58.22h.08l.27-.07.43-.21.19-.14 8.02-8.02.14-.19.21-.43.07-.28v-.07l-.22-.58zM3.5 10.5l8-8 1 1-8 8-1-1zm9.29-9.29l.71.71-.71.71-.71-.71.71-.71zM2 13h1v2H1v-2h1zm10-2h1v4h-2v-4h1z"/></svg>',
  error:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM4 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 014 8z"/></svg>',
  warning:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1z"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 4a1 1 0 100-2 1 1 0 000 2zm.75 3.5a.75.75 0 00-1.5 0v4a.75.75 0 001.5 0v-4z"/></svg>',
  keyboard: lucideIcon(Keyboard)
}

// Folder type detector based on folder name
export function getFolderIcon(folderName: string): string {
  const name = folderName.toLowerCase()

  // Root folder - special icon
  if (name === 'root' || name === 'vault' || name === 'knowledgehub' || name === 'knowledge hub') {
    return codicons.folderRoot
  }

  // Git/GitHub folders
  if (name === '.git' || name === '.github' || name === 'github') {
    return codicons.folderGit
  }

  // Dynamic folder recognition like VS Code
  const folderIcons: Record<string, string> = {
    // Source code
    src: codicons.folderSrc,
    source: codicons.folderSrc,
    sources: codicons.folderSrc,
    app: codicons.folderSrc,
    core: codicons.folderSrc,
    components: codicons.folderSrc,
    modules: codicons.folderSrc,
    features: codicons.folderSrc,
    views: codicons.folderSrc,
    screens: codicons.folderSrc,

    // Configuration
    config: codicons.folderConfig,
    configs: codicons.folderConfig,
    configuration: codicons.folderConfig,
    '.config': codicons.folderConfig,
    '.vscode': codicons.folderConfig,

    // Settings
    settings: codicons.folderSettings,
    setting: codicons.folderSettings,
    preferences: codicons.folderSettings,

    // Testing
    test: codicons.folderTest,
    tests: codicons.folderTest,
    testing: codicons.folderTest,
    __tests__: codicons.folderTest,
    spec: codicons.folderTest,
    specs: codicons.folderTest,

    // Public/Assets
    public: codicons.folderPublic,
    static: codicons.folderPublic,
    assets: codicons.folderPublic,
    images: codicons.folderPublic,
    img: codicons.folderPublic,
    media: codicons.folderPublic,
    resources: codicons.folderPublic,
    pages: codicons.folderPublic,

    // Libraries
    lib: codicons.folderLib,
    libs: codicons.folderLib,
    library: codicons.folderLib,
    libraries: codicons.folderLib,
    utils: codicons.folderLib,
    utilities: codicons.folderLib,
    helpers: codicons.folderLib,
    common: codicons.folderLib,
    shared: codicons.folderLib,
    vendor: codicons.folderLib,
    packages: codicons.folderLib,
    node_modules: codicons.folderLib,

    // Build/Output
    build: codicons.folderSrc,
    dist: codicons.folderSrc,
    out: codicons.folderSrc,
    output: codicons.folderSrc,
    target: codicons.folderSrc,

    // Documentation
    docs: codicons.folderPublic,
    doc: codicons.folderPublic,
    documentation: codicons.folderPublic,
    wiki: codicons.folderPublic,
    notes: codicons.folderPublic
  }

  return folderIcons[name] || codicons.folder
}

export function getFileIcon(fileName: string | undefined | null): string {
  if (!fileName || typeof fileName !== 'string') {
    return codicons.file
  }
  const name = fileName.toLowerCase()

  // Since this is a .md project, all notes are .md files by default
  // The fileName here is the note title (without .md extension in the system)
  // But we check for special patterns like "settings.json" which would be "settings.json.md"

  // Check for special patterns in the title (these would be *.json.md, *.yaml.md, etc.)
  if (name.includes('.json')) {
    // e.g., "settings.json" -> "settings.json.md"
    return codicons.json
  }
  if (name.includes('.yaml') || name.includes('.yml')) {
    // e.g., "config.yaml" -> "config.yaml.md"
    return codicons.fileCode
  }
  if (name.includes('.js') && (name.includes('.jsx') || name.endsWith('.js'))) {
    // e.g., "component.jsx" -> "component.jsx.md"
    return codicons.fileCode
  }
  if (name.includes('.ts') && (name.includes('.tsx') || name.endsWith('.ts'))) {
    // e.g., "component.tsx" -> "component.tsx.md"
    return codicons.fileCode
  }
  if (name.includes('.html')) {
    // e.g., "template.html" -> "template.html.md"
    return codicons.html
  }
  if (
    name.includes('.css') ||
    name.includes('.scss') ||
    name.includes('.sass') ||
    name.includes('.less')
  ) {
    // e.g., "styles.css" -> "styles.css.md"
    return codicons.css
  }

  // Default: all notes are markdown files, use markdown icon
  return codicons.markdown
}

export function renderIcon(svg: string, className = ''): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = `codicon ${className}`
  span.innerHTML = svg
  return span
}
