import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as child_process from 'child_process'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * How an external tool runs.
 * `shell` — executes a command string with inputs substituted as ${input.field}.
 *
 * Example executor in tool.json:
 *   "executor": { "type": "shell", "command": "curl -s 'wttr.in/${input.city}?format=3'" }
 */
export interface ToolExecutor {
  type: 'shell'
  /** Shell command template. Use ${input.<field>} to substitute tool inputs. */
  command: string
}

/** A single entry persisted in registry.json */
export interface ExternalTool {
  name: string
  description: string
  source: string
  version: string
  installedAt: string
  input_schema: Record<string, unknown>
  executor?: ToolExecutor
}

/** A single tool entry inside a remote tool.json manifest */
interface ManifestTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  executor?: ToolExecutor
}

/** Shape of tool.json in external repos */
interface ToolManifest {
  name: string
  version: string
  description: string
  tools: ManifestTool[]
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const TOOLS_DIR = path.join(os.homedir(), '.opensage', 'tools')
const REGISTRY_FILE = path.join(TOOLS_DIR, 'registry.json')
const REGISTRY_TMP = REGISTRY_FILE + '.tmp'

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidManifest(data: unknown): data is ToolManifest {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (typeof d['name'] !== 'string' || !d['name'].trim()) return false
  if (!Array.isArray(d['tools'])) return false

  for (const raw of d['tools']) {
    if (!raw || typeof raw !== 'object') return false
    const t = raw as Record<string, unknown>
    if (typeof t['name'] !== 'string' || !t['name'].trim()) return false
    if (typeof t['description'] !== 'string') return false
    if (!t['input_schema'] || typeof t['input_schema'] !== 'object')
      return false

    // Validate executor if present
    if (t['executor'] !== undefined) {
      const exec = t['executor'] as Record<string, unknown>
      if (exec['type'] !== 'shell') return false
      if (typeof exec['command'] !== 'string' || !exec['command'].trim())
        return false
    }
  }

  return true
}

/** Sanitise a raw tool name to a safe identifier (letters, digits, underscores, hyphens only). */
function sanitiseName(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

// ─── Storage (atomic) ─────────────────────────────────────────────────────────

function ensureDir(): void {
  fs.mkdirSync(TOOLS_DIR, { recursive: true })
}

function readRegistry(): ExternalTool[] {
  ensureDir()
  if (!fs.existsSync(REGISTRY_FILE)) return []
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as ExternalTool[]) : []
  } catch {
    return []
  }
}

/**
 * Atomic write: serialise to a .tmp file first, then rename into place.
 * This prevents partial/corrupt writes if the process dies mid-write.
 */
function writeRegistry(registry: ExternalTool[]): void {
  ensureDir()
  try {
    fs.writeFileSync(REGISTRY_TMP, JSON.stringify(registry, null, 2), 'utf-8')
    fs.renameSync(REGISTRY_TMP, REGISTRY_FILE)
  } catch (err) {
    // Best-effort cleanup of the temp file before re-throwing
    try {
      fs.unlinkSync(REGISTRY_TMP)
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Registry write failed: ${msg}`)
  }
}

// ─── Manifest fetching ────────────────────────────────────────────────────────

/**
 * Fetch and validate a tool.json manifest from a GitHub repo.
 * Tries `main` first, then falls back to `master`.
 */
export async function fetchToolManifest(
  repo: string
): Promise<ToolManifest | null> {
  // Normalise: strip protocol and trailing .git
  const clean = repo
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .trim()

  const branches = ['main', 'master']

  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${clean}/${branch}/tool.json`
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) continue

      const data: unknown = await response.json()

      if (!isValidManifest(data)) {
        // Manifest exists but is malformed — don't try master if main was found
        return null
      }

      return data
    } catch (err) {
      // Timeout or network error — try next branch
      if (err instanceof Error && err.name === 'TimeoutError') continue
      continue
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listExternalTools(): ExternalTool[] {
  return readRegistry()
}

export function loadExternalTool(name: string): ExternalTool | null {
  return readRegistry().find((t) => t.name === name) ?? null
}

export function getExternalToolsDir(): string {
  return TOOLS_DIR
}

// ─── Install ──────────────────────────────────────────────────────────────────

export async function installTool(
  repo: string,
  toolName?: string
): Promise<{ success: boolean; message: string; installed?: string[] }> {
  const manifest = await fetchToolManifest(repo)

  if (!manifest) {
    return {
      success: false,
      message: `Could not fetch a valid tool.json from "${repo}". Check that the repo exists and its tool.json is valid.`,
    }
  }

  const candidates = toolName
    ? manifest.tools.filter((t) => t.name === toolName)
    : manifest.tools

  if (candidates.length === 0) {
    return {
      success: false,
      message: toolName
        ? `Tool "${toolName}" was not found in ${repo}.`
        : `No tools are defined in the manifest for ${repo}.`,
    }
  }

  const registry = readRegistry()
  const installed: string[] = []
  const now = new Date().toISOString()

  for (const tool of candidates) {
    const safeName = sanitiseName(tool.name)
    if (!safeName) continue

    const entry: ExternalTool = {
      name: safeName,
      description: tool.description,
      source: repo,
      version: manifest.version ?? '0.0.0',
      installedAt: now,
      input_schema: tool.input_schema,
      ...(tool.executor ? { executor: tool.executor } : {}),
    }

    const existingIdx = registry.findIndex((t) => t.name === safeName)
    if (existingIdx >= 0) {
      // Update in place (re-install / upgrade)
      registry[existingIdx] = entry
    } else {
      registry.push(entry)
    }

    installed.push(safeName)
  }

  try {
    writeRegistry(registry)
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  const noun = installed.length === 1 ? 'tool' : 'tools'
  return {
    success: true,
    message: `Installed ${installed.length} ${noun}: ${installed.join(', ')}`,
    installed,
  }
}

// ─── Remove ───────────────────────────────────────────────────────────────────

export function removeTool(toolName: string): boolean {
  const registry = readRegistry()
  const idx = registry.findIndex((t) => t.name === toolName)
  if (idx === -1) return false

  registry.splice(idx, 1)

  try {
    writeRegistry(registry)
    return true
  } catch {
    return false
  }
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Execute an installed external tool with the given input.
 *
 * Currently supports `shell` executors only.
 * Shell commands are template strings with ${input.<field>} substitutions.
 * All substituted values are single-quote escaped to prevent injection.
 */
export async function executeExternalTool(
  tool: ExternalTool,
  input: Record<string, unknown>
): Promise<string> {
  if (!tool.executor) {
    return (
      `Error: Tool "${tool.name}" has no executor. ` +
      `Reinstall it from a repo that provides an executor in tool.json.`
    )
  }

  if (tool.executor.type === 'shell') {
    const command = interpolateCommand(tool.executor.command, input)
    return runShellCommand(command)
  }

  return `Error: Unknown executor type "${(tool.executor as { type: string }).type}".`
}

/**
 * Replace ${input.<field>} placeholders in a shell command template.
 * Values are shell-escaped with single quotes to prevent injection.
 */
function interpolateCommand(
  template: string,
  input: Record<string, unknown>
): string {
  return template.replace(/\$\{input\.(\w+)\}/g, (match, key: string) => {
    const val = input[key]
    if (val === undefined || val === null) return ''
    // Wrap in single quotes and escape any embedded single quotes
    const escaped = String(val).replace(/'/g, "'\\''")
    return `'${escaped}'`
  })
}

function runShellCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(
      command,
      { timeout: 30_000, maxBuffer: 1024 * 512 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr?.trim() || err.message).slice(0, 500)
          resolve(`Error: ${detail}`)
        } else {
          resolve(stdout.trim() || '(no output)')
        }
      }
    )
  })
}
