import { T } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

export const VERSION = '0.1.0'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ANSI escape codes to get true visible length. */
function visLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*m/g, '').length
}

/** Right-pad a pre-styled string to a visible width. */
function padTo(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - visLen(s)))
}

// ─── Banner ───────────────────────────────────────────────────────────────────
//
//  ╭────────────────────────────────────────────────────────╮
//  │  ◆ aichat   v0.1.0                                     │
//  │    anthropic · claude-3-5-sonnet                       │
//  │    ● gmail  ● gcal                                     │
//  ├────────────────────────────────────────────────────────┤
//  │  /help  ·  /approve  ·  /exit                          │
//  ╰────────────────────────────────────────────────────────╯

export function printBanner(
  providerName: string,
  model: string,
  mcpServers: McpServer[] = []
): void {
  const modelShort = model.split('/').pop()!
  const W = 56 // visible content width (between the two │ columns)
  const BW = W // border dash count

  const row = (content: string) => {
    const padded = padTo(' ' + content, W)
    console.log(T.dim('  │') + padded + T.dim('│'))
  }

  const sep = () => console.log(T.dim('  ├' + '─'.repeat(BW) + '┤'))

  // Top border
  console.log()
  console.log(T.dim('  ╭' + '─'.repeat(BW) + '╮'))

  // Identity: ◆ aichat  v0.1.0
  row(T.brand.bold(' ◆ supernano') + T.dim('   ') + T.muted('v' + VERSION))

  // Provider · model
  row(
    T.subtle('   ') +
      T.muted(providerName.toLowerCase()) +
      T.dim('  ·  ') +
      T.white(modelShort)
  )

  // MCP accounts (optional row)
  if (mcpServers.length > 0) {
    const dots = mcpServers
      .map((s) => T.success('●') + ' ' + T.white(s.name))
      .join(T.dim('  '))
    row(T.subtle('   ') + dots)
  }

  sep()

  // Shortcut hints row
  const hint = (cmd: string, desc: string) =>
    T.accent(cmd) + T.dim(' ') + T.subtle(desc)

  const line = [
    hint('/help', ''),
    hint('/approve', ''),
    hint('/exit', ''),
  ].join(T.dim('  ·  '))

  row(' ' + line)

  console.log(T.dim('  ╰' + '─'.repeat(BW) + '╯'))
  console.log()
}

// ─── Help ─────────────────────────────────────────────────────────────────────
//
//  Renders a compact two-column table inside a titled box.

export function printHelp(): void {
  const LABEL_W = 22
  const W = 56
  // const BW = W

  const section = (title: string) => {
    console.log()
    console.log(T.boxTop(title, W + 4))
  }

  const row = (cmd: string, desc: string) => {
    const label = padTo(
      T.accent(cmd),
      LABEL_W + (T.accent(cmd).length - cmd.length)
    )
    const padded = padTo(' ' + label + ' ' + T.muted(desc), W)
    console.log(T.dim('  │') + padded + T.dim('│'))
  }

  const close = () => console.log(T.boxBottom(W + 2))

  // ── Session ──────────────────────────────────────────────────────────────
  section('session')
  ;(
    [
      ['/help', 'show this help'],
      ['/clear', 'clear conversation (saves history first)'],
      ['/retry', 're-send your last message'],
      ['/compact', 'summarise & compress the conversation'],
      ['/save', 'save session to history'],
      ['/history', 'show recent sessions'],
      ['/copy', 're-print the last response'],
      ['/exit  /quit', 'quit'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))
  close()

  // ── Config ───────────────────────────────────────────────────────────────
  section('config')
  ;(
    [
      ['/setup', 're-run the interactive setup wizard'],
      ['/provider [name]', 'show or switch provider'],
      ['/model [id]', 'show or switch model'],
      ['/apikey <p> <key>', 'save API key for a provider'],
      ['/approve', 'toggle auto-approve for non-sensitive tools'],
      ['/system [text]', 'view or update the system prompt'],
      ['/tokens', 'show token usage for this session'],
      ['/version', 'show version'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))
  close()

  // ── Tools & Memory ───────────────────────────────────────────────────────
  section('tools & memory')
  ;(
    [
      ['/tools', 'list all available tools'],
      ['/accounts', 'list connected MCP accounts'],
      ['/attach <file>', "attach a file's contents to the conversation"],
      ['/notes', 'show all persistent memory notes'],
      ['/forget <id>', 'delete a memory note by ID'],
      ['/gmail-auth', 'connect Gmail account (one-time OAuth)'],
      ['/gmail-status', 'check Gmail connection status'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))
  close()

  // ── Example prompts ──────────────────────────────────────────────────────
  console.log()
  console.log(T.boxTop('example prompts', W + 4))
  const examples = [
    'summarise ~/Documents/notes.md',
    'what emails did I get today?',
    "what's on my calendar this week?",
    'search the web for the latest Bun.js release notes',
    'create a Python script that renames all images in ~/Downloads',
    'draft an email to john@example.com about the project update',
    'remember that I prefer TypeScript over JavaScript',
    'run the tests in this repo and fix any failures',
  ]
  examples.forEach((ex) => {
    const padded = padTo(' ' + T.dim('›') + ' ' + T.white(ex), W)
    console.log(T.dim('  │') + padded + T.dim('│'))
  })
  close()
  console.log()
}

// ─── Tools list ───────────────────────────────────────────────────────────────

export function printTools(mcpServers: McpServer[] = []): void {
  const autoSet = new Set([
    'read_file',
    'web_fetch',
    'web_search',
    'save_memory',
  ])
  const W = 56
  const NAME_W = 22
  const DESC_W = 26

  // ── Local tools ──────────────────────────────────────────────────────────
  console.log()
  console.log(T.boxTop('local tools', W + 4))

  for (const t of TOOLS) {
    const auto = autoSet.has(t.name)
    const nameCol = padTo(
      T.tool(t.name),
      NAME_W + (T.tool(t.name).length - t.name.length)
    )
    const descRaw = (t.description ?? '').slice(0, DESC_W - 1)
    const descCol = padTo(
      T.muted(descRaw),
      DESC_W + (T.muted(descRaw).length - descRaw.length)
    )
    const badge = auto
      ? T.success('✓') + ' ' + T.dim('auto   ')
      : T.warn('⚠') + ' ' + T.dim('confirm')
    const padded = padTo(' ' + nameCol + ' ' + descCol + ' ' + badge, W)
    console.log(T.dim('  │') + padded + T.dim('│'))
  }

  console.log(T.boxBottom(W + 2))

  // ── MCP account tools ────────────────────────────────────────────────────
  if (mcpServers.length > 0) {
    const accountTools: Record<string, string[]> = {
      gmail: [
        'search_emails',
        'get_email',
        'send_email',
        'create_draft',
        'reply_to_email',
        'forward_email',
      ],
      gcal: [
        'list_events',
        'get_event',
        'create_event',
        'update_event',
        'delete_event',
        'respond_to_invite',
      ],
    }

    for (const s of mcpServers) {
      console.log()
      console.log(T.boxTop(T.success('●') + ' ' + s.name, W + 4))

      for (const t of accountTools[s.name] ?? [
        '(dynamic — resolved at runtime)',
      ]) {
        const isWrite = !['search_', 'list_', 'get_'].some((p) =>
          t.startsWith(p)
        )
        const nameCol = padTo(T.tool(t), NAME_W + (T.tool(t).length - t.length))
        const badge = isWrite
          ? T.warn('⚠') + ' ' + T.dim('confirm')
          : T.success('✓') + ' ' + T.dim('auto   ')
        const padded = padTo(
          ' ' + nameCol + ' ' + ' '.repeat(DESC_W) + ' ' + badge,
          W
        )
        console.log(T.dim('  │') + padded + T.dim('│'))
      }

      console.log(T.boxBottom(W + 2))
    }
  }

  console.log()
}

// // ─── Helpers (re-export for use in banner) ────────────────────────────────────

// function visLen(s: string): number {
//   // eslint-disable-next-line no-control-regex
//   return s.replace(/\x1B\[[0-9;]*m/g, '').length
// }

// function padTo(s: string, width: number): string {
//   return s + ' '.repeat(Math.max(0, width - visLen(s)))
// }
