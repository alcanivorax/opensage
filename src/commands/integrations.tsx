import React from 'react'
import { Box, Text } from 'ink'
import { runSetupWizard } from '../setup.js'
import { loadCreds, isGmailConfigured } from '../tools/gmail.js'
import { createProvider } from '../providers/index.js'
import { t } from '../ui/theme.js'
import type { CommandContext, CommandHandler } from './types.js'
import { out, SectionTitle, Err } from './ui.js'

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleSetup(ctx: CommandContext) {
  try {
    const result = await runSetupWizard(ctx.state.config)
    ctx.state.config = result.config
    ctx.state.provider = createProvider({
      provider: result.config.provider,
      apiKey: result.apiKey,
    })
    return { type: 'setup-complete' as const }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return out(<Err msg={'Setup failed: ' + msg} />)
  }
}

function handleGmailAuth() {
  return out(
    <Box flexDirection="column" marginTop={1}>
      <SectionTitle title="Gmail Setup" />

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text color={t.white}>
          {'To connect Gmail you need a Google OAuth2 Client ID.'}
        </Text>

        <Text color={t.muted}>
          {'This is a one-time setup that takes ~3 minutes.'}
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text color={t.white}>{'Steps:'}</Text>
          <Text color={t.muted}>
            {'1. Go to https://console.cloud.google.com/'}
          </Text>
          <Text color={t.muted}>
            {'2. Create a new project (or select an existing one)'}
          </Text>
          <Text color={t.muted}>
            {'3. Enable "Gmail API" from APIs & Services'}
          </Text>
          <Text color={t.muted}>
            {
              '4. Go to "Credentials" → "Create Credentials" → "OAuth Client ID"'
            }
          </Text>
          <Text color={t.muted}>
            {'5. Choose "Desktop App" (or Web if needed)'}
          </Text>
          <Text color={t.muted}>
            {'6. Copy your Client ID and Client Secret'}
          </Text>
          <Text color={t.muted}>{'7. Paste them here to complete setup'}</Text>
        </Box>
      </Box>
    </Box>
  )
}

function handleGmailStatus() {
  const configured = isGmailConfigured()
  const creds = loadCreds()

  return out(
    <Box flexDirection="column">
      <SectionTitle title="Gmail Status" />

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Box>
          <Text color={t.muted}>{'Credentials  '}</Text>
          {creds ? (
            <Text color={t.success}>{'● saved'}</Text>
          ) : (
            <Text color={t.warn}>{'✗ not set'}</Text>
          )}
        </Box>

        <Box>
          <Text color={t.muted}>{'Authorized   '}</Text>
          {configured ? (
            <Text color={t.success}>{'● yes'}</Text>
          ) : (
            <Text color={t.warn}>{'✗ not yet'}</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1} marginLeft={2}>
        {configured ? (
          <Text color={t.success}>
            {'✓ Ready — you can ask about your emails.'}
          </Text>
        ) : (
          <Text color={t.muted}>
            {'Run /gmail-auth to connect your Gmail account.'}
          </Text>
        )}
      </Box>
    </Box>
  )
}

function handleAccounts(ctx: CommandContext) {
  const servers = ctx.state.config.mcpServers ?? []

  if (servers.length === 0) {
    return out(
      <Box marginLeft={2} marginTop={1}>
        <Text color={t.muted}>{'No MCP accounts configured.'}</Text>
      </Box>
    )
  }

  return out(
    <Box flexDirection="column">
      <SectionTitle title="Connected Accounts" />

      <Box marginTop={1} flexDirection="column">
        {servers.map((server) => {
          const available = ctx.state.provider.supportsMcp

          return (
            <Box key={server.url} marginLeft={2}>
              <Text color={available ? t.success : t.warn}>
                {available ? '● ' : '○ '}
              </Text>
              <Text color={t.white}>{server.name.padEnd(14)}</Text>
              <Text color={t.muted}>{server.url}</Text>
              {!available && (
                <Text color={t.warn}>
                  {'  (unavailable on ' + ctx.state.config.provider + ')'}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const integrationHandlers: Record<string, CommandHandler> = {
  '/setup': handleSetup,
  '/gmail-auth': handleGmailAuth,
  '/gmail-status': handleGmailStatus,
  '/accounts': handleAccounts,
}
