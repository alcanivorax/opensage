import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Text } from 'ink'
import * as readline from 'readline'
import { t, colors, CONTENT_WIDTH } from '../ui/theme.js'
import type { ModelGroup, ModelEntry } from './types.js'
import { getModelGroups, flattenModels } from './data.js'

interface ModelsListProps {
  currentModel: string
  onSelect: (model: ModelEntry) => void
  onClose: () => void
}

export function ModelsList({
  currentModel,
  onSelect,
  onClose,
}: ModelsListProps) {
  const groups = getModelGroups()
  const flat = flattenModels(groups)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredModels, setFilteredModels] = useState<ModelEntry[]>(flat)
  const rlRef = useRef<readline.Interface | null>(null)

  useEffect(() => {
    rlRef.current = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })

    return () => {
      rlRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredModels(flat)
      setSelectedIndex(0)
    } else {
      const q = searchQuery.toLowerCase()
      const filtered = flat.filter(
        (m) =>
          m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      )
      setFilteredModels(filtered)
      setSelectedIndex(0)
    }
  }, [searchQuery, flat])

  const handleKeyPress = useCallback(
    (str: string, key: readline.Key) => {
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        onClose()
        return
      }

      if (key.name === 'up' || key.name === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1))
        return
      }

      if (key.name === 'down' || key.name === 'j') {
        setSelectedIndex((i) => Math.min(filteredModels.length - 1, i + 1))
        return
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (filteredModels[selectedIndex]) {
          onSelect(filteredModels[selectedIndex])
        }
        return
      }

      if (key.name === 'backspace') {
        setSearchQuery((q) => q.slice(0, -1))
        return
      }

      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + str)
      }
    },
    [filteredModels, selectedIndex, onSelect, onClose]
  )

  useEffect(() => {
    if (!rlRef.current) return

    const rl = rlRef.current
    const handler = (str: string, key: readline.Key) => {
      handleKeyPress(str, key)
    }

    rl.on('keypress', handler)

    return () => {
      rl.off('keypress', handler)
    }
  }, [handleKeyPress])

  let globalIndex = 0
  const totalWidth = CONTENT_WIDTH - 4

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginLeft={2} marginBottom={1}>
        <Text color={colors.brandBright}>◆ </Text>
        <Text color={t.white}>Select a model</Text>
        <Text color={t.muted}> (↑↓ navigate, Enter select, Esc cancel)</Text>
      </Box>

      {searchQuery && (
        <Box marginLeft={2} marginBottom={1}>
          <Text color={t.muted}>Search: </Text>
          <Text color={t.accent}>{searchQuery}</Text>
          <Text color={t.dim}> ({filteredModels.length} results)</Text>
        </Box>
      )}

      <Box flexDirection="column" marginLeft={2}>
        {groups.map((group) => {
          const groupStart = globalIndex
          const groupEnd = globalIndex + group.models.length
          const hasModels = filteredModels.some(
            (m) => m.provider === group.provider
          )

          if (!hasModels && searchQuery) return null

          globalIndex = groupEnd

          return (
            <Box key={group.provider} flexDirection="column">
              <Box marginTop={1}>
                <Text color={t.accent} bold>
                  {group.label}
                </Text>
              </Box>
              {group.models.map((model) => {
                const filteredIdx = filteredModels.findIndex(
                  (m) => m.id === model.id
                )
                const isVisible = filteredIdx >= 0
                const displayIdx = filteredIdx
                const isSelected = isVisible && displayIdx === selectedIndex
                const isActive = model.id === currentModel

                if (!isVisible) return null

                return (
                  <Box key={model.id} marginTop={0} paddingLeft={0}>
                    <Text
                      color={isSelected ? t.white : t.dim}
                      bold={isSelected}
                    >
                      {isSelected ? '▸ ' : '  '}
                    </Text>
                    <Text color={isActive ? t.success : t.muted}>
                      {isActive ? '●' : '○'}
                    </Text>
                    <Text color={isSelected ? t.white : t.dim}> </Text>
                    <Text
                      color={isSelected ? t.white : t.muted}
                      bold={isSelected}
                    >
                      {String(filteredIdx + 1).padStart(2)}
                    </Text>
                    <Text color={isSelected ? t.white : t.dim}>{'. '}</Text>
                    <Text
                      color={
                        isSelected ? t.white : isActive ? t.success : t.white
                      }
                      bold={isSelected}
                    >
                      {model.label}
                    </Text>
                    {isActive && <Text color={t.dim}> (current)</Text>}
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1} marginLeft={2}>
        <Text color={t.dim}>{'─'.repeat(totalWidth)}</Text>
      </Box>

      <Box marginTop={1} marginLeft={2}>
        <Text color={t.muted}>Type to search · </Text>
        <Text color={t.accent}>↑↓</Text>
        <Text color={t.muted}> navigate · </Text>
        <Text color={t.accent}>Enter</Text>
        <Text color={t.muted}> select · </Text>
        <Text color={t.accent}>Esc</Text>
        <Text color={t.muted}> cancel</Text>
      </Box>
    </Box>
  )
}
