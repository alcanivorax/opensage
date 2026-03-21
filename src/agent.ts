import * as readline from 'readline'
import { T } from './ui/theme.js'
import {
  StreamRenderer,
  printConfirmDialog,
  printTokenFooter,
} from './ui/render.js'
import { printAssistantHeader } from './ui/banner.js'
import {
  SAFE_TOOLS,
  executeTool,
  toolLabel,
  compactSummary,
  COMPACT_TOOLS,
} from './tools/index.js'

function toolAction(name: string): string {
  switch (name) {
    case 'web_search':
      return 'searching…'
    case 'web_fetch':
      return 'fetching…'
    case 'read_file':
      return 'reading…'
    case 'write_file':
      return 'writing…'
    case 'run_command':
      return 'running…'
    case 'save_memory':
      return 'saving…'
    case 'gmail_send':
      return 'sending email…'
    case 'gmail_list':
      return 'fetching emails…'
    default:
      return 'running…'
  }
}

import { TOOLS as LOCAL_TOOLS } from './tools/index.js'
import type { Provider, ToolCall, ToolDefinition } from './providers/index.js'
import type { Config, Message } from './config.js'

export interface AgentResult {
  lastText: string
  inputTokens: number
  outputTokens: number
}

function toToolDefs(): ToolDefinition[] {
  return LOCAL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    parameters: t.input_schema as Record<string, unknown>,
  }))
}

function isSensitive(name: string, sensitiveTools: string[]): boolean {
  return sensitiveTools.some((s) => name === s || name.startsWith(s))
}

function isAutoApproved(name: string): boolean {
  return SAFE_TOOLS.has(name)
}

async function confirmTool(
  rl: readline.Interface,
  call: ToolCall,
  autoApprove: boolean,
  sensitiveTools: string[]
): Promise<boolean> {
  if (isAutoApproved(call.name)) return true
  if (autoApprove && !isSensitive(call.name, sensitiveTools)) return true

  const { name, input } = call

  // Email tools
  if (
    ['send_email', 'create_draft', 'reply_to_email', 'forward_email'].includes(
      name
    )
  ) {
    const details: Record<string, string> = {}
    if (input['to']) details['To'] = String(input['to'])
    if (input['subject']) details['Subject'] = String(input['subject'])
    const body = String(input['body'] ?? input['message'] ?? '')
    if (body)
      details['Body'] =
        body.split('\n')[0].slice(0, 50) + (body.includes('\n') ? '…' : '')
    printConfirmDialog(name.replace(/_/g, ' '), details, true)
  }
  // Calendar tools
  else if (['create_event', 'update_event'].includes(name)) {
    const details: Record<string, string> = {}
    if (input['title'] || input['summary'])
      details['Title'] = String(input['title'] ?? input['summary'])
    if (input['start']) details['Start'] = String(input['start'])
    printConfirmDialog(name.replace(/_/g, ' '), details, false)
  }
  // File write
  else if (name === 'write_file') {
    printConfirmDialog(
      'write_file',
      { File: String(input['path'] ?? '') },
      false
    )
  }
  // Command
  else if (name === 'run_command') {
    printConfirmDialog(
      'run_command',
      { Command: String(input['command'] ?? '').slice(0, 60) },
      true
    )
  }
  // Generic
  else {
    const preview = toolLabel(name, input)
    printConfirmDialog(
      name,
      { Preview: preview.slice(0, 80) },
      isSensitive(name, sensitiveTools)
    )
  }

  return new Promise((resolve) => {
    rl.question(
      T.warn('proceed?') + ' ' + T.muted('[y/n] ') + T.dim('› '),
      (ans) => {
        resolve(['y', 'yes', ''].includes(ans.trim().toLowerCase()))
      }
    )
  })
}

function printToolResult(
  toolName: string,
  result: string,
  elapsed: number
): void {
  const t = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`

  if (COMPACT_TOOLS.has(toolName)) {
    const summary = compactSummary(toolName, result)
    const isError =
      result.startsWith('Error:') || result.startsWith('Fetch error:')
    const icon = isError ? T.cross : T.check
    const text = isError ? T.error(summary) : T.success(summary)
    console.log(
      T.dim('  │ ') +
        icon +
        ' ' +
        T.tool(toolName) +
        T.dim(' · ') +
        text +
        T.dim(' · ') +
        T.muted(t)
    )
    return
  }

  const lines = result.split('\n')
  const isError = result.startsWith('Error:')

  console.log(T.dim('  │'))
  console.log(T.dim('  ├' + '─'.repeat(60) + '┤'))
  console.log(
    T.dim('  │ ') +
      T.muted('result ') +
      (isError ? T.error('✗') : T.success('✓')) +
      ' ' +
      T.muted(t)
  )

  for (const l of lines.slice(0, 6)) {
    console.log(T.dim('  │ ') + T.muted(l.slice(0, 80)))
  }
  if (lines.length > 6) {
    console.log(T.dim('  │ ') + T.muted(`… +${lines.length - 6} more`))
  }
  console.log(T.dim('  └' + '─'.repeat(60) + '┘'))
}

const MAX_ITERATIONS = 20

export async function runAgentLoop(
  provider: Provider,
  config: Config,
  messages: Message[],
  rl: readline.Interface,
  autoApprove: boolean
): Promise<AgentResult> {
  let lastText = ''
  let inputTokens = 0
  let outputTokens = 0

  const mcpServers = provider.supportsMcp ? (config.mcpServers ?? []) : []

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    printAssistantHeader(config.model)

    let currentText = ''
    const toolCalls: ToolCall[] = []
    let firstToken = true
    let lastWasNewline = false

    const renderer = new StreamRenderer()

    // Thinking indicator
    const frames = ['◌', '◐', '◓', '◒']
    let frameIdx = 0
    let thinkingInterval: NodeJS.Timeout | null = null

    const startThinking = () => {
      process.stdout.write('  ' + T.thinking('thinking…') + ' ')
      thinkingInterval = setInterval(() => {
        process.stdout.write(
          '\r  ' +
            T.dim(frames[frameIdx++ % 4]) +
            ' ' +
            T.muted('thinking…') +
            ' '
        )
      }, 120)
    }

    const stopThinking = () => {
      if (thinkingInterval) {
        clearInterval(thinkingInterval)
        thinkingInterval = null
      }
      process.stdout.write('\r\x1B[K')
    }

    startThinking()

    // Stream loop
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
          if (firstToken) {
            stopThinking()
            firstToken = false
          }
          const rendered = renderer.feed(event.text)
          if (rendered) {
            process.stdout.write(rendered)
            lastWasNewline = rendered.endsWith('\n')
          }
          currentText += event.text
          break
        }

        case 'tool_start': {
          if (firstToken) {
            stopThinking()
            firstToken = false
          }
          const flushed = renderer.flush()
          if (flushed) {
            process.stdout.write(flushed)
            lastWasNewline = flushed.endsWith('\n')
          }
          if (currentText && !lastWasNewline) {
            process.stdout.write('\n')
            lastWasNewline = true
          }
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
          if (firstToken) {
            stopThinking()
            firstToken = false
          }
          inputTokens += event.inputTokens
          outputTokens += event.outputTokens
          break
        }
      }
    }

    stopThinking()
    const finalFlush = renderer.flush()
    if (finalFlush) {
      process.stdout.write(finalFlush)
      lastWasNewline = finalFlush.endsWith('\n')
    }

    if (currentText) {
      lastText = currentText
      if (!lastWasNewline) process.stdout.write('\n')
    }

    // Build message
    const assistantContent: unknown[] = []
    if (currentText) {
      assistantContent.push({ type: 'text', text: currentText })
    }
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
      printTokenFooter(inputTokens, outputTokens, provider.name)
      break
    }

    // Execute tools
    console.log()

    for (const call of toolCalls) {
      const hint = toolLabel(call.name, call.input)

      console.log(T.dim('  ┌' + '─'.repeat(64) + '┐'))
      console.log(T.dim('  │'))
      const icon = call.isMcp ? T.assistant('✉') : T.toolIcon
      const line =
        icon +
        ' ' +
        T.white.bold(call.name) +
        T.dim(' · ') +
        T.muted(hint.slice(0, 35))
      console.log(
        T.dim('  │ ') +
          line +
          ' '.repeat(
            Math.max(0, 60 - hint.slice(0, 35).length - call.name.length)
          ) +
          T.dim('│')
      )
      console.log(T.dim('  │'))
      console.log(T.dim('  └' + '─'.repeat(64) + '┘'))

      const approved = await confirmTool(
        rl,
        call,
        autoApprove,
        config.sensitiveTools ?? []
      )

      if (!approved) {
        console.log(T.dim('  │ ') + T.muted('skipped'))
        console.log(T.dim('  └' + '─'.repeat(64) + '┘'))
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

      console.log(
        T.dim('  │ ') + T.executing + ' ' + T.muted(toolAction(call.name))
      )

      const t0 = Date.now()
      const result = await executeTool(call.name, call.input)
      const elapsed = Date.now() - t0

      printToolResult(call.name, result, elapsed)

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
