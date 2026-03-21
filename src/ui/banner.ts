import { T, TERM_WIDTH, CONTENT_WIDTH } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

export const VERSION = '0.1.0'

function visLen(s: string): number {
  return s.replace(/\x1B\[[0-9;]*m/g, '').length
}

function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - visLen(s)))
}

// ─── Banner ───────────────────────────────────────────────────────────────────

export function printBanner(
  providerName: string,
  model: string,
  mcpServers: McpServer[] = []
): void {
  const modelShort = model.split('/').pop()!
  const W = TERM_WIDTH - 4
  const toolsCount = TOOLS.length + mcpServers.length * 6

  console.log()
  console.log(T.boxTopDouble('', W))

  const brand = T.brandBright('◆ opensage') + T.dim(' v' + VERSION)
  console.log(T.vbar + ' ' + pad(brand, W) + T.vbar)

  console.log(T.boxSep(W))

  const kv = (label: string, value: string) =>
    T.vbar +
    ' ' +
    T.muted(label.padEnd(10)) +
    T.white(value) +
    pad('', W - 12 - visLen(value)) +
    T.vbar

  console.log(kv('Model', modelShort))
  console.log(kv('Provider', providerName))
  console.log(kv('Tools', String(toolsCount)))

  if (mcpServers.length > 0) {
    console.log(
      kv(
        'MCP',
        String(mcpServers.length) +
          ' server' +
          (mcpServers.length !== 1 ? 's' : '')
      )
    )
  }

  console.log(T.boxBottomDouble(W))
  console.log()

  const cmds =
    T.accent('/help') +
    T.dim(' · ') +
    T.accent('/setup') +
    T.dim(' · ') +
    T.accent('/exit')
  console.log('  ' + pad(cmds, W - 2))
  console.log()
}

// ─── Message Headers ───────────────────────────────────────────────────────────

export function printUserHeader(): void {
  const label = T.user.bold(' you ')
  console.log()
  console.log(T.dim('┌' + '─'.repeat(CONTENT_WIDTH) + '┐'))
  const padLen = Math.floor((CONTENT_WIDTH - visLen(label)) / 2)
  console.log(
    T.dim('│') +
      ' '.repeat(padLen) +
      label +
      ' '.repeat(CONTENT_WIDTH - padLen - visLen(label)) +
      T.dim('│')
  )
  console.log(T.dim('└' + '─'.repeat(CONTENT_WIDTH) + '┘'))
  console.log()
}

export function printAssistantHeader(model: string): void {
  const modelShort = model.split('/').pop() ?? model
  const label = T.assistant.bold(' assistant ') + T.muted('· ' + modelShort)
  console.log()
  console.log(T.dim('┌' + '─'.repeat(CONTENT_WIDTH) + '┐'))
  const padLen = Math.floor((CONTENT_WIDTH - visLen(label)) / 2)
  console.log(
    T.dim('│') +
      ' '.repeat(padLen) +
      label +
      ' '.repeat(CONTENT_WIDTH - padLen - visLen(label)) +
      T.dim('│')
  )
  console.log(T.dim('└' + '─'.repeat(CONTENT_WIDTH) + '┘'))
  console.log()
}

// ─── Tool Call Header ─────────────────────────────────────────────────────────

export function printToolCallHeader(name: string, hint?: string): void {
  console.log()
  console.log(T.dim('┌' + '─'.repeat(CONTENT_WIDTH) + '┐'))
  const line =
    T.toolIcon +
    ' ' +
    T.tool.bold(name) +
    (hint ? T.dim(' · ') + T.muted(hint) : '')
  console.log(T.dim('│') + ' ' + pad(line, CONTENT_WIDTH) + T.dim(' │'))
  console.log(T.dim('└' + '─'.repeat(CONTENT_WIDTH) + '┘'))
}

// ─── Help ─────────────────────────────────────────────────────────────────────

export function printHelp(): void {
  const W = TERM_WIDTH - 4

  console.log()
  console.log(T.boxTopDouble(' Help ', W))

  const sections = [
    [
      'Session',
      [
        ['/help', 'show this help'],
        ['/clear', 'clear conversation'],
        ['/retry', 're-send last message'],
        ['/compact', 'summarise & compress'],
        ['/save', 'save session'],
        ['/history', 'view recent sessions'],
        ['/exit', 'quit'],
      ],
    ],
    [
      'Config',
      [
        ['/setup', 'setup wizard'],
        ['/provider', 'show/switch provider'],
        ['/model', 'show/switch model'],
        ['/approve', 'toggle auto-approve'],
        ['/tokens', 'token usage'],
      ],
    ],
    [
      'Tools',
      [
        ['/tools', 'list tools'],
        ['/attach <file>', 'attach file'],
        ['/notes', 'memory notes'],
        ['/gmail-auth', 'connect Gmail'],
      ],
    ],
  ]

  for (const [title, cmds] of sections) {
    console.log(T.vbar + ' ' + T.brand(title))
    for (const [cmd, desc] of cmds) {
      console.log(
        T.vbar +
          '   ' +
          T.accent(pad(cmd, 16)) +
          T.white(desc) +
          pad('', W - 20 - visLen(cmd) - visLen(desc)) +
          T.vbar
      )
    }
  }

  console.log(T.boxBottomDouble(W))
  console.log()
}

// ─── Tools List ────────────────────────────────────────────────────────────────

export function printTools(_mcpServers: McpServer[] = []): void {
  const autoSet = new Set([
    'read_file',
    'web_fetch',
    'web_search',
    'save_memory',
  ])
  const W = TERM_WIDTH - 4

  console.log()
  console.log(T.boxTopDouble(' Tools ', W))

  for (const t of TOOLS) {
    const auto = autoSet.has(t.name)
    const name = t.name.padEnd(24)
    const desc = (t.description ?? '').slice(0, 30)
    const badge = auto ? T.success('auto') : T.warn('confirm')
    console.log(
      T.vbar +
        '   ' +
        T.tool(name) +
        T.muted(desc.padEnd(32)) +
        ' ' +
        badge +
        pad('', W - 62) +
        T.vbar
    )
  }

  console.log(T.boxBottomDouble(W))
  console.log()
}

// ─── Goodbye ──────────────────────────────────────────────────────────────────

export function printGoodbye(): void {
  const W = TERM_WIDTH - 4
  console.log()
  console.log(T.boxTopDouble('', W))
  console.log(T.vbar + ' ' + pad(T.brandBright('◆ goodbye'), W) + T.vbar)
  console.log(T.boxBottomDouble(W))
  console.log()
}
