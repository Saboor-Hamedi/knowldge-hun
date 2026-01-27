import {
  Settings,
  Cog,
  FileJson,
  FileCode,
  Hash,
  Image,
  FileText,
  FolderCode,
  FolderOpen,
  FolderGit,
  Database,
  Key,
  Lock,
  Package,
  Terminal,
  Book,
  FileCheck,
  FileX,
  File,
  Code,
  Globe,
  Server,
  Shield,
  Wrench,
  Zap,
  Heart,
  Users,
  ShoppingBag,
  Brain,
  Network,
  BarChart3,
  Github,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  MessageCircle,
  MessageSquare,
  Share2,
  Sparkles,
  Layers,
  LayoutTemplate,
  LayoutDashboard,
  ClipboardList,
  Target,
  ListTodo,
  FileSearch,
  Notebook,
  User,
  GraduationCap,
  Flag,
  School,
  Globe2,
  Library,
  Clock,
  Calendar,
  FileSignature,
  Milestone,
  Car,
  Plane,
  Waves,
  Phone,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  GitBranch,
  Cloud,
  Activity,
  Cpu,
  Archive,
  Monitor,
  Command,
  GitGraph,
  createElement
} from 'lucide'

// Create actual SVG icons for git-related files
// Create actual SVG icons with specific colors
const createLucideSvg = (IconComponent: any, size: number = 16, color?: string): string => {
  const svgElement = createElement(IconComponent, {
    width: size,
    height: size,
    'stroke-width': 2, // Slightly bolder for better visibility
    stroke: color || 'currentColor',
    fill: 'none'
  })
  return svgElement.outerHTML
}

/**
 * File Icon Mapper
 * Maps file names, patterns, and extensions to appropriate Lucide React icons
 * Used for displaying contextual icons in the sidebar file explorer
 */

// Process icon result - convert Lucide components to SVG strings
const processIconResult = (icon: any, title: string = '', extension: string = ''): string => {
  if (typeof icon === 'string') return icon

  // Get color based on logic
  const color = getIconColor(icon, title, extension)
  return createLucideSvg(icon, 14, color)
}

// --- Country Flag Emoji Support (High Performance) ---
const COUNTRY_FLAGS = {
  afghanistan: '🇦🇫',
  america: '🇺🇸',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  uk: '🇬🇧',
  'united kingdom': '🇬🇧',
  germany: '🇩🇪',
  france: '🇫🇷',
  canada: '🇨🇦',
  china: '🇨🇳',
  japan: '🇯🇵',
  india: '🇮🇳',
  brazil: '🇧🇷',
  italy: '🇮🇹',
  spain: '🇪🇸',
  russia: '🇷🇺',
  australia: '🇦🇺',
  mexico: '🇲🇽',
  pakistan: '🇵🇰',
  iran: '🇮🇷',
  turkey: '🇹🇷',
  egypt: '🇪🇬',
  'south africa': '🇿🇦',
  nigeria: '🇳🇬',
  indonesia: '🇮🇩',
  malaysia: '🇲🇾',
  singapore: '🇸🇬',
  korea: '🇰🇷',
  sweden: '🇸🇪',
  norway: '🇳🇴',
  denmark: '🇩🇰',
  switzerland: '🇨🇭',
  netherlands: '🇳🇱'
}

// --- Animal Emoji Support ---
const ANIMAL_EMOJIS = {
  cat: '🐱',
  dog: '🐶',
  bird: '🐦',
  horse: '🐴',
  fish: '🐟',
  lion: '🦁',
  tiger: '🐯',
  elephant: '🐘',
  bear: '🐻',
  wolf: '🐺',
  fox: '🦊',
  rabbit: '🐰',
  mouse: '🐭',
  owl: '🦉',
  eagle: '🦅',
  shark: '🦈',
  whale: '🐳',
  dolphin: '🐬',
  bee: '🐝',
  ant: '🐜',
  spider: '🕷️',
  butterfly: '🦋',
  monkey: '🐵',
  snake: '🐍',
  dragon: '🐉',
  turtle: '🐢',
  frog: '🐸',
  penguin: '🐧',
  panda: '🐼',
  octopus: '🐙',
  gorilla: '🦍',
  chicken: '🐔'
}

// --- Transport & Nature Emojis ---
const EXTRA_EMOJIS = {
  ocean: '🌊',
  waves: '🌊',
  mountain: '⛰️',
  sun: '☀️',
  moon: '🌙',
  star: '⭐️',
  car: '🚗',
  cars: '🚗',
  plane: '✈️',
  airplane: '✈️',
  aeroplane: '✈️',
  phone: '📱',
  call: '📞',
  ring: '🔔',
  rain: '🌧️',
  snow: '❄️',
  storm: '⚡️'
}

const EmojiIcon = (emoji, size = 16, className = 'item-icon') =>
  `<span class="${className}" style="font-size: ${size}px; line-height: 1;">${emoji}</span>`

const getFileIcon = (title, language) => {
  const titleLower = (title || '').toLowerCase().trim()
  const lang = (language || '').toLowerCase()

  // Strip .md extension for base name matching (since most snippets are .md)
  const baseName = titleLower.endsWith('.md') ? titleLower.slice(0, -3).trim() : titleLower

  // Exact filename matches (highest priority) - check full filename first
  const exactMatches = {
    // Settings & Config
    settings: Settings,
    setting: Settings,
    'settings.md': Settings,
    'setting.md': Settings,
    config: Cog,
    configuration: Cog,
    'config.md': Cog,
    'configuration.md': Cog,
    '.env': Key,
    env: Key,
    '.env.local': Key,
    '.env.production': Key,
    '.env.development': Key,
    'package.json': Package,
    'package-lock.json': Package,
    'yarn.lock': Package,
    'pnpm-lock.yaml': Package,
    'tsconfig.json': FileJson,
    'jsconfig.json': FileJson,
    'webpack.config.js': Cog,
    'vite.config.js': Zap,
    'vite.config.ts': Zap,
    'rollup.config.js': Cog,
    'tailwind.config.js': Zap,
    'tailwind.config.ts': Zap,
    'postcss.config.js': Cog,
    'eslint.config.js': Cog,
    'prettier.config.js': Cog,
    '.prettierrc': Cog,
    '.eslintrc': Cog,
    '.gitignore': FileX,
    gitignore: FileX,
    '.gitattributes': GitBranch,
    '.github': Github,
    github: Github,
    '.gitlab': FolderGit,
    gitlab: FolderGit,
    dockerfile: Terminal,
    '.dockerignore': FileX,
    'docker-compose.yml': Terminal,
    'docker-compose.yaml': Terminal,
    'manifest.json': FileJson,
    'theme.json': Zap,
    'next.config.js': Layers,
    'next.config.mjs': Layers,

    // Commands, Graphs, Charts
    command: Command,
    commands: Command,
    graph: GitGraph,
    graphs: GitGraph,
    comment: MessageSquare,
    comments: MessageSquare,
    chat: MessageCircle,
    message: MessageCircle,
    chart: BarChart3,
    stats: BarChart3,
    data: Database,
    db: Database,

    // Documentation
    'readme.md': Book,
    readme: Book,
    license: FileText,
    'license.md': FileText,
    changelog: FileText,
    'changelog.md': FileText,
    'contributing.md': Book,
    contributing: Book,

    // Common entry points
    'index.js': FileCode,
    'index.jsx': FileCode,
    'app.js': FileCode,
    'app.jsx': FileCode,
    'server.js': Server,
    'main.py': FileCode,
    'requirements.txt': FileText,

    // Project Structure
    src: FolderOpen,
    source: FolderOpen,
    'src.md': FolderOpen,
    lib: FolderCode,
    libs: FolderCode,
    'lib.md': FolderCode,
    components: Package,
    'components.md': Package,
    utils: Wrench,
    'utils.md': Wrench,
    helpers: FolderCode,
    hooks: Wrench,
    stores: Database,
    store: Database,
    state: Database,
    api: Server,
    server: Server,
    client: Monitor,
    ui: LayoutTemplate,
    routes: Network,
    pages: LayoutDashboard,
    views: LayoutDashboard,
    templates: LayoutTemplate,
    template: LayoutTemplate,
    assets: Image,
    public: Globe,
    static: Globe,
    styles: FileCode,
    css: FileCode,
    themes: Zap,
    theme: Zap,

    // Test
    test: FileCheck,
    tests: FileCheck,
    spec: FileCheck,
    __tests__: FileCheck,
    __mocks__: File,

    // Academic & Personal
    docs: Book,
    documentation: Book,
    wiki: Book,
    notes: Notebook,
    'notes.md': Notebook,
    thesis: Book,
    'thesis.md': Book,
    journal: Book,
    'journal.md': Book,
    daily: FileText,
    'daily.md': FileText,
    saboor: Heart,
    'saboor.md': Heart,
    note: Heart,
    'note.md': Heart,
    shopping: ShoppingBag,
    university: GraduationCap,
    school: School,
    library: Library,
    flag: Flag,
    country: Globe2,
    when: Clock,
    plan: Notebook,
    roadmap: Milestone,
    'roadmap.md': Milestone,
    research: FileSearch,
    study: FileSearch,

    // Transport & Weather
    car: Car,
    plane: Plane,
    ocean: Waves,
    phone: Phone,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
    weather: Sun
  }

  // Check emoji exact matches first
  const emojiKey = titleLower
  if (COUNTRY_FLAGS[emojiKey]) return EmojiIcon(COUNTRY_FLAGS[emojiKey])
  if (ANIMAL_EMOJIS[emojiKey]) return EmojiIcon(ANIMAL_EMOJIS[emojiKey])
  if (EXTRA_EMOJIS[emojiKey]) return EmojiIcon(EXTRA_EMOJIS[emojiKey])

  // Check exact matches first (full filename)
  if (exactMatches[titleLower]) {
    const icon = exactMatches[titleLower]
    return processIconResult(icon, titleLower, titleLower.split('.').pop())
  }

  // Check base name (without .md extension) for exact matches
  if (baseName !== titleLower) {
    if (COUNTRY_FLAGS[baseName]) return EmojiIcon(COUNTRY_FLAGS[baseName])
    if (ANIMAL_EMOJIS[baseName]) return EmojiIcon(ANIMAL_EMOJIS[baseName])
    if (EXTRA_EMOJIS[baseName]) return EmojiIcon(EXTRA_EMOJIS[baseName])
    if (exactMatches[baseName]) {
      const icon = exactMatches[baseName]
      return processIconResult(icon, baseName, baseName.split('.').pop())
    }
  }

  // Pattern matches (contains)
  const patternMatches = [
    { pattern: /^\.env/, icon: Key },
    { pattern: /component/, icon: Package },
    { pattern: /^test/, icon: FileCheck },
    { pattern: /^spec/, icon: FileCheck },
    { pattern: /^doc/, icon: Book },
    { pattern: /^note/, icon: Heart },
    { pattern: /^readme/, icon: Book },
    { pattern: /literature/, icon: Book },
    { pattern: /review/, icon: Book },
    { pattern: /thesis/, icon: Book },
    { pattern: /journal/, icon: Book },
    { pattern: /daily/, icon: FileText },
    { pattern: /saboor/, icon: Heart },
    { pattern: /shopping/, icon: ShoppingBag },
    { pattern: /family/, icon: Users },
    { pattern: /friend/, icon: Users },
    {
      pattern: /^ai$|artificial.?intelligence|machine.?learning|^ml$|deep.?learning|xai/,
      icon: Brain
    },
    { pattern: /learning|study|education|course/, icon: FileSearch },
    { pattern: /dashboard|overview|console/, icon: LayoutDashboard },
    { pattern: /^gnn$|graph.?neural|neural.?network|neural/, icon: Network },
    { pattern: /^pandas$|data.?science|datascience/, icon: BarChart3 },
    { pattern: /^react$|react/i, icon: FileCode },
    { pattern: /vue|svelte|angular|next|nuxt|gatsby|ember|meteor/, icon: FileCode },
    { pattern: /express|nestjs|koa|fastify/, icon: Terminal },
    { pattern: /spring|springboot|hibernate|java/, icon: FileCode },
    { pattern: /flask|django|rails|ruby|php/, icon: FileCode },
    { pattern: /git|commit|branch|pr|pull/, icon: GitBranch },
    { pattern: /cloud|aws|azure|gcp|s3|lambda/, icon: Cloud },
    { pattern: /ci|workflow|action|pipeline/, icon: Activity },
    { pattern: /perf|benchmark|cpu|profil/, icon: Cpu },
    { pattern: /^github$|^gh$/, icon: Github },
    { pattern: /^twitter$|^x$/, icon: Twitter },
    { pattern: /^instagram$|^ig$/, icon: Instagram },
    { pattern: /^linkedin$|linked.?in/, icon: Linkedin },
    { pattern: /^youtube$|^yt$/, icon: Youtube },
    { pattern: /social.?media|^social$/, icon: Share2 },
    { pattern: /^lumina$/, icon: Sparkles },
    { pattern: /^snippet/, icon: Layers },
    { pattern: /^dev$|^development$/, icon: Code },
    { pattern: /^html$|^htm$/, icon: FileCode },
    { pattern: /^license/, icon: FileText },
    { pattern: /^changelog/, icon: FileText },
    { pattern: /package/, icon: Package },
    { pattern: /release|dist|bundle/, icon: Archive },
    { pattern: /docker/, icon: Terminal },
    { pattern: /gitignore/, icon: FileX },
    { pattern: /^\.github/, icon: Github },
    { pattern: /^\.gitlab/, icon: FolderGit },
    { pattern: /gitlab/, icon: FolderGit },
    { pattern: /^\.docker/, icon: Terminal },
    { pattern: /security/, icon: Shield },
    { pattern: /secret|key|password|credential/, icon: Lock },
    { pattern: /api/, icon: Server },
    { pattern: /route/, icon: Globe },
    { pattern: /page/, icon: File },
    { pattern: /view/, icon: File },
    { pattern: /template/, icon: LayoutTemplate },
    { pattern: /asset/, icon: Image },
    { pattern: /style/, icon: FileCode },
    { pattern: /theme/, icon: Zap },
    { pattern: /model|schema|migration/, icon: Database },
    { pattern: /script|tool|plugin|extension/, icon: Terminal },
    { pattern: /summary|summarize|abstract/, icon: ClipboardList },
    { pattern: /goal|objective|aim|target/, icon: Target },
    { pattern: /task|todo|to-do/, icon: ListTodo },
    { pattern: /blueprint|plan|strategy/, icon: Notebook },
    { pattern: /research|study|exploration/, icon: FileSearch },
    { pattern: /personal/, icon: User },
    { pattern: /university|college|academic|school/, icon: GraduationCap },
    { pattern: /library|archive/, icon: Library },
    { pattern: /flag|country|nation|continent|world|global/, icon: Globe2 },
    { pattern: /quick/, icon: Zap },
    { pattern: /when|time|schedule|clock/, icon: Clock },
    { pattern: /^\d{4}-\d{2}-\d{2}$/, icon: Calendar },

    // Proposal & Purpose Patterns
    { pattern: /proposal/, icon: FileSignature },
    { pattern: /purpose|roadmap/, icon: Milestone },

    // Transport & Nature Patterns
    { pattern: /car|vehicle|driving/, icon: Car },
    { pattern: /plane|flight|airport|fly/, icon: Plane },
    { pattern: /ocean|sea|waves|water/, icon: Waves },
    { pattern: /phone|call|mobile|ring/, icon: Phone },
    { pattern: /rain|drizzle|shower/, icon: CloudRain },
    { pattern: /snow|ice|cold|frost/, icon: CloudSnow },
    { pattern: /storm|thunder|lightning/, icon: CloudLightning },
    { pattern: /weather|forecast|climate|temperature|sun/, icon: Sun },

    // Added Patterns
    { pattern: /graph|network|diagram/, icon: GitGraph },
    { pattern: /comment|message|chat|conversation/, icon: MessageSquare },
    { pattern: /command|cmd|cli/, icon: Command },
    { pattern: /chart|stat|analytics|metric/, icon: BarChart3 }
  ]

  // Check patterns on full filename first
  for (const { pattern, icon } of patternMatches) {
    if (pattern.test(titleLower)) {
      return processIconResult(icon, titleLower, titleLower.split('.').pop())
    }
  }

  // Check patterns on base name (without .md)
  if (baseName !== titleLower) {
    for (const { pattern, icon } of patternMatches) {
      if (pattern.test(baseName)) {
        return processIconResult(icon, baseName, baseName.split('.').pop())
      }
    }
  }

  // File extension matches - handle compound extensions like .jsx.md
  let extension = titleLower.split('.').pop()

  // For markdown files with embedded code extensions, check for the code extension first
  if ((extension === 'md' || extension === 'markdown') && titleLower.split('.').length >= 3) {
    const codeExtension = titleLower.split('.')[titleLower.split('.').length - 2]
    if (
      [
        'js',
        'jsx',
        'ts',
        'tsx',
        'html',
        'css',
        'scss',
        'vue',
        'svelte',
        'sql',
        'json',
        'py',
        'yaml',
        'sh'
      ].includes(codeExtension)
    ) {
      extension = codeExtension
    }
  }

  const extensionMap = {
    // Code files
    js: FileCode,
    jsx: FileCode,
    ts: FileCode,
    tsx: FileCode,
    py: FileCode,
    java: FileCode,
    cpp: FileCode,
    c: FileCode,
    cs: FileCode,
    go: FileCode,
    rs: FileCode,
    php: FileCode,
    rb: FileCode,
    swift: FileCode,
    kt: FileCode,
    scala: FileCode,
    sh: Terminal,
    bash: Terminal,
    zsh: Terminal,
    fish: Terminal,
    ps1: Terminal,
    bat: Terminal,
    cmd: Terminal,

    // Web files
    html: FileCode,
    htm: FileCode,
    css: FileCode,
    scss: FileCode,
    sass: FileCode,
    less: FileCode,
    styl: FileCode,

    // Data files
    json: FileJson,
    xml: FileJson,
    yaml: FileJson,
    yml: FileJson,
    toml: FileJson,
    ini: FileJson,
    csv: FileJson,

    // Markdown (only if no code extension found)
    md: Hash,
    markdown: Hash,
    mdx: Hash,

    // modern JS module types
    mjs: FileCode,
    cjs: FileCode,
    // build tool / script files
    gradle: FileCode,
    makefile: Terminal,

    // Images
    png: Image,
    jpg: Image,
    jpeg: Image,
    gif: Image,
    svg: Image,
    webp: Image,
    ico: Image,
    bmp: Image,
    tiff: Image,

    // Documents
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    txt: FileText,
    rtf: FileText,

    // Archives
    zip: Package,
    tar: Package,
    gz: Package,
    rar: Package,
    '7z': Package,

    // Database
    sql: Database,
    db: Database,
    sqlite: Database,
    mdb: Database,

    // Config files
    conf: Cog,
    config: Cog,
    cfg: Cog,
    properties: Cog,

    // Other
    log: FileText
  }

  if (extension && extensionMap[extension]) {
    return processIconResult(extensionMap[extension], titleLower, extension)
  }

  // Language-based fallback
  const languageMap = {
    javascript: FileCode,
    js: FileCode,
    jsx: FileCode,
    typescript: FileCode,
    ts: FileCode,
    tsx: FileCode,
    python: FileCode,
    py: FileCode,
    html: FileCode,
    css: FileCode,
    json: FileJson,
    markdown: Hash,
    md: Hash,
    react: FileCode,
    vue: FileCode,
    svelte: FileCode,
    angular: FileCode,
    java: FileCode,
    c: FileCode,
    cpp: FileCode,
    csharp: FileCode,
    go: FileCode,
    rust: FileCode,
    ruby: FileCode,
    php: FileCode,
    swift: FileCode,
    kotlin: FileCode
  }

  if (languageMap[lang]) {
    return processIconResult(languageMap[lang], titleLower, lang)
  }

  // Final fallback (Professional Hash/Document icon)
  return processIconResult(Hash, titleLower, extension)
}

/**
 * Get icon color based on icon type and contextual logic
 */
const getIconColor = (icon: any, title: string = '', extension: string = ''): string => {
  const titleLower = title.toLowerCase()

  // 1. Language-specific Brand Colors (High Precision)
  if (extension === 'ts' || extension === 'tsx') return '#3178c6' // TypeScript Blue
  if (extension === 'js' || extension === 'jsx' || extension === 'mjs') return '#f7df1e' // JS Yellow
  if (extension === 'html') return '#e34f26' // HTML Orange
  if (extension === 'css') return '#1572b6' // CSS Blue
  if (extension === 'scss' || extension === 'sass') return '#cc6699' // Sass Pink
  if (extension === 'json') return '#cbcb41' // JSON Gold
  if (extension === 'py') return '#3776ab' // Python Blue
  if (extension === 'java') return '#b07219' // Java Brown
  if (extension === 'rb') return '#701516' // Ruby Red
  if (extension === 'go') return '#00add8' // Go Cyan
  if (extension === 'rs') return '#dea584' // Rust Orange
  if (extension === 'php') return '#777bb4' // PHP Purple
  if (extension === 'sql') return '#336791' // SQL Blue
  if (extension === 'yaml' || extension === 'yml') return '#cb171e' // YAML Red

  // 2. Specialized Folder Icons
  if (icon === FolderOpen || titleLower === 'src') return '#4d90fe' // Source Blue
  if (icon === Package || icon === Layers) return '#ffa500' // Component/Module Orange
  if (icon === Database) return '#4db33d' // DB Green
  if (icon === GitBranch || icon === Github) return '#f1502f' // Git/PR Orange

  // 3. Status Icons
  if (icon === FileCheck || icon === ListTodo) return '#22c55e' // Success Green
  if (icon === FileX) return '#ef4444' // Error Red
  if (icon === Lock || icon === Shield) return '#f59e0b' // Security Amber

  // 4. Content Categories (Contextual)
  if (['saboor', 'note', 'node', 'heart'].some((name) => titleLower.includes(name))) {
    return '#ec4899' // Rosy Pink
  }
  if (
    ['ai', 'brain', 'neural', 'machine learning', 'graph', 'network'].some((name) =>
      titleLower.includes(name)
    )
  ) {
    return '#8b5cf6' // AI/Graph Purple
  }
  if (['comment', 'chat', 'message'].some((name) => titleLower.includes(name))) {
    return '#60a5fa' // Message Blue
  }
  if (['command', 'cmd'].some((name) => titleLower.includes(name))) {
    return '#22c55e' // Command Green
  }
  if (
    ['research', 'study', 'docs', 'readme', 'roadmap'].some((name) => titleLower.includes(name))
  ) {
    return '#10b981' // Documentation Teal
  }

  // Default color (Inherit text color or neutral gray)
  return 'currentColor'
}

/**
 * Get icon HTML string for a snippet (for non-React usage)
 * @param {Object} snippet - The snippet object with title and language
 * @param {number} size - Icon size (default: 14)
 * @param {string} className - CSS class name (default: 'item-icon')
 * @returns {string} HTML string for the icon
 */
export const getSnippetIconHtml = (
  snippet: { title: string; language: string },
  size: number = 14,
  className: string = 'item-icon'
): string => {
  const iconHtml = getFileIcon(snippet.title, snippet.language)
  const iconColor = getIconColor(null, snippet.title, snippet.language)

  return `<span class="${className}" style="color: ${iconColor}; font-size: ${size}px; display: inline-flex; align-items: center; justify-content: center;">${iconHtml}</span>`
}

export default getFileIcon
