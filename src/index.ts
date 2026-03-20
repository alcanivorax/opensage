#!/usr/bin/env node

import * as readline from 'readline'
import * as fs from 'fs'
import chalk from 'chalk'

import { loadConfig, resolveApiKey } from './config.js'
import { printBanner } from './ui/banner.js'
import { T } from './ui/theme.js'
import { runAgentLoop } from './agent.js'
import { handleCommand } from './commands.js'
import { createProvider, detectProvider } from './providers/index.js'
import { loadMemory, buildMemoryContext } from './tools/memory.js'
import { runSetupWizard } from './setup.js'
import type { SessionState } from './commands.js'

// ─── Pipe mode ────────────────────────────────────────────────────────────────
//
//  Reads a single prompt from stdin and prints the raw response.
//  Useful for scripting: echo "summarise this" | supernano-bot

async function runPipeMode(
  provider: ReturnType<typeof createProvider>,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  const piped = fs.readFileSync('/dev/stdin', 'utf8').trim()
  if (!piped) return

  const response = await provider.chat({
    model: config.model,
    maxTokens: config.maxTokens,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: piped }],
    tools: [],
    mcpServers: [],
  })

  for (const text of response.textBlocks) process.stdout.write(text)
  console.log()
}

// ─── Interactive mode ─────────────────────────────────────────────────────────

async function runInteractive(
  provider: ReturnType<typeof createProvider>,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  // Inject persistent memory into the system prompt for this session
  const memories = loadMemory()
  if (memories.length > 0) {
    config.systemPrompt += buildMemoryContext(memories)
  }

  printBanner(config.provider, config.model, config.mcpServers ?? [])

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  })

  const state: SessionState = {
    messages: [],
    totalIn: 0,
    totalOut: 0,
    lastResponse: '',
    lastUserMessage: '',
    autoApprove: config.autoApprove,
    config,
    provider,
    rl,
  }

  // The prompt function reads from state.rl so that /setup can swap the
  // readline instance without breaking the main loop.
  const prompt = (): Promise<string> =>
    new Promise((resolve) =>
      state.rl.question('\n' + T.brand('  you ') + T.dim('›') + ' ', resolve)
    )

  while (true) {
    let input: string
    try {
      input = (await prompt()).trim()
    } catch {
      // readline closed (Ctrl-D)
      break
    }

    if (!input) continue

    // ── Slash commands ───────────────────────────────────────────────────────
    if (input.startsWith('/')) {
      const result = await handleCommand(input, state)

      if (result.type === 'exit') {
        state.rl.close()
        process.exit(0)
      }

      if (result.type === 'setup-complete') {
        // The wizard already printed its success banner.
        // Re-print the aichat banner so the user sees the new provider/model.
        printBanner(
          state.config.provider,
          state.config.model,
          state.config.mcpServers ?? []
        )
        continue
      }

      if (result.type === 'retry') {
        // Treat exactly like a fresh user message — fall through below
        input = result.message
      } else {
        continue
      }
    }

    // ── Agent turn ───────────────────────────────────────────────────────────
    state.lastUserMessage = input
    state.messages.push({ role: 'user', content: input })

    try {
      const { lastText, inputTokens, outputTokens } = await runAgentLoop(
        state.provider,
        state.config,
        state.messages,
        state.rl, // always use the current rl from state so /setup swaps work
        state.autoApprove
      )

      state.lastResponse = lastText
      state.totalIn += inputTokens
      state.totalOut += outputTokens
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('\n' + T.error(`  ✗ ${msg}\n`))
      // Remove the user message we just pushed so history stays clean
      state.messages.pop()
    }
  }

  state.rl.close()
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let config = loadConfig()
  let apiKey = resolveApiKey(config)

  if (!apiKey) {
    // Pipe mode cannot run an interactive wizard — exit with a helpful message
    if (!process.stdin.isTTY) {
      console.error(
        'No API key found. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.'
      )
      process.exit(1)
    }

    // Interactive mode: run the first-time setup wizard
    const result = await runSetupWizard(config)
    config = result.config
    apiKey = result.apiKey
  }

  // Auto-detect provider from key prefix if it was not set explicitly.
  // When the provider changes we also pick a sensible default model so the
  // user doesn't end up sending a "claude-sonnet-4-20250514" request to
  // OpenRouter (which would work but costs money instead of using a free model).
  const detectedProvider = detectProvider(apiKey)
  if (detectedProvider !== config.provider) {
    config.provider = detectedProvider
    if (detectedProvider === 'openrouter') {
      config.model = 'google/gemini-2.0-flash-exp:free'
    } else if (detectedProvider === 'anthropic') {
      config.model = 'claude-sonnet-4-20250514'
    }
  }

  const provider = createProvider({ provider: config.provider, apiKey })

  if (!process.stdin.isTTY) {
    await runPipeMode(provider, config)
  } else {
    await runInteractive(provider, config)
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(chalk.red('Fatal: ' + msg))
  process.exit(1)
})
