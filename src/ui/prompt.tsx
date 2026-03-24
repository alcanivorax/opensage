import React, { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { t } from './theme.js'

interface PromptProps {
  onSubmit: (input: string) => void
  disabled: boolean
}

export function Prompt({ onSubmit, disabled }: PromptProps) {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      setValue('')
      if (trimmed) onSubmit(trimmed)
    },
    [onSubmit]
  )

  if (disabled) {
    return (
      <Box marginTop={1}>
        <Text color={t.dim}>{' you › '}</Text>
        <Text color={t.dim} italic>
          {'waiting for response…'}
        </Text>
      </Box>
    )
  }

  return (
    <Box marginTop={1}>
      <Text color={t.user}>{' you'}</Text>
      <Text color={t.dim}>{' › '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="ask anything…"
        mask=""
      />
    </Box>
  )
}
