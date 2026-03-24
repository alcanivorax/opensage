import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'

interface StatusBarProps {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  autoApprove?: boolean
  shortcuts?: boolean
}

function fmtTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function FooterDivider() {
  return (
    <Box marginTop={1}>
      <Text color={t.dim}>╭</Text>
      <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
      <Text color={t.dim}>╮</Text>
    </Box>
  )
}

function FooterEnd() {
  return (
    <Box>
      <Text color={t.dim}>╰</Text>
      <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
      <Text color={t.dim}>╯</Text>
    </Box>
  )
}

function Dot({ color = t.dim }: { color?: string }) {
  return <Text color={color}>{' • '}</Text>
}

export function StatusBar({
  model,
  provider,
  inputTokens,
  outputTokens,
  autoApprove = false,
  shortcuts = true,
}: StatusBarProps) {
  const totalTokens = inputTokens + outputTokens
  const modelShort = model.includes('/') ? model.split('/').pop()! : model

  return (
    <Box flexDirection="column">
      <FooterDivider />

      <Box>
        <Text color={t.dim}>│ </Text>

        <Text color={t.brandBright} bold>
          opensage
        </Text>

        <Dot />

        <Text color={t.white}>{modelShort}</Text>

        <Dot />

        <Text color={t.accent}>{provider}</Text>

        <Dot />

        <Text color={autoApprove ? t.success : t.dim}>
          {autoApprove ? 'auto-approve on' : 'auto-approve off'}
        </Text>

        <Box flexGrow={1} />

        <Text color={t.dim}>in </Text>
        <Text color={t.white}>{fmtTokens(inputTokens)}</Text>

        <Dot />

        <Text color={t.dim}>out </Text>
        <Text color={t.white}>{fmtTokens(outputTokens)}</Text>

        <Dot />

        <Text color={t.dim}>total </Text>
        <Text color={t.accent}>{fmtTokens(totalTokens)}</Text>

        <Text color={t.dim}> │</Text>
      </Box>

      {shortcuts && (
        <Box>
          <Text color={t.dim}>│ </Text>

          <Text color={t.subtle}>ctrl+c</Text>
          <Text color={t.dim}>{' interrupt'}</Text>

          <Dot />

          <Text color={t.subtle}>/help</Text>
          <Text color={t.dim}>{' commands'}</Text>

          <Dot />

          <Text color={t.subtle}>/models</Text>
          <Text color={t.dim}>{' switch model'}</Text>

          <Dot />

          <Text color={t.subtle}>/clear</Text>
          <Text color={t.dim}>{' new chat'}</Text>

          <Text color={t.dim}> │</Text>
        </Box>
      )}

      <FooterEnd />
    </Box>
  )
}
