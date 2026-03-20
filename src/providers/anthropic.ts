import Anthropic from '@anthropic-ai/sdk'
import type {
  Provider,
  ProviderResponse,
  StreamEvent,
  ChatParams,
} from './types.js'

export class AnthropicProvider implements Provider {
  name = 'Anthropic'
  supportsMcp = true

  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  // ─── Shared request builder ───────────────────────────────────────────────

  private buildRequest(params: ChatParams): Record<string, unknown> {
    const anthropicTools: Anthropic.Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }))

    const request: Record<string, unknown> = {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      tools: anthropicTools,
      messages: params.messages,
    }

    if (params.mcpServers.length > 0) {
      request['mcp_servers'] = params.mcpServers.map((s) => ({
        type: 'url',
        url: s.url,
        name: s.name,
      }))
      request['tool_choice'] = { type: 'auto' }
    }

    return request
  }

  // ─── Non-streaming ────────────────────────────────────────────────────────

  async chat(params: ChatParams): Promise<ProviderResponse> {
    const request = this.buildRequest(params)
    const response = await (this.client.messages.create as any)(request)

    const textBlocks: string[] = []
    const toolCalls: ProviderResponse['toolCalls'] = []

    for (const block of response.content as Array<Record<string, unknown>>) {
      if (block['type'] === 'text' && block['text']) {
        textBlocks.push(block['text'] as string)
      } else if (block['type'] === 'tool_use') {
        toolCalls.push({
          id: block['id'] as string,
          name: block['name'] as string,
          input: block['input'] as Record<string, unknown>,
          isMcp: false,
        })
      } else if (block['type'] === 'mcp_tool_use') {
        toolCalls.push({
          id: block['id'] as string,
          name: block['name'] as string,
          input: block['input'] as Record<string, unknown>,
          isMcp: true,
        })
      }
    }

    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
    }

    return {
      textBlocks,
      toolCalls,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      stopReason: (response.stop_reason as string) ?? 'end_turn',
    }
  }

  // ─── Streaming ────────────────────────────────────────────────────────────

  async *stream(
    params: ChatParams
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const request = this.buildRequest(params)

    // messages.stream() returns a MessageStream (async iterable of raw SSE events)
    const messageStream = (this.client.messages as any).stream(request)

    // Accumulate tool-call inputs as JSON deltas arrive
    const pending: Record<
      number,
      { id: string; name: string; json: string; isMcp: boolean }
    > = {}

    for await (const event of messageStream as AsyncIterable<
      Record<string, unknown>
    >) {
      const eventType = event['type'] as string

      switch (eventType) {
        case 'content_block_start': {
          const block = event['content_block'] as Record<string, unknown>
          const idx = event['index'] as number
          const btype = block['type'] as string

          if (btype === 'tool_use' || btype === 'mcp_tool_use') {
            pending[idx] = {
              id: block['id'] as string,
              name: block['name'] as string,
              json: '',
              isMcp: btype === 'mcp_tool_use',
            }
            yield {
              type: 'tool_start',
              id: pending[idx].id,
              name: pending[idx].name,
            }
          }
          break
        }

        case 'content_block_delta': {
          const delta = event['delta'] as Record<string, unknown>
          const idx = event['index'] as number
          const dtype = delta['type'] as string

          if (dtype === 'text_delta') {
            yield { type: 'text_delta', text: delta['text'] as string }
          } else if (
            dtype === 'input_json_delta' &&
            pending[idx] !== undefined
          ) {
            pending[idx].json += (delta['partial_json'] as string) ?? ''
          }
          break
        }

        case 'content_block_stop': {
          const idx = event['index'] as number
          const pt = pending[idx]
          if (pt !== undefined) {
            let input: Record<string, unknown> = {}
            try {
              input = JSON.parse(pt.json || '{}') as Record<string, unknown>
            } catch {
              // malformed JSON — keep empty object
            }
            yield {
              type: 'tool_done',
              id: pt.id,
              name: pt.name,
              input,
              isMcp: pt.isMcp,
            }
            delete pending[idx]
          }
          break
        }

        default:
          break
      }
    }

    // finalMessage() resolves after the stream is fully consumed
    const final = (await (messageStream as any).finalMessage()) as {
      usage: { input_tokens: number; output_tokens: number }
      stop_reason: string | null
    }

    yield {
      type: 'end',
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      stopReason: final.stop_reason ?? 'end_turn',
    }
  }
}
