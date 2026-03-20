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
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Gemini 2.0 Flash (free)',
  },
  { id: 'google/gemini-flash-1.5:free', label: 'Gemini 1.5 Flash (free)' },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B (free)',
  },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)' },
  { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)' },
  { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)' },
  { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek V3 (free)' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (free)' },
  {
    id: 'microsoft/phi-3-medium-128k-instruct:free',
    label: 'Phi-3 Medium (free)',
  },
  { id: 'openchat/openchat-7b:free', label: 'OpenChat 7B (free)' },
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
