import * as child_process from "child_process";
import * as os from "os";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Tool definition ──────────────────────────────────────────────────────────

export const notifyToolDef: Anthropic.Tool = {
  name: "notify",
  description:
    "Send a desktop notification to the user. " +
    "Use this to alert the user when a long-running task completes, " +
    "when something important is found, or when input is needed. " +
    "Works on macOS, Linux (notify-send / libnotify), and Windows.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Notification title (short, 1–6 words).",
      },
      message: {
        type: "string",
        description: "Notification body text.",
      },
      urgency: {
        type: "string",
        description:
          "Urgency level: 'low', 'normal' (default), or 'critical'. " +
          "Critical notifications stay on screen until dismissed (Linux only).",
      },
    },
    required: ["title", "message"],
  },
};

// ─── Implementation ───────────────────────────────────────────────────────────

function exec(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(cmd, { timeout: 8_000 }, (_err, stdout, stderr) => {
      resolve((stdout || stderr || "").trim());
    });
  });
}

/** Escape a string for safe embedding in a shell double-quoted argument. */
function shellEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/`/g, "\\`");
}

export async function notify(input: {
  title: string;
  message: string;
  urgency?: string;
}): Promise<string> {
  const title = (input.title ?? "aichat").slice(0, 100);
  const message = (input.message ?? "").slice(0, 500);
  const urgency =
    input.urgency && ["low", "normal", "critical"].includes(input.urgency)
      ? input.urgency
      : "normal";

  const p = process.platform;

  // ── macOS ──────────────────────────────────────────────────────────────────
  if (p === "darwin") {
    const t = shellEscape(title);
    const m = shellEscape(message);
    // osascript display notification is always available on macOS
    const script = `display notification "${m}" with title "${t}"`;
    await exec(`osascript -e '${script}'`);
    return `✓ Notification sent: "${title}"`;
  }

  // ── Linux ──────────────────────────────────────────────────────────────────
  if (p === "linux") {
    const t = shellEscape(title);
    const m = shellEscape(message);

    // Try notify-send (libnotify — works on GNOME, KDE, XFCE, etc.)
    const urgencyFlag =
      urgency === "critical"
        ? "-u critical"
        : urgency === "low"
          ? "-u low"
          : "-u normal";

    const result = await exec(
      `notify-send ${urgencyFlag} -a "aichat" "${t}" "${m}" 2>/dev/null`
    );

    if (!result.toLowerCase().includes("error") && !result.includes("not found")) {
      return `✓ Notification sent: "${title}"`;
    }

    // Fallback: kdialog (KDE without libnotify)
    const kdResult = await exec(
      `kdialog --passivepopup "${m}" 5 --title "${t}" 2>/dev/null`
    );
    if (!kdResult.toLowerCase().includes("not found")) {
      return `✓ Notification sent via kdialog: "${title}"`;
    }

    // Last resort: xmessage (always available if X11 is running)
    await exec(`xmessage -timeout 8 "${t}: ${shellEscape(message)}" 2>/dev/null &`);
    return `✓ Notification sent via xmessage: "${title}"`;
  }

  // ── Windows ────────────────────────────────────────────────────────────────
  if (p === "win32") {
    const t = title.replace(/'/g, "''");
    const m = message.replace(/'/g, "''");

    // PowerShell toast notification (Windows 10+)
    const ps = `
Add-Type -AssemblyName System.Windows.Forms;
$notify = New-Object System.Windows.Forms.NotifyIcon;
$notify.Icon = [System.Drawing.SystemIcons]::Information;
$notify.BalloonTipTitle = '${t}';
$notify.BalloonTipText = '${m}';
$notify.Visible = $true;
$notify.ShowBalloonTip(5000);
Start-Sleep -Seconds 1;
$notify.Dispose()
`.trim();

    await exec(`powershell -NoProfile -Command "${ps.replace(/\n/g, "; ")}"`);
    return `✓ Notification sent: "${title}"`;
  }

  return `Error: Unsupported platform (${p})`;
}

// ─── Helper: notify after an async operation ─────────────────────────────────
//
//  Not exposed as a tool — used internally when the agent wants to fire-and-forget
//  a notification at the end of a task.

export async function notifyAfter<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    await notify({ title: "aichat", message: `✓ Done: ${label}` }).catch(
      () => {}
    );
    return result;
  } catch (err) {
    await notify({
      title: "aichat — Error",
      message: `✗ ${label}: ${err instanceof Error ? err.message : String(err)}`,
      urgency: "critical",
    }).catch(() => {});
    throw err;
  }
}
