import React from 'react'
import { Box, Text } from 'ink'
import { t, colors, CONTENT_WIDTH } from '../ui/theme.js'
import type { CommandResult } from './types.js'

export function out(node: React.ReactElement): CommandResult {
  return { type: 'continue', output: <Box width={CONTENT_WIDTH}>{node}</Box> }
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={colors.brandBright} bold>
          {'  ' + title}
        </Text>
      </Box>
      <Text color={t.dim}>{'  ' + '─'.repeat(46)}</Text>
    </Box>
  )
}

export function Ok({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.success}>{'  ✓ '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

export function Err({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.error}>{'  ✗ '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

export function Warn({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.warn}>{'  ⚠  '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

export function EmptyState({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginLeft={2}>
      <Text color={t.muted}>{msg}</Text>
    </Box>
  )
}

export function KVRow({
  label,
  value,
  valueColor = t.white,
}: {
  label: string
  value: React.ReactNode
  valueColor?: string
}) {
  return (
    <Box marginLeft={2}>
      <Text color={t.muted}>{label}</Text>
      <Text color={valueColor}>{value}</Text>
    </Box>
  )
}

export function BulletList({
  items,
  bulletColor = t.dim,
  textColor = t.white,
}: {
  items: Array<string | React.ReactNode>
  bulletColor?: string
  textColor?: string
}) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      {items.map((item, index) => (
        <Box key={index}>
          <Text color={bulletColor}>{'• '}</Text>
          {typeof item === 'string' ? (
            <Text color={textColor}>{item}</Text>
          ) : (
            item
          )}
        </Box>
      ))}
    </Box>
  )
}
