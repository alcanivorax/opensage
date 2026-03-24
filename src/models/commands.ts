import { getModelGroups, flattenModels, searchModels } from './data.js'
import type { ModelEntry } from './types.js'
import type { Config } from '../config.js'
import type { Provider } from '../providers/index.js'
import { createProvider } from '../providers/index.js'
import { saveConfig } from '../config.js'

interface SelectModelOptions {
  config: Config
  _provider: Provider
  arg?: string
  onSelect?: (model: ModelEntry) => void
}

export function selectModel({
  config,
  _provider,
  arg,
  onSelect,
}: SelectModelOptions): {
  model: ModelEntry | null
  error?: string
  needsApiKey?: boolean
  provider_: 'anthropic' | 'openrouter'
} | null {
  const groups = getModelGroups()
  const allModels = flattenModels(groups)

  if (!arg) {
    return null
  }

  const num = parseInt(arg, 10)
  let selectedModel: ModelEntry | null = null

  if (!isNaN(num) && num >= 1 && num <= allModels.length) {
    selectedModel = allModels[num - 1]
  } else {
    const matches = searchModels(groups, arg)
    selectedModel = matches[0] || null
  }

  if (!selectedModel) {
    return {
      model: null,
      error: 'Model not found. Use /models to see options.',
      provider_: config.provider,
    }
  }

  const apiKey =
    selectedModel.provider === 'anthropic'
      ? (config.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
      : (config.apiKeys.openrouter ?? process.env['OPENROUTER_API_KEY'])

  if (!apiKey) {
    return {
      model: selectedModel,
      needsApiKey: true,
      provider_: selectedModel.provider,
    }
  }

  if (onSelect) {
    onSelect(selectedModel)
  }

  return { model: selectedModel, provider_: selectedModel.provider }
}

export function applyModelSelection(
  state: { config: Config; provider: Provider },
  model: ModelEntry
): void {
  const apiKey =
    model.provider === 'anthropic'
      ? (state.config.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'])
      : (state.config.apiKeys.openrouter ?? process.env['OPENROUTER_API_KEY'])

  if (!apiKey) return

  state.config.provider = model.provider
  state.config.model = model.id
  state.provider = createProvider({ provider: model.provider, apiKey })
  saveConfig(state.config)
}
