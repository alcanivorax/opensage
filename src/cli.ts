#!/usr/bin/env node
/**
 * opensage CLI subcommands — no interactive UI, no API key required.
 *
 *   opensage add <tool>               install tool from default repo
 *   opensage add <owner/repo> [tool]  install from custom GitHub repo
 *   opensage add                      install ALL tools from default repo
 *   opensage remove <tool>            uninstall a tool
 *   opensage tools                    list installed tools
 *   opensage help                     print usage
 */

import chalk from 'chalk'
import { installTool, removeTool, listExternalTools } from './tools/registry.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REPO = 'alcanivorax/opensage-tools'

const KNOWN_TOOLS = [
  'git',
  'docker',
  'npm',
  'http',
  'network',
  'filesystem',
  'process',
  'system',
  'encode',
  'hash',
  'data',
  'productivity',
]

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Run a CLI subcommand from the given argv slice.
 * Returns `true` if a subcommand was matched (caller should not start the REPL).
 * Returns `false` if no subcommand was matched (caller should start the REPL).
 */
export async function runCli(args: string[]): Promise<boolean> {
  const cmd = args[0]

  switch (cmd) {
    case 'add':
      await cliAdd(args.slice(1))
      return true

    case 'remove':
    case 'rm':
      cliRemove(args.slice(1))
      return true

    case 'tools':
    case 'list':
      cliList()
      return true

    case 'help':
    case '--help':
    case '-h':
      cliHelp()
      return true

    default:
      // Unknown positional arg — let the caller decide (could be a flag etc.)
      return false
  }
}

// ─── Subcommand: add ──────────────────────────────────────────────────────────

async function cliAdd(args: string[]): Promise<void> {
  let repo = DEFAULT_REPO
  let toolName: string | undefined

  if (args.length === 0) {
    // opensage add  →  install everything from default repo
  } else if (args[0].includes('/') || args[0].startsWith('./') || args[0].startsWith('/')) {
    // opensage add owner/repo [tool]
    // opensage add ./local/path [tool]
    repo = args[0]
    toolName = args[1]
  } else {
    // opensage add <tool-name>  →  default repo
    toolName = args[0]
  }

  const target = toolName
    ? chalk.cyan(toolName)
    : chalk.dim('all tools')

  const from =
    repo === DEFAULT_REPO
      ? chalk.dim(repo)
      : chalk.yellow(repo)

  process.stdout.write(
    chalk.dim('  Fetching ') + target + chalk.dim(' from ') + from + chalk.dim('…\n')
  )

  let result: Awaited<ReturnType<typeof installTool>>
  try {
    result = await installTool(repo, toolName)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(chalk.red('  ✗ ') + msg + '\n')
    process.exitCode = 1
    return
  }

  if (!result.success) {
    process.stderr.write(chalk.red('  ✗ ') + result.message + '\n')

    // Helpful hint when the tool name looks like an old individual tool
    if (toolName && toolName.includes('_')) {
      const group = guessGroup(toolName)
      if (group) {
        process.stdout.write(
          chalk.dim(`\n  Tip: '${toolName}' is now part of the '`) +
            chalk.cyan(group) +
            chalk.dim(`' group.\n`) +
            chalk.dim(`  Run: `) +
            chalk.cyan(`opensage add ${group}`) +
            '\n'
        )
      }
    }

    process.exitCode = 1
    return
  }

  const installed = result.installed ?? []

  process.stdout.write(chalk.green('  ✓ ') + result.message + '\n')

  if (installed.length > 1) {
    process.stdout.write('\n')
    for (const name of installed) {
      process.stdout.write(chalk.dim('    ') + chalk.green('●') + ' ' + chalk.white(name) + '\n')
    }
  }
}

// ─── Subcommand: remove ───────────────────────────────────────────────────────

function cliRemove(args: string[]): void {
  const toolName = args[0]

  if (!toolName) {
    process.stderr.write(
      chalk.red('  Usage: ') + chalk.cyan('opensage remove <tool-name>') + '\n'
    )
    const installed = listExternalTools()
    if (installed.length > 0) {
      process.stdout.write(chalk.dim('\n  Installed: ') + installed.map((t) => t.name).join(', ') + '\n')
    }
    process.exitCode = 1
    return
  }

  const ok = removeTool(toolName)

  if (ok) {
    process.stdout.write(chalk.green('  ✓ ') + 'Removed: ' + chalk.cyan(toolName) + '\n')
  } else {
    process.stderr.write(chalk.red('  ✗ ') + `Tool not found: ${toolName}\n`)
    process.exitCode = 1
  }
}

// ─── Subcommand: tools ────────────────────────────────────────────────────────

function cliList(): void {
  const tools = listExternalTools()

  if (tools.length === 0) {
    process.stdout.write(chalk.dim('\n  No tools installed.\n\n'))
    process.stdout.write(
      '  Run ' +
        chalk.cyan('opensage add <tool>') +
        ' to install tools from ' +
        chalk.dim(DEFAULT_REPO) +
        '\n\n'
    )
    process.stdout.write(chalk.dim('  Available: ') + KNOWN_TOOLS.map((t) => chalk.cyan(t)).join(chalk.dim(', ')) + '\n\n')
    return
  }

  process.stdout.write('\n')
  process.stdout.write(chalk.bold(`  Installed tools`) + chalk.dim(` (${tools.length})\n\n`))

  // Group by source repo for cleaner output
  const bySource = new Map<string, typeof tools>()
  for (const tool of tools) {
    const list = bySource.get(tool.source) ?? []
    list.push(tool)
    bySource.set(tool.source, list)
  }

  for (const [source, group] of bySource) {
    process.stdout.write(chalk.dim(`  from ${source}\n`))
    for (const tool of group) {
      process.stdout.write(
        '    ' +
          chalk.green('●') +
          ' ' +
          chalk.cyan(tool.name.padEnd(16)) +
          chalk.dim(tool.description.length > 60 ? tool.description.slice(0, 57) + '…' : tool.description) +
          '\n'
      )
    }
    process.stdout.write('\n')
  }
}

// ─── Subcommand: help ─────────────────────────────────────────────────────────

function cliHelp(): void {
  const lines = [
    '',
    chalk.bold('  opensage') + chalk.dim(' — AI assistant for your terminal'),
    '',
    chalk.bold('  Usage'),
    '',
    `    ${chalk.cyan('opensage')}                           Start interactive session`,
    `    ${chalk.cyan('opensage add')} ${chalk.dim('<tool>')}               Install a tool`,
    `    ${chalk.cyan('opensage add')} ${chalk.dim('<owner/repo> [tool]')}   Install from custom repo`,
    `    ${chalk.cyan('opensage add')}                        Install all tools`,
    `    ${chalk.cyan('opensage remove')} ${chalk.dim('<tool>')}            Remove a tool`,
    `    ${chalk.cyan('opensage tools')}                     List installed tools`,
    '',
    chalk.bold('  Available tools') + chalk.dim(` (${DEFAULT_REPO})`),
    '',
    ...KNOWN_TOOLS.map((t) => `    ${chalk.green('●')} ${chalk.cyan(t)}`),
    '',
    chalk.bold('  Examples'),
    '',
    `    ${chalk.dim('$')} opensage add git`,
    `    ${chalk.dim('$')} opensage add docker`,
    `    ${chalk.dim('$')} opensage add npm`,
    `    ${chalk.dim('$')} opensage add myuser/my-tools my_custom_tool`,
    `    ${chalk.dim('$')} opensage remove git`,
    `    ${chalk.dim('$')} opensage tools`,
    '',
    chalk.bold('  Once inside the session'),
    '',
    `    ${chalk.dim('>')} ${chalk.cyan('/add git')}            install from the session`,
    `    ${chalk.dim('>')} ${chalk.cyan('/remove git')}         remove from the session`,
    `    ${chalk.dim('>')} ${chalk.cyan('/tools')}              list tools from the session`,
    '',
  ]

  process.stdout.write(lines.join('\n') + '\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given an old-style individual tool name (e.g. `git_status`), guess
 * which new group it belongs to so we can print a helpful tip.
 */
function guessGroup(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.startsWith('git_')) return 'git'
  if (lower.startsWith('docker_')) return 'docker'
  if (lower.startsWith('npm_')) return 'npm'
  if (lower.startsWith('http_')) return 'http'
  if (['ping_host', 'dns_lookup', 'open_ports'].includes(lower)) return 'network'
  if (['search_code', 'find_files', 'count_lines', 'diff_files', 'sort_lines', 'csv_preview', 'compress', 'extract', 'image_info'].includes(lower)) return 'filesystem'
  if (['list_processes', 'kill_process'].includes(lower)) return 'process'
  if (['disk_usage', 'system_info', 'env_get'].includes(lower)) return 'system'
  if (['base64_encode', 'base64_decode', 'url_encode', 'jwt_decode'].includes(lower)) return 'encode'
  if (['sha256', 'md5'].includes(lower)) return 'hash'
  if (['json_query', 'yaml_to_json', 'json_to_yaml', 'calc', 'regex_test', 'color_convert'].includes(lower)) return 'data'
  if (['weather', 'ip_info', 'timestamp', 'uuid', 'qr_code', 'lorem_ipsum', 'cron_next'].includes(lower)) return 'productivity'
  return null
}
