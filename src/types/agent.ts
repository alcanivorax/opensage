import type { ToolCall } from '../providers/index.js'

export interface AgentResult {
  lastText: string
  inputTokens: number
  outputTokens: number
}

export type Phase =
  | { type: 'thinking' }
  | { type: 'streaming'; text: string }
  | { type: 'tool_confirm'; call: ToolCall; onResolve: (ok: boolean) => void }
  | { type: 'tool_running'; call: ToolCall; action: string }
  | { type: 'tool_result'; call: ToolCall; result: string; elapsed: number }
  | {
      type: 'done'
      inputTokens: number
      outputTokens: number
      providerName: string
    }
  | { type: 'idle' }

export interface AgentCallbacks {
  onPhaseChange?: (phase: Phase) => void
  onStreamText?: (text: string) => void
  onToolHistory?: (h: {
    call: ToolCall
    result: string
    elapsed: number
  }) => void
  showStreamText?: boolean
}
