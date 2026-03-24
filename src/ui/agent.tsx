import React, { useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { t } from './theme.js'
import {
  AssistantMessage,
  ToolCallBox,
  ToolResultBox,
  ThinkingIndicator,
  ConfirmDialog,
} from './components/index.js'
import { MarkdownView } from './render.js'
import type { Phase } from '../types/agent.js'
import type { ToolCall } from '../providers/index.js'

function buildConfirmDetails(
  call: ToolCall,
  _sensitiveTools: string[]
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

  return {}
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

  const showAssistant = phase.type !== 'idle'

  return (
    <Box flexDirection="column">
      {showAssistant && (
        <AssistantMessage model={model} phase={phase}>
          {phase.type === 'thinking' && <ThinkingIndicator />}

          {toolHistory.map((h, i) => (
            <Box key={i} flexDirection="column" marginTop={1}>
              <ToolCallBox call={h.call} status="done" />
              <ToolResultBox
                call={h.call}
                result={h.result}
                elapsed={h.elapsed}
                status={h.result.startsWith('Error:') ? 'error' : 'success'}
              />
            </Box>
          ))}

          {phase.type === 'tool_confirm' && (
            <Box flexDirection="column" marginTop={1}>
              <ToolCallBox call={phase.call} status="pending" />
              <ConfirmDialog
                name={phase.call.name}
                details={buildConfirmDetails(phase.call, [])}
                sensitive={false}
              />
            </Box>
          )}

          {phase.type === 'tool_running' && (
            <Box marginTop={1}>
              <ToolCallBox
                call={phase.call}
                status="running"
                action={phase.action}
              />
            </Box>
          )}

          {(phase.type === 'streaming' ||
            phase.type === 'done' ||
            streamText) &&
            streamText.length > 0 && (
              <Box marginTop={1}>
                <MarkdownView text={streamText} />
              </Box>
            )}
        </AssistantMessage>
      )}
    </Box>
  )
}
