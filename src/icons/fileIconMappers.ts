import {
  Settings,
  Cog,
  FileJson,
  FileCode,
  Hash,
  ImageIcon,
  FileText,
  Folder,
  FolderCode,
  FolderOpen,
  Database,
  Key,
  Lock,
  Package,
  Terminal,
  Book,
  FileCheck,
  FileX,
  File,
  FileType,
  Code,
  Globe,
  Server,
  Shield,
  Wrench,
  Zap,
  Box,
  Heart,
  Users,
  ShoppingBag,
  Brain,
  Network,
  BarChart3,
  Github,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MessageCircle,
  Send,
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
  Bell,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  Wind,
  Thermometer
} from 'lucide-react'
import { GitBranch, Cloud, Activity, Cpu, Archive, Monitor } from 'lucide-react'

/**
 * File Icon Mapper
 * Maps file names, patterns, and extensions to appropriate Lucide React icons
 * Used for displaying contextual icons in the sidebar file explorer
 */

// Map Lucide icons to emojis for HTML display
const iconToEmoji = {
  [Settings.name]: '⚙️',
  [Cog.name]: '⚙️',
  [FileJson.name]: '📋',
  [FileCode.name]: '📄',
  [Hash.name]: '#',
  [ImageIcon.name]: '🖼️',
  [FileText.name]: '📄',
  [Folder.name]: '📁',
  [FolderCode.name]: '📁',
  [FolderOpen.name]: '📂',
  [Database.name]: '🗄️',
  [Key.name]: '🔑',
  [Lock.name]: '🔒',
  [Package.name]: '📦',
  [Terminal.name]: '⌨️',
  [Book.name]: '📚',
  [FileCheck.name]: '✅',
  [FileX.name]: '❌',
  [File.name]: '📄',
  [FileType.name]: '📄',
  [Code.name]: '</>',
  [Globe.name]: '🌐',
  [Server.name]: '🖥️',
  [Shield.name]: '🛡️',
  [Wrench.name]: '🔧',
  [Zap.name]: '⚡',
  [Box.name]: '📦',
  [Heart.name]: '❤️',
  [Users.name]: '👥',
  [ShoppingBag.name]: '🛍️',
  [Brain.name]: '🧠',
  [Network.name]: '🔗',
  [BarChart3.name]: '📊',
  [Github.name]: '🐙',
  [Twitter.name]: '𝕏',
  [Facebook.name]: '👥',
  [Instagram.name]: '📷',
  [Linkedin.name]: '💼',
  [Youtube.name]: '📺',
  [MessageCircle.name]: '💬',
  [Send.name]: '📤',
  [Share2.name]: '🔗',
  [Sparkles.name]: '✨',
  [Layers.name]: '📚',
  [LayoutTemplate.name]: '📐',
  [LayoutDashboard.name]: '📊',
  [ClipboardList.name]: '📋',
  [Target.name]: '🎯',
  [ListTodo.name]: '✅',
  [FileSearch.name]: '🔍',
  [Notebook.name]: '📓',
  [User.name]: '👤',
  [GraduationCap.name]: '🎓',
  [Flag.name]: '🚩',
  [School.name]: '🏫',
  [Globe2.name]: '🌍',
  [Library.name]: '📚',
  [Clock.name]: '🕐',
  [Calendar.name]: '📅',
  [FileSignature.name]: '✍️',
  [Milestone.name]: '🏁',
  [Car.name]: '🚗',
  [Plane.name]: '✈️',
  [Waves.name]: '🌊',
  [Phone.name]: '📱',
  [Bell.name]: '🔔',
  [CloudRain.name]: '🌧️',
  [CloudSnow.name]: '❄️',
  [CloudLightning.name]: '⚡',
  [Sun.name]: '☀️',
  [Wind.name]: '💨',
  [Thermometer.name]: '🌡️',
  [GitBranch.name]: '🌿',
  [Cloud.name]: '☁️',
  [Activity.name]: '📈',
  [Cpu.name]: '💻',
  [Archive.name]: '📦',
  [Monitor.name]: '🖥️'
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

const EmojiIcon =
  (emoji) =>
  ({ size, className, style }) =>
    `<span class="${className || ''}" style="font-size: ${size}px; ${
      style
        ? Object.entries(style)
            .map(([k, v]) => `${k}:${v}`)
            .join(';')
        : ''
    }">${emoji}</span>`

// For Lucide icons, we'll return a placeholder for now, but ideally create SVG
const LucideIconHtml = (Icon, iconColor, size, className) => {
  // This is a simplified version - in practice, you'd need to get the SVG path from the icon
  // For now, return a colored square or use a generic icon
  return `<span class="${className || ''}" style="color: ${iconColor}; font-size: ${size}px; display: inline-flex; align-items: center; justify-content: center;">📄</span>`
}

const getFileIcon = (title, language) => {
  const titleLower = (title || '').toLowerCase().trim()
  const lang = (language || 'markdown').toLowerCase()

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

    // Common config files
    'tsconfig.json': FileJson,
    'jsconfig.json': FileJson,
    'webpack.config.js': Cog,
    'vite.config.js': Cog,
    'rollup.config.js': Cog,
    'tailwind.config.js': Cog,
    'postcss.config.js': Cog,
    'eslint.config.js': Cog,
    'prettier.config.js': Cog,
    '.prettierrc': Cog,
    '.eslintrc': Cog,
    '.gitignore': File,
    '.gitattributes': File,
    dockerfile: Terminal,
    '.dockerignore': File,
    'docker-compose.yml': Terminal,
    'docker-compose.yaml': Terminal,

    // Documentation
    'readme.md': Book,
    readme: Book,
    license: FileText,
    'license.md': FileText,
    changelog: FileText,
    'changelog.md': FileText,
    'contributing.md': Book,
    contributing: Book,
    // Common entry points and important files
    'index.js': FileCode,
    'index.jsx': FileCode,
    'app.js': FileCode,
    'app.jsx': FileCode,
    'server.js': Server,
    'main.py': FileCode,
    'requirements.txt': FileText,

    // Security
    '.htaccess': Shield,
    'robots.txt': File,
    '.security': Shield,

    // Build & Deploy
    build: FolderCode,
    dist: FolderCode,
    out: FolderCode,
    '.next': FolderCode,
    '.nuxt': FolderCode,
    '.cache': Folder,

    // Source directories
    dashboard: LayoutDashboard,
    dashboards: LayoutDashboard,
    src: FolderCode,
    source: FolderCode,
    'src.md': FolderCode,
    lib: FolderCode,
    libs: FolderCode,
    'lib.md': FolderCode,
    components: FolderCode,
    'components.md': FolderCode,
    utils: FolderCode,
    'utils.md': FolderCode,
    helpers: FolderCode,
    hooks: FolderCode,
    stores: Database,
    store: Database,
    state: Database,
    api: Server,
    routes: Globe,
    pages: File,
    views: File,
    templates: LayoutTemplate,
    template: LayoutTemplate,
    'templates.md': LayoutTemplate,
    'template.md': LayoutTemplate,
    assets: ImageIcon,
    public: Globe,
    static: Globe,
    styles: FileCode,
    css: FileCode,
    themes: Zap,
    theme: Zap,

    // Test directories
    test: FileCheck,
    tests: FileCheck,
    spec: FileCheck,
    __tests__: FileCheck,
    __mocks__: File,

    // Documentation directories
    docs: Book,
    documentation: Book,
    wiki: Book,
    notes: Notebook,
    'notes.md': Notebook,

    // Literature & Academic
    'literature review': Book,
    'literature-review': Book,
    literature: Book,
    'literature.md': Book,
    review: Book,
    'review.md': Book,
    thesis: Book,
    'thesis.md': Book,
    journals: Book,
    journal: Book,
    'journals.md': Book,
    'journal.md': Book,
    daily: FileText,
    'daily.md': FileText,

    // Personal & Love
    saboor: Heart,
    'saboor.md': Heart,
    note: Heart,
    'note.md': Heart,
    node: Heart,
    'node.md': Heart,
    tab: Code,
    'tab.md': Code,
    shopping: ShoppingBag,
    'shopping.md': ShoppingBag,

    // Family & Friends
    family: Users,
    'family.md': Users,
    friends: Users,
    'friends.md': Users,

    // Data & Database
    data: Database,
    db: Database,
    database: Database,
    models: Database,
    schema: Database,
    migrations: Database,

    // Scripts
    scripts: Terminal,
    bin: Terminal,
    tools: Wrench,
    cli: Terminal,

    // Other common folders
    node_modules: Package,
    vendor: Package,
    dependencies: Package,
    modules: Box,
    plugins: Zap,
    extensions: Zap,

    // Summaries & Outcomes
    summary: ClipboardList,
    summaries: ClipboardList,
    abstract: ClipboardList,
    goals: Target,
    goal: Target,
    objectives: Target,
    tasks: ListTodo,
    todo: ListTodo,
    blueprint: Notebook,
    plan: Notebook,
    research: FileSearch,
    study: FileSearch,
    personal: User,
    'personal.md': User,
    university: GraduationCap,
    'university.md': GraduationCap,
    college: GraduationCap,
    school: School,
    library: Library,
    flag: Flag,
    country: Globe2,
    when: Clock,
    'when.md': Clock,

    // Proposal & Purpose
    proposal: FileSignature,
    proposals: FileSignature,
    purpose: Milestone,
    purposes: Milestone,

    // Transport & Weather
    car: Car,
    cars: Car,
    plane: Plane,
    airplane: Plane,
    aeroplane: Plane,
    ocean: Waves,
    phone: Phone,
    call: Phone,
    ring: Bell,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
    weather: Sun
  }

  // Check extension mapping FIRST (before exact matches)
  let extension = titleLower.split('.').pop()

  // For markdown files with embedded code extensions, check for the code extension first
  if (extension === 'md' || extension === 'markdown') {
    const parts = titleLower.split('.')
    if (parts.length >= 3) {
      // Check if there's a code extension before .md (e.g., .jsx.md, .ts.md)
      const codeExtension = parts[parts.length - 2]
      if (
        ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'vue', 'svelte'].includes(codeExtension)
      ) {
        extension = codeExtension
      }
    }
  }

  // Direct emoji mapping for specific extensions
  const extensionEmojiMap = {
    js: '⚡',
    jsx: '🔷',
    ts: '🔷',
    tsx: '⚛️',
    sql: '🗄️',
    py: '🐍',
    java: '☕',
    cpp: '⚙️',
    c: '⚙️',
    go: '🐹',
    rs: '🦀',
    php: '🐘',
    rb: '💎',
    swift: '🦉',
    kt: '🎯',
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    json: '📋',
    xml: '📋',
    yaml: '📋',
    yml: '📋'
  }

  if (extension && extensionEmojiMap[extension]) {
    return extensionEmojiMap[extension]
  }

  // Check emoji exact matches first
  const emojiKey = titleLower
  if (COUNTRY_FLAGS[emojiKey]) return EmojiIcon(COUNTRY_FLAGS[emojiKey])
  if (ANIMAL_EMOJIS[emojiKey]) return EmojiIcon(ANIMAL_EMOJIS[emojiKey])
  if (EXTRA_EMOJIS[emojiKey]) return EmojiIcon(EXTRA_EMOJIS[emojiKey])

  // Check exact matches first (full filename)
  if (exactMatches[titleLower]) {
    const Icon = exactMatches[titleLower]
    return iconToEmoji[Icon.name]
  }

  // Check base name (without .md extension) for exact matches
  if (baseName !== titleLower) {
    if (COUNTRY_FLAGS[baseName]) return COUNTRY_FLAGS[baseName]
    if (ANIMAL_EMOJIS[baseName]) return ANIMAL_EMOJIS[baseName]
    if (EXTRA_EMOJIS[baseName]) return EXTRA_EMOJIS[baseName]
    if (exactMatches[baseName]) {
      const Icon = exactMatches[baseName]
      return iconToEmoji[Icon.name]
    }
  }

  // Pattern matches (contains)
  const patternMatches = [
    { pattern: /^\.env/, icon: Key },
    { pattern: /config/, icon: Cog },
    { pattern: /setting/, icon: Settings },
    { pattern: /^src/, icon: FolderCode },
    { pattern: /^lib/, icon: FolderCode },
    { pattern: /component/, icon: FolderCode },
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
    { pattern: /^xia$/, icon: Heart },
    { pattern: /^github$|^gh$/, icon: Github },
    { pattern: /^twitter$|^x$/, icon: Twitter },
    { pattern: /^facebook$|^fb$/, icon: Facebook },
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
    { pattern: /^\.git/, icon: File },
    { pattern: /^\.docker/, icon: Terminal },
    { pattern: /security/, icon: Shield },
    { pattern: /secret/, icon: Lock },
    { pattern: /key/, icon: Key },
    { pattern: /credential/, icon: Lock },
    { pattern: /password/, icon: Lock },
    { pattern: /api/, icon: Server },
    { pattern: /route/, icon: Globe },
    { pattern: /page/, icon: File },
    { pattern: /view/, icon: File },
    { pattern: /template/, icon: LayoutTemplate },
    { pattern: /asset/, icon: ImageIcon },
    { pattern: /style/, icon: FileCode },
    { pattern: /theme/, icon: Zap },
    { pattern: /model/, icon: Database },
    { pattern: /schema/, icon: Database },
    { pattern: /migration/, icon: Database },
    { pattern: /script/, icon: Terminal },
    { pattern: /tool/, icon: Wrench },
    { pattern: /plugin/, icon: Zap },
    { pattern: /extension/, icon: Zap },
    { pattern: /summary|summarize|abstract/, icon: ClipboardList },
    { pattern: /goal|objective|aim/, icon: Target },
    { pattern: /task|todo|to-do|action-item/, icon: ListTodo },
    { pattern: /blueprint|plan|strategy/, icon: Notebook },
    { pattern: /research|study|exploration/, icon: FileSearch },
    { pattern: /personal/, icon: User },
    { pattern: /university|college|academic/, icon: GraduationCap },
    { pattern: /school|education/, icon: School },
    { pattern: /library|archive/, icon: Library },
    { pattern: /flag/, icon: Flag },
    { pattern: /country|nation|continent|world|global/, icon: Globe2 },
    { pattern: /quick/, icon: Zap },
    { pattern: /when|time|schedule|clock/, icon: Clock },
    { pattern: /^\d{4}-\d{2}-\d{2}$/, icon: Calendar },

    // Proposal & Purpose Patterns
    { pattern: /proposal/, icon: FileSignature },
    { pattern: /purpose/, icon: Milestone },

    // Transport & Nature Patterns
    { pattern: /car|vehicle|driving/, icon: Car },
    { pattern: /plane|flight|airport|fly/, icon: Plane },
    { pattern: /ocean|sea|waves|water/, icon: Waves },
    { pattern: /phone|call|mobile|ring/, icon: Phone },
    { pattern: /rain|drizzle|shower/, icon: CloudRain },
    { pattern: /snow|ice|cold|frost/, icon: CloudSnow },
    { pattern: /storm|thunder|lightning/, icon: CloudLightning },
    { pattern: /weather|forecast|climate|temperature|sun/, icon: Sun }
  ]

  // Check patterns on full filename first
  for (const { pattern, icon } of patternMatches) {
    if (pattern.test(titleLower)) {
      return iconToEmoji[icon.name]
    }
  }

  // Check patterns on base name (without .md)
  if (baseName !== titleLower) {
    for (const { pattern, icon } of patternMatches) {
      if (pattern.test(baseName)) {
        return iconToEmoji[icon.name]
      }
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
    Dockerfile: Terminal,

    // Images
    png: ImageIcon,
    jpg: ImageIcon,
    jpeg: ImageIcon,
    gif: ImageIcon,
    svg: ImageIcon,
    webp: ImageIcon,
    ico: ImageIcon,
    bmp: ImageIcon,
    tiff: ImageIcon,

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
    log: FileText,
    lock: Lock,
    key: Key,
    pem: Key,
    cert: Shield,
    crt: Shield
  }

  if (extension && extensionMap[extension]) {
    return iconToEmoji[extensionMap[extension].name]
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
    // Additional language identifiers
    react: FileCode,
    vue: FileCode,
    svelte: FileCode,
    angular: FileCode,
    java: FileCode,
    c: FileCode,
    cpp: FileCode,
    'c++': FileCode,
    csharp: FileCode,
    'c#': FileCode,
    go: FileCode,
    golang: FileCode,
    rust: FileCode,
    rs: FileCode,
    ruby: FileCode,
    php: FileCode,
    swift: FileCode,
    kotlin: FileCode
  }

  if (languageMap[lang]) {
    return iconToEmoji[languageMap[lang].name]
  }

  // Default fallback: ensure anything the user types has a relevant code/file icon
  return iconToEmoji[FileCode.name]
}

/**
 * Get icon color based on icon type
 */
const getIconColor = (iconType, title) => {
  const titleLower = (title || '').toLowerCase()

  // Love/Personal icons
  if (['saboor', 'note', 'node', 'xia', 'personal'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-love, var(--text-accent))'
  }

  // AI & ML icons
  if (
    [
      'ai',
      'artificial intelligence',
      'machine learning',
      'ml',
      'deep learning',
      'neural',
      'xai'
    ].some((name) => titleLower.includes(name))
  ) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // Learning & Education icons
  if (['learning', 'study', 'education', 'course'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-tertiary, #8b5cf6)' // Violet
  }

  // Dashboard icons
  if (['dashboard', 'overview', 'console'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, #06b6d4)' // Cyan
  }

  // GNN & Graph Neural Networks
  if (['gnn', 'graph neural', 'neural network'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-secondary, #10b981)'
  }

  // Data Science & Pandas
  if (['pandas', 'data science', 'datascience'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-tertiary, #f59e0b)'
  }

  // Social Media icons
  if (['github', 'gh'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }
  if (['twitter', 'x'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, #1da1f2)'
  }
  if (['facebook', 'fb'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, #1877f2)'
  }
  if (['instagram', 'ig'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-love, #e4405f)'
  }
  if (['linkedin', 'linked-in'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, #0077b5)'
  }
  if (['youtube', 'yt'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-danger, #ff0000)'
  }
  if (['social', 'social media'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // Settings/Config icons
  if (['settings', 'config', 'setting'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // Code/Development icons
  if (['src', 'lib', 'components', 'utils', 'code'].some((name) => titleLower.includes(name))) {
    return 'var(--icon-secondary, #10b981)'
  }

  // Documentation icons
  if (
    ['readme', 'docs', 'literature', 'thesis', 'journal'].some((name) => titleLower.includes(name))
  ) {
    return 'var(--icon-tertiary, #f59e0b)'
  }

  // Quick & When icons
  if (titleLower.includes('quick')) {
    return 'var(--text-accent)' // Gold/Yellow
  }
  if (
    ['when', 'time', 'schedule', 'clock'].some((name) => titleLower.includes(name)) ||
    /^\d{4}-\d{2}-\d{2}$/.test(titleLower)
  ) {
    return 'var(--icon-primary, #60a5fa)' // Blue
  }

  // Weather & Nature Colors
  if (['sun', 'weather', 'forecast'].some((name) => titleLower.includes(name))) {
    return '#f59e0b' // Amber
  }
  if (['rain', 'ocean', 'sea', 'waves', 'water'].some((name) => titleLower.includes(name))) {
    return '#3b82f6' // Blue
  }
  if (['snow', 'ice', 'frost'].some((name) => titleLower.includes(name))) {
    return '#93c5fd' // Light Blue
  }
  if (['storm', 'thunder', 'lightning'].some((name) => titleLower.includes(name))) {
    return '#eab308' // Yellow
  }

  // Animal Colors (Earthy/Natural)
  if (
    ['animal', 'cat', 'dog', 'horse', 'bear', 'lion', 'tiger'].some((name) =>
      titleLower.includes(name)
    )
  ) {
    return '#b45309' // Brownish
  }

  // Default accent color
  return 'var(--icon-primary, var(--text-accent))'
}

/**
 * Get icon HTML string for a snippet (for non-React usage)
 * @param {Object} snippet - The snippet object with title and language
 * @param {number} size - Icon size (default: 14)
 * @param {string} className - CSS class name (default: 'item-icon')
 * @returns {string} HTML string for the icon
 */
export const getSnippetIconHtml = (snippet, size = 14, className = 'item-icon') => {
  const Icon = getFileIcon(snippet.title, snippet.language)
  const iconColor = getIconColor(Icon, snippet.title)

  return `<span class="${className}" style="color: ${iconColor}; font-size: ${size}px; display: inline-flex; align-items: center; justify-content: center;">${Icon}</span>`
}

export default getFileIcon
