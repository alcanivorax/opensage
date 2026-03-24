import React from 'react'
import { Box, Text } from 'ink'
import { ToolsList } from '../ui/banner.js'
import { t } from '../ui/theme.js'
import {
  installTool,
  listExternalTools,
  removeTool,
} from '../tools/registry.js'
import type { CommandContext, CommandHandler } from './types.js'
import { out, SectionTitle, Ok, Err } from './ui.js'

const DEFAULT_REPO = 'alcanivorax/opensage-tools'

// ─── Help views ───────────────────────────────────────────────────────────────

function AddHelp() {
  const installed = listExternalTools()

  return (
    <Box flexDirection="column">
      <SectionTitle title="Add External Tools" />

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text color={t.white}>{'Install tools from GitHub.'}</Text>
        <Box>
          <Text color={t.muted}>{'Default repo: '}</Text>
          <Text color={t.accent}>{DEFAULT_REPO}</Text>
        </Box>
        <Text color={t.muted}>{'Tools are stored in ~/.opensage/tools'}</Text>
      </Box>

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text color={t.accent}>{'Usage:'}</Text>
        <Box marginLeft={2}>
          <Text color={t.muted}>{'/add <tool>'}</Text>
          <Text color={t.dim}>{'  (from default repo)'}</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={t.muted}>{'/add <repo> <tool>'}</Text>
          <Text color={t.dim}>{'  (from custom repo)'}</Text>
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Text color={t.dim}>{'Example: /add filesystem'}</Text>
        </Box>
      </Box>

      {installed.length > 0 && (
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text color={t.accent}>{'Installed:'}</Text>
          {installed.map((tool) => (
            <Box key={tool.name} marginLeft={2}>
              <Text color={t.success}>{'● '}</Text>
              <Text color={t.white}>{tool.name}</Text>
              <Text color={t.dim}>{'  '}</Text>
              <Text color={t.muted}>{tool.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {installed.length === 0 && (
        <Box marginTop={1} marginLeft={2}>
          <Text color={t.dim}>{'No external tools installed yet.'}</Text>
        </Box>
      )}
    </Box>
  )
}

function RemoveHelp() {
  const installed = listExternalTools()

  return (
    <Box flexDirection="column">
      <SectionTitle title="Remove External Tools" />

      <Box marginTop={1} marginLeft={2}>
        <Text color={t.muted}>{'Usage: '}</Text>
        <Text color={t.accent}>{'/remove <tool-name>'}</Text>
      </Box>

      {installed.length === 0 ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color={t.dim}>{'No external tools installed.'}</Text>
        </Box>
      ) : (
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text color={t.muted}>{'Installed:'}</Text>
          {installed.map((tool) => (
            <Box key={tool.name} marginLeft={2}>
              <Text color={t.dim}>{'• '}</Text>
              <Text color={t.white}>{tool.name}</Text>
              <Text color={t.muted}>{'  ' + tool.description}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ─── Repo / tool-name parsing ─────────────────────────────────────────────────

function resolveRepoAndTool(arg: string): {
  repo: string
  toolName: string | undefined
} {
  const parts = arg.split(' ').filter(Boolean)

  if (parts[0]?.includes('/')) {
    // e.g. /add owner/repo tool-name
    return { repo: parts[0], toolName: parts[1] }
  }

  // e.g. /add tool-name  →  use default repo
  return { repo: DEFAULT_REPO, toolName: parts[0] }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleAdd(ctx: CommandContext) {
  const { arg } = ctx.parsed

  if (!arg) {
    return out(<AddHelp />)
  }

  const { repo, toolName } = resolveRepoAndTool(arg)

  try {
    const [owner, repoName] = repo.split('/')
    const fullRepo = `${owner}/${repoName.replace('.git', '')}`

    const result = await installTool(fullRepo, toolName)

    if (!result.success) {
      return out(<Err msg={result.message} />)
    }

    const installed = result.installed ?? []

    return out(
      <Box flexDirection="column" marginTop={1}>
        <Ok msg={result.message} />
        {installed.length > 0 && (
          <Box marginTop={1} marginLeft={2} flexDirection="column">
            <Text color={t.muted}>{'Installed tools:'}</Text>
            {installed.map((name) => (
              <Box key={name} marginLeft={2}>
                <Text color={t.success}>{'✓ '}</Text>
                <Text color={t.white}>{name}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return out(<Err msg={'Failed to install: ' + msg} />)
  }
}

function handleRemove(ctx: CommandContext) {
  const { arg } = ctx.parsed

  if (!arg) {
    return out(<RemoveHelp />)
  }

  const removed = removeTool(arg)

  return out(
    removed ? (
      <Ok msg={'Removed tool: ' + arg} />
    ) : (
      <Err msg={'Tool not found: ' + arg} />
    )
  )
}

function handleTools(ctx: CommandContext) {
  const installed = listExternalTools()
  const mcpServers = ctx.state.config.mcpServers ?? []

  return out(
    <Box flexDirection="column">
      <ToolsList mcpServers={mcpServers} />

      {installed.length > 0 && (
        <>
          <SectionTitle title="External Tools" />
          <Box marginTop={1} marginLeft={2} flexDirection="column">
            {installed.map((tool) => (
              <Box key={tool.name}>
                <Text color={t.success}>{'● '}</Text>
                <Text color={t.accent}>{tool.name.padEnd(24)}</Text>
                <Text color={t.muted}>{tool.description}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const toolHandlers: Record<string, CommandHandler> = {
  '/add': handleAdd,
  '/remove': handleRemove,
  '/tools': handleTools,
}
