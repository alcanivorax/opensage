import chalk from 'chalk'

// ─── Colour palette ───────────────────────────────────────────────────────────
//
//  Brand  : violet  — the bot's identity
//  Accent : sky     — interactive elements, prompts
//  Success: emerald — confirmations, safe tools
//  Warn   : amber   — destructive actions, sensitive tools
//  Error  : rose    — failures
//  Tool   : orange  — tool-call chrome
//
//  Text hierarchy (light-on-dark terminal):
//    white  → primary content
//    muted  → secondary labels, hints
//    dim    → borders, box-drawing, chrome
//    subtle → deeply de-emphasised chrome
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  brand: chalk.hex('#8B5CF6'), // violet-500
  brandBright: chalk.hex('#A78BFA'), // violet-400
  brandDim: chalk.hex('#6D28D9'), // violet-700

  // ── Semantic ───────────────────────────────────────────────────────────────
  accent: chalk.hex('#38BDF8'), // sky-400     — prompts, highlights
  success: chalk.hex('#34D399'), // emerald-400 — ok / auto
  warn: chalk.hex('#FBBF24'), // amber-400   — confirm / sensitive
  error: chalk.hex('#F87171'), // rose-400    — failures
  tool: chalk.hex('#FB923C'), // orange-400  — tool-call chrome

  // ── Text hierarchy ─────────────────────────────────────────────────────────
  white: chalk.hex('#F1F5F9'), // slate-100   — primary text
  muted: chalk.hex('#94A3B8'), // slate-400   — secondary / labels
  dim: chalk.hex('#475569'), // slate-600   — borders, box-drawing
  subtle: chalk.hex('#334155'), // slate-700   — deeply de-emphasised
} as const
