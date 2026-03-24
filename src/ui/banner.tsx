import React from 'react'
import { Box, Text } from 'ink'
import { colors, t, CONTENT_WIDTH } from './theme.js'
import { TOOLS, getAllTools } from '../tools/index.js'
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
  const allTools = getAllTools()

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
        <Text color={t.white}>{allTools.length}</Text>
        {allTools.length > TOOLS.length && (
          <>
            <Text color={t.dim}>{' ('}</Text>
            <Text color={t.success}>
              {'+' + (allTools.length - TOOLS.length) + ' external'}
            </Text>
            <Text color={t.dim}>{')'}</Text>
          </>
        )}
        <Text color={t.dim}>
          {' ' +
            '─'.repeat(Math.max(0, W - 20 - String(allTools.length).length))}
        </Text>
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
        ['/help', 'show this help'],
        ['/clear', 'clear chat history'],
        ['/retry', 'retry last message'],
        ['/save', 'save session to disk'],
        ['/history', 'view past sessions'],
        ['/attach <file>', 'attach a file to the conversation'],
        ['/exit', 'quit'],
      ],
    },
    {
      title: 'Models & Providers',
      cmds: [
        ['/models', 'list & select a model'],
        ['/model <id>', 'switch to a specific model'],
        ['/provider <name>', 'switch provider (anthropic / openrouter)'],
        ['/apikey <p> <key>', 'set an API key for a provider'],
      ],
    },
    {
      title: 'Tools',
      cmds: [
        ['/tools', 'list all available tools'],
        ['/add <tool>', 'install an external tool from GitHub'],
        ['/remove <name>', 'uninstall an external tool'],
        ['/approve', 'toggle auto-approve for tool calls'],
      ],
    },
    {
      title: 'Memory',
      cmds: [
        ['/notes', 'view saved memory'],
        ['/forget <id>', 'delete a memory entry'],
      ],
    },
    {
      title: 'Other',
      cmds: [
        ['/tokens', 'show token usage'],
        ['/system [text]', 'view or update system prompt'],
        ['/accounts', 'list connected MCP accounts'],
        ['/version', 'show version'],
      ],
    },
  ]

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>┌─ </Text>
        <Text color={t.accent} bold>
          Commands
        </Text>
        <Text color={t.dim}>{' ' + '─'.repeat(W - 12)}</Text>
        <Text color={t.dim}>┐</Text>
      </Box>

      {sections.map((section, si) => (
        <React.Fragment key={section.title}>
          {/* Section header — add a blank separator row before each section except the first */}
          {si > 0 && (
            <Box>
              <Text color={t.dim}>{'│'}</Text>
            </Box>
          )}
          <Box>
            <Text color={t.dim}>│ </Text>
            <Text color={colors.brandBright} bold>
              {section.title}
            </Text>
          </Box>
          {section.cmds.map(([cmd, desc]) => (
            <Box key={cmd}>
              <Text color={t.dim}>│ </Text>
              <Text color={t.accent}>{cmd.padEnd(20)}</Text>
              <Text color={t.muted}>{desc}</Text>
            </Box>
          ))}
        </React.Fragment>
      ))}

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
