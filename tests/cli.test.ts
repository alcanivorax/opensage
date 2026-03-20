import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { detectProvider } from '../src/providers/index.js'
import { buildMemoryContext } from '../src/tools/memory.js'
import type { MemoryEntry } from '../src/tools/memory.js'

// ─── Config defaults ──────────────────────────────────────────────────────────

describe('DEFAULT_CONFIG', () => {
  it('uses anthropic as the default provider', () => {
    expect(DEFAULT_CONFIG.provider).toBe('anthropic')
  })

  it('uses a Claude model by default', () => {
    expect(DEFAULT_CONFIG.model).toMatch(/claude/)
  })

  it('has a positive maxTokens value', () => {
    expect(DEFAULT_CONFIG.maxTokens).toBeGreaterThan(0)
  })

  it('includes run_command and write_file in sensitiveTools', () => {
    expect(DEFAULT_CONFIG.sensitiveTools).toContain('run_command')
    expect(DEFAULT_CONFIG.sensitiveTools).toContain('write_file')
  })

  it('has MCP servers as an empty array by default', () => {
    // MCP servers are empty by default — Gmail is handled via local gmail_* tools
    expect(Array.isArray(DEFAULT_CONFIG.mcpServers)).toBe(true)
    expect(DEFAULT_CONFIG.mcpServers.length).toBe(0)
  })

  it('starts with autoApprove disabled', () => {
    expect(DEFAULT_CONFIG.autoApprove).toBe(false)
  })
})

// ─── Provider detection ───────────────────────────────────────────────────────

describe('detectProvider', () => {
  it('detects anthropic from sk-ant- prefix', () => {
    expect(detectProvider('sk-ant-abc123')).toBe('anthropic')
  })

  it('detects openrouter from sk-or- prefix', () => {
    expect(detectProvider('sk-or-abc123')).toBe('openrouter')
  })

  it('defaults to openrouter for an unrecognised key', () => {
    expect(detectProvider('unknown-key-format')).toBe('openrouter')
  })

  it('defaults to openrouter for an empty string', () => {
    expect(detectProvider('')).toBe('openrouter')
  })
})

// ─── Memory context builder ───────────────────────────────────────────────────

describe('buildMemoryContext', () => {
  it('returns an empty string when there are no entries', () => {
    expect(buildMemoryContext([])).toBe('')
  })

  it('includes the entry content in the output', () => {
    const entries: MemoryEntry[] = [
      {
        id: 'abc',
        content: 'User prefers TypeScript',
        category: 'preference',
        timestamp: new Date().toISOString(),
      },
    ]
    const ctx = buildMemoryContext(entries)
    expect(ctx).toContain('User prefers TypeScript')
  })

  it('groups entries by category', () => {
    const entries: MemoryEntry[] = [
      {
        id: '1',
        content: 'Likes dark mode',
        category: 'preference',
        timestamp: '',
      },
      {
        id: '2',
        content: 'Name is Alice',
        category: 'personal',
        timestamp: '',
      },
      { id: '3', content: 'Uses pnpm', category: 'preference', timestamp: '' },
    ]
    const ctx = buildMemoryContext(entries)
    expect(ctx).toContain('preference')
    expect(ctx).toContain('personal')
    expect(ctx).toContain('Likes dark mode')
    expect(ctx).toContain('Name is Alice')
    expect(ctx).toContain('Uses pnpm')
  })

  it('includes the Persistent Memory header', () => {
    const entries: MemoryEntry[] = [
      { id: 'x', content: 'anything', category: 'general', timestamp: '' },
    ]
    expect(buildMemoryContext(entries)).toContain('Persistent Memory')
  })
})
