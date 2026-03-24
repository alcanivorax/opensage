import React from 'react'
import { Box, Text } from 'ink'
import { t, CONTENT_WIDTH } from './theme.js'
import { getAllTools, SAFE_TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

function groupTools() {
  const tools = getAllTools()

  const groups = [
    {
      title: 'File System',
      match: (name: string) =>
        ['run_command', 'read_file', 'write_file', 'download_file'].includes(
          name
        ),
    },
    {
      title: 'Web',
      match: (name: string) => ['web_fetch', 'web_search'].includes(name),
    },
    {
      title: 'Gmail',
      match: (name: string) =>
        ['gmail_list', 'gmail_read', 'gmail_send', 'gmail_draft'].includes(
          name
        ),
    },
    {
      title: 'System',
      match: (name: string) =>
        [
          'get_system_info',
          'read_clipboard',
          'write_clipboard',
          'open_path',
        ].includes(name),
    },
    {
      title: 'Memory',
      match: (name: string) => ['save_memory'].includes(name),
    },
    {
      title: 'External',
      match: (name: string) =>
        ![
          'run_command',
          'read_file',
          'write_file',
          'download_file',
          'web_fetch',
          'web_search',
          'gmail_list',
          'gmail_read',
          'gmail_send',
          'gmail_draft',
          'get_system_info',
          'read_clipboard',
          'write_clipboard',
          'open_path',
          'save_memory',
        ].includes(name),
    },
  ]

  return groups
    .map((group) => ({
      ...group,
      tools: tools.filter((tool) => group.match(tool.name)),
    }))
    .filter((group) => group.tools.length > 0)
}

function trim(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function HeaderRow({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box>
      <Text color={t.dim}>│ </Text>
      <Text color={t.brandBright} bold>
        {title}
      </Text>
      {subtitle && (
        <>
          <Text color={t.dim}>{'  ·  '}</Text>
          <Text color={t.muted}>{subtitle}</Text>
        </>
      )}
    </Box>
  )
}

function Divider() {
  return (
    <Box>
      <Text color={t.dim}>│ </Text>
      <Text color={t.borderSoft}>{'─'.repeat(CONTENT_WIDTH - 2)}</Text>
    </Box>
  )
}

function ToolRow({
  name,
  description,
  auto,
}: {
  name: string
  description: string
  auto: boolean
}) {
  return (
    <Box>
      <Text color={t.dim}>│ </Text>
      <Text color={auto ? t.success : t.warn}>{auto ? '●' : '○'}</Text>
      <Text color={t.dim}> </Text>
      <Text color={t.tool}>{name.padEnd(24)}</Text>
      <Text color={t.muted}>{trim(description || 'No description', 42)}</Text>
      <Box flexGrow={1} />
      <Text color={auto ? t.success : t.dim}>{auto ? 'auto' : 'confirm'}</Text>
    </Box>
  )
}

export function ToolsList({ mcpServers = [] }: { mcpServers?: McpServer[] }) {
  const grouped = groupTools()
  const total = grouped.reduce((sum, group) => sum + group.tools.length, 0)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>╭</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╮</Text>
      </Box>

      <HeaderRow
        title="tools"
        subtitle={`${total} available${mcpServers.length > 0 ? `  ·  ${mcpServers.length} mcp server${mcpServers.length !== 1 ? 's' : ''}` : ''}`}
      />

      <Divider />

      {grouped.map((group, groupIndex) => (
        <React.Fragment key={group.title}>
          <HeaderRow
            title={group.title}
            subtitle={`${group.tools.length} tool${group.tools.length !== 1 ? 's' : ''}`}
          />

          {group.tools.map((tool) => (
            <ToolRow
              key={tool.name}
              name={tool.name}
              description={tool.description ?? ''}
              auto={SAFE_TOOLS.has(tool.name)}
            />
          ))}

          {groupIndex < grouped.length - 1 && <Divider />}
        </React.Fragment>
      ))}

      <Box marginTop={1}>
        <Text color={t.dim}>│ </Text>
        <Text color={t.subtle}>auto = runs without confirmation</Text>
        <Text color={t.dim}>{'  ·  '}</Text>
        <Text color={t.subtle}>confirm = asks before executing</Text>
      </Box>

      <Box>
        <Text color={t.dim}>╰</Text>
        <Text color={t.border}>{'─'.repeat(CONTENT_WIDTH)}</Text>
        <Text color={t.dim}>╯</Text>
      </Box>
    </Box>
  )
}
