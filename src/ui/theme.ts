// import chalk from 'chalk'

// // ─── Colour palette ───────────────────────────────────────────────────────────
// //
// //  Brand  : violet  — the bot's identity
// //  Accent : sky     — interactive elements, prompts
// //  Success: emerald — confirmations, safe tools
// //  Warn   : amber   — destructive actions, sensitive tools
// //  Error  : rose    — failures
// //  Tool   : orange  — tool-call chrome
// //
// //  Text hierarchy (light-on-dark terminal):
// //    white  → primary content
// //    muted  → secondary labels, hints
// //    dim    → borders, box-drawing, chrome
// //    subtle → deeply de-emphasised chrome
// // ─────────────────────────────────────────────────────────────────────────────

// export const T = {
//   // ── Brand ──────────────────────────────────────────────────────────────────
//   brand: chalk.hex('#8B5CF6'), // violet-500
//   brandBright: chalk.hex('#A78BFA'), // violet-400
//   brandDim: chalk.hex('#6D28D9'), // violet-700

//   // ── Semantic ───────────────────────────────────────────────────────────────
//   accent: chalk.hex('#38BDF8'), // sky-400     — prompts, highlights
//   success: chalk.hex('#34D399'), // emerald-400 — ok / auto
//   warn: chalk.hex('#FBBF24'), // amber-400   — confirm / sensitive
//   error: chalk.hex('#F87171'), // rose-400    — failures
//   tool: chalk.hex('#FB923C'), // orange-400  — tool-call chrome

//   // ── Text hierarchy ─────────────────────────────────────────────────────────
//   white: chalk.hex('#F1F5F9'), // slate-100   — primary text
//   muted: chalk.hex('#94A3B8'), // slate-400   — secondary / labels
//   dim: chalk.hex('#475569'), // slate-600   — borders, box-drawing
//   subtle: chalk.hex('#334155'), // slate-700   — deeply de-emphasised
// } as const
import chalk from 'chalk'

// ─── Colour palette ───────────────────────────────────────────────────────────
//
//  Inspired by Claude Code's terminal aesthetic:
//  warm amber identity, restrained palette, deep slate chrome.
//
//  Brand   : warm amber  — identity, primary brand moments
//  Accent  : cyan        — interactive prompts, highlights
//  Success : emerald     — confirmations, auto-run tools
//  Warn    : amber       — destructive, confirm-needed tools
//  Error   : red         — failures, hard errors
//  Tool    : teal        — tool-call chrome, function names
//
//  Text hierarchy (dark terminal):
//    primary  → near-white for main content
//    white    → slate-200 for body text
//    muted    → slate-400 for secondary labels, hints
//    dim      → slate-600 for borders and box-drawing
//    subtle   → slate-700 for deeply de-emphasised chrome
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  brand: chalk.hex('#D97706'), // amber-600  — primary identity
  brandBright: chalk.hex('#F59E0B'), // amber-500  — active/bright brand
  brandDim: chalk.hex('#92400E'), // amber-900  — subdued brand

  // ── Semantic ───────────────────────────────────────────────────────────────
  accent: chalk.hex('#67E8F9'), // cyan-300   — prompts, interactive
  success: chalk.hex('#6EE7B7'), // emerald-300— ok / auto-run
  warn: chalk.hex('#FCD34D'), // amber-300  — confirm / sensitive
  error: chalk.hex('#FCA5A5'), // red-300    — failures
  tool: chalk.hex('#5EEAD4'), // teal-300   — tool-call chrome

  // ── Text hierarchy ─────────────────────────────────────────────────────────
  primary: chalk.hex('#F8FAFC'), // slate-50   — primary content
  white: chalk.hex('#E2E8F0'), // slate-200  — body text
  muted: chalk.hex('#94A3B8'), // slate-400  — secondary / labels
  dim: chalk.hex('#475569'), // slate-600  — borders, chrome
  subtle: chalk.hex('#334155'), // slate-700  — deep chrome

  // ── Structural helpers ─────────────────────────────────────────────────────
  /** Titled top-edge: ╭─ label ─────╮ */
  boxTop: (label: string, width: number): string => {
    const fill = Math.max(0, width - label.length - 5)
    return (
      chalk.hex('#475569')('  ╭─ ') +
      chalk.hex('#94A3B8')(label) +
      chalk.hex('#475569')(' ' + '─'.repeat(fill) + '╮')
    )
  },
  /** Bottom-edge: ╰──────────╯ */
  boxBottom: (width: number): string =>
    chalk.hex('#475569')('  ╰' + '─'.repeat(width - 2) + '╯'),
  /** Intra-box separator: ├──────────┤ */
  boxSep: (width: number): string =>
    chalk.hex('#334155')('  ├' + '─'.repeat(width - 2) + '┤'),
} as const
