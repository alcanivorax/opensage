import React from 'react'
import * as fs from 'fs'
import { Box, Text } from 'ink'
import { saveConfig } from '../config.js'
import {
  ANTHROPIC_MODELS,
  OPENROUTER_FREE_MODELS,
  detectProvider,
  createProvider,
} from '../providers/index.js'
import {
  getModelGroups,
  flattenModels,
  searchModels,
  type ModelEntry,
} from '../models/index.js'
import { t } from '../ui/theme.js'
import type { CommandContext, CommandHandler } from './types.js'
import { out, Ok, Err, Warn, SectionTitle } from './ui.js'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function providerApiKey(
  ctx: CommandContext,
  provider: 'anthropic' | 'openrouter'
): string | undefined {
  const { apiKeys } = ctx.state.config
  return provider === 'anthropic'
    ? (apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
    : (apiKeys.openrouter ?? process.env['OPENROUTER_API_KEY'])
}

function MissingKeyView({
  provider,
}: {
  provider: 'anthropic' | 'openrouter'
}) {
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Err msg={'No API key for ' + provider + '.'} />
      {provider === 'anthropic' ? (
        <Box>
          <Text color={t.muted}>{'Set: '}</Text>
          <Text color={t.accent}>{'export ANTHROPIC_API_KEY=sk-ant-…'}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Text color={t.muted}>{'Get a free key: '}</Text>
            <Text color={t.accent}>{'https://openrouter.ai/keys'}</Text>
          </Box>
          <Box>
            <Text color={t.muted}>{'Set: '}</Text>
            <Text color={t.accent}>{'export OPENROUTER_API_KEY=sk-or-…'}</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

function applyModelSwitch(
  ctx: CommandContext,
  provider: 'anthropic' | 'openrouter',
  model: string
) {
  const apiKey = providerApiKey(ctx, provider)
  if (!apiKey) return out(<MissingKeyView provider={provider} />)

  ctx.state.config.provider = provider
  ctx.state.config.model = model
  ctx.state.provider = createProvider({ provider, apiKey })
  saveConfig(ctx.state.config)

  return out(
    <Box marginTop={1} marginLeft={2} flexDirection="column">
      <Box>
        <Text color={t.success}>{'✓ Switched to '}</Text>
        <Text color={t.white}>{provider}</Text>
        <Text color={t.muted}>{'  ·  '}</Text>
        <Text color={t.accent}>{model}</Text>
      </Box>
      {!ctx.state.provider.supportsMcp && (
        <Warn msg="MCP (Gmail / Calendar) not available on OpenRouter" />
      )}
    </Box>
  )
}

function resolveModelFromArg(arg: string): ModelEntry | null {
  const groups = getModelGroups()
  const all = flattenModels(groups)
  const num = parseInt(arg, 10)

  if (!Number.isNaN(num) && num >= 1 && num <= all.length) {
    return all[num - 1]
  }

  return searchModels(groups, arg)[0] ?? null
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleProvider(ctx: CommandContext) {
  const { arg } = ctx.parsed
  const { state } = ctx

  if (!arg) {
    return out(
      <Box flexDirection="column">
        <SectionTitle title="Active Provider" />

        <Box marginTop={1} marginLeft={2}>
          <Text color={t.success}>{'● '}</Text>
          <Text color={t.white}>{state.config.provider}</Text>
          <Text color={t.muted}>{'  ·  ' + state.config.model}</Text>
        </Box>

        <SectionTitle title="Available Providers" />

        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Box>
            <Text color={t.accent}>{'anthropic'}</Text>
            <Text color={t.muted}>{'    Claude models, full MCP support'}</Text>
          </Box>
          <Box>
            <Text color={t.accent}>{'openrouter'}</Text>
            <Text color={t.muted}>
              {'   100+ models, free tiers available'}
            </Text>
          </Box>
        </Box>

        <Box marginTop={1} marginLeft={2}>
          <Text color={t.muted}>{'Usage: '}</Text>
          <Text color={t.accent}>{'/provider anthropic'}</Text>
          <Text color={t.muted}>{'  or  '}</Text>
          <Text color={t.accent}>{'/provider openrouter'}</Text>
        </Box>
      </Box>
    )
  }

  if (arg !== 'anthropic' && arg !== 'openrouter') {
    return out(
      <Err
        msg={'Unknown provider "' + arg + '". Use anthropic or openrouter.'}
      />
    )
  }

  const defaultModel =
    arg === 'anthropic'
      ? 'claude-sonnet-4-20250514'
      : 'google/gemini-2.0-flash-exp:free'

  return applyModelSwitch(ctx, arg, defaultModel)
}

function handleModel(ctx: CommandContext) {
  const { arg } = ctx.parsed
  const { state } = ctx

  if (!arg) {
    const models =
      state.config.provider === 'anthropic'
        ? ANTHROPIC_MODELS
        : OPENROUTER_FREE_MODELS

    return out(
      <Box flexDirection="column">
        <SectionTitle title={'Models  ·  ' + state.config.provider} />

        <Box marginTop={1} flexDirection="column">
          {models.map((model) => {
            const active = model.id === state.config.model
            return (
              <Box key={model.id} marginLeft={2}>
                <Text color={active ? t.success : t.dim}>
                  {active ? '● ' : '  '}
                </Text>
                <Text color={t.accent}>{model.id.padEnd(48)}</Text>
                <Text color={t.muted}>{model.label}</Text>
              </Box>
            )
          })}
        </Box>

        <Box marginTop={1} marginLeft={2}>
          <Text color={t.muted}>{'Usage: '}</Text>
          <Text color={t.accent}>{'/model <model-id>'}</Text>
        </Box>
      </Box>
    )
  }

  state.config.model = arg
  saveConfig(state.config)

  return out(
    <Box marginLeft={2} marginTop={1}>
      <Text color={t.success}>{'✓ Model set to '}</Text>
      <Text color={t.accent}>{arg}</Text>
    </Box>
  )
}

function handleModels(ctx: CommandContext) {
  const { arg } = ctx.parsed
  const { state } = ctx
  const groups = getModelGroups()
  const allModels = flattenModels(groups)

  if (!arg) {
    return out(
      <Box flexDirection="column">
        <SectionTitle title="All Available Models" />

        <Box marginTop={1} marginLeft={2} flexDirection="column">
          {groups.map((group) => (
            <Box key={group.provider} flexDirection="column">
              <Box marginTop={1}>
                <Text color={t.accent}>{group.label}</Text>
                <Text color={t.muted}>
                  {' (' + group.models.length + ' models)'}
                </Text>
              </Box>

              {group.models.map((model) => {
                const active = model.id === state.config.model
                const index = allModels.findIndex((m) => m.id === model.id) + 1

                return (
                  <Box key={model.id} marginLeft={2}>
                    <Text color={active ? t.success : t.dim}>
                      {active ? '● ' : '  '}
                    </Text>
                    <Text color={t.muted}>
                      {String(index).padStart(2) + '. '}
                    </Text>
                    <Text color={t.white}>{model.label}</Text>
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>

        <Box marginTop={1} marginLeft={2}>
          <Text color={t.muted}>{'Usage: '}</Text>
          <Text color={t.accent}>{'/models <number>'}</Text>
          <Text color={t.muted}>{' or '}</Text>
          <Text color={t.accent}>{'/models <name>'}</Text>
        </Box>
      </Box>
    )
  }

  const selected = resolveModelFromArg(arg)
  if (!selected) {
    return out(
      <Err msg={'Model not found. Use /models to see available options.'} />
    )
  }

  return applyModelSwitch(ctx, selected.provider, selected.id)
}

function handleApiKey(ctx: CommandContext) {
  const { arg, parts } = ctx.parsed
  const { state } = ctx

  if (!arg) {
    const { apiKeys } = state.config

    return out(
      <Box flexDirection="column">
        <SectionTitle title="API Keys" />

        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Box>
            <Text color={t.muted}>{'anthropic   '}</Text>
            {apiKeys.anthropic ? (
              <Text color={t.success}>{'● set'}</Text>
            ) : (
              <Text color={t.dim}>{'not set'}</Text>
            )}
          </Box>
          <Box>
            <Text color={t.muted}>{'openrouter  '}</Text>
            {apiKeys.openrouter ? (
              <Text color={t.success}>{'● set'}</Text>
            ) : (
              <Text color={t.dim}>{'not set'}</Text>
            )}
          </Box>
        </Box>

        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text color={t.muted}>{'Usage: /apikey anthropic  sk-ant-…'}</Text>
          <Text color={t.muted}>{'       /apikey openrouter sk-or-…'}</Text>
        </Box>
      </Box>
    )
  }

  const [providerName, key] = parts.slice(1)

  if (!key) {
    return out(<Err msg="Usage: /apikey <provider> <key>" />)
  }

  if (providerName === 'anthropic') {
    state.config.apiKeys.anthropic = key
  } else if (providerName === 'openrouter') {
    state.config.apiKeys.openrouter = key
  } else {
    return out(<Err msg={'Unknown provider: ' + providerName} />)
  }

  const detected = detectProvider(key)
  if (detected === state.config.provider) {
    state.provider = createProvider({ provider: detected, apiKey: key })
  }

  saveConfig(state.config)
  return out(<Ok msg={providerName + ' API key saved'} />)
}

function handleApprove(ctx: CommandContext) {
  ctx.state.autoApprove = !ctx.state.autoApprove

  return out(
    ctx.state.autoApprove ? (
      <Warn msg="Auto-approve ON  (sensitive tools still confirm)" />
    ) : (
      <Ok msg="Auto-approve OFF  —  will confirm all tool actions" />
    )
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const modelHandlers: Record<string, CommandHandler> = {
  '/provider': handleProvider,
  '/model': handleModel,
  '/models': handleModels,
  '/apikey': handleApiKey,
  '/approve': handleApprove,
}
