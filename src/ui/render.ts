import chalk from 'chalk'
import { highlight } from 'cli-highlight'
import { T, CONTENT_WIDTH } from './theme.js'

const CODE_W = CONTENT_WIDTH - 4
const LNUM_W = 4

// ─── Thinking ─────────────────────────────────────────────────────────────────

const thinkingFrames = ['◌', '◐', '◓', '◒']
let frameIdx = 0

export function printThinking(label = 'thinking…'): void {
  process.stdout.write('\r  ' + T.thinking(label) + ' ')
}

export function clearThinking(): void {
  process.stdout.write('\r\x1B[K')
}

export function animateThinking(label: string): NodeJS.Timeout {
  return setInterval(() => {
    const frame = thinkingFrames[frameIdx++ % thinkingFrames.length]
    process.stdout.write('\r  ' + T.dim(frame) + ' ' + T.muted(label) + ' ')
  }, 120)
}

// ─── StreamRenderer ───────────────────────────────────────────────────────────

export class StreamRenderer {
  private buf = ''
  private inCode = false
  private codeLang = ''
  private firstLine = true

  feed(delta: string): string {
    this.buf += delta
    let out = ''
    let nl = this.buf.indexOf('\n')

    while (nl !== -1) {
      out += this._processLine(this.buf.slice(0, nl))
      this.buf = this.buf.slice(nl + 1)
      nl = this.buf.indexOf('\n')
    }

    return out
  }

  flush(): string {
    let out = ''

    if (this.buf) {
      out += this._processLine(this.buf)
      this.buf = ''
    }

    if (this.inCode) {
      this.inCode = false
      out += '\n' + T.dim('  ╰' + '─'.repeat(CODE_W + 2) + '╯')
    }

    return out
  }

  private _processLine(line: string): string {
    if (line.startsWith('```')) {
      if (!this.inCode) {
        this.inCode = true
        this.codeLang = line.slice(3).trim()
        const lang = this.codeLang || 'code'
        const prefix = this.firstLine ? '' : '\n'
        this.firstLine = false
        return (
          prefix +
          T.dim('  ╭─ ') +
          T.tool(lang) +
          T.dim('  ' + '─'.repeat(CODE_W - lang.length - 4) + '╮')
        )
      } else {
        this.inCode = false
        return '\n' + T.dim('  ╰' + '─'.repeat(CODE_W + 2) + '╯')
      }
    }

    if (this.inCode) {
      return '\n' + T.dim('  │ ') + T.tool(line)
    }

    return this._renderProse(line)
  }

  private _renderProse(line: string): string {
    const prefix = this.firstLine ? '' : '\n'
    this.firstLine = false

    if (line.startsWith('### '))
      return prefix + T.brandBright('  ◆ ') + chalk.bold.white(line.slice(4))
    if (line.startsWith('## '))
      return prefix + T.brand('  ◈ ') + chalk.bold.white(line.slice(3))
    if (line.startsWith('# '))
      return prefix + T.brandBright.bold('  ' + line.slice(2))

    if (line.startsWith('> '))
      return prefix + T.dim('  ▌ ') + T.muted(this._inline(line.slice(2)))

    if (/^---+$/.test(line.trim())) return prefix + T.dim('  ' + '─'.repeat(60))

    const task = line.match(/^(\s*)- \[([ x])\] (.+)$/)
    if (task) {
      const done = task[2] === 'x'
      const box = done ? T.success('☑') : T.dim('☐')
      const text = done ? T.muted(task[3]) : this._inline(task[3])
      return prefix + '  ' + box + ' ' + text
    }

    const ul = line.match(/^(\s*)[-*] (.+)$/)
    if (ul) {
      const indent = ul[1].length > 0 ? '    ' : '  '
      return prefix + indent + T.accent('▸ ') + this._inline(ul[2])
    }

    const ol = line.match(/^(\s*)(\d+)\. (.+)$/)
    if (ol) return prefix + '  ' + T.accent(`${ol[2]}. `) + this._inline(ol[3])

    if (!line.trim()) return ''

    return prefix + '  ' + this._inline(line)
  }

  private _inline(text: string): string {
    return text
      .replace(/`([^`\n]+)`/g, (_, c) =>
        chalk.bgHex('#1E293B')(T.accent(` ${c} `))
      )
      .replace(/\*\*(.+?)\*\*/g, (_, s) => chalk.bold.white(s))
      .replace(/\*(.+?)\*/g, (_, s) => chalk.italic.hex('#CBD5E1')(s))
      .replace(/~~(.+?)~~/g, (_, s) => chalk.strikethrough(T.muted(s)))
  }
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

export function renderMarkdown(text: string): string {
  let out = ''

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
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
    const rightFill = '─'.repeat(CODE_W - langLabel.length - 4)

    out += `\n${T.dim('  ╭─ ')}${T.tool(langLabel)}${T.dim('  ' + rightFill + '╮')}\n`
    out += numbered + '\n'
    out += `${T.dim('  ╰' + '─'.repeat(CODE_W + 2) + '╯')}\n`

    return ''
  })

  text = text.replace(
    /^### (.+)$/gm,
    (_, t) => '\n' + T.brandBright('  ◆ ') + chalk.bold.white(t)
  )
  text = text.replace(
    /^## (.+)$/gm,
    (_, t) => '\n' + T.brand('  ◈ ') + chalk.bold.white(t)
  )
  text = text.replace(
    /^# (.+)$/gm,
    (_, t) => '\n' + T.brandBright.bold('  ' + t)
  )

  text = text.replace(/^> (.+)$/gm, (_, t) => T.dim('  ▌ ') + T.muted(t))

  text = text.replace(
    /^- \[x\] (.+)$/gim,
    (_, t) => '  ' + T.success('☑') + ' ' + T.muted(t)
  )
  text = text.replace(
    /^- \[ \] (.+)$/gim,
    (_, t) => '  ' + T.dim('☐') + ' ' + T.white(t)
  )

  text = text.replace(
    /^[-*] (.+)$/gm,
    (_, t) => '  ' + T.accent('▸ ') + T.white(t)
  )
  text = text.replace(
    /^(\d+)\. (.+)$/gm,
    (_, n, t) => '  ' + T.accent(`${n}. `) + T.white(t)
  )

  text = text.replace(/^---+$/gm, T.dim('  ' + '─'.repeat(60)))

  text = text.replace(/`([^`\n]+)`/g, (_, c) =>
    chalk.bgHex('#1E293B')(T.accent(` ${c} `))
  )
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold.white(t))
  text = text.replace(/\*(.+?)\*/g, (_, t) => chalk.italic.hex('#CBD5E1')(t))
  text = text.replace(/~~(.+?)~~/g, (_, t) => chalk.strikethrough(T.muted(t)))

  return out + '\n' + text
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

export function printConfirmDialog(
  name: string,
  details: Record<string, string>,
  sensitive: boolean
): void {
  const W = CONTENT_WIDTH

  console.log()
  console.log(T.dim('┌' + '─'.repeat(W) + '┐'))

  const header = sensitive
    ? T.warn + ' ' + T.white.bold(name)
    : T.toolIcon + ' ' + T.white.bold(name)
  console.log(
    T.dim('│') + ' ' + header + ' '.repeat(W - name.length - 3) + T.dim('│')
  )
  console.log(T.dim('├' + '─'.repeat(W) + '┤'))

  for (const [key, value] of Object.entries(details)) {
    const line = T.muted(key.padEnd(12)) + ' ' + T.white(value)
    console.log(T.dim('│') + ' ' + line.padEnd(W) + T.dim('│'))
  }

  console.log(T.dim('└' + '─'.repeat(W) + '┘'))
}

export function printProceedPrompt(): void {
  process.stdout.write(
    T.warn('proceed?') + ' ' + T.muted('[y/n] ') + T.dim('› ')
  )
}

// ─── Token Footer ─────────────────────────────────────────────────────────────

export function printTokenFooter(
  inputTokens: number,
  outputTokens: number,
  providerName: string
): void {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  console.log()
  console.log(
    T.dim('── ') +
      T.muted(`${fmt(inputTokens)} in`) +
      T.dim(' · ') +
      T.muted(`${fmt(outputTokens)} out`) +
      T.dim(' · ') +
      T.muted(providerName) +
      ' ' +
      T.dim('─'.repeat(20))
  )
  console.log()
}
