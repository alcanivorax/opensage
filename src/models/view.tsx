import React from 'react'
import { Box, Text } from 'ink'
import { t } from '../ui/theme.js'
import { getModelGroups, flattenModels } from './data.js'
import type { ModelEntry } from './types.js'

export function ModelsView({
  currentModel,
  searchQuery,
  selectedIndex,
  onSelect,
}: {
  currentModel: string
  searchQuery: string
  selectedIndex: number
  onSelect: (model: ModelEntry) => void
}) {
  const groups = getModelGroups()
  const flat = flattenModels(groups)
  const filtered = searchQuery
    ? flat.filter(
        (m) =>
          m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : flat

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginLeft={2} marginBottom={1}>
        <Text color={t.accent}>Select a model</Text>
      </Box>

      {groups.map((group) => {
        const groupModels = filtered.filter(
          (m) => m.provider === group.provider
        )
        if (groupModels.length === 0 && searchQuery) return null

        return (
          <Box key={group.provider} flexDirection="column">
            <Box marginLeft={2} marginTop={1}>
              <Text color={t.accent} bold>
                {group.label}
              </Text>
            </Box>
            {groupModels.map((model, localIdx) => {
              const globalIdx = filtered.findIndex((m) => m.id === model.id)
              const isSelected = globalIdx === selectedIndex
              const isActive = model.id === currentModel

              return (
                <Box key={model.id} marginLeft={2} marginTop={0}>
                  <Text color={isSelected ? t.white : t.dim}>
                    {isSelected ? '▸ ' : '  '}
                  </Text>
                  <Text color={isActive ? t.success : t.dim}>
                    {isActive ? '●' : '○'}
                  </Text>
                  <Text color={isSelected ? t.white : t.dim}> </Text>
                  <Text
                    color={isSelected ? t.white : t.muted}
                    bold={isSelected}
                  >
                    {String(globalIdx + 1).padStart(2)}.
                  </Text>
                  <Text
                    color={
                      isSelected ? t.white : isActive ? t.success : t.white
                    }
                  >
                    {' ' + model.label}
                  </Text>
                  {isActive && <Text color={t.dim}> (current)</Text>}
                </Box>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}
