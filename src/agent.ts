import * as readline from 'readline'
import ora from 'ora'
import chalk from 'chalk'
import { T } from './ui/theme.js'
import { StreamRenderer } from './ui/render.js'
import {
  SAFE_TOOLS,
  COMPACT_TOOLS,
  executeTool,
  toolLabel,
  compactSummary,
} from './tools/index.js'

// ─── Tool display helpers ─────────────────────────────────────────────────────

/** Verb shown in the spinner while the tool runs. */
function toolActionText(name: string): string {
  switch (name) {
    case 'web_search':
      return 'searching…'
    case 'web_fetch':
      return 'fetching…'
    case 'read_file':
      return 'reading…'
    case 'gmail_list':
      return 'fetching emails…'
    case 'gmail_read':
      return 'reading email…'
    case 'gmail_send':
      return 'sending email…'
    case 'gmail_draft':
      return 'saving draft…'
    case 'download_file':
      return 'downloading…'
    case 'get_system_info':
      return 'checking system…'
    case 'read_clipboard':
      return 'reading clipboard…'
    case 'write_clipboard':
      return 'copying to clipboard…'
    case 'open_path':
      return 'opening…'
    case 'save_memory':
      return 'saving…'
    default:
      return 'running…'
  }
}

import { TOOLS as LOCAL_TOOLS } from './tools/index.js'
import type { Provider, ToolCall, ToolDefinition } from './providers/index.js'
import type { Config, Message } from './config.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentResult {
  lastText: string
  inputTokens: number
  outputTokens: number
}

// ─── Tool definitions converter ───────────────────────────────────────────────

function toToolDefs(): ToolDefinition[] {
  return LOCAL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    parameters: t.input_schema as Record<string, unknown>,
  }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSensitive(name: string, sensitiveTools: string[]): boolean {
  return sensitiveTools.some((s) => name === s || name.startsWith(s))
}

function isAutoApproved(name: string): boolean {
  return SAFE_TOOLS.has(name)
}

function fmtInput(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v, null, 2)
      const lines = val.split('\n')
      return lines.length === 1
        ? `${k}: ${val}`
        : `${k}:\n` + lines.map((l) => `  ${l}`).join('\n')
    })
    .join('\n')
}

// ─── Confirm prompt ───────────────────────────────────────────────────────────

async function confirmTool(
  rl: readline.Interface,
  call: ToolCall,
  autoApprove: boolean,
  sensitiveTools: string[]
): Promise<boolean> {
  if (isAutoApproved(call.name)) return true
  if (autoApprove && !isSensitive(call.name, sensitiveTools)) return true

  const { name, input } = call
  const SEP = T.dim('  ┌' + '─'.repeat(52))
  const END = T.dim('  └' + '─'.repeat(52))

  console.log()

  if (
    ['send_email', 'create_draft', 'reply_to_email', 'forward_email'].includes(
      name
    )
  ) {
    console.log(T.warn(`  ✉  ${name.replace(/_/g, ' ').toUpperCase()}`))
    console.log(SEP)
    if (input['to'])
      console.log(
        T.dim('  │  ') + T.muted('To:      ') + T.white(String(input['to']))
      )
    if (input['cc'])
      console.log(
        T.dim('  │  ') + T.muted('Cc:      ') + T.white(String(input['cc']))
      )
    if (input['subject'])
      console.log(
        T.dim('  │  ') +
          T.muted('Subject: ') +
          T.white(String(input['subject']))
      )
    const body = String(input['body'] ?? input['message'] ?? '')
    if (body) {
      console.log(T.dim('  │  ') + T.muted('Body:'))
      body
        .split('\n')
        .slice(0, 12)
        .forEach((l) => console.log(T.dim('  │    ') + T.white(l)))
      const extra = body.split('\n').length - 12
      if (extra > 0)
        console.log(T.dim('  │    ') + T.muted(`… +${extra} more lines`))
    }
    console.log(END)
  } else if (['create_event', 'update_event'].includes(name)) {
    console.log(T.warn(`  📅  ${name.replace(/_/g, ' ').toUpperCase()}`))
    console.log(SEP)
    const title = input['title'] ?? input['summary']
    if (title)
      console.log(
        T.dim('  │  ') + T.muted('Title:    ') + T.white(String(title))
      )
    if (input['start'])
      console.log(
        T.dim('  │  ') + T.muted('Start:    ') + T.white(String(input['start']))
      )
    if (input['end'])
      console.log(
        T.dim('  │  ') + T.muted('End:      ') + T.white(String(input['end']))
      )
    if (input['attendees'])
      console.log(
        T.dim('  │  ') +
          T.muted('Guests:   ') +
          T.white(JSON.stringify(input['attendees']))
      )
    if (input['location'])
      console.log(
        T.dim('  │  ') +
          T.muted('Location: ') +
          T.white(String(input['location']))
      )
    console.log(END)
  } else if (name === 'run_command') {
    console.log(T.tool('  ⚡ run_command'))
    console.log(SEP)
    console.log(T.dim('  │  ') + chalk.yellow(String(input['command'] ?? '')))
    if (input['cwd'])
      console.log(T.dim('  │  ') + T.muted('cwd: ' + String(input['cwd'])))
    console.log(END)
  } else if (name === 'write_file') {
    console.log(
      T.tool('  ⚡ write_file') +
        T.dim('  →  ') +
        T.accent(String(input['path'] ?? ''))
    )
    console.log(SEP)
    const lines = String(input['content'] ?? '').split('\n')
    lines.slice(0, 6).forEach((l) => console.log(T.dim('  │  ') + T.muted(l)))
    if (lines.length > 6)
      console.log(T.dim('  │  ') + T.muted(`… +${lines.length - 6} more lines`))
    console.log(END)
  } else {
    console.log(T.tool(`  ⚡ ${name}`))
    console.log(SEP)
    fmtInput(input)
      .split('\n')
      .slice(0, 10)
      .forEach((l) => console.log(T.dim('  │  ') + T.muted(l)))
    console.log(END)
  }

  return new Promise((resolve) => {
    rl.question(
      T.warn('  Proceed? ') + T.muted('[y / n / a = always]  ') + T.dim('› '),
      (ans) => {
        const a = ans.trim().toLowerCase()
        resolve(['y', 'yes', '', 'a'].includes(a))
      }
    )
  })
}

// ─── Tool result display ──────────────────────────────────────────────────────

function printToolResult(
  toolName: string,
  result: string,
  elapsed: number
): void {
  const t = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`

  if (COMPACT_TOOLS.has(toolName)) {
    // Single status line — result is internal data for the AI, not the user
    const summary = compactSummary(toolName, result)
    const isError =
      result.startsWith('Error:') ||
      result.startsWith('Fetch error:') ||
      result.startsWith('Search error:')
    console.log(
      T.dim('  ↳ ') +
        (isError
          ? T.error('✗  ' + summary)
          : T.success('✓  ') + T.muted(summary)) +
        T.dim('  ·  ') +
        T.muted(t)
    )
    return
  }

  // Full box for exec / write tools
  const lines = result.split('\n')
  console.log(T.dim('  ┌─ result  ') + T.success('✓ ') + T.muted(t))
  lines
    .slice(0, 10)
    .forEach((l) => console.log(T.dim('  │  ') + T.muted(l.slice(0, 120))))
  if (lines.length > 10)
    console.log(T.dim('  │  ') + T.muted(`… +${lines.length - 10} more lines`))
  console.log(T.dim('  └' + '─'.repeat(52)))
}

// ─── Token footer ─────────────────────────────────────────────────────────────

function printTurnFooter(
  inputTokens: number,
  outputTokens: number,
  providerName: string
): void {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  console.log(
    '\n' +
      T.dim('  ─── ') +
      T.muted(`${fmt(inputTokens)} in  ·  ${fmt(outputTokens)} out`) +
      T.dim('  ·  ') +
      T.muted(providerName) +
      T.dim('  ' + '─'.repeat(20))
  )
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

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
    // ── AI turn header ───────────────────────────────────────────────────────
    const modelShort = config.model.split('/').pop()!
    process.stdout.write(
      '\n  ' + T.brandBright('✦ ') + T.muted(modelShort) + '\n\n'
    )

    // ── State for this turn ──────────────────────────────────────────────────
    let currentText = ''
    const toolCalls: ToolCall[] = []
    let firstToken = true // has any output been written yet?
    let lastWasNewline = false

    const renderer = new StreamRenderer()

    // ── Spinner while waiting for the first token ────────────────────────────
    const spinner = ora({
      spinner: 'dots2',
      color: 'gray',
      prefixText: '  ',
      text: T.dim('thinking…'),
    }).start()

    // ── Stream loop ──────────────────────────────────────────────────────────
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
            spinner.stop()
            process.stdout.write('\r\x1b[2K') // clear spinner line
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
            spinner.stop()
            process.stdout.write('\r\x1b[2K')
            firstToken = false
          }
          // Flush any buffered text and ensure we're on a new line
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
            // The model responded with only tool calls and no text
            spinner.stop()
            process.stdout.write('\r\x1b[2K')
            firstToken = false
          }
          inputTokens += event.inputTokens
          outputTokens += event.outputTokens
          break
        }
      }
    }

    // Flush any remaining buffered content from the renderer
    const finalFlush = renderer.flush()
    if (finalFlush) {
      process.stdout.write(finalFlush)
      lastWasNewline = finalFlush.endsWith('\n')
    }

    if (currentText) {
      lastText = currentText
      if (!lastWasNewline) process.stdout.write('\n')
    }

    // ── Build assistant history entry ────────────────────────────────────────
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

    // ── No tool calls → this turn is complete ────────────────────────────────
    if (toolCalls.length === 0) {
      printTurnFooter(inputTokens, outputTokens, provider.name)
      break
    }

    // ── Execute tools ────────────────────────────────────────────────────────
    const toolResults: unknown[] = []

    for (const call of toolCalls) {
      const hint = String(toolLabel(call.name, call.input)).slice(0, 55)
      const header = call.isMcp
        ? '\n  ' + T.brandBright('✉  ') + T.white(call.name)
        : '\n  ' +
          T.tool('⚡ ') +
          T.white(call.name) +
          T.dim('  ·  ') +
          T.muted(hint)
      console.log(header)

      const approved = await confirmTool(
        rl,
        call,
        autoApprove,
        config.sensitiveTools ?? []
      )

      if (!approved) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: 'User declined.',
        })
        console.log(T.muted('  ↳ skipped'))
        continue
      }

      if (call.isMcp) {
        console.log(T.success('  ↳ approved — executing via MCP…'))
        toolResults.push({
          type: 'mcp_tool_result',
          tool_use_id: call.id,
          content: '__pending__',
        })
      } else {
        process.stdout.write(T.dim('  ↳ ') + T.muted(toolActionText(call.name)))
        const t0 = Date.now()
        const result = await executeTool(call.name, call.input)
        const elapsed = Date.now() - t0
        process.stdout.write('\r\x1b[2K')
        printToolResult(call.name, result, elapsed)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: result,
        })
      }
    }

    // Push tool results back as a user message so the model can react
    const localResults = toolResults.filter(
      (r) => (r as any).type === 'tool_result'
    )
    if (localResults.length > 0) {
      messages.push({ role: 'user', content: localResults })
    }
  }

  return { lastText, inputTokens, outputTokens }
}
