import React from 'react'
import { Box, Text } from 'ink'
import { t } from '../theme.js'
import type { ToolCall } from '../../providers/index.js'
import { toolLabel } from '../../tools/index.js'

interface ToolCallBoxProps {
  call: ToolCall
  status?: 'pending' | 'running' | 'done' | 'error'
  action?: string
}

export function ToolCallBox({ call, status, action }: ToolCallBoxProps) {
  const isMcp = call.isMcp
  const hint = toolLabel(call.name, call.input)

  const statusIcon =
    status === 'done'
      ? { icon: '✓', color: t.success }
      : status === 'error'
        ? { icon: '✗', color: t.error }
        : status === 'running'
          ? { icon: '⋯', color: t.accent }
          : { icon: '○', color: t.muted }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={t.border}>{'├─ '}</Text>
        <Text color={isMcp ? t.assistant : t.tool}>{isMcp ? '✉' : '⚡'}</Text>
        <Text color={t.white}> {call.name}</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.muted}>{hint.slice(0, 40)}</Text>
      </Box>
      {action && (
        <Box paddingLeft={4}>
          <Text color={t.accent}>{statusIcon.icon}</Text>
          <Text color={t.muted}> {action}</Text>
        </Box>
      )}
    </Box>
  )
}

interface ToolResultProps {
  call: ToolCall
  result: string
  elapsed: number
  status?: 'success' | 'error'
}

export function ToolResultBox({
  call,
  result,
  elapsed,
  status = 'success',
}: ToolResultProps) {
  const elapsedStr =
    elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`
  const isError = status === 'error' || result.startsWith('Error:')
  const statusColor = isError ? t.error : t.success
  const statusIcon = isError ? '✗' : '✓'

  const maxLen = 60
  const firstLine = result.split('\n')[0]
  const preview =
    firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '…' : firstLine

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={t.border}>{'│ '}</Text>
        <Text color={statusColor}>{statusIcon}</Text>
        <Text color={t.dim}> {elapsedStr}</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.muted}>{preview}</Text>
      </Box>
      {result.split('\n').length > 1 && (
        <Box paddingLeft={4}>
          <Text color={t.dim}>
            +{result.split('\n').length - 1} more line
            {result.split('\n').length - 1 !== 1 ? 's' : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}
