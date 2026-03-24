import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'
import type { ToolCall } from '../../providers/index.js'
import { toolLabel } from '../../tools/index.js'

interface ToolCallBoxProps {
  call: ToolCall
  status?: 'pending' | 'running' | 'done' | 'error'
  action?: string
}

function getStatusMeta(status?: ToolCallBoxProps['status']) {
  switch (status) {
    case 'done':
      return { icon: '●', color: t.success, label: 'done' }
    case 'error':
      return { icon: '●', color: t.error, label: 'error' }
    case 'running':
      return { icon: '●', color: t.accent, label: 'running' }
    default:
      return { icon: '●', color: t.warn, label: 'pending' }
  }
}

function trim(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

export function ToolCallBox({
  call,
  status = 'pending',
  action,
}: ToolCallBoxProps) {
  const meta = getStatusMeta(status)
  const isMcp = call.isMcp
  const hint = trim(toolLabel(call.name, call.input) || 'no input', 44)
  const source = isMcp ? 'mcp' : 'tool'

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={meta.color}>{meta.icon}</Text>
        <Text color={t.dim}> </Text>
        <Text color={isMcp ? t.assistant : t.tool} bold>
          {call.name}
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.dim}>{source}</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>{hint}</Text>
      </Box>

      {(action || status === 'running') && (
        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.dim}> </Text>
          <Text color={t.accent}>{action ?? 'executing…'}</Text>
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
  const isError = status === 'error' || result.startsWith('Error:')
  const tone = isError ? t.error : t.success
  const icon = isError ? '✕' : '✓'
  const elapsedStr =
    elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`

  const lines = result.split('\n')
  const firstLine = trim(
    lines[0] || (isError ? 'execution failed' : 'completed'),
    64
  )
  const extraLineCount = Math.max(0, lines.length - 1)

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.dim}> </Text>
        <Text color={tone}>{icon}</Text>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.dim}>{elapsedStr}</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.white}>{firstLine}</Text>
      </Box>

      {extraLineCount > 0 && (
        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.dim}> </Text>
          <Text color={t.subtle}>
            +{extraLineCount} more line{extraLineCount !== 1 ? 's' : ''}
          </Text>
        </Box>
      )}

      {!isError && result.trim().length === 0 && (
        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.dim}> </Text>
          <Text color={t.subtle}>no output</Text>
        </Box>
      )}
    </Box>
  )
}
