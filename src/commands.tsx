import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import * as child_process from 'child_process'
import React from 'react'
import { Box, Text } from 'ink'
import { t, colors, CONTENT_WIDTH } from './ui/theme.js'
import { Help, ToolsList, Goodbye, VERSION } from './ui/banner.js'
import { MarkdownView } from './ui/render.js'
import { saveHistory, saveConfig, loadHistory } from './config.js'
import { loadMemory, deleteMemoryEntry } from './tools/memory.js'
import {
  fetchToolManifest,
  installTool,
  listExternalTools,
  removeTool,
  getExternalToolsDir,
} from './tools/registry.js'
import {
  ANTHROPIC_MODELS,
  OPENROUTER_FREE_MODELS,
  detectProvider,
  createProvider,
} from './providers/index.js'
import {
  getModelGroups,
  flattenModels,
  getModelByIndex,
  searchModels,
  type ModelEntry,
} from './models/index.js'
import { runSetupWizard } from './setup.js'
import {
  loadCreds,
  saveCreds,
  buildAuthUrl,
  exchangeAuthCode,
  isGmailConfigured,
} from './tools/gmail.js'
import type { Config, Message } from './config.js'
import type { Provider, ProviderName } from './providers/index.js'

export interface SessionState {
  messages: Message[]
  totalIn: number
  totalOut: number
  lastResponse: string
  lastUserMessage: string
  autoApprove: boolean
  config: Config
  provider: Provider
}

export type CommandResult =
  | { type: 'continue'; output?: React.ReactNode }
  | { type: 'exit' }
  | { type: 'unknown' }
  | { type: 'retry'; message: string }
  | { type: 'setup-complete' }
  | { type: 'output'; content: React.ReactNode }

function out(node: React.ReactElement): CommandResult {
  return { type: 'continue', output: <Box width={CONTENT_WIDTH}>{node}</Box> }
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={colors.brandBright} bold>
          {'  ' + title}
        </Text>
      </Box>
      <Text color={t.dim}>{'  ' + '─'.repeat(46)}</Text>
    </Box>
  )
}

function Ok({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.success}>{'  ✓ '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

function Err({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.error}>{'  ✗ '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

function Warn({ msg }: { msg: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.warn}>{'  ⚠  '}</Text>
      <Text color={t.white}>{msg}</Text>
    </Box>
  )
}

function makeTempRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })
}

function askLine(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) =>
    rl.question(prompt, (ans) => resolve(ans.trim()))
  )
}

export async function handleCommand(
  input: string,
  state: SessionState
): Promise<CommandResult> {
  if (!input.startsWith('/')) return { type: 'unknown' }

  const parts = input.trim().split(' ')
  const cmd = parts[0]
  const arg = parts.slice(1).join(' ').trim()

  switch (cmd) {
    case '/gmail-auth': {
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

              <Text color={t.muted}>
                {'7. Paste them here to complete setup'}
              </Text>
            </Box>
          </Box>
        </Box>
      )
    }
    case '/setup': {
      try {
        const result = await runSetupWizard(state.config)
        state.config = result.config
        state.provider = createProvider({
          provider: result.config.provider,
          apiKey: result.apiKey,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return out(<Err msg={'Setup failed: ' + msg} />)
      }
      return { type: 'setup-complete' }
    }

    case '/exit':
    case '/quit':
      if (state.messages.length) saveHistory(state.messages)
      return { type: 'exit' }

    case '/clear':
      if (state.messages.length) saveHistory(state.messages)
      state.messages.length = 0
      state.totalIn = 0
      state.totalOut = 0
      state.lastResponse = ''
      state.lastUserMessage = ''
      return out(<Ok msg="Conversation cleared" />)

    case '/save':
      saveHistory(state.messages)
      return out(<Ok msg="Saved to ~/.opensage/history.json" />)

    case '/gmail-status': {
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

    case '/history': {
      const hist = loadHistory()
      if (hist.length === 0) {
        return out(
          <Box marginTop={1} marginLeft={2}>
            <Text color={t.muted}>{'No saved sessions yet.'}</Text>
          </Box>
        )
      }
      return out(
        <Box flexDirection="column">
          <SectionTitle title="Recent Sessions" />
          <Box marginTop={1} flexDirection="column">
            {hist.slice(-8).map((h, i) => {
              const date = new Date(h.timestamp).toLocaleString()
              const turns = Math.ceil(h.messages.length / 2)
              return (
                <Box key={h.timestamp} marginLeft={2}>
                  <Text color={t.dim}>{String(i + 1).padStart(2) + '. '}</Text>
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

    case '/retry': {
      let foundIdx = -1
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i]
        if (m.role === 'user' && typeof m.content === 'string') {
          foundIdx = i
          break
        }
      }
      if (foundIdx === -1) {
        if (state.lastUserMessage) {
          return out(
            <Box marginLeft={2}>
              <Text color={t.muted}>
                {'↩ Retrying: "' + state.lastUserMessage.slice(0, 70) + '"'}
              </Text>
            </Box>
          )
        }
        return out(<Warn msg="Nothing to retry" />)
      }
      const msg = state.messages[foundIdx].content as string
      state.messages.splice(foundIdx, 1)
      return out(
        <Box marginLeft={2}>
          <Text color={t.muted}>
            {'↩ Retrying: "' +
              msg.slice(0, 70) +
              (msg.length > 70 ? '…' : '') +
              '"'}
          </Text>
        </Box>
      )
    }

    case '/compact': {
      if (state.messages.length < 4) {
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

    case '/attach': {
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
              'File too large (' +
              Math.round(stat.size / 1024) +
              ' KB, max 512 KB)'
            }
          />
        )
      }
      let content: string
      try {
        content = fs.readFileSync(resolved, 'utf8')
      } catch {
        return out(
          <Err msg="Could not read file (binary or permission error)" />
        )
      }
      const ext = path.extname(resolved).slice(1) || 'text'
      const basename = path.basename(resolved)
      const sizeKb = (stat.size / 1024).toFixed(1)
      const message = `I've attached the file \`${basename}\` (${sizeKb} KB):\n\`\`\`${ext}\n${content}\n\`\`\``
      state.messages.push({ role: 'user', content: message })
      return out(
        <Box marginTop={1} marginLeft={2}>
          <Text color={t.success}>{'✓ Attached '}</Text>
          <Text color={t.white}>{basename}</Text>
          <Text color={t.muted}>{' (' + sizeKb + ' KB)'}</Text>
          <Text color={t.muted}>
            {'  — file contents added to conversation'}
          </Text>
        </Box>
      )
    }

    case '/notes': {
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
            {memories.map((m) => (
              <Box
                key={m.id}
                flexDirection="column"
                marginLeft={2}
                marginBottom={1}
              >
                <Box>
                  <Text color={t.dim}>{'[' + m.id + ']  '}</Text>
                  <Text color={t.accent}>
                    {'[' + m.category + ']'.padEnd(14)}
                  </Text>
                  <Text color={t.white}>{m.content}</Text>
                </Box>
                <Box marginLeft={14}>
                  <Text color={t.muted}>
                    {new Date(m.timestamp).toLocaleString()}
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

    case '/forget': {
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

    case '/provider': {
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
                <Text color={t.muted}>
                  {'    Claude models, full MCP support'}
                </Text>
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
      const name = arg as 'anthropic' | 'openrouter'
      if (name !== 'anthropic' && name !== 'openrouter') {
        return out(
          <Err
            msg={'Unknown provider "' + arg + '". Use anthropic or openrouter.'}
          />
        )
      }
      const apiKey =
        name === 'anthropic'
          ? (state.config.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
          : (state.config.apiKeys.openrouter ??
            process.env['OPENROUTER_API_KEY'])
      if (!apiKey) {
        return out(
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            <Err msg={'No API key for ' + name + '.'} />
            {name === 'anthropic' ? (
              <Box>
                <Text color={t.muted}>{'Set: '}</Text>
                <Text color={t.accent}>
                  {'export ANTHROPIC_API_KEY=sk-ant-…'}
                </Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box>
                  <Text color={t.muted}>{'Get a free key: '}</Text>
                  <Text color={t.accent}>{'https://openrouter.ai/keys'}</Text>
                </Box>
                <Box>
                  <Text color={t.muted}>{'Set: '}</Text>
                  <Text color={t.accent}>
                    {'export OPENROUTER_API_KEY=sk-or-…'}
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        )
      }
      state.config.provider = name
      state.config.model =
        name === 'anthropic'
          ? 'claude-sonnet-4-20250514'
          : 'google/gemini-2.0-flash-exp:free'
      state.provider = createProvider({ provider: name, apiKey })
      saveConfig(state.config)
      return out(
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Box>
            <Text color={t.success}>{'✓ Switched to '}</Text>
            <Text color={t.white}>{name}</Text>
            <Text color={t.muted}>
              {'  (model: ' + state.config.model + ')'}
            </Text>
          </Box>
          {!state.provider.supportsMcp && (
            <Warn msg="MCP (Gmail / Calendar) not available on OpenRouter" />
          )}
        </Box>
      )
    }

    case '/model': {
      if (!arg) {
        const models =
          state.config.provider === 'anthropic'
            ? ANTHROPIC_MODELS
            : OPENROUTER_FREE_MODELS
        return out(
          <Box flexDirection="column">
            <SectionTitle title={'Models  ·  ' + state.config.provider} />
            <Box marginTop={1} flexDirection="column">
              {models.map((m) => {
                const active = m.id === state.config.model
                return (
                  <Box key={m.id} marginLeft={2}>
                    <Text color={active ? t.success : t.dim}>
                      {active ? '● ' : '  '}
                    </Text>
                    <Text color={t.accent}>{m.id.padEnd(48)}</Text>
                    <Text color={t.muted}>{m.label}</Text>
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

    case '/models': {
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
                  {group.models.map((m, i) => {
                    const active = m.id === state.config.model
                    return (
                      <Box key={m.id} marginLeft={2}>
                        <Text color={active ? t.success : t.dim}>
                          {active ? '● ' : '  '}
                        </Text>
                        <Text color={t.muted}>
                          {String(
                            allModels.findIndex((am) => am.id === m.id) + 1
                          ).padStart(2) + '. '}
                        </Text>
                        <Text color={t.white}>{m.label}</Text>
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

      const num = parseInt(arg, 10)
      let selectedModel: ModelEntry | null = null

      if (!isNaN(num) && num >= 1 && num <= allModels.length) {
        selectedModel = allModels[num - 1]
      } else {
        selectedModel = searchModels(groups, arg)[0] || null
      }

      if (!selectedModel) {
        return out(
          <Err msg={'Model not found. Use /models to see available options.'} />
        )
      }

      const apiKey =
        selectedModel.provider === 'anthropic'
          ? (state.config.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
          : (state.config.apiKeys.openrouter ??
            process.env['OPENROUTER_API_KEY'])

      if (!apiKey) {
        return out(
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            <Err msg={'No API key for ' + selectedModel.provider + '.'} />
            {selectedModel.provider === 'anthropic' ? (
              <Box>
                <Text color={t.muted}>{'Set: '}</Text>
                <Text color={t.accent}>
                  {'export ANTHROPIC_API_KEY=sk-ant-…'}
                </Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box>
                  <Text color={t.muted}>{'Get a free key: '}</Text>
                  <Text color={t.accent}>{'https://openrouter.ai/keys'}</Text>
                </Box>
                <Box>
                  <Text color={t.muted}>{'Set: '}</Text>
                  <Text color={t.accent}>
                    {'export OPENROUTER_API_KEY=sk-or-…'}
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        )
      }

      state.config.provider = selectedModel.provider
      state.config.model = selectedModel.id
      state.provider = createProvider({
        provider: selectedModel.provider,
        apiKey,
      })
      saveConfig(state.config)
      return out(
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Box>
            <Text color={t.success}>{'✓ Switched to '}</Text>
            <Text color={t.white}>{selectedModel.provider}</Text>
            <Text color={t.muted}>{'  ·  '}</Text>
            <Text color={t.accent}>{selectedModel.label}</Text>
          </Box>
          {!state.provider.supportsMcp && (
            <Warn msg="MCP (Gmail / Calendar) not available on OpenRouter" />
          )}
        </Box>
      )
    }

    case '/apikey': {
      if (!arg) {
        const ak = state.config.apiKeys
        return out(
          <Box flexDirection="column">
            <SectionTitle title="API Keys" />
            <Box marginTop={1} marginLeft={2} flexDirection="column">
              <Box>
                <Text color={t.muted}>{'anthropic   '}</Text>
                {ak.anthropic ? (
                  <Text color={t.success}>{'● set'}</Text>
                ) : (
                  <Text color={t.muted}>{'not set'}</Text>
                )}
              </Box>
              <Box>
                <Text color={t.muted}>{'openrouter  '}</Text>
                {ak.openrouter ? (
                  <Text color={t.success}>{'● set'}</Text>
                ) : (
                  <Text color={t.muted}>{'not set'}</Text>
                )}
              </Box>
            </Box>
            <Box marginTop={1} marginLeft={2} flexDirection="column">
              <Text color={t.muted}>
                {'Usage: /apikey anthropic  sk-ant-…'}
              </Text>
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

    case '/approve':
      state.autoApprove = !state.autoApprove
      return out(
        state.autoApprove ? (
          <Warn msg="Auto-approve ON  (sensitive tools still confirm)" />
        ) : (
          <Ok msg="Auto-approve OFF  —  will confirm all tool actions" />
        )
      )

    case '/system':
      if (arg) {
        state.config.systemPrompt = arg
        saveConfig(state.config)
        return out(<Ok msg="System prompt updated" />)
      } else {
        return out(
          <Box marginLeft={2}>
            <Text color={t.muted}>{state.config.systemPrompt}</Text>
          </Box>
        )
      }

    case '/help':
      return out(<Help />)

    case '/accounts': {
      const servers = state.config.mcpServers ?? []
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
            {servers.map((s) => {
              const available = state.provider.supportsMcp
              return (
                <Box key={s.url} marginLeft={2}>
                  <Text color={available ? t.success : t.warn}>
                    {available ? '● ' : '○ '}
                  </Text>
                  <Text color={t.white}>{s.name.padEnd(14)}</Text>
                  <Text color={t.muted}>{s.url}</Text>
                  {!available && (
                    <Text color={t.warn}>
                      {'  (unavailable on ' + state.config.provider + ')'}
                    </Text>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      )
    }

    case '/tokens':
      return out(
        <Box marginLeft={2} marginTop={1}>
          <Text color={t.muted}>{'In: '}</Text>
          <Text color={t.accent}>{String(state.totalIn)}</Text>
          <Text color={t.muted}>{'  Out: '}</Text>
          <Text color={t.accent}>{String(state.totalOut)}</Text>
          <Text color={t.muted}>{'  Total: '}</Text>
          <Text color={colors.brandBright}>
            {String(state.totalIn + state.totalOut)}
          </Text>
        </Box>
      )

    case '/copy':
      if (state.lastResponse) {
        return out(<MarkdownView text={state.lastResponse} />)
      } else {
        return out(
          <Box marginLeft={2}>
            <Text color={t.muted}>{'No response yet.'}</Text>
          </Box>
        )
      }

    case '/version':
      return out(
        <Box marginLeft={2}>
          <Text color={t.muted}>{'opensage v'}</Text>
          <Text color={t.accent}>{VERSION}</Text>
        </Box>
      )

    case '/add': {
      if (!arg) {
        return out(
          <Box flexDirection="column">
            <SectionTitle title="Add External Tools" />
            <Box marginTop={1} marginLeft={2} flexDirection="column">
              <Text color={t.white}>
                {'Download tools from GitHub repositories.'}
              </Text>
              <Text color={t.muted}>
                {'Tools are stored in ~/.opensage/tools'}
              </Text>
            </Box>
            <Box marginTop={1} marginLeft={2} flexDirection="column">
              <Box>
                <Text color={t.accent}>{'Usage:'}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color={t.muted}>{'/add <repo>'}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color={t.muted}>
                  {'  Example: /add alquivorax/opensage-tools'}
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text color={t.accent}>{'Installed tools:'}</Text>
              </Box>
              {(() => {
                const installed = listExternalTools()
                if (installed.length === 0) {
                  return (
                    <Box marginLeft={2}>
                      <Text color={t.muted}>
                        {'No external tools installed'}
                      </Text>
                    </Box>
                  )
                }
                return (
                  <Box flexDirection="column" marginLeft={2}>
                    {installed.map((tool) => (
                      <Box key={tool.name}>
                        <Text color={t.success}>{'● '}</Text>
                        <Text color={t.white}>{tool.name}</Text>
                        <Text color={t.dim}>{'  '}</Text>
                        <Text color={t.muted}>{tool.description}</Text>
                      </Box>
                    ))}
                  </Box>
                )
              })()}
            </Box>
          </Box>
        )
      }

      const parts = arg.split(' ')
      const repo = parts[0]
      const toolName = parts[1]

      if (!repo.includes('/')) {
        return out(<Err msg={'Invalid repo format. Use: owner/repo'} />)
      }

      try {
        const [owner, name] = repo.split('/')
        const fullRepo = `${owner}/${name.replace('.git', '')}`

        const result = await installTool(fullRepo, toolName)

        if (result.success) {
          const installed = result.installed ?? []
          return out(
            <Box flexDirection="column" marginTop={1}>
              <Ok msg={result.message} />
              {installed.length > 0 && (
                <Box marginTop={1} marginLeft={2} flexDirection="column">
                  <Text color={t.muted}>{'Installed tools:'}</Text>
                  {installed.map((toolName) => (
                    <Box key={toolName} marginLeft={2}>
                      <Text color={t.success}>{'✓ '}</Text>
                      <Text color={t.white}>{toolName}</Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )
        } else {
          return out(<Err msg={result.message} />)
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        return out(<Err msg={'Failed to install: ' + errorMessage} />)
      }
    }

    case '/remove': {
      if (!arg) {
        return out(
          <Box flexDirection="column">
            <SectionTitle title="Remove External Tools" />
            <Box marginTop={1} marginLeft={2} flexDirection="column">
              <Text color={t.muted}>{'Usage: /remove <tool-name>'}</Text>
            </Box>
            {(() => {
              const installed = listExternalTools()
              if (installed.length === 0) {
                return (
                  <Box marginTop={1} marginLeft={2}>
                    <Text color={t.muted}>{'No external tools to remove'}</Text>
                  </Box>
                )
              }
              return (
                <Box marginTop={1} marginLeft={2} flexDirection="column">
                  <Text color={t.muted}>{'Installed:'}</Text>
                  {installed.map((tool) => (
                    <Box key={tool.name}>
                      <Text color={t.dim}>{'• '}</Text>
                      <Text color={t.white}>{tool.name}</Text>
                    </Box>
                  ))}
                </Box>
              )
            })()}
          </Box>
        )
      }

      const removed = removeTool(arg)
      if (removed) {
        return out(<Ok msg={'Removed tool: ' + arg} />)
      } else {
        return out(<Err msg={'Tool not found: ' + arg} />)
      }
    }

    case '/tools': {
      const installed = listExternalTools()
      return out(
        <Box flexDirection="column">
          <ToolsList mcpServers={state.config.mcpServers ?? []} />
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

    default:
      return out(
        <Box marginLeft={2}>
          <Text color={t.warn}>
            {'Unknown command: ' + cmd + '  ·  type /help'}
          </Text>
        </Box>
      )
  }
}
