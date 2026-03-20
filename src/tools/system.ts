import * as child_process from "child_process";
import * as os from "os";
import * as fs from "fs";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Shared exec helper ───────────────────────────────────────────────────────

function exec(cmd: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(cmd, { timeout: timeoutMs }, (_err, stdout, stderr) => {
      resolve((stdout || stderr || "").trim());
    });
  });
}

// ─── get_system_info ──────────────────────────────────────────────────────────

export const systemInfoToolDef: Anthropic.Tool = {
  name: "get_system_info",
  description:
    "Get information about the local system: OS details, CPU, memory usage, " +
    "disk usage, top running processes, or network interfaces. " +
    "Use type='all' for a full summary, or one of: 'os', 'memory', 'disk', 'processes', 'network'.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        description:
          "What to report. One of: 'all' (default), 'os', 'memory', 'disk', 'processes', 'network'.",
      },
    },
    required: [],
  },
};

export async function getSystemInfo(input: {
  type?: string;
}): Promise<string> {
  const want = (input.type ?? "all").toLowerCase();
  const parts: string[] = [];

  // ── OS / CPU ────────────────────────────────────────────────────────────────
  if (want === "all" || want === "os") {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model ?? "unknown";
    const cores = cpus.length;
    const uptimeSec = os.uptime();
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);

    parts.push(
      [
        "── OS ──────────────────────────────────",
        `Platform : ${os.type()} ${os.release()} (${os.arch()})`,
        `Hostname : ${os.hostname()}`,
        `User     : ${os.userInfo().username}`,
        `Home     : ${os.homedir()}`,
        `Uptime   : ${h}h ${m}m`,
        `Shell    : ${process.env["SHELL"] ?? "unknown"}`,
        "",
        "── CPU ──────────────────────────────────",
        `Model    : ${cpuModel}`,
        `Cores    : ${cores}`,
      ].join("\n")
    );
  }

  // ── Memory ──────────────────────────────────────────────────────────────────
  if (want === "all" || want === "memory") {
    const totalMb = Math.round(os.totalmem() / 1024 / 1024);
    const freeMb = Math.round(os.freemem() / 1024 / 1024);
    const usedMb = totalMb - freeMb;
    const pct = Math.round((usedMb / totalMb) * 100);
    const bar =
      "█".repeat(Math.round(pct / 5)) +
      "░".repeat(20 - Math.round(pct / 5));

    parts.push(
      [
        "── Memory ───────────────────────────────",
        `Total    : ${totalMb} MB`,
        `Used     : ${usedMb} MB  (${pct}%)`,
        `Free     : ${freeMb} MB`,
        `         : [${bar}] ${pct}%`,
      ].join("\n")
    );
  }

  // ── Disk ────────────────────────────────────────────────────────────────────
  if (want === "all" || want === "disk") {
    let diskOut: string;
    if (process.platform === "darwin") {
      diskOut = await exec("df -h /");
    } else if (process.platform === "win32") {
      diskOut = await exec("wmic logicaldisk get caption,size,freespace");
    } else {
      diskOut = await exec(
        "df -h --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | head -20"
      );
    }
    parts.push("── Disk ──────────────────────────────────\n" + diskOut);
  }

  // ── Processes ───────────────────────────────────────────────────────────────
  if (want === "all" || want === "processes") {
    let procOut: string;
    if (process.platform === "win32") {
      procOut = await exec(
        "tasklist /FO TABLE /NH | sort /R | head -15",
        15_000
      );
    } else {
      procOut = await exec(
        "ps aux --sort=-%cpu 2>/dev/null | head -16 || ps aux | head -16"
      );
    }
    parts.push("── Top Processes ─────────────────────────\n" + procOut);
  }

  // ── Network ─────────────────────────────────────────────────────────────────
  if (want === "network") {
    const ifaces = os.networkInterfaces();
    const lines: string[] = ["── Network Interfaces ────────────────────"];
    for (const [name, addrs] of Object.entries(ifaces)) {
      for (const addr of addrs ?? []) {
        if (addr.internal) continue;
        lines.push(`${name.padEnd(12)} ${addr.family.padEnd(6)} ${addr.address}`);
      }
    }
    // Also try to get the public IP
    try {
      const pub = await exec(
        "curl -s --max-time 4 https://api.ipify.org 2>/dev/null || echo '(unavailable)'"
      );
      lines.push(`Public IP  : ${pub}`);
    } catch {
      /* skip */
    }
    parts.push(lines.join("\n"));
  }

  return parts.join("\n\n") || `Unknown type: ${input.type}`;
}

// ─── read_clipboard ───────────────────────────────────────────────────────────

export const readClipboardToolDef: Anthropic.Tool = {
  name: "read_clipboard",
  description: "Read the current text content of the system clipboard.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function readClipboard(): Promise<string> {
  const p = process.platform;

  if (p === "darwin") {
    return exec("pbpaste");
  }

  if (p === "linux") {
    // Try each clipboard tool in order of preference
    const raw = await exec(
      "xclip -selection clipboard -o 2>/dev/null" +
        " || xsel --clipboard --output 2>/dev/null" +
        " || wl-paste 2>/dev/null"
    );
    if (raw) return raw;
    return (
      "Error: No clipboard tool available. " +
      "Install one of: xclip, xsel, wl-clipboard"
    );
  }

  if (p === "win32") {
    return exec("powershell -NoProfile -Command Get-Clipboard");
  }

  return `Error: Unsupported platform (${p})`;
}

// ─── write_clipboard ──────────────────────────────────────────────────────────

export const writeClipboardToolDef: Anthropic.Tool = {
  name: "write_clipboard",
  description:
    "Copy text to the system clipboard so the user can paste it anywhere.",
  input_schema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to copy to the clipboard.",
      },
    },
    required: ["text"],
  },
};

export async function writeClipboard(input: {
  text: string;
}): Promise<string> {
  const { text } = input;
  const p = process.platform;

  // Write to a temp file to avoid shell escaping issues with arbitrary content
  const tmp = os.tmpdir() + "/aichat_clip_" + Date.now() + ".txt";
  fs.writeFileSync(tmp, text, "utf8");

  try {
    if (p === "darwin") {
      await exec(`pbcopy < ${JSON.stringify(tmp)}`);
    } else if (p === "linux") {
      const out = await exec(
        `xclip -selection clipboard < ${JSON.stringify(tmp)} 2>/dev/null` +
          ` || xsel --clipboard --input < ${JSON.stringify(tmp)} 2>/dev/null` +
          ` || wl-copy < ${JSON.stringify(tmp)} 2>/dev/null`
      );
      if (out.toLowerCase().includes("error")) return out;
    } else if (p === "win32") {
      await exec(
        `powershell -NoProfile -Command "Get-Content ${JSON.stringify(tmp)} | Set-Clipboard"`
      );
    } else {
      return `Error: Unsupported platform (${p})`;
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
  }

  const lineCount = text.split("\n").length;
  const charCount = text.length;
  return `✓ Copied ${charCount} character${charCount !== 1 ? "s" : ""} (${lineCount} line${lineCount !== 1 ? "s" : ""}) to clipboard`;
}

// ─── open_path ────────────────────────────────────────────────────────────────

export const openPathToolDef: Anthropic.Tool = {
  name: "open_path",
  description:
    "Open a file or URL using the system's default application. " +
    "Works for URLs (opens browser), documents (opens default viewer), " +
    "images, directories (opens file manager), etc.",
  input_schema: {
    type: "object" as const,
    properties: {
      target: {
        type: "string",
        description: "A file path or URL to open.",
      },
    },
    required: ["target"],
  },
};

export async function openPath(input: { target: string }): Promise<string> {
  const { target } = input;
  const p = process.platform;

  let cmd: string;
  if (p === "darwin") {
    cmd = `open ${JSON.stringify(target)}`;
  } else if (p === "linux") {
    // Try xdg-open, then gio, then gnome-open as fallbacks
    cmd =
      `xdg-open ${JSON.stringify(target)} 2>/dev/null` +
      ` || gio open ${JSON.stringify(target)} 2>/dev/null` +
      ` || gnome-open ${JSON.stringify(target)} 2>/dev/null`;
  } else if (p === "win32") {
    // On Windows, 'start' needs special handling for URLs
    cmd = `start "" ${JSON.stringify(target)}`;
  } else {
    return `Error: Unsupported platform (${p})`;
  }

  await exec(cmd);
  return `✓ Opened: ${target}`;
}
