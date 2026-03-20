import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type Anthropic from '@anthropic-ai/sdk'

// ─── Storage ──────────────────────────────────────────────────────────────────

const TODOS_FILE = path.join(os.homedir(), '.aichat', 'todos.json')

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = 'low' | 'normal' | 'high'

export interface Todo {
  id:           string
  text:         string
  done:         boolean
  priority:     Priority
  due?:         string   // YYYY-MM-DD
  tags?:        string[]
  created:      string   // ISO
  completedAt?: string   // ISO
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function load(): Todo[] {
  if (!fs.existsSync(TODOS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(TODOS_FILE, 'utf8')) as Todo[]
  } catch {
    return []
  }
}

function save(todos: Todo[]): void {
  const dir = path.dirname(TODOS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2))
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const PRIORITY_ICON: Record<Priority, string> = {
  high:   '!!!',
  normal: '  -',
  low:    '  ·',
}

function fmtTodo(t: Todo, idx: number): string {
  const check   = t.done ? '[x]' : '[ ]'
  const prio    = PRIORITY_ICON[t.priority]
  const due     = t.due ? `  due: ${t.due}` : ''
  const tags    = t.tags?.length ? `  #${t.tags.join(' #')}` : ''
  const doneMark = t.done && t.completedAt
    ? `  ✓ ${new Date(t.completedAt).toLocaleDateString()}`
    : ''
  return (
    `${String(idx + 1).padStart(3)}. ${check} ${prio}  ${t.text}` +
    `${due}${tags}${doneMark}` +
    `  [${t.id}]`
  )
}

function isOverdue(t: Todo): boolean {
  if (!t.due || t.done) return false
  return t.due < new Date().toISOString().slice(0, 10)
}

function isDueToday(t: Todo): boolean {
  if (!t.due || t.done) return false
  return t.due === new Date().toISOString().slice(0, 10)
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const addTodoToolDef: Anthropic.Tool = {
  name: 'add_todo',
  description:
    'Add a new item to the local to-do list. ' +
    'Use this when the user asks to remember a task, create a reminder, ' +
    'add something to their list, or says "remind me to…".',
  input_schema: {
    type: 'object' as const,
    properties: {
      text: {
        type: 'string',
        description: 'The task description.',
      },
      priority: {
        type: 'string',
        description: 'Priority level: "low", "normal" (default), or "high".',
      },
      due: {
        type: 'string',
        description:
          'Optional due date in YYYY-MM-DD format (e.g. "2025-01-20").',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for grouping (e.g. ["work", "urgent"]).',
      },
    },
    required: ['text'],
  },
}

export const listTodosToolDef: Anthropic.Tool = {
  name: 'list_todos',
  description:
    'List to-do items. Can filter by status, priority, tag, or date.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filter: {
        type: 'string',
        description:
          'Filter to apply. Options: ' +
          '"active" (not done, default), ' +
          '"done" (completed), ' +
          '"all", ' +
          '"today" (due today), ' +
          '"overdue", ' +
          '"high" (high priority active items). ' +
          'Can also be a tag name to show items with that tag.',
      },
    },
    required: [],
  },
}

export const completeTodoToolDef: Anthropic.Tool = {
  name: 'complete_todo',
  description:
    'Mark a to-do item as done. Use the ID shown in list_todos output, ' +
    'or a 1-based index number.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description:
          'The todo ID (e.g. "lf3abc") or 1-based position number (e.g. "2").',
      },
    },
    required: ['id'],
  },
}

export const deleteTodoToolDef: Anthropic.Tool = {
  name: 'delete_todo',
  description:
    'Permanently delete a to-do item. ' +
    'Use complete_todo instead if you just want to mark it done.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description:
          'The todo ID or 1-based position number. ' +
          'Pass "done" to delete all completed items at once.',
      },
    },
    required: ['id'],
  },
}

export const updateTodoToolDef: Anthropic.Tool = {
  name: 'update_todo',
  description:
    'Edit an existing to-do item — change its text, priority, due date, or tags.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The todo ID or 1-based position number.',
      },
      text: {
        type: 'string',
        description: 'New task description (optional).',
      },
      priority: {
        type: 'string',
        description: 'New priority: "low", "normal", or "high" (optional).',
      },
      due: {
        type: 'string',
        description:
          'New due date in YYYY-MM-DD format. ' +
          'Pass "" (empty string) to remove the due date.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Replace all tags with this list (optional).',
      },
    },
    required: ['id'],
  },
}

// ─── Resolve an ID-or-index to a todo ────────────────────────────────────────

function resolve(
  todos: Todo[],
  ref: string
): { todo: Todo; idx: number } | null {
  // Numeric index (1-based)
  const n = parseInt(ref, 10)
  if (!isNaN(n) && n >= 1 && n <= todos.length) {
    const active = todos.filter((t) => !t.done)
    const target = active[n - 1] ?? todos[n - 1]
    const idx    = todos.indexOf(target)
    return idx !== -1 ? { todo: target, idx } : null
  }
  // ID lookup
  const idx = todos.findIndex((t) => t.id === ref)
  return idx !== -1 ? { todo: todos[idx], idx } : null
}

// ─── Implementations ──────────────────────────────────────────────────────────

export async function addTodo(input: {
  text:      string
  priority?: string
  due?:      string
  tags?:     string[]
}): Promise<string> {
  const todos = load()

  const priority: Priority =
    input.priority === 'high' || input.priority === 'low'
      ? input.priority
      : 'normal'

  const todo: Todo = {
    id:       makeId(),
    text:     input.text.trim(),
    done:     false,
    priority,
    due:      input.due || undefined,
    tags:     input.tags?.length ? input.tags : undefined,
    created:  new Date().toISOString(),
  }

  todos.push(todo)
  save(todos)

  const dueStr  = todo.due ? `  due ${todo.due}` : ''
  const prioStr = todo.priority !== 'normal' ? `  [${todo.priority}]` : ''
  return `✓ Added todo [${todo.id}]: "${todo.text}"${dueStr}${prioStr}`
}

export async function listTodos(input: { filter?: string }): Promise<string> {
  const todos   = load()
  const filter  = (input.filter ?? 'active').toLowerCase().trim()

  let subset: Todo[]

  switch (filter) {
    case 'all':
      subset = todos
      break
    case 'done':
      subset = todos.filter((t) => t.done)
      break
    case 'today':
      subset = todos.filter((t) => isDueToday(t))
      break
    case 'overdue':
      subset = todos.filter((t) => isOverdue(t))
      break
    case 'high':
      subset = todos.filter((t) => !t.done && t.priority === 'high')
      break
    case 'active':
      subset = todos.filter((t) => !t.done)
      break
    default:
      // Treat as tag filter
      subset = todos.filter(
        (t) => !t.done && t.tags?.includes(filter)
      )
  }

  if (subset.length === 0) {
    if (filter === 'active') {
      return 'No active todos. Add one with add_todo!'
    }
    return `No todos matching filter "${filter}".`
  }

  // Sort: high priority first, then by due date, then by creation date
  subset.sort((a, b) => {
    const pOrder: Record<Priority, number> = { high: 0, normal: 1, low: 2 }
    if (!a.done && !b.done) {
      const pd = pOrder[a.priority] - pOrder[b.priority]
      if (pd !== 0) return pd
    }
    if (a.due && b.due) return a.due.localeCompare(b.due)
    if (a.due && !b.due) return -1
    if (!a.due && b.due) return 1
    return a.created.localeCompare(b.created)
  })

  const today    = new Date().toISOString().slice(0, 10)
  const lines    = subset.map((t, i) => {
    const line     = fmtTodo(t, i)
    if (isOverdue(t)) return line + '  ⚠ OVERDUE'
    if (isDueToday(t)) return line + '  ← TODAY'
    return line
  })

  const active    = todos.filter((t) => !t.done).length
  const done      = todos.filter((t) => t.done).length
  const overdue   = todos.filter((t) => isOverdue(t)).length

  const summary = [
    `${active} active`,
    done > 0      ? `${done} done`        : null,
    overdue > 0   ? `${overdue} overdue`  : null,
  ].filter(Boolean).join('  ·  ')

  return lines.join('\n') + `\n\n── ${summary}  ·  today: ${today}`
}

export async function completeTodo(input: { id: string }): Promise<string> {
  const todos = load()
  const found = resolve(todos, input.id.trim())

  if (!found) {
    return `Error: Todo not found: "${input.id}". Use list_todos to see IDs.`
  }

  const { todo, idx } = found
  if (todo.done) {
    return `"${todo.text}" is already marked as done.`
  }

  todos[idx] = { ...todo, done: true, completedAt: new Date().toISOString() }
  save(todos)

  return `✓ Marked as done: "${todo.text}"`
}

export async function deleteTodo(input: { id: string }): Promise<string> {
  const todos = load()
  const ref   = input.id.trim()

  // Special: delete all completed todos
  if (ref === 'done') {
    const before = todos.length
    const kept   = todos.filter((t) => !t.done)
    const removed = before - kept.length
    if (removed === 0) return 'No completed todos to delete.'
    save(kept)
    return `✓ Deleted ${removed} completed todo${removed !== 1 ? 's' : ''}.`
  }

  const found = resolve(todos, ref)
  if (!found) {
    return `Error: Todo not found: "${ref}". Use list_todos to see IDs.`
  }

  const { todo, idx } = found
  todos.splice(idx, 1)
  save(todos)
  return `✓ Deleted: "${todo.text}"`
}

export async function updateTodo(input: {
  id:        string
  text?:     string
  priority?: string
  due?:      string
  tags?:     string[]
}): Promise<string> {
  const todos = load()
  const found = resolve(todos, input.id.trim())

  if (!found) {
    return `Error: Todo not found: "${input.id}". Use list_todos to see IDs.`
  }

  const { todo, idx } = found
  const updated: Todo = { ...todo }

  if (input.text)          updated.text     = input.text.trim()
  if (input.priority === 'high' || input.priority === 'low' || input.priority === 'normal') {
    updated.priority = input.priority
  }
  if (input.due !== undefined) {
    updated.due = input.due === '' ? undefined : input.due
  }
  if (input.tags !== undefined) {
    updated.tags = input.tags.length ? input.tags : undefined
  }

  todos[idx] = updated
  save(todos)

  return `✓ Updated todo [${todo.id}]: "${updated.text}"`
}
