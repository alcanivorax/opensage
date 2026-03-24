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

function ShellLine({
  label,
  value,
  valueColor = t.white,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <Box>
      <Text color={t.dim}>│ </Text>
      <Text color={t.dim}>{label.padEnd(10)}</Text>
      <Text color={valueColor}>{value}</Text>
    </Box>
  )
}

function ShellDivider() {
  return (
    <Box>
      <Text color={t.dim}>│ </Text>
      <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
    </Box>
  )
}

export function Banner({ providerName, model, mcpServers = [] }: BannerProps) {
  const modelShort = model.includes('/') ? model.split('/').pop()! : model
  const allTools = getAllTools()
  const externalCount = Math.max(0, allTools.length - TOOLS.length)

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={colors.brandBright} bold>
          opensage
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>terminal coding assistant</Text>
        <Box flexGrow={1} />
        <Text color={t.dim}>v{VERSION}</Text>
        <Text color={t.dim}> │</Text>
      </Box>

      <ShellDivider />

      <ShellLine label="model" value={modelShort} valueColor={t.white} />
      <ShellLine label="provider" value={providerName} valueColor={t.accent} />
      <ShellLine
        label="tools"
        value={
          externalCount > 0
            ? `${allTools.length} total  ·  ${externalCount} external`
            : `${allTools.length} available`
        }
        valueColor={externalCount > 0 ? t.success : t.white}
      />

      {mcpServers.length > 0 && (
        <ShellLine
          label="mcp"
          value={`${mcpServers.length} server${mcpServers.length !== 1 ? 's' : ''}`}
          valueColor={t.system}
        />
      )}

      <ShellDivider />

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.accent}>/help</Text>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.accent}>/tools</Text>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.accent}>/models</Text>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.accent}>/exit</Text>
      </Box>

      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}

export function Help() {
  const sections = [
    {
      title: 'Session',
      items: [
        ['/help', 'show this help'],
        ['/clear', 'clear the current conversation'],
        ['/retry', 'retry the last user message'],
        ['/save', 'save the session to disk'],
        ['/history', 'view recent saved sessions'],
        ['/exit', 'quit opensage'],
      ],
    },
    {
      title: 'Models',
      items: [
        ['/models', 'browse and pick available models'],
        ['/model <id>', 'switch directly to a model'],
        ['/provider <name>', 'switch provider'],
        ['/apikey <provider> <key>', 'save an API key'],
      ],
    },
    {
      title: 'Tools',
      items: [
        ['/tools', 'list built-in and external tools'],
        ['/add <tool>', 'install an external tool from the default repo'],
        ['/add <repo> <tool>', 'install from a custom repo'],
        ['/remove <name>', 'uninstall an external tool'],
        ['/approve', 'toggle auto-approve for safe actions'],
      ],
    },
    {
      title: 'Context',
      items: [
        ['/attach <file>', 'attach a local file to the conversation'],
        ['/notes', 'view persistent memory'],
        ['/forget <id>', 'delete a memory entry'],
        ['/system [text]', 'view or update the system prompt'],
      ],
    },
    {
      title: 'Diagnostics',
      items: [
        ['/tokens', 'show token usage'],
        ['/accounts', 'show connected MCP accounts'],
        ['/gmail-status', 'show Gmail connection status'],
        ['/version', 'show installed version'],
      ],
    },
  ]

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>

      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={colors.brandBright} bold>
          opensage commands
        </Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>minimal shell reference</Text>
      </Box>

      {sections.map((section, index) => (
        <React.Fragment key={section.title}>
          <Box marginTop={index === 0 ? 1 : 0}>
            <Text color={t.dim}>│ </Text>
            <Text color={t.brandBright} bold>
              {section.title}
            </Text>
          </Box>

          {section.items.map(([cmd, desc]) => (
            <Box key={cmd}>
              <Text color={t.dim}>│ </Text>
              <Text color={t.accent}>{cmd.padEnd(24)}</Text>
              <Text color={t.muted}>{desc}</Text>
            </Box>
          ))}

          {index < sections.length - 1 && (
            <Box marginTop={1}>
              <Text color={t.dim}>│ </Text>
              <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
            </Box>
          )}
        </React.Fragment>
      ))}

      <Box marginTop={1}>
        <Text color={t.dim}>│ </Text>
        <Text color={t.dim}>Tip:</Text>
        <Text color={t.muted}>{' use '}</Text>
        <Text color={t.accent}>/models</Text>
        <Text color={t.muted}>{' to switch capability tiers, and '}</Text>
        <Text color={t.accent}>/tools</Text>
        <Text color={t.muted}>{' to inspect what the assistant can do.'}</Text>
      </Box>

      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}

export function Goodbye() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>
      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={colors.brandBright}>goodbye</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.muted}>session closed</Text>
      </Box>
      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}

export { UserMessage } from './components/user-message.js'
export { ToolsList } from './tools-list.js'
export { UserHeader, AssistantHeader, ToolCallHeader } from './headers.js'
