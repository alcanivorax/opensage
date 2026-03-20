import chalk from 'chalk'
import { highlight } from 'cli-highlight'
import { T } from './theme.js'

// ─── Box width constants ──────────────────────────────────────────────────────

const BOX_W = 66 // border dash count for full-width code fence
const INNER_W = 44 // space for language label filler
const LNUM_W = 4 // line-number column width

// ─── Inline tool-call chrome ──────────────────────────────────────────────────
//
//  Used by the chat loop to render tool invocations before the model responds.
//
//    ┄ read_file  ~/Documents/notes.md  ✓ auto
//    ┄ bash       echo "hello"          ⚠ confirm

export function printToolCall(
  name: string,
  preview: string,
  needsConfirm: boolean
): void {
  const badge = needsConfirm
    ? T.warn('⚠') + ' ' + T.dim('confirm')
    : T.success('✓') + ' ' + T.dim('auto   ')
  console.log(
    T.dim('  ┄ ') +
      T.tool(name.padEnd(14)) +
      T.muted(preview.slice(0, 38).padEnd(40)) +
      badge
  )
}

export function printToolResult(
  name: string,
  ok: boolean,
  summary: string
): void {
  const icon = ok ? T.success('✔') : T.error('✘')
  console.log(
    T.dim('  └ ') +
      icon +
      ' ' +
      T.dim(name.padEnd(14)) +
      T.muted(summary.slice(0, 48))
  )
}

// ─── Thinking / status spinner line ───────────────────────────────────────────

export function printThinking(label = 'thinking…'): void {
  process.stdout.write(T.dim('  ◌ ') + T.muted(label))
}

export function clearLine(): void {
  process.stdout.write('\r\x1B[K')
}

// ─── StreamRenderer ───────────────────────────────────────────────────────────
//
//  Renders markdown incrementally as text streams in, line-by-line.
//  Feed raw delta strings via .feed(); call .flush() once the stream ends.
//
//  Code blocks stream progressively in teal (no syntax highlight during
//  streaming — preserves the live feel).  Static /copy re-renders use
//  renderMarkdown() which applies full syntax highlighting.

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
   * Flush remaining buffered content (call once after the stream ends).
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
    // Fenced code block fence ───────────────────────────────────────────────
    if (line.startsWith('```')) {
      if (!this.inCode) {
        this.inCode = true
        this.codeLang = line.slice(3).trim()
        const lang = this.codeLang || 'code'
        const filler = '─'.repeat(Math.max(0, INNER_W - lang.length))
        return (
          '\n' +
          T.dim('  ╭─ ') +
          T.muted(lang) +
          T.dim('  ' + filler + '─'.repeat(BOX_W - INNER_W - 5) + '╮')
        )
      } else {
        this.inCode = false
        this.codeLang = ''
        return T.dim('  ╰' + '─'.repeat(BOX_W) + '╯')
      }
    }

    // Inside code block ──────────────────────────────────────────────────────
    if (this.inCode) {
      return T.dim('  │ ') + T.tool(line)
    }

    // Normal prose line ──────────────────────────────────────────────────────
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

    // Task list  (- [ ] / - [x])
    const taskMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/)
    if (taskMatch) {
      const done = taskMatch[2] === 'x'
      const box = done ? T.success('☑') : T.dim('☐')
      const text = done ? T.muted(taskMatch[3]) : this._inline(taskMatch[3])
      return '  ' + box + ' ' + text
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*] (.+)$/)
    if (ulMatch) {
      const indent = ulMatch[1].length > 0 ? '    ' : '  '
      return indent + T.accent('▸ ') + this._inline(ulMatch[2])
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\. (.+)$/)
    if (olMatch)
      return '  ' + T.accent(`${olMatch[2]}. `) + this._inline(olMatch[3])

    // Empty line
    if (!line.trim()) return ''

    return '  ' + this._inline(line)
  }

  /** Apply inline styles: code, bold, italic, strikethrough */
  private _inline(text: string): string {
    return (
      text
        // Inline code (protect from further substitution)
        .replace(/`([^`\n]+)`/g, (_, c) =>
          chalk.bgHex('#1E293B')(T.accent(` ${c} `))
        )
        // Bold
        .replace(/\*\*(.+?)\*\*/g, (_, s) => chalk.bold.white(s))
        // Italic
        .replace(/\*(.+?)\*/g, (_, s) => chalk.italic.hex('#CBD5E1')(s))
        // Strikethrough
        .replace(/~~(.+?)~~/g, (_, s) => chalk.strikethrough(T.muted(s)))
    )
  }
}

// ─── Static full-document renderer ───────────────────────────────────────────
//
//  Used for pipe-mode output and /copy re-render.
//  Applies proper syntax highlighting and line numbers to code blocks.

export function renderMarkdown(text: string): string {
  // ── Fenced code blocks (with syntax highlighting + line numbers) ──────────
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const language = lang || 'plaintext'
    let highlighted: string

    try {
      highlighted = highlight(code.trimEnd(), {
        language,
        ignoreIllegals: true,
      })
    } catch {
      highlighted = T.tool(code.trimEnd())
    }

    const lines = highlighted.split('\n')
    const totalLines = lines.length
    const lnWidth = Math.max(LNUM_W, String(totalLines).length)

    const numbered = lines
      .map(
        (l, i) =>
          T.dim('  │ ') +
          T.subtle(String(i + 1).padStart(lnWidth)) +
          T.dim('  ') +
          l
      )
      .join('\n')

    const langLabel = language
    const filler = '─'.repeat(Math.max(0, INNER_W - langLabel.length))
    const rightFill = '─'.repeat(BOX_W - INNER_W - 5)

    return (
      `\n${T.dim('  ╭─ ')}${T.muted(langLabel)}${T.dim('  ' + filler + rightFill + '╮')}\n` +
      `${numbered}\n` +
      `${T.dim('  ╰' + '─'.repeat(BOX_W) + '╯')}\n`
    )
  })

  // ── Inline code ───────────────────────────────────────────────────────────
  text = text.replace(/`([^`\n]+)`/g, (_, c) =>
    chalk.bgHex('#1E293B')(T.accent(` ${c} `))
  )

  // ── Bold / italic / strikethrough ─────────────────────────────────────────
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold.white(t))
  text = text.replace(/\*(.+?)\*/g, (_, t) => chalk.italic.hex('#CBD5E1')(t))
  text = text.replace(/~~(.+?)~~/g, (_, t) => chalk.strikethrough(T.muted(t)))

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

  // ── Task lists ────────────────────────────────────────────────────────────
  text = text.replace(
    /^- \[x\] (.+)$/gim,
    (_, t) => '  ' + T.success('☑') + ' ' + T.muted(t)
  )
  text = text.replace(
    /^- \[ \] (.+)$/gim,
    (_, t) => '  ' + T.dim('☐') + ' ' + T.white(t)
  )

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
