const iconMap: Record<string, string> = {
  '.ts': '💻',
  '.js': '💻',
  '.tsx': '💻',
  '.jsx': '💻',
  '.json': '🧾',
  '.html': '🌐',
  '.htm': '🌐',
  '.css': '🎨',
  '.scss': '🎨',
  '.md': '📝',
  '.txt': '📄',
  '.sh': '⚙️'
}

const defaultIcon = '📄'

export function getNoteIcon(title: string): string {
  const lower = title.toLowerCase().trim()
  const ext = Object.keys(iconMap).find((key) => lower.endsWith(key))
  return ext ? iconMap[ext] : defaultIcon
}