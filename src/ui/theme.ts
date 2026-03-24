export const colors = {
  // ── Brand / identity ───────────────────────────────────────────────────────
  brand: '#D97757',
  brandBright: '#E7A07F',
  brandDim: '#B86A4C',

  accent: '#7CC4FA',
  accentSoft: '#4FA3E3',

  // ── Semantic status ────────────────────────────────────────────────────────
  success: '#61C38B',
  warn: '#E6C36A',
  error: '#E07A7A',
  tool: '#A98FF0',

  // ── Premium dark surfaces ──────────────────────────────────────────────────
  primary: '#F5F7FA',
  white: '#E8EDF3',

  surface: '#0D1016',
  surfaceAlt: '#131923',
  surfaceRaised: '#18202C',

  border: '#273244',
  borderBright: '#334258',
  borderSoft: '#1E2735',

  // ── Typography hierarchy ───────────────────────────────────────────────────
  muted: '#A6B0BF',
  dim: '#6F7B8F',
  subtle: '#556173',

  // ── Actor colors ───────────────────────────────────────────────────────────
  user: '#F2B8D8',
  assistant: '#CBB7FF',
  system: '#70D7B1',

  // ── Code / monospace accents ───────────────────────────────────────────────
  code: '#F1C27D',
  codeBg: '#171E29',
} as const

export type ColorKey = keyof typeof colors

export const t = {
  brand: colors.brand,
  brandBright: colors.brandBright,
  brandDim: colors.brandDim,

  accent: colors.accent,
  accentSoft: colors.accentSoft,

  success: colors.success,
  warn: colors.warn,
  error: colors.error,
  tool: colors.tool,

  primary: colors.primary,
  white: colors.white,

  surface: colors.surface,
  surfaceAlt: colors.surfaceAlt,
  surfaceRaised: colors.surfaceRaised,

  border: colors.border,
  borderBright: colors.borderBright,
  borderSoft: colors.borderSoft,

  muted: colors.muted,
  dim: colors.dim,
  subtle: colors.subtle,

  user: colors.user,
  assistant: colors.assistant,
  system: colors.system,

  code: colors.code,
  codeBg: colors.codeBg,
} as const

// ── Layout widths ─────────────────────────────────────────────────────────────
//
// These widths are tuned for a premium, balanced CLI layout:
// - TERM_WIDTH: full shell width target
// - CONTENT_WIDTH: main readable conversation column
// - MAX_WIDTH: inner markdown / content rendering width
//
export const TERM_WIDTH = 96
export const CONTENT_WIDTH = 84
export const MAX_WIDTH = 80
