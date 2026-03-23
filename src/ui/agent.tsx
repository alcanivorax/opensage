import React, { useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { t, CONTENT_WIDTH } from './theme.js'
import { AssistantHeader } from './banner.js'
import {
  ThinkingSpinner,
  MarkdownView,
  ConfirmDialog,
  ToolResult,
  TokenFooter,
} from './render.js'
import { toolLabel } from '../tools/index.js'
import type { Phase, AgentCallbacks } from '../types/agent.js'
import type { ToolCall } from '../providers/index.js'

const CODE_W = CONTENT_WIDTH - 4

function buildConfirmDetails(
  call: ToolCall,
  sensitiveTools: string[]
): Record<string, string> {
  const { name, input } = call

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
    return details
  }
  if (['create_event', 'update_event'].includes(name)) {
    const details: Record<string, string> = {}
    if (input['title'] ?? input['summary'])
      details['Title'] = String(input['title'] ?? input['summary'])
    if (input['start']) details['Start'] = String(input['start'])
    return details
  }
  if (name === 'write_file') return { File: String(input['path'] ?? '') }
  if (name === 'run_command')
    return { Command: String(input['command'] ?? '').slice(0, 60) }

  return { Preview: toolLabel(name, input).slice(0, 80) }
}

function ToolCallBox({ call }: { call: ToolCall }) {
  const hint = toolLabel(call.name, call.input)
  const W = 64
  return (
    <Box flexDirection="column">
      <Text color={t.dim}>{'  ┌' + '─'.repeat(W) + '┐'}</Text>
      <Text color={t.dim}>{'  │'}</Text>
      <Box>
        <Text color={t.dim}>{'  │ '}</Text>
        {call.isMcp ? (
          <Text color={t.assistant}>✉ </Text>
        ) : (
          <Text color={t.tool}>⚡ </Text>
        )}
        <Text color={t.white} bold>
          {call.name}
        </Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.muted}>{hint.slice(0, 35)}</Text>
      </Box>
      <Text color={t.dim}>{'  │'}</Text>
      <Text color={t.dim}>{'  └' + '─'.repeat(W) + '┘'}</Text>
    </Box>
  )
}

const COMPACT_TOOLS = new Set(['web_search', 'web_fetch', 'read_file'])

interface AgentUIProps {
  phase: Phase
  model: string
  streamText: string
  toolHistory: Array<{ call: ToolCall; result: string; elapsed: number }>
  onConfirm: (ok: boolean) => void
}

export function AgentUI({
  phase,
  model,
  streamText,
  toolHistory,
  onConfirm,
}: AgentUIProps) {
  useInput((input) => {
    if (phase.type === 'tool_confirm') {
      const ans = input.trim().toLowerCase()
      if (['y', 'yes', ''].includes(ans) || input === '\r') {
        onConfirm(true)
      } else if (['n', 'no'].includes(ans)) {
        onConfirm(false)
      }
    }
  })

  return (
    <Box flexDirection="column">
      <AssistantHeader model={model} />

      {phase.type === 'thinking' && <ThinkingSpinner />}

      {toolHistory.map((h, i) => (
        <Box flexDirection="column" key={i}>
          <ToolCallBox call={h.call} />
          <ToolResult
            toolName={h.call.name}
            result={h.result}
            elapsed={h.elapsed}
            compact={COMPACT_TOOLS.has(h.call.name)}
          />
        </Box>
      ))}

      {phase.type === 'tool_confirm' && (
        <Box flexDirection="column">
          <ToolCallBox call={phase.call} />
          <ConfirmDialog
            name={phase.call.name}
            details={buildConfirmDetails(phase.call, [])}
            sensitive={false}
          />
        </Box>
      )}

      {phase.type === 'tool_running' && (
        <Box flexDirection="column">
          <ToolCallBox call={phase.call} />
          <Box>
            <Text color={t.dim}>{'  │ '}</Text>
            <Text color={t.muted}>↻ {phase.action}</Text>
          </Box>
        </Box>
      )}

      {(phase.type === 'streaming' || phase.type === 'done' || streamText) &&
        streamText.length > 0 && <MarkdownView text={streamText} />}

      {phase.type === 'done' && (
        <TokenFooter
          inputTokens={phase.inputTokens}
          outputTokens={phase.outputTokens}
          providerName={phase.providerName}
        />
      )}
    </Box>
  )
}
