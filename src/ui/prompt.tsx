import React, { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { t, CONTENT_WIDTH } from './theme.js'

interface PromptProps {
  onSubmit: (input: string) => void
  disabled: boolean
  model?: string
  inputTokens?: number
  outputTokens?: number
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

export function Prompt({
  onSubmit,
  disabled,
  model = 'unknown',
  inputTokens = 0,
  outputTokens = 0,
}: PromptProps) {
  const [value, setValue] = useState('')
  const totalTokens = inputTokens + outputTokens
  const modelShort = model.includes('/') ? model.split('/').pop()! : model

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
          <Text color={t.white}>{modelShort}</Text>
          <Text color={t.dim}>{'  ·  in '}</Text>
          <Text color={t.white}>{String(inputTokens)}</Text>
          <Text color={t.dim}>{'  ·  out '}</Text>
          <Text color={t.white}>{String(outputTokens)}</Text>
          <Text color={t.dim}>{'  ·  total '}</Text>
          <Text color={t.accent}>{String(totalTokens)}</Text>
          <Box flexGrow={1} />
          <Text color={t.dim}>command</Text>
          <Text color={t.dim}> │</Text>
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
        <Text color={t.white}>{modelShort}</Text>
        <Text color={t.dim}>{'  ·  in '}</Text>
        <Text color={t.white}>{String(inputTokens)}</Text>
        <Text color={t.dim}>{'  ·  out '}</Text>
        <Text color={t.white}>{String(outputTokens)}</Text>
        <Text color={t.dim}>{'  ·  total '}</Text>
        <Text color={t.accent}>{String(totalTokens)}</Text>
        <Box flexGrow={1} />
        <Text color={t.dim}>command</Text>
        <Text color={t.dim}> │</Text>
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
