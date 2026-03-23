import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface ExternalTool {
  name: string
  description: string
  source: string
  installedAt?: string
}

interface ToolManifest {
  name: string
  version: string
  description: string
  tools: {
    name: string
    description: string
    input_schema: Record<string, unknown>
  }[]
}

const EXTERNAL_TOOLS_DIR = path.join(os.homedir(), '.opensage', 'tools')
const REGISTRY_FILE = path.join(EXTERNAL_TOOLS_DIR, 'registry.json')

function ensureToolsDir(): void {
  if (!fs.existsSync(EXTERNAL_TOOLS_DIR)) {
    fs.mkdirSync(EXTERNAL_TOOLS_DIR, { recursive: true })
  }
}

function getRegistry(): ExternalTool[] {
  ensureToolsDir()
  if (!fs.existsSync(REGISTRY_FILE)) {
    return []
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveRegistry(registry: ExternalTool[]): void {
  ensureToolsDir()
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2))
}

export async function fetchToolManifest(
  repo: string
): Promise<ToolManifest | null> {
  const url = `https://raw.githubusercontent.com/${repo}/main/tool.json`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function installTool(
  repo: string,
  toolName?: string
): Promise<{ success: boolean; message: string; installed?: string[] }> {
  ensureToolsDir()

  const manifest = await fetchToolManifest(repo)
  if (!manifest) {
    return {
      success: false,
      message: `Could not fetch tool manifest from ${repo}. Make sure the repository exists and has a tool.json file.`,
    }
  }

  const toolsToInstall = toolName
    ? manifest.tools.filter((t) => t.name === toolName)
    : manifest.tools

  if (toolsToInstall.length === 0) {
    return {
      success: false,
      message: toolName
        ? `Tool "${toolName}" not found in ${repo}`
        : 'No tools found in manifest',
    }
  }

  const installed: string[] = []
  const registry = getRegistry()

  for (const tool of toolsToInstall) {
    const toolDir = path.join(EXTERNAL_TOOLS_DIR, tool.name)
    if (!fs.existsSync(toolDir)) {
      fs.mkdirSync(toolDir, { recursive: true })
    }

    const toolFile = path.join(toolDir, 'index.js')
    const wrapperCode = `// Auto-generated wrapper for ${tool.name}
// Source: ${repo}
module.exports = {
  name: '${tool.name}',
  description: '${tool.description}',
  input_schema: ${JSON.stringify(tool.input_schema)},
  execute: async function(input) {
    // Placeholder - actual implementation would come from the tool source
    return JSON.stringify({ status: 'ok', tool: '${tool.name}', input });
  }
};
`
    fs.writeFileSync(toolFile, wrapperCode)

    const existing = registry.find((t) => t.name === tool.name)
    if (existing) {
      existing.source = repo
      existing.installedAt = new Date().toISOString()
    } else {
      registry.push({
        name: tool.name,
        description: tool.description,
        source: repo,
        installedAt: new Date().toISOString(),
      })
    }
    installed.push(tool.name)
  }

  saveRegistry(registry)

  return {
    success: true,
    message: `Installed ${installed.length} tool(s): ${installed.join(', ')}`,
    installed,
  }
}

export function listExternalTools(): ExternalTool[] {
  return getRegistry()
}

export function removeTool(toolName: string): boolean {
  const registry = getRegistry()
  const index = registry.findIndex((t) => t.name === toolName)
  if (index === -1) return false

  const toolDir = path.join(EXTERNAL_TOOLS_DIR, toolName)
  if (fs.existsSync(toolDir)) {
    fs.rmSync(toolDir, { recursive: true })
  }

  registry.splice(index, 1)
  saveRegistry(registry)
  return true
}

export function loadExternalTool(name: string): unknown | null {
  const toolDir = path.join(EXTERNAL_TOOLS_DIR, name, 'index.js')
  if (!fs.existsSync(toolDir)) return null
  try {
    return require(toolDir)
  } catch {
    return null
  }
}

export function getExternalToolsDir(): string {
  return EXTERNAL_TOOLS_DIR
}
