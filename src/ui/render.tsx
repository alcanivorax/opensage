import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { t, MAX_WIDTH } from './theme.js'

const CODE_W = MAX_WIDTH - 4

interface Segment {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strike?: boolean
}

function parseInline(raw: string): Segment[] {
  const segments: Segment[] = []
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
            <Text key={i} color={t.code} backgroundColor={t.codeBg}>
              {' ' + s.text + ' '}
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
            <Text key={i} color={t.muted} italic>
              {s.text}
            </Text>
          )
        if (s.strike)
          return (
            <Text key={i} color={t.dim} strikethrough>
              {s.text}
            </Text>
          )
        return (
          <Text key={i} color={t.white}>
            {s.text}
          </Text>
        )
      })}
    </>
  )
}

function CodeBlock({ lang, lines }: { lang: string; lines: string[] }) {
  const label = lang || 'code'
  const displayLines = lines.slice(0, 20)
  const hasMore = lines.length > 20

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={t.dim}>
        {'├─ '}
        <Text color={t.tool}>{label}</Text>
        {' ' + '─'.repeat(Math.max(0, CODE_W - label.length - 2))}
      </Text>
      {displayLines.map((line, i) => (
        <Text key={i} color={t.tool}>
          {'│ '}
          <Text color={t.white}>{line || ' '}</Text>
        </Text>
      ))}
      {hasMore && (
        <Text color={t.dim}>
          {'│ '}
          <Text italic color={t.muted}>
            +{lines.length - 20} more lines
          </Text>
        </Text>
      )}
      <Text color={t.dim}>{'└' + '─'.repeat(CODE_W + 2)}</Text>
    </Box>
  )
}

function ProseLine({ line }: { line: string }) {
  if (!line.trim()) return <Text> </Text>

  if (line.startsWith('### '))
    return (
      <Box>
        <Text color={t.brand}>◆ </Text>
        <Text bold color={t.white}>
          {line.slice(4)}
        </Text>
      </Box>
    )
  if (line.startsWith('## '))
    return (
      <Box>
        <Text color={t.brandBright}>◈ </Text>
        <Text bold color={t.white}>
          {line.slice(3)}
        </Text>
      </Box>
    )
  if (line.startsWith('# '))
    return (
      <Box>
        <Text color={t.brandBright} bold>
          {line.slice(2)}
        </Text>
      </Box>
    )
  if (line.startsWith('> '))
    return (
      <Box>
        <Text color={t.dim}>▌ </Text>
        <Text color={t.muted}>
          <InlineText raw={line.slice(2)} />
        </Text>
      </Box>
    )
  if (/^---+$/.test(line.trim()))
    return <Text color={t.border}>{'─'.repeat(40)}</Text>

  const task = line.match(/^(\s*)- \[([ x])\] (.+)$/)
  if (task) {
    const done = task[2] === 'x'
    return (
      <Box>
        <Text color={done ? t.success : t.dim}>{done ? '☑' : '☐'}</Text>
        <Text color={t.dim}> </Text>
        {done ? (
          <Text color={t.muted} strikethrough>
            {task[3]}
          </Text>
        ) : (
          <InlineText raw={task[3]} />
        )}
      </Box>
    )
  }

  const ul = line.match(/^(\s*)[-*] (.+)$/)
  if (ul) {
    const indent = ul[1].length > 0 ? '    ' : ''
    return (
      <Box>
        <Text color={t.dim}>{indent}▸ </Text>
        <InlineText raw={ul[2]} />
      </Box>
    )
  }

  const ol = line.match(/^(\s*)(\d+)\. (.+)$/)
  if (ol)
    return (
      <Box>
        <Text color={t.dim}>{'  '}</Text>
        <Text color={t.accent}>{ol[2]}. </Text>
        <InlineText raw={ol[3]} />
      </Box>
    )

  return <InlineText raw={line} />
}

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
