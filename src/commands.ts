import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import * as child_process from 'child_process'
import { T } from './ui/theme.js'
import { printHelp, printTools, printGoodbye, VERSION } from './ui/banner.js'
import { renderMarkdown } from './ui/render.js'
import { saveHistory, saveConfig, loadHistory } from './config.js'
import { loadMemory, deleteMemoryEntry } from './tools/memory.js'
import {
  ANTHROPIC_MODELS,
  OPENROUTER_FREE_MODELS,
  detectProvider,
  createProvider,
} from './providers/index.js'
import { runSetupWizard } from './setup.js'
import {
  loadCreds,
  saveCreds,
  buildAuthUrl,
  exchangeAuthCode,
  isGmailConfigured,
} from './tools/gmail.js'
import type { Config, Message } from './config.js'
import type { Provider } from './providers/index.js'

// ─── Session state ────────────────────────────────────────────────────────────

export interface SessionState {
  messages: Message[]
  totalIn: number
  totalOut: number
  lastResponse: string
  lastUserMessage: string
  autoApprove: boolean
  config: Config
  provider: Provider
  rl: readline.Interface
}

export type CommandResult =
  | { type: 'continue' }
  | { type: 'exit' }
  | { type: 'unknown' }
  | { type: 'retry'; message: string }
  | { type: 'setup-complete' }

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleCommand(
  input: string,
  state: SessionState
): Promise<CommandResult> {
  if (!input.startsWith('/')) return { type: 'unknown' }

  const parts = input.trim().split(' ')
  const cmd = parts[0]
  const arg = parts.slice(1).join(' ').trim()

  switch (cmd) {
    // ── Session ───────────────────────────────────────────────────────────────

    // ── Gmail OAuth setup ─────────────────────────────────────────────────────

    case '/gmail-auth': {
      console.log()
      console.log(T.brandBright.bold('  Gmail Setup'))
      console.log(T.dim('  ' + '─'.repeat(56)))
      console.log()
      console.log(
        T.white('  To connect Gmail you need a Google OAuth2 Client ID.')
      )
      console.log(T.muted('  This is a one-time setup that takes ~3 minutes.'))
      console.log()

      // ── Step 1: check / show existing creds ─────────────────────────────────
      const existingCreds = loadCreds()
      if (existingCreds && !arg.includes('reset')) {
        console.log(
          T.success('  ✓ Credentials already saved.') +
            T.muted(
              '  client_id: ' + existingCreds.client_id.slice(0, 24) + '…'
            )
        )
        console.log(
          T.muted('  Run /gmail-auth reset to reconfigure from scratch.\n')
        )
        if (isGmailConfigured()) {
          console.log(T.success('  ✓ Gmail is fully authorized and ready.\n'))
          return { type: 'continue' }
        }
        // Creds exist but no tokens — fall through to auth flow
        console.log(
          T.warn(
            '  ⚠  No authorization tokens found — continuing to auth step.\n'
          )
        )
      } else {
        // ── How to get credentials ─────────────────────────────────────────────
        console.log(T.brandBright('  How to get your credentials:'))
        console.log()
        console.log(
          T.accent('  1') +
            T.muted('  Go to ') +
            T.accent('https://console.cloud.google.com/apis/credentials')
        )
        console.log(
          T.accent('  2') +
            T.muted('  Create a project (or select one), then click') +
            T.white(' + CREATE CREDENTIALS')
        )
        console.log(
          T.accent('  3') +
            T.muted('  Choose') +
            T.white(' OAuth client ID') +
            T.muted('  →  Application type:') +
            T.white(' Desktop app')
        )
        console.log(
          T.accent('  4') +
            T.muted('  Enable the Gmail API at ') +
            T.accent(
              'https://console.cloud.google.com/apis/library/gmail.googleapis.com'
            )
        )
        console.log(
          T.accent('  5') +
            T.muted('  Copy the') +
            T.white(' Client ID') +
            T.muted(' and') +
            T.white(' Client Secret') +
            T.muted(' below.')
        )
        console.log()

        // ── Collect client_id ──────────────────────────────────────────────────
        const clientId: string = await new Promise((resolve) =>
          state.rl.question('  ' + T.muted('Client ID     › '), (ans) =>
            resolve(ans.trim())
          )
        )

        if (!clientId) {
          console.log('\n' + T.error('  ✗ Aborted — client ID is required.\n'))
          return { type: 'continue' }
        }

        // ── Collect client_secret ──────────────────────────────────────────────
        const clientSecret: string = await new Promise((resolve) =>
          state.rl.question('  ' + T.muted('Client Secret › '), (ans) =>
            resolve(ans.trim())
          )
        )

        if (!clientSecret) {
          console.log(
            '\n' + T.error('  ✗ Aborted — client secret is required.\n')
          )
          return { type: 'continue' }
        }

        saveCreds({ client_id: clientId, client_secret: clientSecret })
        console.log('\n' + T.success('  ✓ Credentials saved.\n'))
      }

      // ── Step 2: generate auth URL ─────────────────────────────────────────
      const creds = loadCreds()!
      const authUrl = buildAuthUrl(creds.client_id)

      console.log(T.brandBright('  Authorize opensage in your browser:'))
      console.log()
      console.log('  ' + T.accent(authUrl))
      console.log()
      console.log(
        T.muted(
          '  Opening your browser…  ' +
            T.dim('(if it does not open, copy the URL above)')
        )
      )

      // Best-effort browser open
      const openCmd =
        process.platform === 'darwin'
          ? `open "${authUrl}"`
          : process.platform === 'win32'
            ? `start "" "${authUrl}"`
            : `xdg-open "${authUrl}" 2>/dev/null || true`
      child_process.exec(openCmd)

      console.log()
      console.log(
        T.muted(
          '  After you grant access Google will show a code. Paste it here.'
        )
      )
      console.log()

      // ── Step 3: collect auth code ─────────────────────────────────────────
      const authCode: string = await new Promise((resolve) =>
        state.rl.question('  ' + T.dim('Auth code › '), (ans) =>
          resolve(ans.trim())
        )
      )

      if (!authCode) {
        console.log('\n' + T.error('  ✗ Aborted — no auth code entered.\n'))
        return { type: 'continue' }
      }

      // ── Step 4: exchange code for tokens ─────────────────────────────────
      console.log()
      console.log(T.dim('  Exchanging code for tokens…'))

      try {
        await exchangeAuthCode(authCode, creds.client_id, creds.client_secret)

        console.log()
        console.log(T.success('  ✓ Gmail authorized successfully!'))
        console.log(
          T.muted(
            '  Tokens saved to ~/.opensage/google-tokens.json\n' +
              '  They refresh automatically — you will not need to do this again.\n'
          )
        )
        console.log(T.white('  You can now ask me things like:'))
        console.log(T.dim('  › ') + T.muted('read my latest unread emails'))
        console.log(
          T.dim('  › ') +
            T.muted('send an email to alice@example.com about the meeting')
        )
        console.log(
          T.dim('  › ') +
            T.muted('search my email for invoices from last month')
        )
        console.log()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log('\n' + T.error(`  ✗ Authorization failed: ${msg}\n`))
        console.log(
          T.muted(
            '  Make sure you copied the full code and that your credentials are correct.\n' +
              '  Run /gmail-auth reset to start over.\n'
          )
        )
      }

      return { type: 'continue' }
    }

    case '/setup': {
      console.log()

      // Close the active readline so raw mode can take over for the key prompt
      state.rl.close()

      try {
        const result = await runSetupWizard(state.config)

        state.config = result.config
        state.provider = createProvider({
          provider: result.config.provider,
          apiKey: result.apiKey,
        })

        // Inject updated memory context into the new system prompt
        // (keep it simple — just use the config as-is from the wizard)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log('\n' + T.error(`  ✗ Setup failed: ${msg}\n`))
      }

      // Recreate the readline interface so the main prompt loop keeps working
      state.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        historySize: 100,
      })

      return { type: 'setup-complete' }
    }

    case '/exit':
    case '/quit':
      if (state.messages.length) saveHistory(state.messages)
      printGoodbye()
      return { type: 'exit' }

    case '/clear':
      if (state.messages.length) saveHistory(state.messages)
      state.messages.length = 0
      state.totalIn = 0
      state.totalOut = 0
      state.lastResponse = ''
      state.lastUserMessage = ''
      console.log('\n' + T.success('  ✓ Conversation cleared\n'))
      return { type: 'continue' }

    case '/save':
      saveHistory(state.messages)
      console.log('\n' + T.success('  ✓ Saved to ~/.opensage/history.json\n'))
      return { type: 'continue' }

    case '/gmail-status': {
      const configured = isGmailConfigured()
      const creds = loadCreds()
      console.log()
      console.log(T.brandBright.bold('  Gmail Status'))
      console.log(T.dim('  ' + '─'.repeat(46)))
      console.log(
        '  Credentials  ' + (creds ? T.success('● saved') : T.warn('✗ not set'))
      )
      console.log(
        '  Authorized   ' +
          (configured ? T.success('● yes') : T.warn('✗ not yet'))
      )
      if (!configured) {
        console.log()
        console.log(
          T.muted('  Run /gmail-auth to connect your Gmail account.\n')
        )
      } else {
        console.log()
        console.log(T.success('  ✓ Ready — you can ask about your emails.\n'))
      }
      return { type: 'continue' }
    }

    case '/history': {
      const hist = loadHistory()
      if (hist.length === 0) {
        console.log('\n' + T.muted('  No saved sessions yet.\n'))
        return { type: 'continue' }
      }
      console.log()
      console.log(T.brandBright.bold('  Recent Sessions'))
      console.log(T.dim('  ' + '─'.repeat(54)))
      hist.slice(-8).forEach((h, i) => {
        const date = new Date(h.timestamp).toLocaleString()
        const turns = Math.ceil(h.messages.length / 2)
        console.log(
          T.dim(`  ${String(i + 1).padStart(2)}. `) +
            T.accent(date) +
            T.muted(`  —  ${turns} turn${turns !== 1 ? 's' : ''}`)
        )
      })
      console.log()
      return { type: 'continue' }
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    case '/retry': {
      // Walk backwards to find the last user message that is a plain string
      // (not a tool-result array).
      let foundIdx = -1
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i]
        if (m.role === 'user' && typeof m.content === 'string') {
          foundIdx = i
          break
        }
      }

      // Fall back to lastUserMessage if history was already trimmed
      if (foundIdx === -1) {
        if (state.lastUserMessage) {
          console.log(
            '\n' +
              T.muted(`  ↩ Retrying: "${state.lastUserMessage.slice(0, 70)}"\n`)
          )
          return { type: 'retry', message: state.lastUserMessage }
        }
        console.log('\n' + T.warn('  Nothing to retry\n'))
        return { type: 'continue' }
      }

      const msg = state.messages[foundIdx].content as string
      // Remove everything from this user message onward
      state.messages.splice(foundIdx)
      console.log(
        '\n' +
          T.muted(
            `  ↩ Retrying: "${msg.slice(0, 70)}${msg.length > 70 ? '…' : ''}"\n`
          )
      )
      return { type: 'retry', message: msg }
    }

    // ── Compact ───────────────────────────────────────────────────────────────

    case '/compact': {
      if (state.messages.length < 4) {
        console.log('\n' + T.muted('  Not enough conversation to compact.\n'))
        return { type: 'continue' }
      }

      console.log('\n' + T.dim('  Summarising conversation…'))

      try {
        const summaryMessages: Message[] = [
          ...state.messages,
          {
            role: 'user' as const,
            content:
              'Please write a concise but complete summary of our conversation so far. ' +
              'Capture all decisions made, code written, tasks completed, and any important context ' +
              'that would be needed to continue the conversation. Use bullet points.',
          },
        ]

        const response = await state.provider.chat({
          model: state.config.model,
          maxTokens: 2048,
          system: state.config.systemPrompt,
          messages: summaryMessages,
          tools: [],
          mcpServers: [],
        })

        const summary = response.textBlocks.join('\n')

        // Replace conversation with a minimal context pair
        state.messages = [
          {
            role: 'user',
            content:
              '[Conversation compacted — summary of previous context below]',
          },
          {
            role: 'assistant',
            content: summary,
          },
        ]

        state.totalIn = response.inputTokens
        state.totalOut = response.outputTokens

        process.stdout.write('\r\x1b[2K')
        console.log('\n' + T.success('  ✓ Conversation compacted'))
        console.log(T.muted('  ' + '─'.repeat(54)))
        summary
          .split('\n')
          .slice(0, 10)
          .forEach((l) => console.log(T.muted('  ' + l)))
        if (summary.split('\n').length > 10) console.log(T.muted('  …'))
        console.log()
      } catch (err: any) {
        console.log(
          '\n' + T.error(`  ✗ Compact failed: ${err.message ?? err}\n`)
        )
      }

      return { type: 'continue' }
    }

    // ── File attach ───────────────────────────────────────────────────────────

    case '/attach': {
      if (!arg) {
        console.log('\n' + T.error('  ✗ Usage: /attach <file-path>\n'))
        return { type: 'continue' }
      }

      const resolved = path.resolve(arg)

      if (!fs.existsSync(resolved)) {
        console.log('\n' + T.error(`  ✗ File not found: ${resolved}\n`))
        return { type: 'continue' }
      }

      const stat = fs.statSync(resolved)
      if (stat.isDirectory()) {
        console.log(
          '\n' + T.error('  ✗ Path is a directory. Attach individual files.\n')
        )
        return { type: 'continue' }
      }
      if (stat.size > 512 * 1024) {
        console.log(
          '\n' +
            T.error(
              `  ✗ File too large (${Math.round(stat.size / 1024)} KB, max 512 KB)\n`
            )
        )
        return { type: 'continue' }
      }

      let content: string
      try {
        content = fs.readFileSync(resolved, 'utf8')
      } catch {
        console.log(
          '\n' +
            T.error('  ✗ Could not read file (binary or permission error)\n')
        )
        return { type: 'continue' }
      }

      const ext = path.extname(resolved).slice(1) || 'text'
      const basename = path.basename(resolved)
      const sizeKb = (stat.size / 1024).toFixed(1)

      const message =
        `I've attached the file \`${basename}\` (${sizeKb} KB):\n` +
        '```' +
        ext +
        '\n' +
        content +
        '\n```'

      state.messages.push({ role: 'user', content: message })

      console.log(
        '\n' +
          T.success(`  ✓ Attached `) +
          T.white(basename) +
          T.muted(` (${sizeKb} KB)`) +
          T.muted('  — file contents added to conversation\n')
      )
      return { type: 'continue' }
    }

    // ── Memory: notes & forget ────────────────────────────────────────────────

    case '/notes': {
      const memories = loadMemory()
      if (memories.length === 0) {
        console.log('\n' + T.muted('  No memories saved yet.'))
        console.log(
          T.muted(
            '  Ask the AI to remember something, or say "remember that…"\n'
          )
        )
        return { type: 'continue' }
      }

      console.log()
      console.log(T.brandBright.bold('  Memory Notes'))
      console.log(T.dim('  ' + '─'.repeat(54)))

      for (const m of memories) {
        console.log(
          '  ' +
            T.dim(`[${m.id}]`) +
            '  ' +
            T.accent(`[${m.category}]`.padEnd(14)) +
            T.white(m.content)
        )
        console.log(
          T.muted('              ' + new Date(m.timestamp).toLocaleString())
        )
      }

      console.log()
      console.log(
        T.muted(
          `  ${memories.length} note${memories.length !== 1 ? 's' : ''}  ·  /forget <id> to delete\n`
        )
      )
      return { type: 'continue' }
    }

    case '/forget': {
      if (!arg) {
        console.log('\n' + T.error('  ✗ Usage: /forget <id>\n'))
        return { type: 'continue' }
      }
      const deleted = deleteMemoryEntry(arg)
      if (deleted) {
        console.log('\n' + T.success(`  ✓ Deleted memory [${arg}]\n`))
      } else {
        console.log('\n' + T.error(`  ✗ Memory not found: ${arg}\n`))
      }
      return { type: 'continue' }
    }

    // ── Provider switching ────────────────────────────────────────────────────

    case '/provider': {
      if (!arg) {
        console.log()
        console.log(T.brandBright.bold('  Active Provider'))
        console.log(T.dim('  ' + '─'.repeat(46)))
        console.log(
          '  ' +
            T.success('● ') +
            T.white(state.config.provider) +
            T.muted(`  ·  ${state.config.model}`)
        )
        console.log()
        console.log(T.brandBright.bold('  Available Providers'))
        console.log(T.dim('  ' + '─'.repeat(46)))
        console.log(
          '  ' +
            T.accent('anthropic') +
            T.muted('    Claude models, full MCP support')
        )
        console.log(
          '  ' +
            T.accent('openrouter') +
            T.muted('   100+ models, free tiers available')
        )
        console.log()
        console.log(
          T.muted('  Usage: ') +
            T.accent('/provider anthropic') +
            T.muted('  or  ') +
            T.accent('/provider openrouter')
        )
        console.log()
        return { type: 'continue' }
      }

      const name = arg as 'anthropic' | 'openrouter'
      if (name !== 'anthropic' && name !== 'openrouter') {
        console.log(
          '\n' +
            T.error(
              `  ✗ Unknown provider "${arg}". Use anthropic or openrouter.\n`
            )
        )
        return { type: 'continue' }
      }

      const apiKey =
        name === 'anthropic'
          ? (state.config.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
          : (state.config.apiKeys.openrouter ??
            process.env['OPENROUTER_API_KEY'])

      if (!apiKey) {
        console.log()
        console.log(T.error(`  ✗ No API key for ${name}.`))
        if (name === 'anthropic') {
          console.log(
            T.muted('  Set: ') + T.accent('export ANTHROPIC_API_KEY=sk-ant-…')
          )
        } else {
          console.log(
            T.muted('  Get a free key: ') +
              T.accent('https://openrouter.ai/keys')
          )
          console.log(
            T.muted('  Set: ') + T.accent('export OPENROUTER_API_KEY=sk-or-…')
          )
        }
        console.log()
        return { type: 'continue' }
      }

      state.config.provider = name
      state.config.model =
        name === 'anthropic'
          ? 'claude-sonnet-4-20250514'
          : 'google/gemini-2.0-flash-exp:free'

      state.provider = createProvider({ provider: name, apiKey })
      saveConfig(state.config)

      console.log(
        '\n' +
          T.success('  ✓ Switched to ') +
          T.white(name) +
          T.muted(`  (model: ${state.config.model})\n`)
      )

      if (!state.provider.supportsMcp) {
        console.log(
          T.warn('  ⚠  MCP (Gmail / Calendar) not available on OpenRouter\n')
        )
      }
      return { type: 'continue' }
    }

    // ── Model switching ───────────────────────────────────────────────────────

    case '/model': {
      if (!arg) {
        const models =
          state.config.provider === 'anthropic'
            ? ANTHROPIC_MODELS
            : OPENROUTER_FREE_MODELS

        console.log()
        console.log(T.brandBright.bold(`  Models  ·  ${state.config.provider}`))
        console.log(T.dim('  ' + '─'.repeat(56)))
        for (const m of models) {
          const active = m.id === state.config.model
          console.log(
            '  ' +
              (active ? T.success('● ') : T.dim('  ')) +
              T.accent(m.id.padEnd(48)) +
              T.muted(m.label)
          )
        }
        console.log()
        console.log(T.muted('  Usage: ') + T.accent('/model <model-id>'))
        console.log()
        return { type: 'continue' }
      }

      state.config.model = arg
      saveConfig(state.config)
      console.log('\n' + T.success('  ✓ Model set to ') + T.accent(arg) + '\n')
      return { type: 'continue' }
    }

    // ── API keys ──────────────────────────────────────────────────────────────

    case '/apikey': {
      if (!arg) {
        console.log()
        console.log(T.brandBright.bold('  API Keys'))
        console.log(T.dim('  ' + '─'.repeat(46)))
        const ak = state.config.apiKeys
        console.log(
          '  anthropic   ' +
            (ak.anthropic ? T.success('● set') : T.muted('not set'))
        )
        console.log(
          '  openrouter  ' +
            (ak.openrouter ? T.success('● set') : T.muted('not set'))
        )
        console.log()
        console.log(T.muted('  Usage: /apikey anthropic  sk-ant-…'))
        console.log(T.muted('         /apikey openrouter sk-or-…'))
        console.log()
        return { type: 'continue' }
      }

      const [providerName, key] = parts.slice(1)
      if (!key) {
        console.log('\n' + T.error('  ✗ Usage: /apikey <provider> <key>\n'))
        return { type: 'continue' }
      }

      if (providerName === 'anthropic') {
        state.config.apiKeys.anthropic = key
      } else if (providerName === 'openrouter') {
        state.config.apiKeys.openrouter = key
      } else {
        console.log('\n' + T.error(`  ✗ Unknown provider: ${providerName}\n`))
        return { type: 'continue' }
      }

      // If the saved key matches the active provider, hot-swap the client
      const detected = detectProvider(key)
      if (detected === state.config.provider) {
        state.provider = createProvider({ provider: detected, apiKey: key })
      }

      saveConfig(state.config)
      console.log('\n' + T.success(`  ✓ ${providerName} API key saved\n`))
      return { type: 'continue' }
    }

    // ── Config ────────────────────────────────────────────────────────────────

    case '/approve':
      state.autoApprove = !state.autoApprove
      console.log(
        '\n' +
          (state.autoApprove
            ? T.warn('  ⚡ Auto-approve ON  (sensitive tools still confirm)\n')
            : T.success(
                '  ✓ Auto-approve OFF  —  will confirm all tool actions\n'
              ))
      )
      return { type: 'continue' }

    case '/system':
      if (arg) {
        state.config.systemPrompt = arg
        saveConfig(state.config)
        console.log('\n' + T.success('  ✓ System prompt updated\n'))
      } else {
        console.log('\n  ' + T.muted(state.config.systemPrompt) + '\n')
      }
      return { type: 'continue' }

    // ── Info ──────────────────────────────────────────────────────────────────

    case '/help':
      printHelp()
      return { type: 'continue' }

    case '/tools':
      printTools(state.config.mcpServers ?? [])
      return { type: 'continue' }

    case '/accounts': {
      const servers = state.config.mcpServers ?? []
      if (servers.length === 0) {
        console.log('\n' + T.muted('  No MCP accounts configured.\n'))
        return { type: 'continue' }
      }
      console.log()
      console.log(T.brandBright.bold('  Connected Accounts'))
      console.log(T.dim('  ' + '─'.repeat(46)))
      for (const s of servers) {
        const available = state.provider.supportsMcp
        console.log(
          '  ' +
            (available ? T.success('● ') : T.warn('○ ')) +
            T.white(s.name.padEnd(14)) +
            T.muted(s.url) +
            (!available
              ? T.warn('  (unavailable on ' + state.config.provider + ')')
              : '')
        )
      }
      console.log()
      return { type: 'continue' }
    }

    case '/tokens':
      console.log(
        '\n' +
          T.muted('  In: ') +
          T.accent(String(state.totalIn)) +
          '  ' +
          T.muted('Out: ') +
          T.accent(String(state.totalOut)) +
          '  ' +
          T.muted('Total: ') +
          T.brandBright(String(state.totalIn + state.totalOut)) +
          '\n'
      )
      return { type: 'continue' }

    case '/copy':
      if (state.lastResponse) {
        console.log('\n' + renderMarkdown(state.lastResponse) + '\n')
      } else {
        console.log('\n' + T.muted('  No response yet.\n'))
      }
      return { type: 'continue' }

    case '/version':
      console.log('\n' + T.muted('  opensage v') + T.accent(VERSION) + '\n')
      return { type: 'continue' }

    default:
      console.log('\n' + T.warn(`  Unknown command: ${cmd}  ·  type /help\n`))
      return { type: 'continue' }
  }
}
