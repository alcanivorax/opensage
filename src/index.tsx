#!/usr/bin/env node

import * as fs from 'fs'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text, render, useApp } from 'ink'
import { loadConfig, resolveApiKey } from './config.js'
import { Banner, Goodbye, UserHeader, VERSION } from './ui/banner.js'
import { t } from './ui/theme.js'
import { AgentUI } from './ui/agent.js'
import { Prompt } from './ui/prompt.js'
import { runAgentLoop } from './agent.js'
import type { Phase, AgentCallbacks } from './types/agent.js'
import type { ToolCall } from './providers/index.js'
import { handleCommand, type CommandResult } from './commands.js'
import { createProvider, detectProvider } from './providers/index.js'
import { loadMemory, buildMemoryContext } from './tools/memory.js'
import { runSetupWizard } from './setup.js'
import type { SessionState } from './commands.js'
import type { Config } from './config.js'
import type { Provider } from './providers/index.js'

// ─── Pipe mode ────────────────────────────────────────────────────────────────

async function runPipeMode(provider: Provider, config: Config): Promise<void> {
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
  process.stdout.write('\n')
}

// ─── Interactive app ──────────────────────────────────────────────────────────

interface AppProps {
  initialProvider: Provider
  initialConfig: Config
}

function App({ initialProvider, initialConfig }: AppProps) {
  const { exit } = useApp()

  const [provider, setProvider] = useState<Provider>(initialProvider)
  const [config, setConfig] = useState<Config>(initialConfig)
  const [busy, setBusy] = useState(false)

  const [agentPhase, setAgentPhase] = useState<Phase>({ type: 'idle' })
  const [streamText, setStreamText] = useState('')
  const [toolHistory, setToolHistory] = useState<
    Array<{ call: ToolCall; result: string; elapsed: number }>
  >([])
  const [commandOutput, setCommandOutput] = useState<React.ReactNode>(null)
  const [userMessages, setUserMessages] = useState<string[]>([])
  const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)

  const handleConfirm = useCallback((ok: boolean) => {
    confirmResolveRef.current?.(ok)
    confirmResolveRef.current = null
  }, [])

  // SessionState lives in a ref-like object so agent/command mutations are
  // reflected immediately without triggering re-renders on every token.
  const [state] = useState<SessionState>(() => ({
    messages: [],
    totalIn: 0,
    totalOut: 0,
    lastResponse: '',
    lastUserMessage: '',
    autoApprove: initialConfig.autoApprove,
    config: initialConfig,
    provider: initialProvider,
  }))

  // Keep state in sync when provider/config change via /setup or /provider
  useEffect(() => {
    state.provider = provider
  }, [provider, state])

  useEffect(() => {
    state.config = config
  }, [config, state])

  const handleSubmit = useCallback(
    async (input: string) => {
      if (busy) return
      setBusy(true)
      setCommandOutput(null)

      try {
        // ── Command ──────────────────────────────────────────────────────────
        if (input.startsWith('/')) {
          const result = await handleCommand(input, state)

          switch (result.type) {
            case 'exit':
              exit()
              return

            case 'setup-complete':
              setProvider(state.provider)
              setConfig({ ...state.config })
              setBusy(false)
              return

            case 'output':
              setCommandOutput(result.content)
              setBusy(false)
              return

            case 'retry':
              state.lastUserMessage = result.message
              state.messages.push({ role: 'user', content: result.message })
              break

            default:
              if ('output' in result && result.output) {
                setCommandOutput(result.output)
              }
              setBusy(false)
              return
          }
        } else {
          // ── User message ─────────────────────────────────────────────────
          state.lastUserMessage = input
          state.messages.push({ role: 'user', content: input })
          setUserMessages((prev) => [...prev, input])
        }

        // ── Agent loop ───────────────────────────────────────────────────────
        setAgentPhase({ type: 'thinking' })
        setStreamText('')
        setToolHistory([])

        try {
          const { lastText, inputTokens, outputTokens } = await runAgentLoop(
            state.provider,
            state.config,
            state.messages,
            state.autoApprove,
            {
              onPhaseChange: (phase) => {
                if (phase.type === 'tool_confirm') {
                  confirmResolveRef.current = phase.onResolve
                }
                setAgentPhase(phase)
              },
              onStreamText: setStreamText,
              onToolHistory: (h) => setToolHistory((prev) => [...prev, h]),
            }
          )

          state.lastResponse = lastText
          state.totalIn += inputTokens
          state.totalOut += outputTokens
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          // Pop the user message that failed so it can be retried cleanly
          state.messages.pop()
          render(
            <Box marginTop={1}>
              <Text color={t.error}>{'✗ '}</Text>
              <Text color={t.white}>{msg}</Text>
            </Box>
          )
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, exit, state]
  )

  return (
    <Box flexDirection="column">
      <Banner
        providerName={config.provider}
        model={config.model}
        mcpServers={config.mcpServers ?? []}
      />
      {commandOutput}
      {userMessages.map((msg, i) => (
        <Box key={i} marginTop={1}>
          <Text color={t.user}>{' you'}</Text>
          <Text color={t.dim}>{' › '}</Text>
          <Text>{msg}</Text>
        </Box>
      ))}
      <AgentUI
        phase={agentPhase}
        model={config.model}
        streamText={streamText}
        toolHistory={toolHistory}
        onConfirm={handleConfirm}
      />
      <Prompt onSubmit={handleSubmit} disabled={busy} />
    </Box>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let config = loadConfig()
  let apiKey = resolveApiKey(config)

  if (!apiKey) {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        'No API key. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.\n'
      )
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

  // Inject memory into system prompt before first render
  const memories = loadMemory()
  if (memories.length > 0) {
    config.systemPrompt += buildMemoryContext(memories)
  }

  const provider = createProvider({ provider: config.provider, apiKey })

  if (!process.stdin.isTTY) {
    await runPipeMode(provider, config)
    return
  }

  // Interactive Ink app — waits until exit() is called from within
  await new Promise<void>((resolve) => {
    const { unmount } = render(
      <App initialProvider={provider} initialConfig={config} />,
      { exitOnCtrlC: true }
    )

    // exitOnCtrlC triggers process exit directly; this handles /exit
    process.on('exit', () => {
      unmount()
      resolve()
    })
  })
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write('✗ Fatal: ' + msg + '\n')
  process.exit(1)
})
