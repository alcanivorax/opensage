#!/usr/bin/env node

import * as fs from 'fs'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text, render, useApp } from 'ink'
import { loadConfig, resolveApiKey } from './config.js'
import { Banner } from './ui/banner.js'
import { UserMessage } from './ui/components/user-message.js'
import { StatusBar } from './ui/components/status-bar.js'
import { t } from './ui/theme.js'
import { AgentUI } from './ui/agent.js'
import { Prompt } from './ui/prompt.js'
import { runAgentLoop } from './agent.js'
import type { Phase } from './types/agent.js'
import type { ToolCall } from './providers/index.js'
import { handleCommand } from './commands/index.js'
import { createProvider, detectProvider } from './providers/index.js'
import { loadMemory, buildMemoryContext } from './tools/memory.js'
import { runSetupWizard } from './setup.js'
import type { SessionState } from './commands/index.js'
import type { Config } from './config.js'
import type { Provider } from './providers/index.js'

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

interface AppProps {
  initialProvider: Provider
  initialConfig: Config
}

interface ToolHistoryEntry {
  call: ToolCall
  result: string
  elapsed: number
}

type TranscriptEntry =
  | {
      id: string
      kind: 'user'
      content: string
    }
  | {
      id: string
      kind: 'assistant'
      model: string
      text: string
      toolHistory: ToolHistoryEntry[]
    }

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function App({ initialProvider, initialConfig }: AppProps) {
  const { exit } = useApp()

  const [provider, setProvider] = useState<Provider>(initialProvider)
  const [config, setConfig] = useState<Config>(initialConfig)
  const [busy, setBusy] = useState(false)

  const [agentPhase, setAgentPhase] = useState<Phase>({ type: 'idle' })
  const [streamText, setStreamText] = useState('')
  const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>([])
  const [commandOutput, setCommandOutput] = useState<React.ReactNode>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)

  const handleConfirm = useCallback((ok: boolean) => {
    confirmResolveRef.current?.(ok)
    confirmResolveRef.current = null
  }, [])

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
              setTranscript((prev) => [
                ...prev,
                {
                  id: makeId('user'),
                  kind: 'user',
                  content: result.message,
                },
              ])
              break

            default:
              if ('output' in result && result.output) {
                setCommandOutput(result.output)
              }
              setBusy(false)
              return
          }
        } else {
          state.lastUserMessage = input
          state.messages.push({ role: 'user', content: input })
          setTranscript((prev) => [
            ...prev,
            {
              id: makeId('user'),
              kind: 'user',
              content: input,
            },
          ])
        }

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
              onToolHistory: (h) =>
                setToolHistory((prev) => {
                  const next = [...prev, h]
                  return next
                }),
            }
          )

          state.lastResponse = lastText
          state.totalIn += inputTokens
          state.totalOut += outputTokens

          setTranscript((prev) => [
            ...prev,
            {
              id: makeId('assistant'),
              kind: 'assistant',
              model: state.config.model,
              text: lastText,
              toolHistory: [...toolHistory],
            },
          ])

          setAgentPhase({ type: 'idle' })
          setStreamText('')
          setToolHistory([])
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
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
    [busy, exit, state, toolHistory]
  )

  return (
    <Box flexDirection="column">
      <Banner
        providerName={config.provider}
        model={config.model}
        mcpServers={config.mcpServers ?? []}
      />

      {commandOutput}

      {transcript.map((entry) =>
        entry.kind === 'user' ? (
          <UserMessage key={entry.id} content={entry.content} />
        ) : (
          <AgentUI
            key={entry.id}
            phase={{
              type: 'done',
              inputTokens: 0,
              outputTokens: 0,
              providerName: provider.name,
            }}
            model={entry.model}
            streamText={entry.text}
            toolHistory={entry.toolHistory}
            onConfirm={handleConfirm}
          />
        )
      )}

      <AgentUI
        phase={agentPhase}
        model={config.model}
        streamText={streamText}
        toolHistory={toolHistory}
        onConfirm={handleConfirm}
      />

      <Prompt onSubmit={handleSubmit} disabled={busy} />

      <StatusBar
        model={config.model}
        provider={config.provider}
        inputTokens={state.totalIn}
        outputTokens={state.totalOut}
        autoApprove={state.autoApprove}
      />
    </Box>
  )
}

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

  const memories = loadMemory()
  if (memories.length > 0) {
    config.systemPrompt += buildMemoryContext(memories)
  }

  const provider = createProvider({ provider: config.provider, apiKey })

  if (!process.stdin.isTTY) {
    await runPipeMode(provider, config)
    return
  }

  await new Promise<void>((resolve) => {
    const { unmount } = render(
      <App initialProvider={provider} initialConfig={config} />,
      { exitOnCtrlC: true }
    )

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
