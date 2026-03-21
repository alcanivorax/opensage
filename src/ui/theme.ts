import chalk from 'chalk'

// ─── Claude Code-inspired Colour Palette ─────────────────────────────────────
//
// Clean, minimal design with clear hierarchy.
// Monochrome base with strategic amber brand identity.
//
const c = {
  brand: chalk.hex('#F59E0B'),
  brandBright: chalk.hex('#D97757'),
  accent: chalk.hex('#67E8F9'),
  success: chalk.hex('#34D399'),
  warn: chalk.hex('#FCD34D'),
  error: chalk.hex('#F87171'),
  tool: chalk.hex('#A78BFA'),
  primary: chalk.hex('#F8FAFC'),
  white: chalk.hex('#E2E8F0'),
  muted: chalk.hex('#94A3B8'),
  dim: chalk.hex('#475569'),
  subtle: chalk.hex('#334155'),
  user: chalk.hex('#F472B6'),
  assistant: chalk.hex('#A78BFA'),
  system: chalk.hex('#34D399'),
}

export const T = {
  ...c,

  brandDim: c.brand,

  boxTopDouble: (label: string, width: number): string => {
    const len = label.length
    const pad = Math.max(0, width - len - 4)
    return (
      c.dim('╔') +
      c.dim('═') +
      (label ? c.muted(' ' + label + ' ') : ' ') +
      c.dim('═'.repeat(pad + 2)) +
      c.dim('╗')
    )
  },

  boxBottomDouble: (width: number): string =>
    c.dim('╚' + '═'.repeat(width + 4) + '╝'),

  boxTop: (label: string, width: number): string => {
    const len = label.length
    const pad = Math.max(0, width - len - 4)
    return (
      c.dim('╭─ ') + c.muted(label) + c.dim(' ' + '─'.repeat(pad + 2) + '╮')
    )
  },

  boxBottom: (width: number): string =>
    c.dim('╰' + '─'.repeat(width + 4) + '╯'),

  boxSep: (width: number): string => c.dim('├' + '─'.repeat(width + 4) + '┤'),

  vbar: c.dim('│'),

  arrow: c.dim('›'),
  bullet: c.muted('•'),
  dash: c.dim('─'),

  check: c.success('✓'),
  cross: c.error('✗'),

  thinking: (label: string) => c.muted(`◌ ${label}`),
  executing: c.muted('↻'),
  toolIcon: c.tool('⚡'),

  header: (icon: string, text: string) =>
    c.muted(icon) + ' ' + chalk.bold.white(text),

  kv: (key: string, value: string) => c.muted(key.padEnd(14)) + c.white(value),

  dimText: (text: string) => c.dim(text),
  mutedItalic: (text: string) => chalk.italic.dim(text),

  hr: () => c.dim('─'.repeat(74)),
  sep: () => c.dim('·'),
} as const

export const TERM_WIDTH = 80
export const CONTENT_WIDTH = 72
export const INDENT = '  '
