import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from './theme.js'

export function UserHeader() {
  const label = ' you '
  const W = CONTENT_WIDTH
  const pad = Math.floor((W - label.length) / 2)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text>{' '.repeat(Math.max(0, pad))}</Text>
        <Text color={t.user} bold>
          {label}
        </Text>
        <Text>{' '.repeat(Math.max(0, W - pad - label.length))}</Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}

export function AssistantHeader({ model }: { model: string }) {
  const modelShort = model.includes('/') ? model.split('/').pop()! : model
  const inner = ` sage · ${modelShort} `
  const W = CONTENT_WIDTH
  const pad = Math.floor((W - inner.length) / 2)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text>{' '.repeat(Math.max(0, pad))}</Text>
        <Text color={t.assistant}> sage </Text>
        <Text color={t.muted}>· {modelShort} </Text>
        <Text>{' '.repeat(Math.max(0, W - pad - inner.length))}</Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}

export function ToolCallHeader({
  name,
  hint,
}: {
  name: string
  hint?: string
}) {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text color={t.tool}> ⚡</Text>
        <Text color={t.white} bold>
          {' ' + name}
        </Text>
        {hint && <Text color={t.dim}> · </Text>}
        {hint && <Text color={t.muted}>{hint.slice(0, 40)}</Text>}
        <Text color={t.dim}>
          {' '.repeat(Math.max(0, W - name.length - 50))}
        </Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}
