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
import { COMPACT_TOOLS } from '../tools/index.js'
import type { Phase } from '../types/agent.js'
import type { ToolCall } from '../providers/index.js'

// ─── Confirm-dialog detail builders ──────────────────────────────────────────

/**
 * Extract the most relevant fields from a tool call to show in the
 * confirmation dialog. Returns a flat key→value map.
 */
function buildConfirmDetails(call: ToolCall): Record<string, string> {
  const { name, input } = call

  // Gmail write actions (built-in tools)
  if (name === 'gmail_send' || name === 'gmail_draft') {
    const details: Record<string, string> = {}
    if (input['to']) details['To'] = String(input['to'])
    if (input['subject']) details['Subject'] = String(input['subject'])
    const body = String(input['body'] ?? input['message'] ?? '')
    if (body) {
      const firstLine = body.split('\n')[0].slice(0, 60)
      details['Body'] = firstLine + (body.includes('\n') ? '…' : '')
    }
    return details
  }

  // File system mutations
  if (name === 'write_file') {
    return { File: String(input['path'] ?? '') }
  }
  if (name === 'run_command') {
    return { Command: String(input['command'] ?? '').slice(0, 80) }
  }
  if (name === 'download_file') {
    return { URL: String(input['url'] ?? '').slice(0, 80) }
  }

  // Clipboard write
  if (name === 'write_clipboard') {
    return { Text: String(input['text'] ?? '').slice(0, 60) }
  }

  // MCP calendar tools (kept for compatibility if MCP servers are added)
  if (name === 'create_event' || name === 'update_event') {
    const details: Record<string, string> = {}
    const title = input['title'] ?? input['summary']
    if (title) details['Title'] = String(title)
    if (input['start']) details['Start'] = String(input['start'])
    return details
  }

  // For any other tool that requires confirmation, show the first input field
  const firstKey = Object.keys(input)[0]
  if (firstKey) {
    return { [firstKey]: String(input[firstKey]).slice(0, 80) }
  }

  return {}
}

// ─── AgentUI ──────────────────────────────────────────────────────────────────

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
    if (phase.type !== 'tool_confirm') return
    const ans = input.trim().toLowerCase()
    if (['y', 'yes', ''].includes(ans) || input === '\r') {
      onConfirm(true)
    } else if (['n', 'no'].includes(ans)) {
      onConfirm(false)
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
                details={buildConfirmDetails(phase.call)}
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

          {streamText.length > 0 &&
            (phase.type === 'streaming' ||
              phase.type === 'done' ||
              phase.type === 'thinking') && (
              <Box marginTop={1}>
                <MarkdownView text={streamText} />
              </Box>
            )}
        </AssistantMessage>
      )}
    </Box>
  )
}
