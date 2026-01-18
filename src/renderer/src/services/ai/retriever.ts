// Lightweight lexical retriever and context builder for local notes.
// This keeps the retrieval simple and synchronous from the caller's
// perspective by returning a Promise<string> when needed.

function tokenize(text: string): string[] {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function scoreText(queryTokens: string[], text: string): number {
  if (!text) return 0
  const tokens = tokenize(text)
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  let score = 0
  for (const qt of queryTokens) {
    if (freq.has(qt)) score += freq.get(qt) || 0
  }
  return score
}

async function loadNoteContent(id: string): Promise<string | null> {
  try {
    const note = await window.api.loadNote(id as string)
    return note?.content || ''
  } catch (err) {
    console.error('[AI:retriever] Failed to load note', id, err)
    return null
  }
}

export async function getRelevantContext(userMessage: string, maxChars = 4000, maxNotes = 6): Promise<string> {
  if (!userMessage || !userMessage.trim()) return ''

  const qTokens = tokenize(userMessage)
  if (qTokens.length === 0) return ''

  let rawNotes: Array<any> = []
  try {
    rawNotes = await window.api.listNotes()
  } catch (err) {
    console.error('[AI:retriever] Failed to list notes', err)
    return ''
  }

  const candidates = rawNotes.filter((n: any) => n.type !== 'folder').slice(0, 150)

  const scored = candidates.map((n: any) => {
    const baseText = `${n.title || ''} ${n.path || ''}`
    return { id: n.id, title: n.title, score: scoreText(qTokens, baseText) }
  }).sort((a: any, b: any) => b.score - a.score)

  const top = scored.filter((s: any) => s.score > 0).slice(0, Math.max(maxNotes, 10))

  const loaded: Array<{ id: string; title: string; content: string; score: number }> = []
  for (const s of top.slice(0, 12)) {
    const c = await loadNoteContent(s.id)
    if (c !== null) loaded.push({ id: s.id, title: s.title, content: c, score: s.score })
  }

  for (const l of loaded) {
    l.score = scoreText(qTokens, `${l.title || ''} ${l.content || ''}`)
  }

  loaded.sort((a, b) => b.score - a.score)

  const parts: string[] = []
  let used = 0
  for (const note of loaded.slice(0, maxNotes)) {
    if (note.score <= 0) continue
    const paragraphs = (note.content || '').split(/\n\n+/)
    let excerpt = ''
    const qset = new Set(qTokens)
    for (const p of paragraphs) {
      const pt = p.toLowerCase()
      for (const qt of qset) {
        if (pt.includes(qt)) {
          excerpt = p.trim()
          break
        }
      }
      if (excerpt) break
    }
    if (!excerpt) excerpt = (note.content || '').slice(0, 240).trim()

    const header = `--- ${note.title || 'Note'} ---\n`
    const block = `${header}${excerpt}\n\n`
    if (used + block.length > maxChars) break
    parts.push(block)
    used += block.length
  }

  return parts.join('\n')
}

export async function buildContextMessage(userMessage: string, editorContent?: string | null, noteInfo?: { title: string; id: string } | null): Promise<string> {
  let context = 'Context: You are helping with a note-taking application.'
  if (noteInfo) {
    context += ` The user is currently working on a note titled "${noteInfo.title}" (ID: ${noteInfo.id}).`
  }

  if (editorContent && editorContent.trim()) {
    const preview = editorContent.length > 2000 ? editorContent.substring(0, 2000) + '...' : editorContent
    context += `\n\nCurrent note content:\n${preview}\n\n`
  }

  try {
    const retrieved = await getRelevantContext(userMessage, 1500, 4)
    if (retrieved) {
      context += `\n\nRelevant notes:\n${retrieved}\n\n`
    }
  } catch (err) {
    console.error('[AI:retriever] Failed to getRelevantContext', err)
  }

  context += `\nUser's question: ${userMessage}`
  return context
}
