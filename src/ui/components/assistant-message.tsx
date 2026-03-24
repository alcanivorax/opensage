import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'
import type { Phase } from '../../types/agent.js'
import type { ToolCall } from '../../providers/index.js'

interface AssistantMessageProps {
  model: string
  phase: Phase
  children?: React.ReactNode
}

export function AssistantMessage({
  model,
  phase,
  children,
}: AssistantMessageProps) {
  const isThinking = phase.type === 'thinking'
  const isToolRunning = phase.type === 'tool_running'
  const isConfirming = phase.type === 'tool_confirm'

  const statusText = isThinking
    ? 'thinking'
    : isToolRunning
      ? 'running'
      : isConfirming
        ? 'waiting'
        : ''

  const statusColor = isThinking
    ? t.muted
    : isToolRunning
      ? t.accent
      : isConfirming
        ? t.warn
        : t.dim

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>{'┌'}</Text>
        <Text color={t.assistant}>◆ sage </Text>
        <Text color={t.dim}>·</Text>
        <Text color={t.muted}> {model.split('/').pop()}</Text>
        {statusText && (
          <>
            <Text color={t.dim}> · </Text>
            <Text color={statusColor}>{statusText}</Text>
          </>
        )}
        <Text color={t.dim}>
          {' '.repeat(Math.max(0, CONTENT_WIDTH - model.length - 25))}
        </Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      {children && (
        <Box flexDirection="column" paddingLeft={2} paddingRight={1}>
          {children}
        </Box>
      )}
      <Box>
        <Text color={t.dim}>{'└'}</Text>
        <Text color={t.dim}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}
