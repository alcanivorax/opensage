import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { t } from '../theme.js'

const FRAMES = ['◌', '◐', '◓', '◒', '◔', '◕'] as const

interface ThinkingIndicatorProps {
  label?: string
}

export function ThinkingIndicator({
  label = 'thinking',
}: ThinkingIndicatorProps) {
  const [frame, setFrame] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const frameId = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 100)
    const dotsId = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 300)
    return () => {
      clearInterval(frameId)
      clearInterval(dotsId)
    }
  }, [])

  return (
    <Box>
      <Text color={t.muted}>{FRAMES[frame]}</Text>
      <Text color={t.dim}> </Text>
      <Text color={t.muted}>
        {label}
        {dots}
      </Text>
    </Box>
  )
}
