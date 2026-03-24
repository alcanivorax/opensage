import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

const AUTO_TOOLS = new Set([
  'read_file',
  'web_fetch',
  'web_search',
  'save_memory',
])

export function ToolsList({ mcpServers = [] }: { mcpServers?: McpServer[] }) {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌─ </Text>
        <Text color={t.accent} bold>
          Tools
        </Text>
        <Text color={t.dim}>{' ' + '─'.repeat(W - 8)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>

      {TOOLS.map((tool) => {
        const auto = AUTO_TOOLS.has(tool.name)
        return (
          <Box key={tool.name}>
            <Text color={t.dim}>│</Text>
            <Text color={t.dim}> </Text>
            <Text color={t.tool}>{tool.name.padEnd(24)}</Text>
            <Text color={t.muted}>
              {(tool.description ?? '').slice(0, 28).padEnd(30)}
            </Text>
            <Text color={t.dim}> </Text>
            {auto ? (
              <Text color={t.success}>auto</Text>
            ) : (
              <Text color={t.warn}>confirm</Text>
            )}
          </Box>
        )
      })}

      <Box>
        <Text color={t.dim}>└</Text>
        <Text color={t.dim}>{'─'.repeat(W)}</Text>
        <Text color={t.dim}>┘</Text>
      </Box>
    </Box>
  )
}
