import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'
import type { Phase } from '../../types/agent.js'

interface AssistantMessageProps {
  model: string
  phase: Phase
  children?: React.ReactNode
}

function getStatus(phase: Phase): { label: string; color: string } | null {
  switch (phase.type) {
    case 'thinking':
      return { label: 'thinking', color: t.muted }
    case 'tool_running':
      return { label: 'running tools', color: t.accent }
    case 'tool_confirm':
      return { label: 'awaiting approval', color: t.warn }
    case 'streaming':
      return { label: 'responding', color: t.assistant }
    case 'done':
      return { label: 'done', color: t.dim }
    default:
      return null
  }
}

export function AssistantMessage({
  model,
  phase,
  children,
}: AssistantMessageProps) {
  const modelShort = model.includes('/') ? model.split('/').pop()! : model
  const status = getStatus(phase)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>

        <Text color={t.assistant} bold>
          sage
        </Text>

        <Text color={t.dim}>{'  ·  '}</Text>

        <Text color={t.muted}>{modelShort}</Text>

        {status && (
          <>
            <Text color={t.dim}>{'  ·  '}</Text>
            <Text color={status.color}>{status.label}</Text>
          </>
        )}

        <Box flexGrow={1} />

        <Text color={t.dim}>assistant</Text>
        <Text color={t.dim}> │</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
      </Box>

      {children && (
        <Box flexDirection="column" paddingLeft={2} paddingRight={2}>
          {children}
        </Box>
      )}

      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}
