import type React from 'react'
import type { Config, Message } from '../config.js'
import type { Provider } from '../providers/index.js'

export interface SessionState {
  messages: Message[]
  totalIn: number
  totalOut: number
  lastResponse: string
  lastUserMessage: string
  autoApprove: boolean
  config: Config
  provider: Provider
}

export type CommandResult =
  | { type: 'continue'; output?: React.ReactNode }
  | { type: 'exit' }
  | { type: 'unknown' }
  | { type: 'retry'; message: string }
  | { type: 'setup-complete' }
  | { type: 'output'; content: React.ReactNode }

export interface ParsedCommand {
  raw: string
  cmd: string
  arg: string
  parts: string[]
}

export interface CommandContext {
  input: string
  parsed: ParsedCommand
  state: SessionState
}

export type CommandHandler = (
  ctx: CommandContext
) => Promise<CommandResult> | CommandResult

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim()
  const parts = trimmed.split(' ')
  const cmd = parts[0] ?? ''
  const arg = parts.slice(1).join(' ').trim()

  return {
    raw: input,
    cmd,
    arg,
    parts,
  }
}

export function createCommandContext(
  input: string,
  state: SessionState
): CommandContext {
  return {
    input,
    parsed: parseCommand(input),
    state,
  }
}

export function isCommand(input: string): boolean {
  return input.trim().startsWith('/')
}
