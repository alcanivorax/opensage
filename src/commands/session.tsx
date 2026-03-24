import React from 'react'
import { Box, Text } from 'ink'
import { saveHistory, loadHistory } from '../config.js'
import { Help, VERSION } from '../ui/banner.js'
import { MarkdownView } from '../ui/render.js'
import { t } from '../ui/theme.js'
import type { CommandContext, CommandHandler, CommandResult } from './types.js'
import { out, Ok, Warn, EmptyState } from './ui.js'

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleExit(ctx: CommandContext): CommandResult {
  if (ctx.state.messages.length) saveHistory(ctx.state.messages)
  return { type: 'exit' }
}

function handleClear(ctx: CommandContext): CommandResult {
  if (ctx.state.messages.length) saveHistory(ctx.state.messages)

  ctx.state.messages.length = 0
  ctx.state.totalIn = 0
  ctx.state.totalOut = 0
  ctx.state.lastResponse = ''
  ctx.state.lastUserMessage = ''

  return out(<Ok msg="Conversation cleared" />)
}

function handleSave(ctx: CommandContext): CommandResult {
  saveHistory(ctx.state.messages)
  return out(<Ok msg="Saved to ~/.opensage/history.json" />)
}

function handleHistory(): CommandResult {
  const hist = loadHistory()

  if (hist.length === 0) {
    return out(<EmptyState msg="No saved sessions yet." />)
  }

  return out(
    <Box flexDirection="column">
      <Box marginTop={1} marginLeft={2}>
        <Text color={t.brandBright} bold>
          Recent Sessions
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {hist.slice(-8).map((entry, index) => {
          const date = new Date(entry.timestamp).toLocaleString()
          const turns = Math.ceil(entry.messages.length / 2)

          return (
            <Box key={entry.timestamp} marginLeft={2}>
              <Text color={t.dim}>{String(index + 1).padStart(2) + '. '}</Text>
              <Text color={t.accent}>{date}</Text>
              <Text color={t.muted}>
                {'  —  ' + turns + ' turn' + (turns !== 1 ? 's' : '')}
              </Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function handleRetry(ctx: CommandContext): CommandResult {
  let foundIdx = -1

  for (let i = ctx.state.messages.length - 1; i >= 0; i--) {
    const message = ctx.state.messages[i]
    if (message.role === 'user' && typeof message.content === 'string') {
      foundIdx = i
      break
    }
  }

  if (foundIdx === -1) {
    if (ctx.state.lastUserMessage) {
      return out(
        <Box marginLeft={2}>
          <Text color={t.muted}>
            {'↩ Retrying: "' + ctx.state.lastUserMessage.slice(0, 70) + '"'}
          </Text>
        </Box>
      )
    }
    return out(<Warn msg="Nothing to retry" />)
  }

  const msg = ctx.state.messages[foundIdx].content as string
  ctx.state.messages.splice(foundIdx, 1)

  return { type: 'retry', message: msg }
}

function handleCompact(ctx: CommandContext): CommandResult {
  if (ctx.state.messages.length < 4) {
    return out(
      <Box marginLeft={2}>
        <Text color={t.muted}>{'Not enough conversation to compact.'}</Text>
      </Box>
    )
  }

  return out(
    <Box marginLeft={2}>
      <Text color={t.dim}>{'Summarising conversation…'}</Text>
    </Box>
  )
}

function handleHelp(): CommandResult {
  return out(<Help />)
}

function handleTokens(ctx: CommandContext): CommandResult {
  const total = ctx.state.totalIn + ctx.state.totalOut

  return out(
    <Box marginLeft={2} marginTop={1}>
      <Text color={t.muted}>{'In: '}</Text>
      <Text color={t.accent}>{String(ctx.state.totalIn)}</Text>
      <Text color={t.muted}>{'  Out: '}</Text>
      <Text color={t.accent}>{String(ctx.state.totalOut)}</Text>
      <Text color={t.muted}>{'  Total: '}</Text>
      <Text color={t.brandBright}>{String(total)}</Text>
    </Box>
  )
}

function handleCopy(ctx: CommandContext): CommandResult {
  if (!ctx.state.lastResponse) {
    return out(
      <Box marginLeft={2}>
        <Text color={t.muted}>{'No response yet.'}</Text>
      </Box>
    )
  }

  return out(<MarkdownView text={ctx.state.lastResponse} />)
}

function handleVersion(): CommandResult {
  return out(
    <Box marginLeft={2}>
      <Text color={t.muted}>{'opensage v'}</Text>
      <Text color={t.accent}>{VERSION}</Text>
    </Box>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const sessionHandlers: Record<string, CommandHandler> = {
  '/exit': handleExit,
  '/quit': handleExit,
  '/clear': handleClear,
  '/save': handleSave,
  '/history': handleHistory,
  '/retry': handleRetry,
  '/compact': handleCompact,
  '/help': handleHelp,
  '/tokens': handleTokens,
  '/copy': handleCopy,
  '/version': handleVersion,
}
