import React from 'react'
import { Box, Text } from 'ink'
import { t } from '../theme.js'

interface ConfirmDialogProps {
  name: string
  details: Record<string, string>
  sensitive?: boolean
}

export function ConfirmDialog({
  name,
  details,
  sensitive = false,
}: ConfirmDialogProps) {
  const warningColor = sensitive ? t.warn : t.accent

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.border}>├─ </Text>
        <Text color={warningColor}>{sensitive ? '⚠' : '⚡'}</Text>
        <Text color={t.white}> {name}</Text>
      </Box>
      {Object.entries(details).map(([key, value]) => (
        <Box key={key} paddingLeft={4}>
          <Text color={t.muted}>{key}: </Text>
          <Text color={t.white}>{value}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color={t.border}>{'├─ '}</Text>
        <Text color={t.warn}>proceed?</Text>
        <Text color={t.muted}> [</Text>
        <Text color={t.success}>y</Text>
        <Text color={t.muted}>/</Text>
        <Text color={t.error}>n</Text>
        <Text color={t.muted}>] </Text>
        <Text color={t.dim}>› </Text>
      </Box>
    </Box>
  )
}
