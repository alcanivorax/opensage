import * as readline from 'readline'
import { T } from './ui/theme.js'
import { VERSION } from './ui/banner.js'
import { saveConfig, DEFAULT_CONFIG } from './config.js'
import { ANTHROPIC_MODELS, OPENROUTER_FREE_MODELS } from './providers/index.js'
import type { Config } from './config.js'
import type { ProviderName } from './providers/index.js'

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SetupResult {
  config: Config
  apiKey: string
}

// ─── Readline helpers ─────────────────────────────────────────────────────────

function makeRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) =>
    rl.question(prompt, (ans) => resolve(ans.trim()))
  )
}

/**
 * Pick a number from 1..n, or press Enter to accept the default (index 0).
 * Keeps asking until a valid answer is given.
 */
async function pickNumber(
  rl: readline.Interface,
  count: number,
  promptStr: string
): Promise<number> {
  while (true) {
    const ans = await ask(rl, promptStr)
    if (ans === '') return 0 // default
    const n = parseInt(ans, 10)
    if (!isNaN(n) && n >= 1 && n <= count) return n - 1
    console.log(
      '  ' + T.warn(`Please enter a number between 1 and ${count}, or Enter for the default.`)
    )
  }
}

// ─── Masked key input ─────────────────────────────────────────────────────────
//
//  Reads a line from stdin character-by-character in raw mode, echoing ● for
//  each printable character so the key is never shown in plain text.
//
//  Falls back to a plain readline.question() call when stdin is not a TTY
//  (e.g. piped input in tests).

async function readMasked(promptStr: string): Promise<string> {
  process.stdout.write(promptStr)

  // ── Non-TTY fallback ───────────────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    const fb = makeRl()
    return new Promise((resolve) =>
      fb.once('line', (line) => {
        fb.close()
        resolve(line.trim())
      })
    )
  }

  // ── Raw mode ───────────────────────────────────────────────────────────────
  return new Promise((resolve) => {
    let input = ''

    const handler = (buf: Buffer) => {
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i]

        // Enter / Return
        if (b === 13 || b === 10) {
          cleanup()
          process.stdout.write('\n')
          resolve(input)
          return
        }

        // Ctrl-C
        if (b === 3) {
          cleanup()
          process.stdout.write('\n')
          process.exit(0)
        }

        // Ctrl-U — clear line
        if (b === 21) {
          process.stdout.write('\r\x1b[2K' + promptStr)
          input = ''
          continue
        }

        // Backspace / Delete
        if (b === 127 || b === 8) {
          if (input.length > 0) {
            input = input.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }

        // Printable ASCII (includes common key characters like -_.)
        if (b >= 32 && b < 127) {
          input += String.fromCharCode(b)
          process.stdout.write('●')
        }
      }
    }

    const cleanup = () => {
      try {
        process.stdin.setRawMode(false)
      } catch {
        // not a TTY at cleanup time — ignore
      }
      process.stdin.removeListener('data', handler)
      process.stdin.pause()
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', handler)
  })
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const W = 54 // inner box width

function boxTop(): void {
  console.log(T.dim('  ╭' + '─'.repeat(W) + '╮'))
}

function boxLine(content: string, rawLen: number): void {
  const pad = Math.max(0, W - 2 - rawLen)
  console.log(T.dim('  │ ') + content + ' '.repeat(pad) + T.dim(' │'))
}

function boxBot(): void {
  console.log(T.dim('  ╰' + '─'.repeat(W) + '╯'))
}

function sectionHeader(step: string, title: string): void {
  console.log()
  console.log(
    T.brandBright.bold('  ' + step + '  ') +
      T.dim('·') +
      '  ' +
      T.white(title)
  )
  console.log(T.dim('  ' + '─'.repeat(W)))
  console.log()
}

function stepDone(label: string, value: string): void {
  console.log(
    '\n  ' +
      T.success('✓  ') +
      T.muted(label + ': ') +
      T.white(value) +
      '\n'
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export async function runSetupWizard(
  existingConfig?: Partial<Config>
): Promise<SetupResult> {
  const cfg: Config = { ...DEFAULT_CONFIG, ...(existingConfig ?? {}) }

  // ── Banner ─────────────────────────────────────────────────────────────────
  console.log()
  boxTop()
  boxLine(
    T.brandBright.bold('✦  aichat') + T.dim('  ·  ') + T.muted('v' + VERSION),
    10 + VERSION.length
  )
  boxLine(T.muted('   First-time setup'), 19)
  boxBot()

  // ── Step 1 · Provider ─────────────────────────────────────────────────────
  sectionHeader('1 / 3', 'Choose a provider')

  const providers: ProviderName[] = ['anthropic', 'openrouter']

  console.log(
    '  ' +
      T.accent('1') +
      T.dim('  ─  ') +
      T.white('Anthropic') +
      T.muted('      Claude models — best reasoning, paid plans') +
      T.dim('  ← default')
  )
  console.log(
    '  ' +
      T.accent('2') +
      T.dim('  ─  ') +
      T.white('OpenRouter') +
      T.muted('     300+ models, many completely free')
  )
  console.log()

  const rl1 = makeRl()
  const providerIdx = await pickNumber(
    rl1,
    providers.length,
    '  ' + T.dim('›') + ' '
  )
  rl1.close()

  cfg.provider = providers[providerIdx]
  stepDone('Provider', cfg.provider)

  // ── Step 2 · API Key ──────────────────────────────────────────────────────
  sectionHeader('2 / 3', 'Paste your API key')

  if (cfg.provider === 'anthropic') {
    console.log(
      T.muted('  Get a key →  ') +
        T.accent('https://console.anthropic.com/keys')
    )
  } else {
    console.log(
      T.muted('  Get a free key →  ') +
        T.accent('https://openrouter.ai/keys')
    )
  }
  console.log(
    T.muted(
      '  Stored in ~/.aichat/config.json · never sent anywhere else.'
    )
  )
  console.log(
    T.dim(
      '  (Ctrl-U to clear the line  ·  Ctrl-C to abort)'
    )
  )
  console.log()

  // readMasked uses raw mode — no readline interface must be open while it runs
  let apiKey = ''
  while (true) {
    apiKey = await readMasked('  ' + T.dim('›') + ' ')
    if (apiKey.trim().length > 0) break
    console.log('\n  ' + T.warn('API key cannot be empty. Please try again.'))
    console.log()
  }

  if (cfg.provider === 'anthropic') {
    cfg.apiKeys = { ...cfg.apiKeys, anthropic: apiKey.trim() }
  } else {
    cfg.apiKeys = { ...cfg.apiKeys, openrouter: apiKey.trim() }
  }

  stepDone('Key', '●'.repeat(Math.min(12, apiKey.length)) + '  (saved)')

  // ── Step 3 · Model ────────────────────────────────────────────────────────
  sectionHeader('3 / 3', 'Choose a model')

  const models =
    cfg.provider === 'anthropic' ? ANTHROPIC_MODELS : OPENROUTER_FREE_MODELS

  models.forEach((m, i) => {
    const isDefault = i === 0
    const bullet = isDefault ? T.success('●') : T.dim('○')
    const num = T.accent(String(i + 1))
    const idStr = T.white(m.id)
    const labelStr = T.muted(m.label)
    const defTag = isDefault ? '  ' + T.dim('← default') : ''

    console.log('  ' + bullet + '  ' + num + '  ' + idStr)
    console.log('         ' + labelStr + defTag)
    console.log()
  })

  console.log(
    T.muted('  Press Enter to use the default') +
      T.dim('  [1]') +
      T.muted('  or type a number.')
  )
  console.log()

  cfg.model = models[0].id

  const rl3 = makeRl()
  const modelIdx = await pickNumber(
    rl3,
    models.length,
    '  ' + T.dim('›') + ' '
  )
  rl3.close()

  cfg.model = models[modelIdx].id
  stepDone('Model', cfg.model)

  // ── Save ──────────────────────────────────────────────────────────────────
  saveConfig(cfg)

  console.log(T.dim('  ╭' + '─'.repeat(W) + '╮'))
  console.log(
    T.dim('  │ ') +
      T.success('✓  All set — config saved to ~/.aichat/config.json') +
      T.dim('  │')
  )
  console.log(T.dim('  ╰' + '─'.repeat(W) + '╯'))
  console.log()

  return { config: cfg, apiKey: apiKey.trim() }
}
