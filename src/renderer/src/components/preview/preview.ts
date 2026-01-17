import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { state } from '../../core/state'
import { createElement, Copy, Check } from 'lucide'
import 'highlight.js/styles/github-dark.css'
import './preview.css'

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
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)

export class PreviewComponent {
  private container: HTMLElement
  private md: MarkdownIt
  private onWikiLinkClick?: (target: string) => void

  private createLucideIcon(IconComponent: any, size: number = 16, strokeWidth: number = 1.5, color?: string): string {
    // Use Lucide's createElement to create SVG element
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': strokeWidth,
      stroke: color || 'currentColor',
      color: color || 'currentColor'
    })
    // Convert SVGElement to string
    if (svgElement && svgElement.outerHTML) {
      return svgElement.outerHTML
    }
    // Fallback if icon doesn't render properly
    return ''
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
      typographer: true, // Enable some language-neutral replacement + quotes beautification
      highlight: (str: string, lang: string) => {
        if (!lang) {
          return `<pre class="hljs"><code>${this.md.utils.escapeHtml(str)}</code></pre>`
        }

        // Normalize language name
        const normalizedLang = lang.toLowerCase().trim()

        // Try to highlight
        if (hljs.getLanguage(normalizedLang)) {
          try {
            const highlighted = hljs.highlight(str, { language: normalizedLang, ignoreIllegals: true })
            return `<pre class="hljs"><code class="language-${normalizedLang}">${highlighted.value}</code></pre>`
          } catch (err) {
            console.warn(`[Preview] Highlighting failed for language: ${normalizedLang}`, err)
          }
        }

        // Fallback: escape HTML
        return `<pre class="hljs"><code class="language-${normalizedLang}">${this.md.utils.escapeHtml(str)}</code></pre>`
      }
    })

    // Add custom rule for wiki links [[note-name]]
    this.md.inline.ruler.before('link', 'wiki_link', (state, silent) => {
      const max = state.posMax
      const start = state.pos

      if (state.src.charCodeAt(start) !== 0x5B /* [ */) return false
      if (state.src.charCodeAt(start + 1) !== 0x5B /* [ */) return false

      let pos = start + 2
      let labelStart = pos
      let labelEnd = -1

      // Find the closing ]]
      while (pos < max) {
        if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
          if (state.src.charCodeAt(pos + 1) === 0x5D /* ] */) {
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
    // Handle wiki link clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const wikiLink = target.closest('.wiki-link') as HTMLElement
      if (wikiLink && this.onWikiLinkClick) {
        e.preventDefault()
        const linkTarget = wikiLink.dataset.wikiLink
        if (linkTarget) {
          this.onWikiLinkClick(linkTarget)
        }
      }
    })
  }

  update(content: string): void {
    const previewContent = this.container.querySelector('.preview-content') as HTMLElement
    if (!previewContent) return

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

    // Resolve image paths to file:// URLs
    previewContent.querySelectorAll('img').forEach((img) => {
      const imgElement = img as HTMLImageElement
      const src = imgElement.getAttribute('src')
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('file://')) {
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
      copyButton.innerHTML = this.createLucideIcon(Copy, 16, 1.5)
      copyButton.title = 'Copy code'

      copyButton.addEventListener('click', async () => {
        const code = preElement.querySelector('code')
        if (code) {
          const text = code.textContent || ''
          try {
            await navigator.clipboard.writeText(text)
            // Show green checkmark using Lucide Check icon
            copyButton.innerHTML = this.createLucideIcon(Check, 16, 2, '#22c55e')
            copyButton.title = 'Copied!'
            copyButton.classList.add('copied')
            setTimeout(() => {
              copyButton.innerHTML = this.createLucideIcon(Copy, 16, 1.5)
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
        } catch (err) {
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
  }

  destroy(): void {
    this.clear()
    this.container.innerHTML = ''
  }
}
