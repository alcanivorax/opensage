import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { t, CONTENT_WIDTH } from './theme.js'

const CODE_W = CONTENT_WIDTH - 4

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (para.length <= maxWidth) {
      lines.push(para)
    } else {
      const words = para.split(' ')
      let current = ''
      for (const word of words) {
        if ((current + ' ' + word).trim().length <= maxWidth) {
          current = (current + ' ' + word).trim()
        } else {
          if (current) lines.push(current)
          current = word
        }
      }
      if (current) lines.push(current)
    }
  }
  return lines
}

// ─── Thinking Spinner ─────────────────────────────────────────────────────────

const FRAMES = ['◌', '◐', '◓', '◒'] as const

export function ThinkingSpinner({ label = 'thinking…' }: { label?: string }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 120)
    return () => clearInterval(id)
  }, [])

  return (
    <Box>
      <Text color={t.dim}>{'  '}</Text>
      <Text color={t.dim}>{FRAMES[frame]}</Text>
      <Text> </Text>
      <Text color={t.muted}>{label}</Text>
    </Box>
  )
}

// ─── Inline Markdown ──────────────────────────────────────────────────────────
// Parses inline markers (bold, italic, code, strikethrough) into Ink Text nodes.

interface Segment {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strike?: boolean
}

function parseInline(raw: string): Segment[] {
  const segments: Segment[] = []
  // Very small hand-rolled parser; good enough for terminal output
  const re = /(`[^`\n]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segments.push({ text: raw.slice(last, m.index) })
    const tok = m[0]
    if (tok.startsWith('**'))
      segments.push({ text: tok.slice(2, -2), bold: true })
    else if (tok.startsWith('*'))
      segments.push({ text: tok.slice(1, -1), italic: true })
    else if (tok.startsWith('`'))
      segments.push({ text: tok.slice(1, -1), code: true })
    else if (tok.startsWith('~~'))
      segments.push({ text: tok.slice(2, -2), strike: true })
    last = m.index + tok.length
  }

  if (last < raw.length) segments.push({ text: raw.slice(last) })
  return segments
}

function InlineText({ raw }: { raw: string }) {
  const segs = parseInline(raw)
  return (
    <>
      {segs.map((s, i) => {
        if (s.code)
          return (
            <Text key={i} color={t.accent} backgroundColor="#1E293B">
              {' '}
              {s.text}{' '}
            </Text>
          )
        if (s.bold)
          return (
            <Text key={i} color={t.white} bold>
              {s.text}
            </Text>
          )
        if (s.italic)
          return (
            <Text key={i} color="#CBD5E1" italic>
              {s.text}
            </Text>
          )
        if (s.strike)
          return (
            <Text key={i} color={t.muted} strikethrough>
              {s.text}
            </Text>
          )
        return <Text key={i}>{s.text}</Text>
      })}
    </>
  )
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ lang, lines }: { lang: string; lines: string[] }) {
  const label = lang || 'code'
  const rightFill = '─'.repeat(Math.max(0, CODE_W - label.length - 4))

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>
        {'  ╭─ '}
        <Text color={t.tool}>{label}</Text>
        {'  ' + rightFill + '╮'}
      </Text>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color={t.dim}>{'  │ '}</Text>
          <Text color={t.tool}>{line}</Text>
        </Box>
      ))}
      <Text color={t.dim}>{'  ╰' + '─'.repeat(CODE_W + 2) + '╯'}</Text>
    </Box>
  )
}

// ─── Prose Line ───────────────────────────────────────────────────────────────

function ProseLine({ line }: { line: string }) {
  if (!line.trim()) return <Text>{''}</Text>

  if (line.startsWith('### '))
    return (
      <Box>
        <Text color={t.brandBright}>{'  ◆ '}</Text>
        <Text bold color={t.white}>
          {line.slice(4)}
        </Text>
      </Box>
    )
  if (line.startsWith('## '))
    return (
      <Box>
        <Text color={t.brand}>{'  ◈ '}</Text>
        <Text bold color={t.white}>
          {line.slice(3)}
        </Text>
      </Box>
    )
  if (line.startsWith('# '))
    return (
      <Box>
        <Text color={t.brandBright} bold>
          {'  ' + line.slice(2)}
        </Text>
      </Box>
    )
  if (line.startsWith('> '))
    return (
      <Box>
        <Text color={t.dim}>{'  ▌ '}</Text>
        <Text color={t.muted}>
          <InlineText raw={line.slice(2)} />
        </Text>
      </Box>
    )
  if (/^---+$/.test(line.trim()))
    return <Text color={t.dim}>{'  ' + '─'.repeat(60)}</Text>

  // Task list
  const task = line.match(/^(\s*)- \[([ x])\] (.+)$/)
  if (task) {
    const done = task[2] === 'x'
    return (
      <Box>
        <Text>{'  '}</Text>
        <Text color={done ? t.success : t.dim}>{done ? '☑' : '☐'}</Text>
        <Text> </Text>
        {done ? (
          <Text color={t.muted}>{task[3]}</Text>
        ) : (
          <InlineText raw={task[3]} />
        )}
      </Box>
    )
  }

  // Unordered list
  const ul = line.match(/^(\s*)[-*] (.+)$/)
  if (ul) {
    const indent = ul[1].length > 0 ? '    ' : '  '
    return (
      <Box>
        <Text>{indent}</Text>
        <Text color={t.accent}>▸ </Text>
        <InlineText raw={ul[2]} />
      </Box>
    )
  }

  // Ordered list
  const ol = line.match(/^(\s*)(\d+)\. (.+)$/)
  if (ol)
    return (
      <Box>
        <Text>{'  '}</Text>
        <Text color={t.accent}>{ol[2]}. </Text>
        <InlineText raw={ol[3]} />
      </Box>
    )

  return (
    <Box>
      <Text>{'  '}</Text>
      <InlineText raw={line} />
    </Box>
  )
}

// ─── Parsed Markdown block types ──────────────────────────────────────────────

type Block =
  | { kind: 'prose'; line: string }
  | { kind: 'code'; lang: string; lines: string[] }

function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = []
  const raw = text.split('\n')
  let i = 0

  while (i < raw.length) {
    const line = raw[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const lines: string[] = []
      i++
      while (i < raw.length && !raw[i].startsWith('```')) {
        lines.push(raw[i])
        i++
      }
      blocks.push({ kind: 'code', lang, lines })
    } else {
      blocks.push({ kind: 'prose', line })
    }
    i++
  }

  return blocks
}

// ─── MarkdownView ─────────────────────────────────────────────────────────────
// Renders a complete markdown string as Ink nodes.

export function MarkdownView({ text }: { text: string }) {
  const blocks = parseMarkdown(text)
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) =>
        b.kind === 'code' ? (
          <CodeBlock key={i} lang={b.lang} lines={b.lines} />
        ) : (
          <ProseLine key={i} line={b.line} />
        )
      )}
    </Box>
  )
}

// ─── StreamRenderer (hook) ────────────────────────────────────────────────────
// Accumulates streamed text deltas and returns a stable markdown string.

export function useStreamRenderer() {
  const [text, setText] = useState('')
  const buf = useRef('')

  const feed = (delta: string) => {
    buf.current += delta
    setText(buf.current)
  }

  const reset = () => {
    buf.current = ''
    setText('')
  }

  return { text, feed, reset }
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  name: string
  details: Record<string, string>
  sensitive?: boolean
}

export function ConfirmDialog({
  name,
  details,
  sensitive = false,
}: ConfirmDialogProps) {
  const W = CONTENT_WIDTH
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>{'┌' + '─'.repeat(W) + '┐'}</Text>

      {/* Header */}
      <Box>
        <Text color={t.dim}>│ </Text>
        {sensitive ? (
          <Text color={t.warn}>⚠ </Text>
        ) : (
          <Text color={t.tool}>⚡ </Text>
        )}
        <Text color={t.white} bold>
          {name}
        </Text>
      </Box>

      <Text color={t.dim}>{'├' + '─'.repeat(W) + '┤'}</Text>

      {/* Details */}
      {Object.entries(details).map(([key, value]) => (
        <Box key={key}>
          <Text color={t.dim}>│ </Text>
          <Text color={t.muted}>{key.padEnd(12)}</Text>
          <Text> </Text>
          <Text color={t.white}>{value}</Text>
        </Box>
      ))}

      <Text color={t.dim}>{'└' + '─'.repeat(W) + '┘'}</Text>

      {/* Prompt */}
      <Box marginTop={0}>
        <Text color={t.warn}>proceed?</Text>
        <Text color={t.muted}> [y/n] </Text>
        <Text color={t.dim}>› </Text>
      </Box>
    </Box>
  )
}

// ─── Tool Result ──────────────────────────────────────────────────────────────

interface ToolResultProps {
  toolName: string
  result: string
  elapsed: number
  compact?: boolean
}

export function ToolResult({
  toolName,
  result,
  elapsed,
  compact = false,
}: ToolResultProps) {
  const t_str =
    elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`
  const isErr = result.startsWith('Error:') || result.startsWith('Fetch error:')

  if (compact) {
    // Single-line summary
    const summary = result.split('\n')[0].slice(0, 60)
    return (
      <Box>
        <Text color={t.dim}>{'  │ '}</Text>
        <Text color={isErr ? t.error : t.success}>{isErr ? '✗' : '✓'}</Text>
        <Text> </Text>
        <Text color={t.tool}>{toolName}</Text>
        <Text color={t.dim}> · </Text>
        <Text color={isErr ? t.error : t.success}>{summary}</Text>
        <Text color={t.dim}> · </Text>
        <Text color={t.muted}>{t_str}</Text>
      </Box>
    )
  }

  const maxContentWidth = 56
  const wrappedLines = wrapText(result, maxContentWidth).slice(0, 6)
  return (
    <Box flexDirection="column">
      <Text color={t.dim}>{'  │'}</Text>
      <Text color={t.dim}>{'  ├' + '─'.repeat(60) + '┤'}</Text>
      <Box>
        <Text color={t.dim}>{'  │ '}</Text>
        <Text color={t.muted}>result </Text>
        <Text color={isErr ? t.error : t.success}>{isErr ? '✗' : '✓'}</Text>
        <Text> </Text>
        <Text color={t.muted}>{t_str}</Text>
      </Box>
      {wrappedLines.map((line, i) => (
        <Box key={i}>
          <Text color={t.dim}>{'  │ '}</Text>
          <Text color={t.muted}>{line}</Text>
        </Box>
      ))}
      {wrapText(result, maxContentWidth).length > 6 && (
        <Box>
          <Text color={t.dim}>{'  │ '}</Text>
          <Text
            color={t.muted}
          >{`… +${wrapText(result, maxContentWidth).length - 6} more`}</Text>
        </Box>
      )}
      <Text color={t.dim}>{'  └' + '─'.repeat(60) + '┘'}</Text>
    </Box>
  )
}

// ─── Token Footer ─────────────────────────────────────────────────────────────

export function TokenFooter({
  inputTokens,
  outputTokens,
  providerName,
}: {
  inputTokens: number
  outputTokens: number
  providerName: string
}) {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  return (
    <Box marginTop={1}>
      <Text color={t.dim}>── </Text>
      <Text color={t.muted}>{fmt(inputTokens)} in</Text>
      <Text color={t.dim}> · </Text>
      <Text color={t.muted}>{fmt(outputTokens)} out</Text>
      <Text color={t.dim}> · </Text>
      <Text color={t.muted}>{providerName}</Text>
      <Text color={t.dim}>{' ' + '─'.repeat(20)}</Text>
    </Box>
  )
}
