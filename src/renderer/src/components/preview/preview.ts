import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { state } from '../../core/state'
import { createElement, Copy, Check } from 'lucide'
import 'highlight.js/styles/github-dark.css'
import './preview.css'
import '../wikilink/wikilink.css'

// Pre-register common languages at module load
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'

// Register common languages immediately
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('yml', yaml)

// Configure highlighting to ignore unescaped HTML warnings
// Safe as we sanitize with DOMPurify
hljs.configure({ ignoreUnescapedHTML: true })

// Helper for tag/mention matching
const isIdentifierChar = (code: number): boolean => {
  return (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    code === 0x5f || // _
    code === 0x2d // -
  )
}

export class PreviewComponent {
  private container: HTMLElement
  private md: MarkdownIt
  private onWikiLinkClick?: (target: string) => void

  private createLucideIcon(
    IconComponent: Parameters<typeof createElement>[0],
    size: number = 16,
    strokeWidth: number = 1.5,
    color?: string
  ): SVGElement | null {
    // Use Lucide's createElement to create SVG element
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': strokeWidth,
      stroke: color || 'currentColor',
      color: color || 'currentColor'
    })
    return svgElement instanceof SVGElement ? svgElement : null
  }

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    if (!this.container) {
      throw new Error(`Preview container with id "${containerId}" not found`)
    }

    // Initialize MarkdownIt with plugins
    this.md = new MarkdownIt({
      html: true, // Enable HTML tags in source
      linkify: true, // Autoconvert URL-like text to links
      breaks: false, // Don't convert '\n' in paragraphs into <br> (standard markdown)
      typographer: true // Enable some language-neutral replacement + quotes beautification
    })

    // Add custom rule for wiki links [[note-name]]
    this.md.inline.ruler.before('link', 'wiki_link', (state, silent) => {
      const max = state.posMax
      const start = state.pos

      if (state.src.charCodeAt(start) !== 0x5b /* [ */) return false
      if (state.src.charCodeAt(start + 1) !== 0x5b /* [ */) return false

      let pos = start + 2
      const labelStart = pos
      let labelEnd = -1

      // Find the closing ]]
      while (pos < max) {
        if (state.src.charCodeAt(pos) === 0x5d /* ] */) {
          if (state.src.charCodeAt(pos + 1) === 0x5d /* ] */) {
            labelEnd = pos
            pos += 2
            break
          }
        }
        pos++
      }

      if (labelEnd < 0) return false

      const label = state.src.slice(labelStart, labelEnd)
      if (!label) return false

      if (!silent) {
        const token = state.push('wiki_link', 'a', 0)
        token.content = label
        token.attrSet('href', '#')
        token.attrSet('data-wiki-link', label)
        token.markup = '[['
      }

      state.pos = pos
      return true
    })

    // Render wiki links
    this.md.renderer.rules.wiki_link = (tokens, idx) => {
      const token = tokens[idx]
      const label = token.content
      return `<a href="#" class="wiki-link" data-wiki-link="${this.md.utils.escapeHtml(label)}">${this.md.utils.escapeHtml(label)}</a>`
    }

    // Add custom rule for tags #tag
    this.md.inline.ruler.after('wiki_link', 'tag', (state, silent) => {
      const start = state.pos
      if (state.src.charCodeAt(start) !== 0x23 /* # */) return false

      const max = state.posMax
      let pos = start + 1

      if (pos >= max) return false

      if (!isIdentifierChar(state.src.charCodeAt(pos))) return false

      while (pos < max) {
        if (!isIdentifierChar(state.src.charCodeAt(pos))) break
        pos++
      }

      if (pos === start + 1) return false

      if (!silent) {
        const token = state.push('tag', 'span', 0)
        token.content = state.src.slice(start + 1, pos)
        token.markup = '#'
      }

      state.pos = pos
      return true
    })

    // Add custom rule for mentions @mention
    this.md.inline.ruler.after('tag', 'mention', (state, silent) => {
      const start = state.pos
      if (state.src.charCodeAt(start) !== 0x40 /* @ */) return false

      const max = state.posMax
      let pos = start + 1

      if (pos >= max) return false

      if (!isIdentifierChar(state.src.charCodeAt(pos))) return false

      while (pos < max) {
        if (!isIdentifierChar(state.src.charCodeAt(pos))) break
        pos++
      }

      if (pos === start + 1) return false

      if (!silent) {
        const token = state.push('mention', 'span', 0)
        token.content = state.src.slice(start + 1, pos)
        token.markup = '@'
      }

      state.pos = pos
      return true
    })

    this.md.renderer.rules.tag = (tokens, idx) => {
      const label = tokens[idx].content
      return `<span class="tag">#${this.md.utils.escapeHtml(label)}</span>`
    }

    this.md.renderer.rules.mention = (tokens, idx) => {
      const label = tokens[idx].content
      return `<span class="mention">@${this.md.utils.escapeHtml(label)}</span>`
    }

    this.render()
    this.attachEvents()
  }

  setWikiLinkHandler(handler: (target: string) => void): void {
    this.onWikiLinkClick = handler
  }

  private resolveImagePath(src: string): string {
    // If it's already an absolute URL (http/https/file), return as-is
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('file://')) {
      return src
    }

    // If it's a relative path and we have vault path, convert to file:// URL
    const vaultPath = state.vaultPath
    if (vaultPath && !src.startsWith('/')) {
      // Normalize path separators and join
      const vaultPathNormalized = vaultPath.replace(/\\/g, '/')
      const srcNormalized = src.replace(/\\/g, '/')

      // Remove leading slash from src if present
      const cleanSrc = srcNormalized.startsWith('/') ? srcNormalized.slice(1) : srcNormalized

      // Join paths
      const fullPath = `${vaultPathNormalized}/${cleanSrc}`

      // Convert to file:// URL (Windows needs 3 slashes, Unix needs 2)
      // On Windows, paths like C:\ need to become file:///C:/
      if (fullPath.match(/^[A-Za-z]:/)) {
        // Windows absolute path
        return `file:///${fullPath.replace(/\\/g, '/')}`
      } else {
        // Unix path
        return `file://${fullPath}`
      }
    }

    // Fallback: return as-is
    return src
  }

  private render(): void {
    this.container.innerHTML = '<div class="preview-content"></div>'
  }

  private attachEvents(): void {
    // Handle click delegation
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement

      // 1. Handle Wiki Links
      const wikiLink = target.closest('.wiki-link') as HTMLElement
      if (wikiLink && this.onWikiLinkClick) {
        e.preventDefault()
        const linkTarget = wikiLink.dataset.wikiLink
        if (linkTarget) {
          this.onWikiLinkClick(linkTarget)
        }
        return
      }

      // 2. Handle Tags
      const tagElement = target.closest('.tag') as HTMLElement
      if (tagElement) {
        e.preventDefault()
        const tagText = tagElement.textContent?.replace(/^#/, '') || ''
        if (tagText) {
          // Open search with tag
          window.dispatchEvent(
            new CustomEvent('hub-open-search', {
              detail: { query: `#${tagText}` }
            })
          )
        }
        return
      }

      // 3. Handle Mentions
      const mentionElement = target.closest('.mention') as HTMLElement
      if (mentionElement) {
        e.preventDefault()
        const mentionText = mentionElement.textContent?.replace(/^@/, '') || ''
        if (mentionText) {
          // Open search with mention
          window.dispatchEvent(
            new CustomEvent('hub-open-search', {
              detail: { query: `@${mentionText}` }
            })
          )
          // Also try to find a note with that name directly
          if (this.onWikiLinkClick) {
            this.onWikiLinkClick(mentionText)
          }
        }
        return
      }
    })
  }

  private lastContent: string | null = null
  private renderPending = false

  update(content: string): void {
    if (this.lastContent === content) return
    this.lastContent = content

    if (this.renderPending) return
    this.renderPending = true

    requestAnimationFrame(() => {
      if (this.lastContent !== null) {
        this.performRender(this.lastContent)
      }
      this.renderPending = false
    })
  }

  private performRender(content: string): void {
    const previewContent = this.container.querySelector('.preview-content') as HTMLElement
    if (!previewContent) return

    // Save scroll position
    const scrollTop = this.container.scrollTop

    // Normalize image markdown syntax (fix spaces after !)
    // Fix cases like ![ Logo.png] to ![Logo.png]
    const normalizedContent = content.replace(/!\[\s+([^\]]+)\]/g, '![$1]')

    // Render markdown to HTML
    const rawHtml = this.md.render(normalizedContent)

    // Sanitize HTML but allow necessary attributes for styling and functionality
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['class', 'data-wiki-link', 'src', 'alt', 'title'],
      ADD_TAGS: ['pre', 'code', 'img'],
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true,
      ALLOW_UNKNOWN_PROTOCOLS: false
    })

    previewContent.innerHTML = cleanHtml

    // Restore scroll position
    this.container.scrollTop = scrollTop

    // Resolve image paths to file:// URLs
    previewContent.querySelectorAll('img').forEach((img) => {
      const imgElement = img as HTMLImageElement
      const src = imgElement.getAttribute('src')
      if (
        src &&
        !src.startsWith('http://') &&
        !src.startsWith('https://') &&
        !src.startsWith('file://')
      ) {
        const resolvedPath = this.resolveImagePath(src)
        imgElement.src = resolvedPath
        // Handle image load errors
        imgElement.onerror = () => {
          console.warn('[Preview] Failed to load image:', resolvedPath, 'Original src:', src)
          imgElement.alt = `Failed to load: ${src}`
          imgElement.style.border = '2px dashed var(--danger)'
        }
      }
    })

    // Wrap code blocks with header and add copy buttons
    previewContent.querySelectorAll('pre').forEach((pre) => {
      const preElement = pre as HTMLElement

      // Check if already wrapped
      if (preElement.parentElement?.classList.contains('code-block-wrapper')) return

      // Get language from code element
      const codeElement = preElement.querySelector('code')
      const language = codeElement?.className?.replace('language-', '') || ''
      const languageName = language || 'code'

      // Create wrapper
      const wrapper = document.createElement('div')
      wrapper.className = 'code-block-wrapper'

      // Create header
      const header = document.createElement('div')
      header.className = 'code-block-header'

      // Language label
      const languageLabel = document.createElement('span')
      languageLabel.className = 'code-block-language'
      languageLabel.textContent = languageName
      header.appendChild(languageLabel)

      // Copy button with Lucide icons
      const copyButton = document.createElement('button')
      copyButton.className = 'code-copy-button'
      const copyIcon = this.createLucideIcon(Copy, 16, 1.5)
      if (copyIcon) copyButton.appendChild(copyIcon)
      copyButton.title = 'Copy code'

      copyButton.addEventListener('click', async () => {
        const code = preElement.querySelector('code')
        if (code) {
          const text = code.textContent || ''
          try {
            await navigator.clipboard.writeText(text)
            // Show green checkmark using Lucide Check icon
            const checkIcon = this.createLucideIcon(Check, 16, 2, '#22c55e')
            if (checkIcon) copyButton.replaceChildren(checkIcon)
            copyButton.title = 'Copied!'
            copyButton.classList.add('copied')
            setTimeout(() => {
              const resetIcon = this.createLucideIcon(Copy, 16, 1.5)
              if (resetIcon) copyButton.replaceChildren(resetIcon)
              copyButton.title = 'Copy code'
              copyButton.classList.remove('copied')
            }, 2000)
          } catch (err) {
            console.error('Failed to copy code:', err)
          }
        }
      })

      header.appendChild(copyButton)

      // Wrap the pre element
      preElement.parentNode?.insertBefore(wrapper, preElement)
      wrapper.appendChild(header)
      wrapper.appendChild(preElement)
    })

    // Re-highlight code blocks (DOMPurify might have stripped some attributes)
    previewContent.querySelectorAll('pre code').forEach((block) => {
      const codeElement = block as HTMLElement
      const lang = codeElement.className.match(/language-(\w+)/)?.[1] || ''
      if (lang && hljs.getLanguage(lang)) {
        try {
          hljs.highlightElement(codeElement as HTMLElement)
        } catch {
          // Ignore highlighting errors
        }
      }
    })
  }

  clear(): void {
    const previewContent = this.container.querySelector('.preview-content') as HTMLElement
    if (previewContent) {
      previewContent.innerHTML = ''
    }
    this.lastContent = null
  }

  destroy(): void {
    this.clear()
    this.container.innerHTML = ''
  }
}
