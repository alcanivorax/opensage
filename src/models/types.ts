import type { ProviderName } from '../providers/index.js'

export interface ModelEntry {
  id: string
  label: string
  provider: ProviderName
  description?: string
}

export interface ModelGroup {
  provider: ProviderName
  label: string
  models: ModelEntry[]
}
