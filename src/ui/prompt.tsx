import React, { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { t, CONTENT_WIDTH } from './theme.js'

interface PromptProps {
  onSubmit: (input: string) => void
  disabled: boolean
}

function Divider() {
  return (
    <Box>
      <Text color={t.dim}>╭</Text>
      <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
      <Text color={t.dim}>╮</Text>
    </Box>
  )
}

function Footer() {
  return (
    <Box>
      <Text color={t.dim}>╰</Text>
      <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
      <Text color={t.dim}>╯</Text>
    </Box>
  )
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
      <Box flexDirection="column" marginTop={1}>
        <Divider />

        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.user} bold>
            command
          </Text>
          <Text color={t.dim}>{'  ·  '}</Text>
          <Text color={t.muted}>locked while assistant is responding</Text>
        </Box>

        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
        </Box>

        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.dim}>› </Text>
          <Text color={t.muted} italic>
            waiting for response…
          </Text>
        </Box>

        <Box>
          <Text color={t.dim}>│ </Text>
          <Text color={t.subtle}>press ctrl+c to interrupt if needed</Text>
        </Box>

        <Footer />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Divider />

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.user} bold>
          command
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>ask, edit, inspect, or run a slash command</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.user}>› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Ask anything or type /help…"
          mask=""
        />
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.subtle}>enter to send</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.subtle}>/help for commands</Text>
      </Box>

      <Footer />
    </Box>
  )
}
