import * as fs from 'fs'
import * as path from 'path'
import type Anthropic from '@anthropic-ai/sdk'

export const readFileToolDef: Anthropic.Tool = {
  name: 'read_file',
  description: 'Read the contents of a file from disk.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file (absolute or relative)',
      },
      lines: {
        type: 'number',
        description: 'Max lines to return (optional, defaults to all)',
      },
    },
    required: ['path'],
  },
}

export const writeFileToolDef: Anthropic.Tool = {
  name: 'write_file',
  description:
    "Write content to a file. Creates it if it doesn't exist, overwrites if it does.",
  input_schema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Path to the file' },
      content: { type: 'string', description: 'Content to write' },
      append: {
        type: 'boolean',
        description: 'If true, append instead of overwrite',
      },
    },
    required: ['path', 'content'],
  },
}

export async function readFile(input: {
  path: string
  lines?: number
}): Promise<string> {
  const resolved = path.resolve(input.path)

  if (!fs.existsSync(resolved)) return `Error: File not found: ${resolved}`

  const stat = fs.statSync(resolved)
  if (stat.size > 1024 * 1024) {
    return `Error: File too large (${Math.round(stat.size / 1024)} KB). Use lines param to read a portion.`
  }

  let content = fs.readFileSync(resolved, 'utf8')

  if (input.lines) {
    const all = content.split('\n')
    content = all.slice(0, input.lines).join('\n')
    if (all.length > input.lines) {
      content += `\n… (${all.length - input.lines} more lines)`
    }
  }

  return content
}

export async function writeFile(input: {
  path: string
  content: string
  append?: boolean
}): Promise<string> {
  const resolved = path.resolve(input.path)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })

  if (input.append) {
    fs.appendFileSync(resolved, input.content)
  } else {
    fs.writeFileSync(resolved, input.content)
  }

  const bytes = Buffer.byteLength(input.content, 'utf8')
  return `✓ ${input.append ? 'Appended' : 'Wrote'} ${bytes} bytes to ${resolved}`
}
