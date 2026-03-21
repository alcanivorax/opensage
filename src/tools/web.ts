import type Anthropic from '@anthropic-ai/sdk'

export const webFetchToolDef: Anthropic.Tool = {
  name: 'web_fetch',
  description:
    'Fetch a URL and return its text content. Good for reading docs, APIs, articles, or any web page.',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
}

export const webSearchToolDef: Anthropic.Tool = {
  name: 'web_search',
  description:
    'Search the web using DuckDuckGo. Returns titles, URLs, and snippets for current information.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
}

export async function webFetch(input: { url: string }): Promise<string> {
  try {
    const res = await fetch(input.url, {
      headers: { 'User-Agent': 'opensage/2.1 terminal assistant' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return `HTTP ${res.status} ${res.statusText}`

    let text = await res.text()
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim()

    if (text.length > 8_000) text = text.slice(0, 8_000) + '\n…[truncated]'
    return text
  } catch (err: any) {
    return `Fetch error: ${err.message}`
  }
}

export async function webSearch(input: { query: string }): Promise<string> {
  const encoded = encodeURIComponent(input.query)
  const results: string[] = []

  try {
    // Try JSON API first
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { 'User-Agent': 'opensage/2.1' },
        signal: AbortSignal.timeout(8_000),
      }
    )
    const data: any = await res.json()

    if (data.AbstractText) {
      results.push(`Answer: ${data.AbstractText}`)
      if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`)
    }

    if (data.RelatedTopics?.length) {
      results.push('\nResults:')
      for (const t of data.RelatedTopics.slice(0, 6)) {
        if (t.Text && t.FirstURL) results.push(`- ${t.Text}\n  ${t.FirstURL}`)
      }
    }
  } catch {
    // JSON API failed, fall through to HTML scrape
  }

  // HTML fallback when JSON API returns nothing
  if (results.length === 0) {
    try {
      const htmlRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encoded}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8_000),
        }
      )
      const html = await htmlRes.text()

      const snippets = [
        ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g),
      ]
        .slice(0, 5)
        .map((m) => m[1].replace(/<[^>]+>/g, '').trim())

      const urls = [
        ...html.matchAll(/class="result__url"[^>]*>([\s\S]*?)<\/a>/g),
      ]
        .slice(0, 5)
        .map((m) => m[1].replace(/<[^>]+>/g, '').trim())

      for (let i = 0; i < snippets.length; i++) {
        results.push(`${i + 1}. ${snippets[i]}\n   ${urls[i] ?? ''}`)
      }
    } catch (err: any) {
      return `Search error: ${err.message}`
    }
  }

  return results.join('\n') || 'No results found.'
}
