import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true
})

export function formatMarkdown(content: string): string {
  if (!content) return ''
  const rawHtml = md.render(content)
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'href'],
    ADD_TAGS: ['a']
  })
}
