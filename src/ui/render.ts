import chalk from 'chalk'
import { highlight } from 'cli-highlight'
import { T } from './theme.js'

// ─── Box width constants ──────────────────────────────────────────────────────

const BOX_W = 66 // width of full-width code box border
const INNER_W = 44 // space for language label filler

// ─── StreamRenderer ───────────────────────────────────────────────────────────
//
//  Renders markdown incrementally as text streams in, line-by-line.
//  Feed raw delta strings; the renderer buffers until it sees a newline,
//  then emits the formatted line immediately.
//
//  Code blocks are rendered progressively (no syntax highlighting during
//  streaming — plain cyan), so the user sees code as it appears.
//  Call flush() at the end to emit any trailing content.

export class StreamRenderer {
  private buf = ''
  private inCode = false
  private codeLang = ''

  /** Feed a raw text delta. Returns terminal-ready string to write immediately. */
  feed(delta: string): string {
    this.buf += delta
    let out = ''
    let nl = this.buf.indexOf('\n')

    while (nl !== -1) {
      out += this._processLine(this.buf.slice(0, nl)) + '\n'
      this.buf = this.buf.slice(nl + 1)
      nl = this.buf.indexOf('\n')
    }

    return out
  }

  /**
   * Flush any remaining buffered content (call once after the stream ends).
   * Also closes any unclosed code block.
   */
  flush(): string {
    let out = ''

    if (this.buf) {
      out += this._processLine(this.buf)
      this.buf = ''
    }

    if (this.inCode) {
      this.inCode = false
      out += '\n' + T.dim('  ╰' + '─'.repeat(BOX_W))
    }

    return out
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _processLine(line: string): string {
    // ── Fenced code block fence ──────────────────────────────────────────────
    if (line.startsWith('```')) {
      if (!this.inCode) {
        this.inCode = true
        this.codeLang = line.slice(3).trim()
        const lang = this.codeLang || 'code'
        const filler = '─'.repeat(Math.max(0, INNER_W - lang.length))
        return '\n' + T.dim('  ╭─ ') + T.muted(lang) + T.dim('  ' + filler)
      } else {
        this.inCode = false
        this.codeLang = ''
        return T.dim('  ╰' + '─'.repeat(BOX_W))
      }
    }

    // ── Inside code block ────────────────────────────────────────────────────
    if (this.inCode) {
      // Stream progressively in cyan — no full syntax highlighting here
      // (preserves the live feel; use renderMarkdown for the static /copy)
      return T.dim('  │ ') + chalk.cyan(line)
    }

    // ── Normal prose line ────────────────────────────────────────────────────
    return this._renderProse(line)
  }

  private _renderProse(line: string): string {
    // Headers
    if (line.startsWith('### '))
      return '\n' + T.brandBright('  ◆ ') + chalk.bold.white(line.slice(4))
    if (line.startsWith('## '))
      return '\n' + T.brand.bold('  ◈ ') + chalk.bold.white(line.slice(3))
    if (line.startsWith('# '))
      return '\n' + T.brand.bold.underline('  ✦ ' + line.slice(2))

    // Blockquote
    if (line.startsWith('> '))
      return T.dim('  ▌ ') + T.muted(this._inline(line.slice(2)))

    // Horizontal rule
    if (/^---+$/.test(line.trim())) return T.dim('  ' + '─'.repeat(54))

    // Unordered list  (-, *, spaces before)
    const ulMatch = line.match(/^(\s*)[-*] (.+)$/)
    if (ulMatch) {
      const pad = ulMatch[1].length > 0 ? '    ' : '  '
      return pad + T.accent('▸ ') + this._inline(ulMatch[2])
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\. (.+)$/)
    if (olMatch)
      return '  ' + T.accent(`${olMatch[2]}. `) + this._inline(olMatch[3])

    // Empty line
    if (!line.trim()) return ''

    // Normal text
    return '  ' + this._inline(line)
  }

  /** Apply inline styles: code, bold, italic */
  private _inline(text: string): string {
    return (
      text
        // Inline code first (protect its contents from further substitutions)
        .replace(/`([^`\n]+)`/g, (_, c) =>
          chalk.bgHex('#1E293B')(T.accent(` ${c} `))
        )
        .replace(/\*\*(.+?)\*\*/g, (_, s) => chalk.bold.white(s))
        .replace(/\*(.+?)\*/g, (_, s) => chalk.italic.hex('#CBD5E1')(s))
    )
  }
}

// ─── Static full-document renderer ───────────────────────────────────────────
//
//  Used for pipe mode output and /copy re-render.
//  Applies proper syntax highlighting to code blocks.

export function renderMarkdown(text: string): string {
  // ── Fenced code blocks (with syntax highlighting) ─────────────────────────
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const language = lang || 'plaintext'
    let highlighted: string

    try {
      highlighted = highlight(code.trimEnd(), {
        language,
        ignoreIllegals: true,
      })
    } catch {
      highlighted = chalk.cyan(code.trimEnd())
    }

    const numbered = highlighted
      .split('\n')
      .map(
        (l, i) => T.dim('  │ ') + T.subtle(String(i + 1).padStart(3) + '  ') + l
      )
      .join('\n')

    const langLabel = language
    const filler = '─'.repeat(Math.max(0, INNER_W - langLabel.length))

    return (
      `\n${T.dim('  ╭─ ')}${T.muted(langLabel)}${T.dim('  ' + filler)}\n` +
      `${numbered}\n` +
      `${T.dim('  ╰' + '─'.repeat(BOX_W))}\n`
    )
  })

  // ── Inline code ───────────────────────────────────────────────────────────
  text = text.replace(/`([^`\n]+)`/g, (_, c) =>
    chalk.bgHex('#1E293B')(T.accent(` ${c} `))
  )

  // ── Bold / italic ─────────────────────────────────────────────────────────
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold.white(t))
  text = text.replace(/\*(.+?)\*/g, (_, t) => chalk.italic.hex('#CBD5E1')(t))

  // ── Headers ───────────────────────────────────────────────────────────────
  text = text.replace(
    /^### (.+)$/gm,
    (_, t) => '\n' + T.brandBright('  ◆ ') + chalk.bold.white(t)
  )
  text = text.replace(
    /^## (.+)$/gm,
    (_, t) => '\n' + T.brand.bold('  ◈ ') + chalk.bold.white(t)
  )
  text = text.replace(
    /^# (.+)$/gm,
    (_, t) => '\n' + T.brand.bold.underline('  ✦ ' + t)
  )

  // ── Blockquote ────────────────────────────────────────────────────────────
  text = text.replace(/^> (.+)$/gm, (_, t) => T.dim('  ▌ ') + T.muted(t))

  // ── Lists ─────────────────────────────────────────────────────────────────
  text = text.replace(
    /^[-*] (.+)$/gm,
    (_, t) => '  ' + T.accent('▸ ') + T.white(t)
  )
  text = text.replace(
    /^(\d+)\. (.+)$/gm,
    (_, n, t) => '  ' + T.accent(`${n}. `) + T.white(t)
  )

  // ── Horizontal rule ───────────────────────────────────────────────────────
  text = text.replace(/^---+$/gm, T.dim('  ' + '─'.repeat(54)))

  return text
}
