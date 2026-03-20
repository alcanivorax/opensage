import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Storage path ─────────────────────────────────────────────────────────────

export const MEMORY_FILE = path.join(os.homedir(), ".aichat", "memory.json");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id:        string;
  content:   string;
  category:  string;
  timestamp: string;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function loadMemory(): MemoryEntry[] {
  if (!fs.existsSync(MEMORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")) as MemoryEntry[];
  } catch {
    return [];
  }
}

function persistMemory(entries: MemoryEntry[]): void {
  const dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

export function addMemoryEntry(content: string, category: string = "general"): MemoryEntry {
  const entries = loadMemory();
  const entry: MemoryEntry = {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    content:   content.trim(),
    category:  category.trim().toLowerCase() || "general",
    timestamp: new Date().toISOString(),
  };
  entries.push(entry);
  persistMemory(entries);
  return entry;
}

export function deleteMemoryEntry(id: string): boolean {
  const entries = loadMemory();
  const next    = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  persistMemory(next);
  return true;
}

export function clearAllMemory(): void {
  persistMemory([]);
}

// ─── System-prompt injection ──────────────────────────────────────────────────

export function buildMemoryContext(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  // Group by category for a clean layout
  const grouped: Record<string, string[]> = {};
  for (const e of entries) {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e.content);
  }

  const lines: string[] = [
    "",
    "## Persistent Memory",
    "The following notes were saved from previous sessions. Use them to personalise your responses.",
    "",
  ];

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`### ${cat}`);
    items.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const saveMemoryToolDef: Anthropic.Tool = {
  name: "save_memory",
  description:
    "Save an important fact, preference, or note to persistent memory so it is available in future sessions. " +
    "Use this proactively when the user shares something they would want remembered: their name, preferences, " +
    "recurring tasks, important deadlines, facts about their setup, etc. " +
    "Do NOT save transient information (today's weather, one-off commands, etc.).",
  input_schema: {
    type: "object" as const,
    properties: {
      content: {
        type:        "string",
        description: "The fact or note to remember. Be concise and specific (one sentence max).",
      },
      category: {
        type:        "string",
        description:
          "Category label for grouping. Use one of: 'personal', 'preference', 'task', 'fact', or 'general'.",
      },
    },
    required: ["content"],
  },
};

export async function saveMemoryTool(input: { content: string; category?: string }): Promise<string> {
  if (!input.content?.trim()) return "Error: content is required.";
  const entry = addMemoryEntry(input.content, input.category ?? "general");
  return `✓ Saved to memory [${entry.id}] (${entry.category}): "${entry.content}"`;
}
