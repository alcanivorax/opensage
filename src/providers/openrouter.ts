import OpenAI from 'openai'
import type {
  Provider,
  ProviderMessage,
  ProviderResponse,
  StreamEvent,
  ChatParams,
} from './types.js'

// OpenRouter exposes an OpenAI-compatible API
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements Provider {
  name = 'OpenRouter'
  supportsMcp = false // OpenRouter does not support Anthropic MCP servers

  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/aichat-cli',
        'X-Title': 'aichat terminal',
      },
    })
  }

  // ── Message format conversion ────────────────────────────────────────────────

  private toOpenAiMessage(
    m: ProviderMessage
  ): OpenAI.ChatCompletionMessageParam {
    // Plain string content
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }

    if (Array.isArray(m.content)) {
      // User turn containing tool results
      const toolResults = m.content.filter((b: any) => b.type === 'tool_result')
      if (toolResults.length > 0) {
        // OpenAI expects one "tool" message per tool call result
        // Return the first one; multi-result turns are serialised below
        return {
          role: 'tool' as any,
          tool_call_id: toolResults[0].tool_use_id,
          content: toolResults
            .map((r: any) =>
              typeof r.content === 'string'
                ? r.content
                : JSON.stringify(r.content)
            )
            .join('\n'),
        } as any
      }

      // Assistant message that may contain text + tool_use blocks
      const textBlock = m.content.find((b: any) => b.type === 'text')
      const toolBlocks = m.content.filter((b: any) => b.type === 'tool_use')

      if (toolBlocks.length > 0) {
        return {
          role: 'assistant',
          content: textBlock?.text ?? null,
          tool_calls: toolBlocks.map((b: any) => ({
            id: b.id,
            type: 'function',
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input),
            },
          })),
        }
      }

      // Fallback: join all text blocks
      const text = m.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
      return { role: m.role, content: text }
    }

    return { role: m.role, content: String(m.content) }
  }

  private buildMessages(
    params: ChatParams
  ): OpenAI.ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: params.system },
      ...params.messages.map((m) => this.toOpenAiMessage(m)),
    ]
  }

  private buildTools(params: ChatParams): OpenAI.ChatCompletionTool[] {
    return params.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  // ── Non-streaming chat ────────────────────────────────────────────────────────

  async chat(params: ChatParams): Promise<ProviderResponse> {
    const tools = this.buildTools(params)

    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: this.buildMessages(params),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    })

    const choice = response.choices[0]
    const msg = choice.message

    const textBlocks: string[] = []
    const toolCalls: ProviderResponse['toolCalls'] = []

    if (msg.content) textBlocks.push(msg.content)

    for (const tc of msg.tool_calls ?? []) {
      const fn = (tc as any).function as
        | { name: string; arguments: string }
        | undefined
      if (!fn) continue
      let input: Record<string, any> = {}
      try {
        input = JSON.parse(fn.arguments)
      } catch {
        /* keep empty */
      }
      toolCalls.push({ id: tc.id, name: fn.name, input, isMcp: false })
    }

    return {
      textBlocks,
      toolCalls,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      stopReason: choice.finish_reason ?? 'stop',
    }
  }

  // ── Streaming chat ────────────────────────────────────────────────────────────

  async *stream(
    params: ChatParams
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const tools = this.buildTools(params)

    // `stream_options: { include_usage: true }` makes the final chunk carry usage data.
    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: this.buildMessages(params),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      stream: true,
      stream_options: { include_usage: true },
    } as any)

    // Accumulate tool-call fragments indexed by their position in the delta array
    const pending: Record<number, { id: string; name: string; args: string }> =
      {}
    let inputTokens = 0
    let outputTokens = 0
    let stopReason = 'stop'

    for await (const chunk of response as any) {
      // Usage is sent in the final chunk when stream_options.include_usage is set
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0
        outputTokens = chunk.usage.completion_tokens ?? 0
      }

      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      // Text content
      if (delta.content) {
        yield { type: 'text_delta', text: delta.content }
      }

      // Tool-call fragments — each delta may carry partial function names / arguments
      for (const tc of (delta.tool_calls ?? []) as any[]) {
        const idx = tc.index as number

        if (!pending[idx]) {
          // First fragment for this call: id and name arrive here
          const id = tc.id ?? `call_${idx}`
          const name = tc.function?.name ?? ''
          pending[idx] = { id, name, args: '' }
          // Only emit tool_start once we have a name (always true on first fragment for OpenAI)
          yield { type: 'tool_start', id, name }
        }

        if (tc.function?.arguments) {
          pending[idx].args += tc.function.arguments
        }
      }

      const fr = chunk.choices?.[0]?.finish_reason
      if (fr) stopReason = fr
    }

    // Emit completed tool calls after the stream ends
    for (const pc of Object.values(pending)) {
      let input: Record<string, any> = {}
      try {
        input = JSON.parse(pc.args || '{}')
      } catch {
        /* keep empty */
      }
      yield { type: 'tool_done', id: pc.id, name: pc.name, input, isMcp: false }
    }

    yield { type: 'end', inputTokens, outputTokens, stopReason }
  }
}
