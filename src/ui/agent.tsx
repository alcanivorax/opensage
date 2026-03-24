import React from 'react'
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
import { COMPACT_TOOLS, compactSummary } from '../tools/index.js'
import type { Phase } from '../types/agent.js'
import type { ToolCall } from '../providers/index.js'

// ─── Confirm-dialog detail builders ──────────────────────────────────────────

function buildConfirmDetails(call: ToolCall): Record<string, string> {
  const { name, input } = call

  if (name === 'gmail_send' || name === 'gmail_draft') {
    const details: Record<string, string> = {}
    if (input['to']) details['To'] = String(input['to'])
    if (input['subject']) details['Subject'] = String(input['subject'])

    const body = String(input['body'] ?? input['message'] ?? '')
    if (body) {
      const firstLine = body.split('\n')[0].slice(0, 72)
      details['Body'] = firstLine + (body.includes('\n') ? '…' : '')
    }

    return details
  }

  if (name === 'write_file') {
    return { File: String(input['path'] ?? '') }
  }

  if (name === 'run_command') {
    return { Command: String(input['command'] ?? '').slice(0, 88) }
  }

  if (name === 'download_file') {
    return { URL: String(input['url'] ?? '').slice(0, 88) }
  }

  if (name === 'write_clipboard') {
    return { Text: String(input['text'] ?? '').slice(0, 72) }
  }

  if (name === 'create_event' || name === 'update_event') {
    const details: Record<string, string> = {}
    const title = input['title'] ?? input['summary']
    if (title) details['Title'] = String(title)
    if (input['start']) details['Start'] = String(input['start'])
    return details
  }

  const firstKey = Object.keys(input)[0]
  if (firstKey) {
    return { [firstKey]: String(input[firstKey]).slice(0, 88) }
  }

  return {}
}

// ─── Compact trace row ───────────────────────────────────────────────────────

function trim(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function CompactToolTrace({
  call,
  result,
  elapsed,
}: {
  call: ToolCall
  result: string
  elapsed: number
}) {
  const isError = result.startsWith('Error:')
  const tone = isError ? t.error : t.success
  const elapsedStr =
    elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`

  const summary = trim(compactSummary(call.name, result), 62)

  return (
    <Box marginTop={1}>
      <Text color={t.dim}>│ </Text>
      <Text color={tone}>{isError ? '●' : '●'}</Text>
      <Text color={t.dim}> </Text>
      <Text color={call.isMcp ? t.assistant : t.tool} bold>
        {call.name}
      </Text>
      <Text color={t.dim}>{'  ·  '}</Text>
      <Text color={t.dim}>{elapsedStr}</Text>
      <Text color={t.dim}>{'  ·  '}</Text>
      <Text color={t.muted}>{summary}</Text>
    </Box>
  )
}

function SectionDivider() {
  return (
    <Box marginTop={1}>
      <Text color={t.dim}>│ </Text>
      <Text color={t.borderSoft}>{'─'.repeat(82)}</Text>
    </Box>
  )
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

    const answer = input.trim().toLowerCase()

    if (['y', 'yes', ''].includes(answer) || input === '\r') {
      onConfirm(true)
    } else if (['n', 'no'].includes(answer)) {
      onConfirm(false)
    }
  })

  const showAssistant = phase.type !== 'idle'

  const compactHistory = toolHistory.filter((h) =>
    COMPACT_TOOLS.has(h.call.name)
  )
  const expandedHistory = toolHistory.filter(
    (h) => !COMPACT_TOOLS.has(h.call.name)
  )

  const showStream =
    streamText.length > 0 &&
    (phase.type === 'streaming' ||
      phase.type === 'done' ||
      phase.type === 'thinking')

  return (
    <Box flexDirection="column">
      {showAssistant && (
        <AssistantMessage model={model} phase={phase}>
          {phase.type === 'thinking' && (
            <Box marginTop={1}>
              <ThinkingIndicator label="thinking" />
            </Box>
          )}

          {compactHistory.length > 0 && (
            <Box flexDirection="column">
              {compactHistory.map((h, i) => (
                <CompactToolTrace
                  key={`${h.call.id}-${i}`}
                  call={h.call}
                  result={h.result}
                  elapsed={h.elapsed}
                />
              ))}
            </Box>
          )}

          {expandedHistory.length > 0 && (
            <Box flexDirection="column">
              {(compactHistory.length > 0 || phase.type === 'thinking') && (
                <SectionDivider />
              )}

              {expandedHistory.map((h, i) => (
                <Box key={`${h.call.id}-${i}`} flexDirection="column">
                  <ToolCallBox call={h.call} status="done" />
                  <ToolResultBox
                    call={h.call}
                    result={h.result}
                    elapsed={h.elapsed}
                    status={h.result.startsWith('Error:') ? 'error' : 'success'}
                  />
                </Box>
              ))}
            </Box>
          )}

          {phase.type === 'tool_confirm' && (
            <Box flexDirection="column">
              {(compactHistory.length > 0 || expandedHistory.length > 0) && (
                <SectionDivider />
              )}

              <ToolCallBox call={phase.call} status="pending" />
              <ConfirmDialog
                name={phase.call.name}
                details={buildConfirmDetails(phase.call)}
                sensitive={false}
              />
            </Box>
          )}

          {phase.type === 'tool_running' && (
            <Box flexDirection="column">
              {(compactHistory.length > 0 || expandedHistory.length > 0) && (
                <SectionDivider />
              )}

              <ToolCallBox
                call={phase.call}
                status="running"
                action={phase.action}
              />
            </Box>
          )}

          {showStream && (
            <Box flexDirection="column">
              {(compactHistory.length > 0 || expandedHistory.length > 0) && (
                <SectionDivider />
              )}

              <Box marginTop={1}>
                <MarkdownView text={streamText} />
              </Box>
            </Box>
          )}

          {phase.type === 'done' &&
            streamText.length === 0 &&
            toolHistory.length === 0 && (
              <Box marginTop={1}>
                <Text color={t.dim}>│ </Text>
                <Text color={t.subtle}>no output</Text>
              </Box>
            )}
        </AssistantMessage>
      )}
    </Box>
  )
}
