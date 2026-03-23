import React, { useState, useCallback } from 'react'
import { Box, Text, render, useApp } from 'ink'
import TextInput from 'ink-text-input'
import { t, colors } from './ui/theme.js'
import { VERSION } from './ui/banner.js'
import { saveConfig, DEFAULT_CONFIG } from './config.js'
import { ANTHROPIC_MODELS, OPENROUTER_FREE_MODELS } from './providers/index.js'
import type { Config } from './config.js'
import type { ProviderName } from './providers/index.js'

export interface SetupResult {
  config: Config
  apiKey: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 54

const PROVIDERS: Array<{ id: ProviderName; label: string; hint: string }> = [
  { id: 'anthropic', label: 'Anthropic', hint: 'Claude models' },
  { id: 'openrouter', label: 'OpenRouter', hint: 'Free tier available' },
]

const PROVIDER_URLS: Record<ProviderName, string> = {
  anthropic: 'https://console.anthropic.com/keys',
  openrouter: 'https://openrouter.ai/keys',
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function HRule() {
  return <Text color={t.dim}>{'  ' + '─'.repeat(W)}</Text>
}

function BorderBox({ children }: { children: React.ReactNode }) {
  return (
    <Box flexDirection="column">
      <Text color={t.dim}>{'  ╭' + '─'.repeat(W) + '╮'}</Text>
      {children}
      <Text color={t.dim}>{'  ╰' + '─'.repeat(W) + '╯'}</Text>
    </Box>
  )
}

function BorderRow({
  children,
  pad = W,
}: {
  children: React.ReactNode
  pad?: number
}) {
  return (
    <Box>
      <Text color={t.dim}>{'  │ '}</Text>
      <Box width={pad}>{children}</Box>
      <Text color={t.dim}>{'│'}</Text>
    </Box>
  )
}

function EmptyRow() {
  return (
    <Box>
      <Text color={t.dim}>{'  │' + ' '.repeat(W) + '│'}</Text>
    </Box>
  )
}

function SectionHeader({ step, title }: { step: string; title: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={colors.brandBright} bold>
          {step + '  '}
        </Text>
        <Text color={t.dim}>{'·  '}</Text>
        <Text color={t.white}>{title}</Text>
      </Box>
      <HRule />
      <Text>{''}</Text>
    </Box>
  )
}

function DoneRow({ label, value }: { label: string; value: string }) {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={t.success}>{'✓ '}</Text>
      <Text color={t.muted}>{label + ': '}</Text>
      <Text color={t.accent}>{value}</Text>
    </Box>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

function WelcomeBox() {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <BorderBox>
        <EmptyRow />
        <BorderRow>
          <Text color={colors.brandBright} bold>
            {'◆ opensage'}
          </Text>
          <Text color={t.dim}>{' v' + VERSION}</Text>
        </BorderRow>
        <EmptyRow />
        <BorderRow>
          <Text color={t.muted}>{'First-time setup'}</Text>
        </BorderRow>
        <EmptyRow />
      </BorderBox>
    </Box>
  )
}

function ProviderStep({
  onSelect,
}: {
  onSelect: (provider: ProviderName) => void
}) {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(
    (val: string) => {
      const n = parseInt(val.trim(), 10)
      if (n >= 1 && n <= PROVIDERS.length) {
        onSelect(PROVIDERS[n - 1].id)
      }
    },
    [onSelect]
  )

  return (
    <Box flexDirection="column">
      <SectionHeader step="1 / 3" title="Choose provider" />

      {PROVIDERS.map((p, i) => (
        <Box key={p.id} marginLeft={2}>
          <Text color={t.accent}>{String(i + 1)}</Text>
          <Text color={t.dim}>{'  ─  '}</Text>
          <Text color={t.white}>{p.label}</Text>
          <Text color={t.muted}>{'  ' + p.hint}</Text>
        </Box>
      ))}

      <Box marginTop={1} marginLeft={2}>
        <Text color={t.dim}>{'› '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="1"
        />
      </Box>
    </Box>
  )
}

function ApiKeyStep({
  provider,
  onSubmit,
}: {
  provider: ProviderName
  onSubmit: (key: string) => void
}) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const url = PROVIDER_URLS[provider]

  const handleSubmit = useCallback(
    (val: string) => {
      if (val.trim().length === 0) {
        setError('Key cannot be empty')
        return
      }
      setError('')
      onSubmit(val.trim())
    },
    [onSubmit]
  )

  return (
    <Box flexDirection="column">
      <SectionHeader step="2 / 3" title="Enter API key" />

      <Box marginLeft={2} flexDirection="column">
        <Box>
          <Text color={t.muted}>{'Get key: '}</Text>
          <Text color={t.accent}>{url}</Text>
        </Box>
        <Text color={t.muted}>{'Ctrl-U to clear · Ctrl-C to abort'}</Text>
      </Box>

      <Box marginTop={1} marginLeft={2}>
        <Text color={t.dim}>{'› '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          mask="●"
          placeholder="sk-..."
        />
      </Box>

      {error.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={t.warn}>{error}</Text>
        </Box>
      )}
    </Box>
  )
}

function ModelStep({
  provider,
  onSelect,
}: {
  provider: ProviderName
  onSelect: (modelId: string) => void
}) {
  const [input, setInput] = useState('')
  const models =
    provider === 'anthropic' ? ANTHROPIC_MODELS : OPENROUTER_FREE_MODELS
  const visible = models.slice(0, 5)

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (trimmed === '') {
        onSelect(models[0].id)
        return
      }
      const n = parseInt(trimmed, 10)
      if (n >= 1 && n <= visible.length) {
        onSelect(models[n - 1].id)
      }
    },
    [models, onSelect, visible.length]
  )

  return (
    <Box flexDirection="column">
      <SectionHeader step="3 / 3" title="Choose model" />

      {visible.map((m, i) => (
        <Box key={m.id} flexDirection="column" marginLeft={2} marginBottom={1}>
          <Box>
            <Text color={i === 0 ? t.success : t.dim}>
              {i === 0 ? '● ' : '○ '}
            </Text>
            <Text color={t.accent}>{String(i + 1) + '  '}</Text>
            <Text color={t.white}>{m.id}</Text>
          </Box>
          <Box marginLeft={4}>
            <Text color={t.muted}>{m.label}</Text>
            {i === 0 && <Text color={t.dim}>{' ← default'}</Text>}
          </Box>
        </Box>
      ))}

      {models.length > 5 && (
        <Box marginLeft={2} marginBottom={1}>
          <Text color={t.muted}>
            {'... and ' + (models.length - 5) + ' more'}
          </Text>
        </Box>
      )}

      <Box marginLeft={2}>
        <Text color={t.dim}>{'› '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="1"
        />
      </Box>
    </Box>
  )
}

function SuccessBox() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <BorderBox>
        <EmptyRow />
        <BorderRow>
          <Text color={t.success}>{'✓ '}</Text>
          <Text color={t.white} bold>
            {'All set!'}
          </Text>
        </BorderRow>
        <EmptyRow />
        <BorderRow>
          <Text color={t.muted}>
            {'Config saved to ~/.opensage/config.json'}
          </Text>
        </BorderRow>
        <EmptyRow />
      </BorderBox>
    </Box>
  )
}

// ─── Wizard state machine ─────────────────────────────────────────────────────

type Step =
  | { type: 'provider' }
  | { type: 'apiKey'; provider: ProviderName }
  | { type: 'model'; provider: ProviderName; apiKey: string }
  | { type: 'done'; result: SetupResult }

interface WizardProps {
  existingConfig?: Partial<Config>
  onDone: (result: SetupResult) => void
}

function Wizard({ existingConfig, onDone }: WizardProps) {
  const { exit } = useApp()
  const [step, setStep] = useState<Step>({ type: 'provider' })
  const [doneItems, setDoneItems] = useState<Array<[string, string]>>([])

  const handleProviderSelect = useCallback((provider: ProviderName) => {
    setDoneItems((prev) => [...prev, ['Provider', provider]])
    setStep({ type: 'apiKey', provider })
  }, [])

  const handleApiKey = useCallback((apiKey: string, provider: ProviderName) => {
    const masked = '●●●●●●●● (' + apiKey.length + ' chars)'
    setDoneItems((prev) => [...prev, ['Key', masked]])
    setStep({ type: 'model', provider, apiKey })
  }, [])

  const handleModelSelect = useCallback(
    (modelId: string, provider: ProviderName, apiKey: string) => {
      setDoneItems((prev) => [...prev, ['Model', modelId]])

      const base: Config = { ...DEFAULT_CONFIG, ...(existingConfig ?? {}) }
      base.provider = provider
      base.model = modelId
      if (provider === 'anthropic') {
        base.apiKeys = { ...base.apiKeys, anthropic: apiKey }
      } else {
        base.apiKeys = { ...base.apiKeys, openrouter: apiKey }
      }

      saveConfig(base)

      const result: SetupResult = { config: base, apiKey }
      setStep({ type: 'done', result })

      // Give React one frame to render the success box, then exit
      setTimeout(() => {
        onDone(result)
        exit()
      }, 80)
    },
    [existingConfig, onDone, exit]
  )

  return (
    <Box flexDirection="column">
      <WelcomeBox />

      {/* Completed steps */}
      {doneItems.map(([label, value]) => (
        <DoneRow key={label} label={label} value={value} />
      ))}

      {/* Active step */}
      {step.type === 'provider' && (
        <ProviderStep onSelect={handleProviderSelect} />
      )}

      {step.type === 'apiKey' && (
        <ApiKeyStep
          provider={step.provider}
          onSubmit={(key) => handleApiKey(key, step.provider)}
        />
      )}

      {step.type === 'model' && (
        <ModelStep
          provider={step.provider}
          onSelect={(modelId) =>
            handleModelSelect(modelId, step.provider, step.apiKey)
          }
        />
      )}

      {step.type === 'done' && <SuccessBox />}
    </Box>
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runSetupWizard(
  existingConfig?: Partial<Config>
): Promise<SetupResult> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <Wizard
        existingConfig={existingConfig}
        onDone={(result) => {
          unmount()
          resolve(result)
        }}
      />
    )
  })
}
