import { AnthropicProvider } from './anthropic.js'
import { OpenRouterProvider } from './openrouter.js'
import type { Provider } from './types.js'

export * from './types.js'

// ─── Supported providers ─────────────────────────────────────────────────────

export type ProviderName = 'anthropic' | 'openrouter'

export interface ProviderConfig {
  provider: ProviderName
  apiKey: string
}

// ─── Free / cheap models available on OpenRouter ─────────────────────────────

export const OPENROUTER_FREE_MODELS: { id: string; label: string }[] = [
  { id: 'stepfun/step-3.5-flash:free', label: 'Step Fun (free)' },
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen (free)',
  },
]

export const ANTHROPIC_MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recommended)' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4 (most capable)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest)' },
]

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createProvider(cfg: ProviderConfig): Provider {
  switch (cfg.provider) {
    case 'anthropic':
      return new AnthropicProvider(cfg.apiKey)
    case 'openrouter':
      return new OpenRouterProvider(cfg.apiKey)
    default:
      throw new Error(`Unknown provider: ${(cfg as any).provider}`)
  }
}

/** Guess the provider from an API key's prefix */
export function detectProvider(apiKey: string): ProviderName {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic'
  if (apiKey.startsWith('sk-or-')) return 'openrouter'
  return 'openrouter' // OpenRouter is the safe default for unknown keys
}
