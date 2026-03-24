import type { ProviderName } from '../providers/index.js'
import { ANTHROPIC_MODELS, OPENROUTER_FREE_MODELS } from '../providers/index.js'
import type { ModelGroup, ModelEntry } from './types.js'

export function getModelGroups(): ModelGroup[] {
  return [
    {
      provider: 'anthropic',
      label: 'Anthropic',
      models: ANTHROPIC_MODELS.map((m) => ({
        ...m,
        provider: 'anthropic' as ProviderName,
      })),
    },
    {
      provider: 'openrouter',
      label: 'OpenRouter',
      models: OPENROUTER_FREE_MODELS.map((m) => ({
        ...m,
        provider: 'openrouter' as ProviderName,
      })),
    },
  ]
}

export function flattenModels(groups: ModelGroup[]): ModelEntry[] {
  return groups.flatMap((g) => g.models)
}

export function getModelByIndex(
  groups: ModelGroup[],
  index: number
): ModelEntry | null {
  const flat = flattenModels(groups)
  if (index < 0 || index >= flat.length) return null
  return flat[index]
}

export function searchModels(
  groups: ModelGroup[],
  query: string
): ModelEntry[] {
  const flat = flattenModels(groups)
  if (!query) return flat
  const q = query.toLowerCase()
  return flat.filter(
    (m) =>
      m.label.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
  )
}
