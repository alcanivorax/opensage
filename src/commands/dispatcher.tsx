import React from 'react'
import { Box, Text } from 'ink'

import type { SessionState, CommandResult } from './types.js'
import { createCommandContext, isCommand } from './types.js'
import { out } from './ui.js'
import { t } from '../ui/theme.js'

import { sessionHandlers } from './session.js'
import { integrationHandlers } from './integrations.js'
import { contextHandlers } from './context.js'
import { modelHandlers } from './models.js'
import { toolHandlers } from './tools.js'

// ─── Handler table ────────────────────────────────────────────────────────────

const HANDLERS = {
  ...sessionHandlers,
  ...integrationHandlers,
  ...contextHandlers,
  ...modelHandlers,
  ...toolHandlers,
}

type HandlerKey = keyof typeof HANDLERS

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleCommand(
  input: string,
  state: SessionState
): Promise<CommandResult> {
  if (!isCommand(input)) return { type: 'unknown' }

  const ctx = createCommandContext(input, state)
  const handler = HANDLERS[ctx.parsed.cmd as HandlerKey]

  if (!handler) {
    return out(
      <Box marginLeft={2}>
        <Text color={t.warn}>
          {'Unknown command: ' + ctx.parsed.cmd + '  ·  type /help'}
        </Text>
      </Box>
    )
  }

  return handler(ctx)
}
