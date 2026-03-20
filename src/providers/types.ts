import type { McpServer } from '../config.js'

// ─── Shared param bag ─────────────────────────────────────────────────────────

export interface ChatParams {
  model: string
  maxTokens: number
  system: string
  messages: ProviderMessage[]
  tools: ToolDefinition[]
  mcpServers: McpServer[]
}

// ─── Tool types ───────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any> // JSON Schema object
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, any>
  isMcp: boolean
}

// ─── Non-streaming response ───────────────────────────────────────────────────

export interface ProviderResponse {
  textBlocks: string[]
  toolCalls: ToolCall[]
  inputTokens: number
  outputTokens: number
  stopReason: string
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface ProviderMessage {
  role: 'user' | 'assistant'
  content: any // kept flexible — each provider re-shapes as needed
}

// ─── Streaming event union ────────────────────────────────────────────────────

export type StreamEvent =
  /** A chunk of text content from the model */
  | { type: 'text_delta'; text: string }
  /** The model has started invoking a tool (name is known, input still accumulating) */
  | { type: 'tool_start'; id: string; name: string }
  /** Tool input is fully accumulated and ready for execution */
  | {
      type: 'tool_done'
      id: string
      name: string
      input: Record<string, any>
      isMcp: boolean
    }
  /** Stream finished — final token counts */
  | {
      type: 'end'
      inputTokens: number
      outputTokens: number
      stopReason: string
    }

// ─── Provider interface ───────────────────────────────────────────────────────

export interface Provider {
  /** Human-readable name shown in the UI */
  name: string
  /** Whether this provider supports Anthropic MCP servers */
  supportsMcp: boolean

  /** Single-shot, non-streaming call (used for pipe mode & compact summaries) */
  chat(params: ChatParams): Promise<ProviderResponse>

  /** Streaming call — yields events as the model generates content */
  stream(params: ChatParams): AsyncGenerator<StreamEvent, void, undefined>
}
