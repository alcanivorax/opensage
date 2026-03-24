import type Anthropic from '@anthropic-ai/sdk'
import { shellToolDef, runCommand } from './shell.js'
import { readFileToolDef, readFile } from './files.js'
import { writeFileToolDef, writeFile } from './files.js'
import { webFetchToolDef, webFetch } from './web.js'
import { webSearchToolDef, webSearch } from './web.js'
import { saveMemoryToolDef, saveMemoryTool } from './memory.js'
import { downloadFileToolDef, downloadFile } from './download.js'
import { gmailListToolDef, gmailList } from './gmail.js'
import { gmailReadToolDef, gmailRead } from './gmail.js'
import { gmailSendToolDef, gmailSend } from './gmail.js'
import { gmailDraftToolDef, gmailDraft } from './gmail.js'
import { systemInfoToolDef, getSystemInfo } from './system.js'
import { readClipboardToolDef, readClipboard } from './system.js'
import { writeClipboardToolDef, writeClipboard } from './system.js'
import { openPathToolDef, openPath } from './system.js'
import {
  listExternalTools,
  loadExternalTool,
  executeExternalTool,
} from './registry.js'

// ─── Static tool registry ──────────────────────────────────────────────────────

/** Built-in tool definitions sent to the model. */
export const TOOLS: Anthropic.Tool[] = [
  // ── File system ────────────────────────────────────────────────────────────
  shellToolDef,
  readFileToolDef,
  writeFileToolDef,
  downloadFileToolDef,

  // ── Web ────────────────────────────────────────────────────────────────────
  webFetchToolDef,
  webSearchToolDef,

  // ── Gmail ──────────────────────────────────────────────────────────────────
  gmailListToolDef,
  gmailReadToolDef,
  gmailSendToolDef,
  gmailDraftToolDef,

  // ── System ─────────────────────────────────────────────────────────────────
  systemInfoToolDef,
  readClipboardToolDef,
  writeClipboardToolDef,
  openPathToolDef,

  // ── Memory ─────────────────────────────────────────────────────────────────
  saveMemoryToolDef,
]

/**
 * Returns all tool definitions — built-in tools plus any installed external
 * tools. Call this instead of the static TOOLS constant when building the
 * request to the LLM so external tools are included.
 */
export function getAllTools(): Anthropic.Tool[] {
  const external = listExternalTools()

  if (external.length === 0) return TOOLS

  const externalDefs: Anthropic.Tool[] = external.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool['input_schema'],
  }))

  return [...TOOLS, ...externalDefs]
}

// ─── Safety classification ─────────────────────────────────────────────────────

/**
 * Tools that run without user confirmation.
 * Every tool in this set must be read-only or trivially reversible.
 */
export const SAFE_TOOLS = new Set([
  'read_file',
  'web_fetch',
  'web_search',
  'gmail_list',
  'gmail_read',
  'get_system_info',
  'read_clipboard',
  'write_clipboard',
  'open_path',
  'save_memory',
])

/**
 * Tools whose output is intermediate data consumed by the model.
 * We show a compact one-line status instead of a full result box.
 */
export const COMPACT_TOOLS = new Set([
  'read_file',
  'web_fetch',
  'web_search',
  'gmail_list',
  'gmail_read',
  'get_system_info',
  'read_clipboard',
  'save_memory',
])

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // File system
    case 'run_command':
      return runCommand(input as Parameters<typeof runCommand>[0])
    case 'read_file':
      return readFile(input as Parameters<typeof readFile>[0])
    case 'write_file':
      return writeFile(input as Parameters<typeof writeFile>[0])
    case 'download_file':
      return downloadFile(input as Parameters<typeof downloadFile>[0])

    // Web
    case 'web_fetch':
      return webFetch(input as Parameters<typeof webFetch>[0])
    case 'web_search':
      return webSearch(input as Parameters<typeof webSearch>[0])

    // Gmail
    case 'gmail_list':
      return gmailList(input as Parameters<typeof gmailList>[0])
    case 'gmail_read':
      return gmailRead(input as Parameters<typeof gmailRead>[0])
    case 'gmail_send':
      return gmailSend(input as Parameters<typeof gmailSend>[0])
    case 'gmail_draft':
      return gmailDraft(input as Parameters<typeof gmailDraft>[0])

    // System
    case 'get_system_info':
      return getSystemInfo(input as Parameters<typeof getSystemInfo>[0])
    case 'read_clipboard':
      return readClipboard()
    case 'write_clipboard':
      return writeClipboard(input as Parameters<typeof writeClipboard>[0])
    case 'open_path':
      return openPath(input as Parameters<typeof openPath>[0])

    // Memory
    case 'save_memory':
      return saveMemoryTool(input as Parameters<typeof saveMemoryTool>[0])

    default: {
      // Try installed external tools before giving up
      const externalTool = loadExternalTool(name)
      if (externalTool) {
        return executeExternalTool(externalTool, input)
      }

      const available = getAllTools()
        .map((t) => t.name)
        .join(', ')
      return `Unknown tool: "${name}". Available tools: ${available}`
    }
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

/** Short hint shown next to the tool name in the terminal. */
export function toolLabel(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case 'run_command':
      return String(input['command'] ?? '')
    case 'read_file':
      return String(input['path'] ?? '')
    case 'write_file':
      return String(input['path'] ?? '')
    case 'download_file':
      return String(input['url'] ?? '')
    case 'web_fetch':
      return String(input['url'] ?? '')
    case 'web_search':
      return String(input['query'] ?? '')
    case 'gmail_list':
      return String(input['query'] ?? 'inbox')
    case 'gmail_read':
      return String(input['messageId'] ?? '')
    case 'gmail_send':
      return `to: ${String(input['to'] ?? '')} · ${String(input['subject'] ?? '')}`
    case 'gmail_draft':
      return `draft · ${String(input['subject'] ?? '')}`
    case 'get_system_info':
      return String(input['type'] ?? 'all')
    case 'read_clipboard':
      return ''
    case 'write_clipboard':
      return String(input['text'] ?? '').slice(0, 40)
    case 'open_path':
      return String(input['target'] ?? '')
    case 'save_memory':
      return String(input['content'] ?? '').slice(0, 50)
    default: {
      // For external tools, show the first input value as a hint
      const firstVal = Object.values(input)[0]
      return firstVal !== undefined ? String(firstVal).slice(0, 40) : ''
    }
  }
}

/** One-line summary shown after a compact tool finishes. */
export function compactSummary(name: string, result: string): string {
  // Surface errors regardless of tool
  if (
    result.startsWith('Error:') ||
    result.startsWith('Fetch error:') ||
    result.startsWith('Search error:') ||
    result.startsWith('Gmail API')
  ) {
    return result.slice(0, 80)
  }

  const lineCount = result.split('\n').length

  switch (name) {
    case 'web_search': {
      const hits = (result.match(/^\d+\./gm) ?? []).length
      return hits > 0 ? `${hits} result${hits !== 1 ? 's' : ''}` : 'no results'
    }
    case 'web_fetch':
      return `${lineCount} lines`
    case 'read_file':
      return `${lineCount} line${lineCount !== 1 ? 's' : ''}`
    case 'gmail_list': {
      const emails = (result.match(/^ID:/gm) ?? []).length
      return `${emails} email${emails !== 1 ? 's' : ''}`
    }
    case 'gmail_read':
      return `email loaded · ${lineCount} lines`
    case 'get_system_info':
      return 'system info loaded'
    case 'read_clipboard':
      return `${result.length} chars from clipboard`
    case 'save_memory':
      return 'saved to memory'
    default:
      return 'done'
  }
}
