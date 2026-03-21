import * as readline from 'readline'
import { T } from './ui/theme.js'
import { VERSION } from './ui/banner.js'
import { saveConfig, DEFAULT_CONFIG } from './config.js'
import { ANTHROPIC_MODELS, OPENROUTER_FREE_MODELS } from './providers/index.js'
import type { Config } from './config.js'
import type { ProviderName } from './providers/index.js'

export interface SetupResult {
  config: Config
  apiKey: string
}

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

async function pickNumber(
  rl: readline.Interface,
  count: number,
  promptStr: string
): Promise<number> {
  while (true) {
    const ans = await ask(rl, promptStr)
    if (ans === '') return 0
    const n = parseInt(ans, 10)
    if (!isNaN(n) && n >= 1 && n <= count) return n - 1
    console.log('  ' + T.warn(`Enter 1-${count} or press Enter`))
  }
}

async function readMasked(promptStr: string): Promise<string> {
  process.stdout.write(promptStr)

  if (!process.stdin.isTTY) {
    const fb = makeRl()
    return new Promise((resolve) =>
      fb.once('line', (line) => {
        fb.close()
        resolve(line.trim())
      })
    )
  }

  return new Promise((resolve) => {
    let input = ''

    const handler = (buf: Buffer) => {
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i]

        if (b === 13 || b === 10) {
          cleanup()
          process.stdout.write('\n')
          resolve(input)
          return
        }

        if (b === 3) {
          cleanup()
          process.stdout.write('\n')
          process.exit(0)
        }

        if (b === 21) {
          process.stdout.write('\r\x1b[2K' + promptStr)
          input = ''
          continue
        }

        if (b === 127 || b === 8) {
          if (input.length > 0) {
            input = input.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }

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
        /* ignore */
      }
      process.stdin.removeListener('data', handler)
      process.stdin.pause()
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', handler)
  })
}

const W = 54

function sectionHeader(step: string, title: string): void {
  console.log()
  console.log(
    T.brandBright('  ' + step + '  ') + T.dim('·') + '  ' + T.white(title)
  )
  console.log(T.dim('  ' + '─'.repeat(W)))
  console.log()
}

function done(label: string, value: string): void {
  console.log(
    '\n' + T.check + ' ' + T.muted(label + ': ') + T.accent(value) + '\n'
  )
}

export async function runSetupWizard(
  existingConfig?: Partial<Config>
): Promise<SetupResult> {
  const cfg: Config = { ...DEFAULT_CONFIG, ...(existingConfig ?? {}) }

  // Welcome
  console.log()
  console.log(T.dim('  ╭' + '─'.repeat(W) + '╮'))
  console.log(
    T.dim('  │') +
      ' ' +
      T.brandBright.bold('◆ opensage') +
      T.dim(' v' + VERSION) +
      ' '.repeat(W - 14 - VERSION.length) +
      T.dim('│')
  )
  console.log(T.dim('  │') + ' '.repeat(W) + T.dim('│'))
  console.log(
    T.dim('  │') +
      ' ' +
      T.muted('First-time setup') +
      ' '.repeat(W - 18) +
      T.dim('│')
  )
  console.log(T.dim('  │') + ' '.repeat(W) + T.dim('│'))
  console.log(T.dim('  ╰' + '─'.repeat(W) + '╯'))
  console.log()

  // Step 1: Provider
  sectionHeader('1 / 3', 'Choose provider')

  console.log(
    '  ' +
      T.accent('1') +
      T.dim('  ─  ') +
      T.white('Anthropic') +
      T.muted('  Claude models')
  )
  console.log(
    '  ' +
      T.accent('2') +
      T.dim('  ─  ') +
      T.white('OpenRouter') +
      T.muted('  Free tier available')
  )
  console.log()

  const rl1 = makeRl()
  const providerIdx = await pickNumber(rl1, 2, '  ' + T.dim('›') + ' ')
  rl1.close()

  cfg.provider = ['anthropic', 'openrouter'][providerIdx] as ProviderName
  done('Provider', cfg.provider)

  // Step 2: API Key
  sectionHeader('2 / 3', 'Enter API key')

  const url =
    cfg.provider === 'anthropic'
      ? 'https://console.anthropic.com/keys'
      : 'https://openrouter.ai/keys'

  console.log('  ' + T.muted('Get key: ') + T.accent(url))
  console.log('  ' + T.muted('Ctrl-U to clear · Ctrl-C to abort'))
  console.log()

  let apiKey = ''
  while (true) {
    apiKey = await readMasked('  ' + T.dim('›') + ' ')
    if (apiKey.trim().length > 0) break
    console.log('\n  ' + T.warn('Key cannot be empty\n'))
  }

  if (cfg.provider === 'anthropic') {
    cfg.apiKeys = { ...cfg.apiKeys, anthropic: apiKey.trim() }
  } else {
    cfg.apiKeys = { ...cfg.apiKeys, openrouter: apiKey.trim() }
  }

  done('Key', '●●●●●●●● (' + apiKey.length + ' chars)')

  // Step 3: Model
  sectionHeader('3 / 3', 'Choose model')

  const models =
    cfg.provider === 'anthropic' ? ANTHROPIC_MODELS : OPENROUTER_FREE_MODELS

  for (let i = 0; i < Math.min(models.length, 5); i++) {
    const m = models[i]
    const isDefault = i === 0
    console.log(
      '  ' +
        (isDefault ? T.success('●') : T.dim('○')) +
        '  ' +
        T.accent(String(i + 1)) +
        '  ' +
        T.white(m.id)
    )
    console.log(
      '         ' +
        T.muted(m.label) +
        (isDefault ? ' ' + T.dim('← default') : '')
    )
    console.log()
  }

  if (models.length > 5) {
    console.log('  ' + T.muted('... and ' + (models.length - 5) + ' more'))
    console.log()
  }

  cfg.model = models[0].id

  const rl3 = makeRl()
  const modelIdx = await pickNumber(
    rl3,
    Math.min(models.length, 5),
    '  ' + T.dim('›') + ' '
  )
  rl3.close()

  cfg.model = models[modelIdx].id
  done('Model', cfg.model)

  // Save
  saveConfig(cfg)

  console.log()
  console.log(T.dim('  ╭' + '─'.repeat(W) + '╮'))
  console.log(
    T.dim('  │') +
      ' ' +
      T.success('✓') +
      ' ' +
      T.white.bold('All set!') +
      ' '.repeat(W - 12) +
      T.dim('│')
  )
  console.log(T.dim('  │') + ' '.repeat(W) + T.dim('│'))
  console.log(
    T.dim('  │') +
      ' ' +
      T.muted('Config saved to ~/.opensage/config.json') +
      ' '.repeat(W - 42) +
      T.dim('│')
  )
  console.log(T.dim('  │') + ' '.repeat(W) + T.dim('│'))
  console.log(T.dim('  ╰' + '─'.repeat(W) + '╯'))
  console.log()

  return { config: cfg, apiKey: apiKey.trim() }
}
