import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'

interface UserMessageProps {
  content: string
}

export function UserMessage({ content }: UserMessageProps) {
  const lines = content.split('\n')

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.user} bold>
          you
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>prompt</Text>
        <Box flexGrow={1} />
        <Text color={t.dim}>user</Text>
        <Text color={t.dim}> │</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2} paddingRight={2}>
        {lines.length === 0 ? (
          <Text color={t.white}>{''}</Text>
        ) : (
          lines.map((line, i) => (
            <Text key={i} color={t.white}>
              {line.length > 0 ? line : ' '}
            </Text>
          ))
        )}
      </Box>

      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}
