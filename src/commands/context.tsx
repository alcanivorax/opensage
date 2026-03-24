import React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { Box, Text } from 'ink'
import { saveConfig } from '../config.js'
import { loadMemory, deleteMemoryEntry } from '../tools/memory.js'
import { t } from '../ui/theme.js'
import type { CommandContext, CommandHandler } from './types.js'
import { out, Ok, Err, SectionTitle } from './ui.js'

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleAttach(ctx: CommandContext) {
  const { arg } = ctx.parsed

  if (!arg) {
    return out(<Err msg="Usage: /attach <file-path>" />)
  }

  const resolved = path.resolve(arg)

  if (!fs.existsSync(resolved)) {
    return out(<Err msg={'File not found: ' + resolved} />)
  }

  const stat = fs.statSync(resolved)

  if (stat.isDirectory()) {
    return out(<Err msg="Path is a directory. Attach individual files." />)
  }

  if (stat.size > 512 * 1024) {
    return out(
      <Err
        msg={
          'File too large (' + Math.round(stat.size / 1024) + ' KB, max 512 KB)'
        }
      />
    )
  }

  let content: string
  try {
    content = fs.readFileSync(resolved, 'utf8')
  } catch {
    return out(<Err msg="Could not read file (binary or permission error)" />)
  }

  const ext = path.extname(resolved).slice(1) || 'text'
  const basename = path.basename(resolved)
  const sizeKb = (stat.size / 1024).toFixed(1)
  const message = `I've attached the file \`${basename}\` (${sizeKb} KB):\n\`\`\`${ext}\n${content}\n\`\`\``

  ctx.state.messages.push({ role: 'user', content: message })

  return out(
    <Box marginTop={1} marginLeft={2}>
      <Text color={t.success}>{'✓ Attached '}</Text>
      <Text color={t.white}>{basename}</Text>
      <Text color={t.muted}>{' (' + sizeKb + ' KB)'}</Text>
      <Text color={t.muted}>{'  — file contents added to conversation'}</Text>
    </Box>
  )
}

function handleNotes() {
  const memories = loadMemory()

  if (memories.length === 0) {
    return out(
      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text color={t.muted}>{'No memories saved yet.'}</Text>
        <Text color={t.muted}>
          {'Ask the AI to remember something, or say "remember that…"'}
        </Text>
      </Box>
    )
  }

  return out(
    <Box flexDirection="column">
      <SectionTitle title="Memory Notes" />

      <Box marginTop={1} flexDirection="column">
        {memories.map((memory) => (
          <Box
            key={memory.id}
            flexDirection="column"
            marginLeft={2}
            marginBottom={1}
          >
            <Box>
              <Text color={t.dim}>{'[' + memory.id + ']  '}</Text>
              <Text color={t.accent}>
                {'[' + memory.category + ']'.padEnd(14)}
              </Text>
              <Text color={t.white}>{memory.content}</Text>
            </Box>
            <Box marginLeft={14}>
              <Text color={t.muted}>
                {new Date(memory.timestamp).toLocaleString()}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginLeft={2} marginTop={1}>
        <Text color={t.muted}>
          {memories.length +
            ' note' +
            (memories.length !== 1 ? 's' : '') +
            '  ·  /forget <id> to delete'}
        </Text>
      </Box>
    </Box>
  )
}

function handleForget(ctx: CommandContext) {
  const { arg } = ctx.parsed

  if (!arg) {
    return out(<Err msg="Usage: /forget <id>" />)
  }

  const deleted = deleteMemoryEntry(arg)

  return out(
    deleted ? (
      <Ok msg={'Deleted memory [' + arg + ']'} />
    ) : (
      <Err msg={'Memory not found: ' + arg} />
    )
  )
}

function handleSystem(ctx: CommandContext) {
  const { arg } = ctx.parsed

  if (arg) {
    ctx.state.config.systemPrompt = arg
    saveConfig(ctx.state.config)
    return out(<Ok msg="System prompt updated" />)
  }

  return out(
    <Box marginLeft={2}>
      <Text color={t.muted}>{ctx.state.config.systemPrompt}</Text>
    </Box>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const contextHandlers: Record<string, CommandHandler> = {
  '/attach': handleAttach,
  '/notes': handleNotes,
  '/forget': handleForget,
  '/system': handleSystem,
}
