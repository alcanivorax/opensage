import React from 'react'
import { Box, Text } from 'ink'
import { t, colors } from '../theme.js'

interface StatusBarProps {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  autoApprove?: boolean
  shortcuts?: boolean
}

export function StatusBar({
  model,
  provider,
  inputTokens,
  outputTokens,
  autoApprove,
  shortcuts = true,
}: StatusBarProps) {
  const totalTokens = inputTokens + outputTokens
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  const modelShort = model.includes('/') ? model.split('/').pop()! : model

  return (
    <Box flexDirection="column">
      <Box
        borderTop={`1px ${t.border}` as any}
        paddingTop={1}
        justifyContent="space-between"
      >
        <Box>
          <Text color={colors.brand}>◆</Text>
          <Text color={t.muted}> opensage</Text>
          <Text color={t.dim}> · </Text>
          <Text color={t.white}>{modelShort}</Text>
          <Text color={t.dim}> · </Text>
          <Text color={t.muted}>{provider}</Text>
        </Box>
        <Box>
          {autoApprove && (
            <>
              <Text color={t.success}>auto</Text>
              <Text color={t.dim}> · </Text>
            </>
          )}
          <Text color={t.muted}>in:</Text>
          <Text color={t.white}>{fmt(inputTokens)}</Text>
          <Text color={t.dim}> out:</Text>
          <Text color={t.white}>{fmt(outputTokens)}</Text>
          <Text color={t.dim}> total:</Text>
          <Text color={t.accent}>{fmt(totalTokens)}</Text>
        </Box>
      </Box>
      {shortcuts && (
        <Box paddingTop={1} justifyContent="space-between">
          <Box>
            <Text color={t.dim}>ctrl+c </Text>
            <Text color={t.muted}>interrupt</Text>
            <Text color={t.dim}> · </Text>
            <Text color={t.dim}>/help </Text>
            <Text color={t.muted}>commands</Text>
          </Box>
          <Box>
            <Text color={t.dim}>/models </Text>
            <Text color={t.muted}>change model</Text>
            <Text color={t.dim}> · </Text>
            <Text color={t.dim}>/clear </Text>
            <Text color={t.muted}>new chat</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
