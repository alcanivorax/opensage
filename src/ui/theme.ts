export const colors = {
  brand: '#F97316',
  brandBright: '#FB923C',
  brandDim: '#EA580C',

  accent: '#38BDF8',
  success: '#22C55E',
  warn: '#FACC15',
  error: '#EF4444',
  tool: '#A78BFA',

  primary: '#FFFFFF',
  white: '#F1F5F9',
  surface: '#0F172A',
  surfaceAlt: '#1E293B',
  border: '#334155',
  borderBright: '#475569',

  muted: '#94A3B8',
  dim: '#64748B',
  subtle: '#475569',

  user: '#F472B6',
  assistant: '#C084FC',
  system: '#34D399',

  code: '#F472B6',
  codeBg: '#1E1B4B',
} as const

export type ColorKey = keyof typeof colors

export const t = {
  brand: colors.brand,
  brandBright: colors.brandBright,
  accent: colors.accent,
  success: colors.success,
  warn: colors.warn,
  error: colors.error,
  tool: colors.tool,

  primary: colors.primary,
  white: colors.white,
  surface: colors.surface,
  surfaceAlt: colors.surfaceAlt,
  border: colors.border,
  borderBright: colors.borderBright,

  muted: colors.muted,
  dim: colors.dim,
  subtle: colors.subtle,

  user: colors.user,
  assistant: colors.assistant,
  system: colors.system,

  code: colors.code,
  codeBg: colors.codeBg,
} as const

export const TERM_WIDTH = 80
export const CONTENT_WIDTH = 74
export const MAX_WIDTH = 72
