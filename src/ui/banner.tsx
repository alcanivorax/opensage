import React from 'react'
import { Box, Text } from 'ink'
import { colors, t, CONTENT_WIDTH } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

export const VERSION = '0.1.0'

interface BannerProps {
  providerName: string
  model: string
  mcpServers?: McpServer[]
}

export function Banner({ providerName, model, mcpServers = [] }: BannerProps) {
  const modelShort = model.includes('/') ? model.split('/').pop()! : model
  const W = CONTENT_WIDTH

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌</Text>
        <Text color={colors.brandBright}>◆ opensage</Text>
        <Text color={t.dim}>{' v' + VERSION}</Text>
        <Text color={t.dim}>
          {' ' +
            '─'.repeat(
              Math.max(0, W - 15 - modelShort.length - providerName.length)
            )}
        </Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text color={t.muted}> model </Text>
        <Text color={t.white}>{modelShort}</Text>
        <Text color={t.dim}>
          {' ' + '─'.repeat(Math.max(0, W - 20 - modelShort.length))}
        </Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text color={t.muted}> provider </Text>
        <Text color={t.accent}>{providerName}</Text>
        <Text color={t.dim}>
          {' ' + '─'.repeat(Math.max(0, W - 20 - providerName.length))}
        </Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text color={t.muted}> tools </Text>
        <Text color={t.white}>{TOOLS.length}</Text>
        <Text color={t.dim}>{' ' + '─'.repeat(Math.max(0, W - 20))}</Text>
        <Text color={t.dim}>│</Text>
      </Box>
      {mcpServers.length > 0 && (
        <Box>
          <Text color={t.dim}>│</Text>
          <Text color={t.muted}> mcp </Text>
          <Text color={t.white}>
            {mcpServers.length} server{mcpServers.length !== 1 ? 's' : ''}
          </Text>
          <Text color={t.dim}>{' ' + '─'.repeat(Math.max(0, W - 20))}</Text>
          <Text color={t.dim}>│</Text>
        </Box>
      )}
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
      <Box marginTop={1} marginLeft={2}>
        <Text color={t.accent}>/help</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.accent}>/models</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.accent}>/tools</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.accent}>/exit</Text>
      </Box>
    </Box>
  )
}

export function Help() {
  const W = CONTENT_WIDTH
  const sections = [
    {
      title: 'Session',
      cmds: [
        ['/help', 'show help'],
        ['/clear', 'clear chat'],
        ['/retry', 'retry last'],
        ['/save', 'save session'],
        ['/history', 'view history'],
        ['/exit', 'quit'],
      ],
    },
    {
      title: 'Models',
      cmds: [
        ['/models', 'select model'],
        ['/provider', 'switch provider'],
      ],
    },
    {
      title: 'Tools',
      cmds: [
        ['/tools', 'list tools'],
        ['/attach', 'attach file'],
        ['/notes', 'memory'],
        ['/approve', 'auto-approve'],
      ],
    },
  ]

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌─ </Text>
        <Text color={t.accent} bold>
          Help
        </Text>
        <Text color={t.dim}>{' ' + '─'.repeat(W - 8)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      {sections.map((section) => (
        <Box key={section.title}>
          <Text color={t.dim}>│</Text>
          <Text color={t.muted}> {section.title.padEnd(10)}</Text>
        </Box>
      ))}
      {sections.map((section) =>
        section.cmds.map(([cmd, desc]) => (
          <Box key={cmd}>
            <Text color={t.dim}>│</Text>
            <Text color={t.dim}> </Text>
            <Text color={t.accent}>{cmd.padEnd(10)}</Text>
            <Text color={t.white}>{desc}</Text>
          </Box>
        ))
      )}
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}

export function Goodbye() {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌─ </Text>
        <Text color={colors.brandBright}>goodbye</Text>
        <Text color={t.dim}>{' ' + '─'.repeat(W - 10)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>
      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}

export { UserMessage } from './components/user-message.js'
export { ToolsList } from './tools-list.js'
export { UserHeader, AssistantHeader, ToolCallHeader } from './headers.js'
