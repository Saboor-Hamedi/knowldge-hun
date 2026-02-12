import {
  createElement,
  File,
  FileJson,
  FileText,
  FileCode2,
  FileCode,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Link,
  DownloadCloud,
  UploadCloud,
  Calendar,
  Pin,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderRoot,
  FolderCode,
  FolderCog,
  FolderCheck,
  FolderDot,
  FolderArchive,
  FolderGit2,
  Files,
  Search,
  Paintbrush,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  Keyboard,
  Sparkles,
  Lock,
  Key,
  Square,
  FilePlus,
  Maximize2,
  Minimize2,
  LogIn,
  FileUp,
  PlusSquare,
  FileOutput,
  CopyPlus,
  Layers,
  LayoutGrid,
  Terminal,
  History,
  GitCommit
} from 'lucide'

/**
 * Helper to create Lucide icon SVG string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lucideIcon(IconComponent: any, size: number = 16, strokeWidth: number = 2): string {
  const svgElement = createElement(IconComponent, {
    width: size,
    height: size,
    'stroke-width': strokeWidth,
    stroke: 'currentColor',
    fill: 'currentColor',
    'fill-opacity': 0.1,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  })
  return svgElement.outerHTML
}

/**
 * VS Code Codicon system
 * SVG-based icons matching VS Code's icon set
 */

export const codicons = {
  // File types
  file: lucideIcon(File),
  fileCode: lucideIcon(FileCode),
  json: lucideIcon(FileJson),
  markdown: lucideIcon(FileText),
  html: lucideIcon(FileCode2),
  css: lucideIcon(FileCode),
  image: lucideIcon(FilePlus),

  // UI elements
  chevronRight: lucideIcon(ChevronRight),
  chevronDown: lucideIcon(ChevronDown),
  close: lucideIcon(X),
  add: lucideIcon(Plus),
  refresh: lucideIcon(RefreshCw),
  ellipsis: lucideIcon(MoreHorizontal),
  edit: lucideIcon(Pencil),
  trash: lucideIcon(Trash2),
  copy: lucideIcon(Copy),
  link: lucideIcon(Link),
  cloudDownload: lucideIcon(DownloadCloud),
  cloudUpload: lucideIcon(UploadCloud),
  calendar: lucideIcon(Calendar),
  pin: lucideIcon(Pin),

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
  files: lucideIcon(Files),
  search: lucideIcon(Search),
  settingsGear: lucideIcon(FolderCog),
  palette: lucideIcon(Paintbrush),
  check: lucideIcon(Check),
  paintbrush: lucideIcon(Paintbrush),
  error: lucideIcon(AlertCircle),
  warning: lucideIcon(AlertTriangle),
  info: lucideIcon(Info),
  keyboard: lucideIcon(Keyboard),
  sparkles: lucideIcon(Sparkles),
  lock: lucideIcon(Lock),
  key: lucideIcon(Key),
  stop: lucideIcon(Square, 14, 2),
  insert: lucideIcon(FilePlus, 14, 2),
  maximize: lucideIcon(Maximize2, 14, 2),
  minimize: lucideIcon(Minimize2, 14, 2),
  closeX: lucideIcon(X, 14, 2),
  chevronDownLucide: lucideIcon(ChevronDown, 14, 2),
  terminal: lucideIcon(Terminal, 14, 2),
  agent: lucideIcon(Sparkles, 14, 2),
  signIn: lucideIcon(LogIn, 16, 2),
  archive: lucideIcon(FileUp, 14, 2),
  insertPlus: lucideIcon(PlusSquare, 14, 2),
  export: lucideIcon(FileOutput, 14, 2),
  duplicate: lucideIcon(CopyPlus),
  closeAll: lucideIcon(Layers),
  closeOthers: lucideIcon(LayoutGrid),
  history: lucideIcon(History),
  gitCommit: lucideIcon(GitCommit)
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

  if (name.endsWith('.json')) return codicons.json
  if (name.endsWith('.md')) return codicons.markdown
  if (name.endsWith('.html') || name.endsWith('.htm')) return codicons.html
  if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.sass')) return codicons.css
  if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs'))
    return codicons.fileCode
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return codicons.fileCode
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return codicons.fileCode

  // Images
  if (name.match(/\.(png|jpe?g|gif|svg|ico|webp)$/)) return codicons.image

  // Fallback for names containing extensions (older logic)
  if (name.includes('.json')) return codicons.json
  if (name.includes('.js')) return codicons.fileCode
  if (name.includes('.ts')) return codicons.fileCode
  if (name.includes('.css')) return codicons.css
  if (name.includes('.html')) return codicons.html

  return codicons.file
}

export function renderIcon(svg: string, className = ''): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = `codicon ${className}`
  span.innerHTML = svg
  return span
}
