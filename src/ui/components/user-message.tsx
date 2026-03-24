import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from '../theme.js'

interface UserMessageProps {
  content: string
}

export function UserMessage({ content }: UserMessageProps) {
  const lines = content.split('\n')
  const firstLine = lines[0]
  const hasMore = lines.length > 1

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>{'┌'}</Text>
        <Text color={t.dim}>{'─'.repeat(2)}</Text>
        <Text color={t.user} bold>
          {' '}
          you{' '}
        </Text>
        <Text color={t.dim}>{'─'.repeat(CONTENT_WIDTH - 10)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box paddingLeft={2} paddingRight={1}>
        <Text color={t.white}>{firstLine}</Text>
        {hasMore && (
          <Text color={t.dim}>
            {' '}
            +{lines.length - 1} more line{lines.length - 1 !== 1 ? 's' : ''}
          </Text>
        )}
      </Box>
      <Box>
        <Text color={t.dim}>{'└'}</Text>
        <Text color={t.dim}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}
