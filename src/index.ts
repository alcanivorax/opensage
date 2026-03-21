#!/usr/bin/env node

import * as readline from 'readline'
import * as fs from 'fs'

import { loadConfig, resolveApiKey } from './config.js'
// import { printBanner, printGoodbye, printUserHeader } from './ui/banner.js'
import { printBanner, printGoodbye } from './ui/banner.js'
import { T } from './ui/theme.js'
import { runAgentLoop } from './agent.js'
import { handleCommand } from './commands.js'
import { createProvider, detectProvider } from './providers/index.js'
import { loadMemory, buildMemoryContext } from './tools/memory.js'
import { runSetupWizard } from './setup.js'
import type { SessionState } from './commands.js'

// ─── Pipe mode ────────────────────────────────────────────────────────────────

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

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      state.rl.question('\n' + T.user(' you') + ' ' + T.dim('›') + ' ', resolve)
    })

  while (true) {
    let input: string
    try {
      input = (await prompt()).trim()
    } catch {
      break
    }

    if (!input) continue

    if (input.startsWith('/')) {
      const result = await handleCommand(input, state)

      // if (result.type === 'exit') {
      //   printGoodbye()
      //   state.rl.close()
      //   process.exit(0)
      // }

      if (result.type === 'setup-complete') {
        printBanner(
          state.config.provider,
          state.config.model,
          state.config.mcpServers ?? []
        )
        continue
      }

      if (result.type === 'retry') {
        input = result.message
      } else {
        continue
      }
    }

    // temp changes
    // printUserHeader()
    // console.log(T.white('  ' + input))
    // console.log()

    state.lastUserMessage = input
    state.messages.push({ role: 'user', content: input })

    try {
      const { lastText, inputTokens, outputTokens } = await runAgentLoop(
        state.provider,
        state.config,
        state.messages,
        state.rl,
        state.autoApprove
      )

      state.lastResponse = lastText
      state.totalIn += inputTokens
      state.totalOut += outputTokens
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log()
      console.log(T.cross + ' ' + T.white(msg))
      console.log()
      state.messages.pop()
    }
  }

  printGoodbye()
  state.rl.close()
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let config = loadConfig()
  let apiKey = resolveApiKey(config)

  if (!apiKey) {
    if (!process.stdin.isTTY) {
      console.error('No API key. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.')
      process.exit(1)
    }

    const result = await runSetupWizard(config)
    config = result.config
    apiKey = result.apiKey
  }

  const detectedProvider = detectProvider(apiKey)
  if (detectedProvider !== config.provider) {
    config.provider = detectedProvider
    config.model =
      detectedProvider === 'openrouter'
        ? 'nvidia/nemotron-3-super-120b-a12b:free'
        : 'claude-sonnet-4-20250514'
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
  console.error(T.cross + ' ' + T.white('Fatal: ' + msg))
  process.exit(1)
})
