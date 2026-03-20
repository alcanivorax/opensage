import { T } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

export const VERSION = '0.1.0'

// ─── Banner ───────────────────────────────────────────────────────────────────

export function printBanner(
  providerName: string,
  model: string,
  mcpServers: McpServer[] = []
): void {
  const modelShort = model.split('/').pop()!
  const W = 54

  console.log()
  console.log(T.dim('  ╭' + '─'.repeat(W) + '╮'))
  console.log(
    T.dim('  │ ') +
      T.brandBright.bold('✦  aichat') +
      T.dim('  ·  ') +
      T.muted('v' + VERSION) +
      ' '.repeat(Math.max(0, W - 14 - VERSION.length)) +
      T.dim(' │')
  )
  console.log(
    T.dim('  │ ') +
      T.muted('   ' + providerName.toLowerCase()) +
      T.dim('  ·  ') +
      T.white(modelShort) +
      ' '.repeat(Math.max(0, W - 8 - providerName.length - modelShort.length)) +
      T.dim(' │')
  )
  if (mcpServers.length > 0) {
    const accountStr = mcpServers
      .map((s) => T.success('● ') + T.white(s.name))
      .join('  ')
    const plainLen = mcpServers.reduce((n, s) => n + s.name.length + 2, 0)
    console.log(
      T.dim('  │ ') +
        T.muted('   accounts: ') +
        accountStr +
        ' '.repeat(Math.max(0, W - 13 - plainLen)) +
        T.dim(' │')
    )
  }
  console.log(T.dim('  ╰' + '─'.repeat(W) + '╯'))
  console.log()
  console.log(
    T.dim('  ') +
      T.muted('type ') +
      T.accent('/help') +
      T.muted(' for commands  ·  ') +
      T.accent('/approve') +
      T.muted(' to toggle auto-run  ·  ') +
      T.accent('/exit') +
      T.muted(' to quit')
  )
  console.log()
}

// ─── Help ─────────────────────────────────────────────────────────────────────

export function printHelp(): void {
  const row = (cmd: string, desc: string) =>
    console.log('  ' + T.accent(cmd.padEnd(26)) + T.muted(desc))

  console.log()
  console.log(T.brandBright.bold('  Session'))
  console.log(T.dim('  ' + '─'.repeat(56)))
  ;(
    [
      ['/help', 'Show this help'],
      ['/clear', 'Clear conversation (saves to history first)'],
      ['/retry', 'Re-send your last message'],
      ['/compact', 'Summarise & compress the conversation'],
      ['/save', 'Save session to history'],
      ['/history', 'Show recent sessions'],
      ['/copy', 'Re-print the last response'],
      ['/exit  /quit', 'Quit'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))

  console.log()
  console.log(T.brandBright.bold('  Config'))
  console.log(T.dim('  ' + '─'.repeat(56)))
  ;(
    [
      ['/setup', 'Re-run the interactive setup wizard'],
      ['/provider [name]', 'Show or switch provider (anthropic / openrouter)'],
      ['/model [id]', 'Show or switch model'],
      ['/apikey <p> <key>', 'Save API key for a provider'],
      ['/approve', 'Toggle auto-approve for non-sensitive tools'],
      ['/system [text]', 'View or update the system prompt'],
      ['/tokens', 'Show token usage for this session'],
      ['/version', 'Show version'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))

  console.log()
  console.log(T.brandBright.bold('  Tools & Memory'))
  console.log(T.dim('  ' + '─'.repeat(56)))
  ;(
    [
      ['/tools', 'List all available tools'],
      ['/accounts', 'List connected MCP accounts'],
      ['/attach <file>', "Attach a file's contents to the conversation"],
      ['/notes', 'Show all persistent memory notes'],
      ['/forget <id>', 'Delete a memory note by ID'],
      ['/gmail-auth', 'Connect your Gmail account (one-time OAuth setup)'],
      ['/gmail-status', 'Check Gmail connection status'],
    ] as [string, string][]
  ).forEach(([c, d]) => row(c, d))

  console.log()
  console.log(T.brandBright.bold('  Example prompts'))
  console.log(T.dim('  ' + '─'.repeat(56)))
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
  examples.forEach((ex) => console.log(T.dim('  › ') + T.white(ex)))
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

  console.log()
  console.log(T.brandBright.bold('  Local Tools'))
  console.log(T.dim('  ' + '─'.repeat(56)))
  for (const t of TOOLS) {
    const auto = autoSet.has(t.name)
    console.log(
      '  ' +
        T.tool(t.name.padEnd(20)) +
        T.muted(((t.description ?? '').slice(0, 44) + '…').padEnd(46)) +
        (auto ? T.success('✓ auto') : T.warn('⚠ confirm'))
    )
  }

  if (mcpServers.length > 0) {
    console.log()
    console.log(T.brandBright.bold('  MCP Account Tools'))
    console.log(T.dim('  ' + '─'.repeat(56)))

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
      console.log('  ' + T.success('● ') + T.white(s.name))
      for (const t of accountTools[s.name] ?? [
        '(dynamic — resolved at runtime)',
      ]) {
        const isWrite = !['search_', 'list_', 'get_'].some((p) =>
          t.startsWith(p)
        )
        console.log(
          '    ' +
            T.brandBright(t.padEnd(30)) +
            (isWrite ? T.warn('⚠ confirm') : T.success('✓ auto'))
        )
      }
    }
  }

  console.log()
}
