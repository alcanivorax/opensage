import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'

interface ConfirmDialogProps {
  name: string
  details: Record<string, string>
  sensitive?: boolean
}

function trim(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + '…' : value
}

export function ConfirmDialog({
  name,
  details,
  sensitive = false,
}: ConfirmDialogProps) {
  const tone = sensitive ? t.warn : t.accent
  const title = sensitive ? 'approval required' : 'confirm action'
  const hint = sensitive
    ? 'This action may change local or external state.'
    : 'Review the action before continuing.'

  const entries = Object.entries(details)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={tone}>{sensitive ? '●' : '●'}</Text>
        <Text color={t.dim}> </Text>
        <Text color={t.white} bold>
          {title}
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={tone}>{name}</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.subtle}>{hint}</Text>
      </Box>

      {entries.length > 0 && (
        <>
          <Box marginTop={1}>
            <Text color={t.dim}>│ </Text>
            <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
          </Box>

          {entries.map(([key, value]) => (
            <Box key={key}>
              <Text color={t.dim}>│ </Text>
              <Text color={t.dim}>{key.padEnd(12)}</Text>
              <Text color={t.white}>{trim(value, CONTENT_WIDTH - 18)}</Text>
            </Box>
          ))}
        </>
      )}

      <Box marginTop={1}>
        <Text color={t.dim}>│ </Text>
        <Text color={t.muted}>approve</Text>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.success}>y</Text>
        <Text color={t.dim}>{' / '}</Text>
        <Text color={t.error}>n</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.subtle}>press enter to approve</Text>
      </Box>
    </Box>
  )
}
