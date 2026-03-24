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
        <Text color={t.dim}>{'┌'}</Text>
        <Text color={t.dim}>{'─'.repeat(2)}</Text>
        <Text color={t.user} bold>
          {' you '}
        </Text>
        <Text color={t.dim}>{'─'.repeat(CONTENT_WIDTH - 10)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} paddingRight={1}>
        {lines.map((line, i) => (
          <Text key={i} color={t.white}>
            {line}
          </Text>
        ))}
      </Box>
      <Box>
        <Text color={t.dim}>{'└'}</Text>
        <Text color={t.dim}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}
