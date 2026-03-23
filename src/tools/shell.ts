import * as child_process from 'child_process'
import type Anthropic from '@anthropic-ai/sdk'

export const shellToolDef: Anthropic.Tool = {
  name: 'run_command',
  description:
    "Execute a shell command on the user's system. Use for running scripts, installing packages, listing files, git operations, compiling code, etc.",
  input_schema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
    },
    required: ['command'],
  },
}

export async function runCommand(input: {
  command: string
  cwd?: string
}): Promise<string> {
  const { command, cwd } = input

  return new Promise((resolve) => {
    child_process.exec(
      command,
      {
        cwd: cwd ?? process.cwd(),
        timeout: 30_000,
        maxBuffer: 1024 * 1024 * 5,
      },
      (err, stdout, stderr) => {
        const parts: string[] = []
        if (stdout) parts.push(stdout.trimEnd())
        if (stderr) parts.push(`[stderr]\n${stderr.trimEnd()}`)
        if (err && parts.length === 0) parts.push(`[error] ${err.message}`)
        parts.push(`[exit: ${err ? (err.code ?? 1) : 0}]`)
        resolve(parts.join('\n'))
      }
    )
  })
}
