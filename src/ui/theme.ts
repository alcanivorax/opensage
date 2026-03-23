// ─── Theme — Claude Code style (orange brand + slate palette) ─────────────────

export const colors = {
  // Brand
  brand: '#F97316', // orange-500
  brandBright: '#FB923C', // orange-400
  brandDim: '#EA580C', // orange-600

  // Accent
  accent: '#38BDF8', // sky-400
  success: '#34D399', // emerald-400
  warn: '#FCD34D', // amber-300
  error: '#F87171', // red-400
  tool: '#C084FC', // purple-400

  // Text hierarchy
  primary: '#F8FAFC', // slate-50
  white: '#E2E8F0', // slate-200
  muted: '#94A3B8', // slate-400
  dim: '#475569', // slate-600
  subtle: '#334155', // slate-700

  // Role colours
  user: '#F472B6', // pink-400
  assistant: '#C084FC', // purple-400
  system: '#34D399', // emerald-400
} as const

export type Color = (typeof colors)[keyof typeof colors]

// Semantic aliases used throughout components
export const t = {
  brand: colors.brand,
  brandBright: colors.brandBright,
  accent: colors.accent,
  success: colors.success,
  warn: colors.warn,
  error: colors.error,
  tool: colors.tool,
  white: colors.white,
  muted: colors.muted,
  dim: colors.dim,
  user: colors.user,
  assistant: colors.assistant,
} as const

export const TERM_WIDTH = 80
export const CONTENT_WIDTH = 72
