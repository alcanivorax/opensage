import Anthropic from '@anthropic-ai/sdk'
import type {
  Provider,
  ProviderResponse,
  StreamEvent,
  ChatParams,
} from './types.js'

type StreamResult = AsyncIterable<Record<string, unknown>> & {
  finalMessage(): Promise<{
    usage: { input_tokens: number; output_tokens: number }
    stop_reason: string | null
  }>
}

export class AnthropicProvider implements Provider {
  name = 'Anthropic'
  supportsMcp = true

  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  private buildRequest(
    params: ChatParams
  ): Anthropic.MessageCreateParamsNonStreaming {
    const anthropicTools: Anthropic.Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }))

    return {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      tools: anthropicTools,
      messages: params.messages as Anthropic.MessageParam[],
    }
  }

  async chat(params: ChatParams): Promise<ProviderResponse> {
    const request = this.buildRequest(params)
    const response = await this.client.messages.create(request)

    const textBlocks: string[] = []
    const toolCalls: ProviderResponse['toolCalls'] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text)
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
          isMcp: false,
        })
      }
    }

    return {
      textBlocks,
      toolCalls,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason ?? 'end_turn',
    }
  }

  async *stream(
    params: ChatParams
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const request = this.buildRequest(params)
    const streamResponse = await this.client.messages.create({
      ...request,
      stream: true,
    })

    const messageStream = streamResponse as unknown as StreamResult

    const pending: Record<number, { id: string; name: string; json: string }> =
      {}

    for await (const event of messageStream) {
      const eventType = event['type'] as string

      switch (eventType) {
        case 'content_block_start': {
          const block = event['content_block'] as Record<string, unknown>
          const idx = event['index'] as number
          const btype = block['type'] as string

          if (btype === 'tool_use') {
            pending[idx] = {
              id: block['id'] as string,
              name: block['name'] as string,
              json: '',
            }
            yield {
              type: 'tool_start',
              id: block['id'] as string,
              name: block['name'] as string,
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
            pending[idx].json += delta['partial_json'] as string
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
              console.warn(
                `[opensage] Failed to parse tool input for ${pt.name}`
              )
            }
            yield {
              type: 'tool_done',
              id: pt.id,
              name: pt.name,
              input,
              isMcp: false,
            }
            delete pending[idx]
          }
          break
        }

        default:
          break
      }
    }

    const final = await messageStream.finalMessage()

    yield {
      type: 'end',
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      stopReason: final.stop_reason ?? 'end_turn',
    }
  }
}
