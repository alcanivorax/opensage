import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type Anthropic from '@anthropic-ai/sdk'

// ─── Tool definition ──────────────────────────────────────────────────────────

export const downloadFileToolDef: Anthropic.Tool = {
  name: 'download_file',
  description:
    'Download a file from a URL and save it to disk. ' +
    'Works with any file type: images, PDFs, ZIPs, videos, binaries, etc. ' +
    'If no save path is given the file goes to ~/Downloads. ' +
    'If the path is a directory the filename is inferred from the URL.',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The URL to download.',
      },
      path: {
        type: 'string',
        description:
          'Where to save the file. ' +
          'Can be a full file path (/home/user/file.pdf), ' +
          'a directory (/home/user/Downloads/), ' +
          'or omitted to default to ~/Downloads.',
      },
    },
    required: ['url'],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Best-effort filename from a URL (falls back to "download"). */
function filenameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    const segments = u.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    // Strip query-string artefacts that sometimes end up in pathname
    const cleaned = last.split('?')[0].split('#')[0]
    if (cleaned.length > 0) return decodeURIComponent(cleaned)
  } catch {
    // malformed URL — fall through
  }
  return 'download'
}

/** Human-readable byte size. */
function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024)
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

/**
 * Resolve the final save path from the user-supplied path (or undefined)
 * and the URL being downloaded.
 */
function resolveSavePath(inputPath: string | undefined, url: string): string {
  const defaultDir = path.join(os.homedir(), 'Downloads')

  if (!inputPath) {
    // No path supplied → ~/Downloads/<inferred-name>
    fs.mkdirSync(defaultDir, { recursive: true })
    return path.join(defaultDir, filenameFromUrl(url))
  }

  const expanded = inputPath.startsWith('~')
    ? path.join(os.homedir(), inputPath.slice(1))
    : inputPath

  const resolved = path.resolve(expanded)

  // If the path already exists and is a directory, place the file inside it
  try {
    if (fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, filenameFromUrl(url))
    }
  } catch {
    // Path does not exist yet — treat as a full file path.
    // But if it has no extension, assume it's an intended directory.
    if (!path.extname(resolved)) {
      fs.mkdirSync(resolved, { recursive: true })
      return path.join(resolved, filenameFromUrl(url))
    }
  }

  return resolved
}

// ─── Implementation ───────────────────────────────────────────────────────────

export async function downloadFile(input: {
  url: string
  path?: string
}): Promise<string> {
  const { url } = input

  // ── Validate URL ────────────────────────────────────────────────────────────
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return `Error: Invalid URL: ${url}`
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return `Error: Only http and https URLs are supported (got ${parsedUrl.protocol})`
  }

  // ── Resolve destination ─────────────────────────────────────────────────────
  const savePath = resolveSavePath(input.path, url)
  fs.mkdirSync(path.dirname(savePath), { recursive: true })

  // ── Fetch ───────────────────────────────────────────────────────────────────
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'aichat/4.1 personal-assistant-downloader',
      },
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5-minute timeout
      redirect: 'follow',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Error: Fetch failed — ${msg}`
  }

  if (!response.ok) {
    return `Error: HTTP ${response.status} ${response.statusText}`
  }

  if (!response.body) {
    return 'Error: Server returned an empty response body.'
  }

  // Content-Length (may be absent for chunked/streamed responses)
  const contentLength = response.headers.get('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null

  // ── Stream to disk ──────────────────────────────────────────────────────────
  const writer = fs.createWriteStream(savePath)
  const reader = response.body.getReader()
  let received = 0
  let writeError: Error | null = null

  // Pipe reader → write stream
  writer.on('error', (err) => {
    writeError = err
  })

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>

    try {
      chunk = await reader.read()
    } catch (err: unknown) {
      writer.destroy()
      const msg = err instanceof Error ? err.message : String(err)
      return `Error: Stream interrupted — ${msg}`
    }

    if (chunk.done) break
    if (writeError) break

    writer.write(Buffer.from(chunk.value))
    received += chunk.value.length
  }

  // Flush and close
  await new Promise<void>((resolve, reject) => {
    writer.end((err?: Error | null) => {
      if (err ?? writeError) reject(err ?? writeError)
      else resolve()
    })
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    return `Error: Failed to write file — ${msg}`
  })

  if (writeError) {
    return `Error: Failed to write file — ${(writeError as Error).message}`
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const contentType = response.headers.get('content-type') ?? 'unknown'
  const mimeShort = contentType.split(';')[0].trim()

  const lines = [
    `✓ Downloaded ${fmtBytes(received)} → ${savePath}`,
    `  type: ${mimeShort}`,
  ]

  if (totalBytes && totalBytes !== received) {
    lines.push(
      `  ⚠  Expected ${fmtBytes(totalBytes)} but received ${fmtBytes(received)}`
    )
  }

  return lines.join('\n')
}
