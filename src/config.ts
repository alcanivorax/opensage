import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { ProviderName } from './providers/index.js'

// ─── Paths ───────────────────────────────────────────────────────────────────

export const CONFIG_DIR = path.join(os.homedir(), '.aichat')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
export const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json')

// ─── Types ───────────────────────────────────────────────────────────────────

export interface McpServer {
  name: string
  url: string
}

export interface Config {
  // Active provider & model
  provider: ProviderName
  model: string

  // API keys per provider
  apiKeys: {
    anthropic?: string
    openrouter?: string
  }

  // Shared settings
  systemPrompt: string
  maxTokens: number
  autoApprove: boolean
  mcpServers: McpServer[]
  sensitiveTools: string[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: any
}

export interface HistoryEntry {
  timestamp: string
  messages: Message[]
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: Config = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  apiKeys: {},

  systemPrompt: `You are aichat, a powerful personal AI assistant running in the user's terminal. You have direct access to their computer and Gmail.

When given a task, use your tools to actually complete it — do not just describe what to do.

## Available tools

### File system
- run_command    — execute any shell command (git, npm, python, ffmpeg, etc.)
- read_file      — read a file from disk
- write_file     — create or overwrite a file
- download_file  — download any file from a URL (images, PDFs, ZIPs, videos, etc.)

### Web
- web_search     — search the web via DuckDuckGo for current information
- web_fetch      — fetch and read any URL as text

### Gmail  (requires /gmail-auth setup)
- gmail_list     — list or search emails (supports Gmail query syntax: is:unread, from:x, subject:y, newer_than:2d, has:attachment, etc.)
- gmail_read     — read the full content of an email by ID
- gmail_send     — send an email  ← ALWAYS show the full draft and wait for explicit user confirmation first
- gmail_draft    — save an email as a draft without sending

### System
- get_system_info  — disk usage, memory, CPU, running processes, network
- read_clipboard   — read the current clipboard content
- write_clipboard  — copy text to the clipboard
- open_path        — open a file or URL with the default system app (browser, viewer, etc.)

### Memory
- save_memory    — persist an important fact, preference, or note across sessions

## Rules
- For gmail_send: always display the complete draft (To, Subject, full body) and explicitly ask the user to confirm before calling the tool.
- For gmail_draft: no confirmation needed.
- If Gmail tools return "not configured", tell the user to run /gmail-auth.
- Prefer doing over describing. Be concise.`,

  maxTokens: 4096,
  autoApprove: false,

  // MCP servers — empty by default; add your own if needed.
  // Note: Anthropic's managed MCP servers (gmail.mcp.claude.com) only work
  // inside Claude.ai, not via the raw API. Use the built-in gmail_* tools instead.
  mcpServers: [],

  sensitiveTools: [
    // Gmail write actions
    'gmail_send',
    // File system mutations
    'run_command',
    'write_file',
    'download_file',
    // Legacy MCP names (kept for compatibility if someone re-adds MCP servers)
    'send_email',
    'create_draft',
    'reply_to_email',
    'forward_email',
    'delete_email',
    'move_email',
    'modify_labels',
    'create_event',
    'update_event',
    'delete_event',
    'respond_to_invite',
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
}

export function loadConfig(): Config {
  ensureDir()
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      // Backwards-compat: migrate old single apiKey field
      if (saved.apiKey && !saved.apiKeys) {
        saved.apiKeys = { anthropic: saved.apiKey }
        delete saved.apiKey
      }
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...saved.apiKeys },
      }
    } catch {
      return DEFAULT_CONFIG
    }
  }
  return DEFAULT_CONFIG
}

export function saveConfig(config: Config): void {
  ensureDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

/**
 * Return the active API key for the current provider, checking env vars too.
 *
 * Resolution order:
 *   1. Saved key for the configured provider  (config.apiKeys.*)
 *   2. Env var for the configured provider    (ANTHROPIC_API_KEY / OPENROUTER_API_KEY)
 *   3. Any other saved/env key               (fallback for first-time users who only
 *      have e.g. OPENROUTER_API_KEY set but haven't changed the default provider yet)
 *
 * The caller is responsible for calling detectProvider(key) and updating
 * config.provider when the returned key belongs to a different provider.
 */
export function resolveApiKey(config: Config): string | undefined {
  const { provider, apiKeys } = config

  // ── Primary: try the configured provider first ────────────────────────────
  if (provider === 'anthropic') {
    const key = apiKeys.anthropic ?? process.env.ANTHROPIC_API_KEY
    if (key) return key
  }
  if (provider === 'openrouter') {
    const key = apiKeys.openrouter ?? process.env.OPENROUTER_API_KEY
    if (key) return key
  }

  // ── Fallback: try every other known key in priority order ─────────────────
  // This lets first-time users start immediately with just OPENROUTER_API_KEY
  // even though the default provider is "anthropic".
  return (
    apiKeys.anthropic ??
    process.env.ANTHROPIC_API_KEY ??
    apiKeys.openrouter ??
    process.env.OPENROUTER_API_KEY
  )
}

export function loadHistory(): HistoryEntry[] {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
    } catch {
      return []
    }
  }
  return []
}

export function saveHistory(messages: Message[]): void {
  ensureDir()
  const history = loadHistory()
  const simplified = messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }))
  history.push({ timestamp: new Date().toISOString(), messages: simplified })
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-50), null, 2))
}
