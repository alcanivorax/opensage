import {
  SAFE_TOOLS,
  executeTool,
  toolLabel,
  getAllTools,
} from './tools/index.js'
import type { Provider, ToolCall, ToolDefinition } from './providers/index.js'
import type { Config, Message } from './config.js'
import type { Phase, AgentCallbacks, AgentResult } from './types/agent.js'

function toToolDefs(): ToolDefinition[] {
  return getAllTools().map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    parameters: tool.input_schema as Record<string, unknown>,
  }))
}

function isSensitive(name: string, sensitiveTools: string[]): boolean {
  return sensitiveTools.some((s) => name === s || name.startsWith(s))
}

function isAutoApproved(name: string): boolean {
  return SAFE_TOOLS.has(name)
}

function toolAction(name: string): string {
  const map: Record<string, string> = {
    web_search: 'searching…',
    web_fetch: 'fetching…',
    read_file: 'reading…',
    write_file: 'writing…',
    run_command: 'running…',
    save_memory: 'saving…',
    gmail_send: 'sending email…',
    gmail_list: 'fetching emails…',
  }
  return map[name] ?? 'running…'
}

const MAX_ITERATIONS = 20

export async function runAgentLoop(
  provider: Provider,
  config: Config,
  messages: Message[],
  autoApprove: boolean,
  callbacks?: AgentCallbacks
): Promise<AgentResult> {
  let lastText = ''
  let inputTokens = 0
  let outputTokens = 0

  const setPhase = (p: Phase) => {
    callbacks?.onPhaseChange?.(p)
  }

  if (!provider.supportsMcp && (config.mcpServers?.length ?? 0) > 0) {
    console.warn(
      '[opensage] MCP servers configured but not supported by provider'
    )
  }
  const mcpServers = provider.supportsMcp ? (config.mcpServers ?? []) : []

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    setPhase({ type: 'thinking' })
    callbacks?.onStreamText?.('')

    let currentText = ''
    const toolCalls: ToolCall[] = []
    const streamBuf = { text: '' }

    try {
      for await (const event of provider.stream({
        model: config.model,
        maxTokens: config.maxTokens,
        system: config.systemPrompt,
        messages,
        tools: toToolDefs(),
        mcpServers,
      })) {
        switch (event.type) {
          case 'text_delta': {
            setPhase({ type: 'streaming', text: '' })
            currentText += event.text
            streamBuf.text += event.text
            callbacks?.onStreamText?.(streamBuf.text)
            break
          }
          case 'tool_done': {
            toolCalls.push({
              id: event.id,
              name: event.name,
              input: event.input,
              isMcp: event.isMcp,
            })
            break
          }
          case 'end': {
            inputTokens += event.inputTokens
            outputTokens += event.outputTokens
            break
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Stream error: ${message}`)
    }

    if (currentText) lastText = currentText

    const assistantContent: unknown[] = []
    if (currentText) assistantContent.push({ type: 'text', text: currentText })
    for (const tc of toolCalls) {
      assistantContent.push({
        type: tc.isMcp ? 'mcp_tool_use' : 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })
    }
    messages.push({ role: 'assistant', content: assistantContent })

    if (toolCalls.length === 0) {
      setPhase({
        type: 'done',
        inputTokens,
        outputTokens,
        providerName: provider.name,
      })
      break
    }

    for (const call of toolCalls) {
      let approved = isAutoApproved(call.name)
      if (
        !approved &&
        autoApprove &&
        !isSensitive(call.name, config.sensitiveTools ?? [])
      ) {
        approved = true
      }

      if (!approved) {
        approved = await new Promise<boolean>((resolve) => {
          setPhase({
            type: 'tool_confirm',
            call,
            onResolve: resolve,
          })
        })
      }

      if (!approved) {
        setPhase({ type: 'idle' })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: call.id,
              content: 'User declined.',
            },
          ],
        })
        continue
      }

      const action = toolAction(call.name)
      setPhase({ type: 'tool_running', call, action })

      let result: string
      const t0 = Date.now()
      try {
        result = await executeTool(call.name, call.input)
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`
      }
      const elapsed = Date.now() - t0

      callbacks?.onToolHistory?.({ call, result, elapsed })
      setPhase({ type: 'idle' })

      messages.push({
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: call.id, content: result },
        ],
      })
    }
  }

  return { lastText, inputTokens, outputTokens }
}
