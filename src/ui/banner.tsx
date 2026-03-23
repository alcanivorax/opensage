import React from 'react'
import { Box, Text, Spacer } from 'ink'
import { colors, t, CONTENT_WIDTH } from './theme.js'
import { TOOLS } from '../tools/index.js'
import type { McpServer } from '../config.js'

export const VERSION = '0.1.0'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function HRule({
  width = CONTENT_WIDTH,
  char = '─',
}: {
  width?: number
  char?: string
}) {
  return <Text color={t.dim}>{char.repeat(width)}</Text>
}

function BoxRow({
  children,
  width = CONTENT_WIDTH,
}: {
  children: React.ReactNode
  width?: number
}) {
  return (
    <Box width={width + 2}>
      <Text color={t.dim}>│</Text>
      <Box width={width} paddingLeft={1}>
        {children}
      </Box>
      <Text color={t.dim}>│</Text>
    </Box>
  )
}

function KV({
  label,
  value,
  width = CONTENT_WIDTH,
}: {
  label: string
  value: string
  width?: number
}) {
  return (
    <BoxRow width={width}>
      <Text color={t.muted}>{label.padEnd(10)}</Text>
      <Text color={t.white}>{value}</Text>
    </BoxRow>
  )
}

// ─── Banner ───────────────────────────────────────────────────────────────────

interface BannerProps {
  providerName: string
  model: string
  mcpServers?: McpServer[]
}

export function Banner({ providerName, model, mcpServers = [] }: BannerProps) {
  const modelShort = model.split('/').pop()!
  const W = CONTENT_WIDTH
  const toolsCount = TOOLS.length + mcpServers.length * 6

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Top double border */}
      <Text color={t.dim}>{'╔═' + ' '.repeat(W - 2) + '═╗'}</Text>

      {/* Brand row */}
      <BoxRow width={W}>
        <Text color={colors.brandBright}>◆ opensage</Text>
        <Text color={t.dim}> v{VERSION}</Text>
      </BoxRow>

      {/* Sep */}
      <Text color={t.dim}>{'╠' + '═'.repeat(W) + '╣'}</Text>

      <KV label="Model" value={modelShort} width={W} />
      <KV label="Provider" value={providerName} width={W} />
      <KV label="Tools" value={String(toolsCount)} width={W} />
      {mcpServers.length > 0 && (
        <KV
          label="MCP"
          value={`${mcpServers.length} server${mcpServers.length !== 1 ? 's' : ''}`}
          width={W}
        />
      )}

      {/* Bottom double border */}
      <Text color={t.dim}>{'╚' + '═'.repeat(W) + '╝'}</Text>

      {/* Commands hint */}
      <Box marginTop={1} paddingLeft={2}>
        <Text color={t.accent}>/help</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.accent}>/setup</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.accent}>/exit</Text>
      </Box>
    </Box>
  )
}

// ─── Message Headers ───────────────────────────────────────────────────────────

export function UserHeader() {
  const label = ' you '
  const W = CONTENT_WIDTH
  const pad = Math.floor((W - label.length) / 2)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>{'┌' + '─'.repeat(W) + '┐'}</Text>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text>{' '.repeat(pad)}</Text>
        <Text color={t.user} bold>
          {label}
        </Text>
        <Text>{' '.repeat(W - pad - label.length)}</Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Text color={t.dim}>{'└' + '─'.repeat(W) + '┘'}</Text>
    </Box>
  )
}

export function AssistantHeader({ model }: { model: string }) {
  const modelShort = model.split('/').pop() ?? model
  const inner = ` sage · ${modelShort} `
  const W = CONTENT_WIDTH
  const pad = Math.floor((W - inner.length) / 2)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>{'┌' + '─'.repeat(W) + '┐'}</Text>
      <Box>
        <Text color={t.dim}>│</Text>
        <Text>{' '.repeat(Math.max(0, pad))}</Text>
        <Text color={t.assistant}> sage </Text>
        <Text color={t.muted}>· {modelShort} </Text>
        <Text>{' '.repeat(Math.max(0, W - pad - inner.length))}</Text>
        <Text color={t.dim}>│</Text>
      </Box>
      <Text color={t.dim}>{'└' + '─'.repeat(W) + '┘'}</Text>
    </Box>
  )
}

// ─── Tool Call Header ─────────────────────────────────────────────────────────

export function ToolCallHeader({
  name,
  hint,
}: {
  name: string
  hint?: string
}) {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>{'┌' + '─'.repeat(W) + '┐'}</Text>
      <Box>
        <Text color={t.dim}>│ </Text>
        <Text color={t.tool}>⚡</Text>
        <Text> </Text>
        <Text color={t.tool} bold>
          {name}
        </Text>
        {hint && <Text color={t.dim}> · </Text>}
        {hint && <Text color={t.muted}>{hint.slice(0, 40)}</Text>}
      </Box>
      <Text color={t.dim}>{'└' + '─'.repeat(W) + '┘'}</Text>
    </Box>
  )
}

// ─── Help ─────────────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    title: 'Session',
    cmds: [
      ['/help', 'show this help'],
      ['/clear', 'clear conversation'],
      ['/retry', 're-send last message'],
      ['/compact', 'summarise & compress'],
      ['/save', 'save session'],
      ['/history', 'view recent sessions'],
      ['/exit', 'quit'],
    ],
  },
  {
    title: 'Config',
    cmds: [
      ['/setup', 'setup wizard'],
      ['/provider', 'show/switch provider'],
      ['/model', 'show/switch model'],
      ['/approve', 'toggle auto-approve'],
      ['/tokens', 'token usage'],
    ],
  },
  {
    title: 'Tools',
    cmds: [
      ['/tools', 'list tools'],
      ['/attach', 'attach file'],
      ['/notes', 'memory notes'],
      ['/gmail-auth', 'connect Gmail'],
    ],
  },
]

export function Help() {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>
        {'╔═ '}
        <Text color={t.muted}>Help </Text>
        {'═'.repeat(W - 4)}
        {'╗'}
      </Text>

      {HELP_SECTIONS.map((section) => (
        <React.Fragment key={section.title}>
          <BoxRow width={W}>
            <Text color={t.brand}>{section.title}</Text>
          </BoxRow>
          {section.cmds.map(([cmd, desc]) => (
            <BoxRow width={W} key={cmd}>
              <Text>{'   '}</Text>
              <Text color={t.accent}>{cmd.padEnd(18)}</Text>
              <Text color={t.white}>{desc}</Text>
            </BoxRow>
          ))}
        </React.Fragment>
      ))}

      <Text color={t.dim}>{'╚' + '═'.repeat(W + 2) + '╝'}</Text>
    </Box>
  )
}

// ─── Tools List ────────────────────────────────────────────────────────────────

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
      <Text color={t.dim}>
        {'╔═ '}
        <Text color={t.muted}>Tools </Text>
        {'═'.repeat(W - 5)}
        {'╗'}
      </Text>

      {TOOLS.map((tool) => {
        const auto = AUTO_TOOLS.has(tool.name)
        return (
          <BoxRow width={W} key={tool.name}>
            <Text>{'   '}</Text>
            <Text color={t.tool}>{tool.name.padEnd(24)}</Text>
            <Text color={t.muted}>
              {(tool.description ?? '').slice(0, 30).padEnd(32)}
            </Text>
            <Text> </Text>
            {auto ? (
              <Text color={t.success}>auto</Text>
            ) : (
              <Text color={t.warn}>confirm</Text>
            )}
          </BoxRow>
        )
      })}

      <Text color={t.dim}>{'╚' + '═'.repeat(W + 2) + '╝'}</Text>
    </Box>
  )
}

// ─── Goodbye ──────────────────────────────────────────────────────────────────

export function Goodbye() {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>{'╔' + '═'.repeat(W + 2) + '╗'}</Text>
      <BoxRow width={W}>
        <Text color={colors.brandBright}>◆ goodbye</Text>
      </BoxRow>
      <Text color={t.dim}>{'╚' + '═'.repeat(W + 2) + '╝'}</Text>
    </Box>
  )
}
