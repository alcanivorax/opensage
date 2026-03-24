# OpenSage

A CLI-based AI assistant that runs in your terminal. OpenSage connects to LLMs (Claude via Anthropic or various models via OpenRouter) and gives them the ability to interact with your computer through tools.

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/github/stars/alcanivorax/opensage" alt="Stars">
  <img src="https://img.shields.io/github/forks/alcanivorax/opensage" alt="Forks">
</p>

---

## What is OpenSage?

OpenSage is an AI-powered CLI assistant that lives in your terminal. Unlike chatbots that can only talk, OpenSage can actually _do_ things on your computer:

- Execute shell commands
- Read and write files
- Search the web and fetch URLs
- Manage your Gmail (read, send, draft emails)
- Access system information (clipboard, processes, disk usage)
- Remember important facts across sessions
- Use hundreds of community-built tools

Think of it as giving an AI direct access to your development environment.

---

## Features

### AI Providers

- **Anthropic** — Connect to Claude (Claude 3.5 Sonnet, Haiku, etc.)
- **OpenRouter** — Access 100+ models including free options

### Built-in Tools

| Tool              | Description                         |
| ----------------- | ----------------------------------- |
| `run_command`     | Execute any shell command           |
| `read_file`       | Read files from disk                |
| `write_file`      | Create or overwrite files           |
| `download_file`   | Download files from URLs            |
| `web_search`      | Search the web (DuckDuckGo)         |
| `web_fetch`       | Fetch any URL as text               |
| `gmail_list`      | List or search emails               |
| `gmail_read`      | Read email content                  |
| `gmail_send`      | Send emails                         |
| `gmail_draft`     | Save email drafts                   |
| `get_system_info` | CPU, memory, disk, processes        |
| `read_clipboard`  | Read system clipboard               |
| `write_clipboard` | Write to system clipboard           |
| `open_path`       | Open files or URLs with default app |
| `save_memory`     | Persist facts across sessions       |

### Slash Commands

- `/add <tool>` — Install tools from the registry
- `/remove <tool>` — Remove installed tools
- `/tools` — List installed tools
- `/model <name>` — Switch AI model
- `/models` — List available models
- `/clear` — Clear conversation history
- `/exit` — Exit the session
- `/gmail-auth` — Setup Gmail authentication
- `/tokens` — Show token usage for current session
- `/system` — Update system prompt

---

## Installation

### Prerequisites

- **Node.js** v18 or higher
- **pnpm** (recommended) or npm

```bash
# Clone the repository
git clone https://github.com/alcanivorax/opensage.git
cd opensage

# Install dependencies
pnpm install
```

---

## Usage

### Development Mode

```bash
pnpm dev
```

### Build and Run

```bash
# Build the TypeScript
pnpm build

# Link globally
pnpm link --global

# Run OpenSage
opensage
```

### First Run

On first launch, OpenSage runs an interactive setup wizard that helps you:

1. Choose an AI provider (Anthropic or OpenRouter)
2. Enter your API key
3. Select a model
4. Customize the system prompt

---

## Configuration

Config is stored in `~/.opensage/config.json`:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "sk-ant-...",
  "systemPrompt": "You are a helpful CLI assistant...",
  "autoApprove": false,
  "sensitiveTools": ["run_command", "write_file"]
}
```

---

## Tools

OpenSage can be extended with tools from the community. The official toolset includes 55+ tools for:

- **Git** — status, log, diff, commit, push, pull, branch, checkout, stash
- **Docker** — ps, images, logs, stop, restart, stats
- **NPM** — install, run, outdated, audit
- **Search & Files** — grep, find, count lines, diff, sort, CSV preview
- **Network** — http GET/POST, ping, DNS lookup, open ports
- **System** — disk usage, processes, kill, system info, env variables
- **Data Transform** — JSON query, base64, hash, YAML/JSON conversion, URL encode, JWT decode, regex test, calculator, color conversion
- **Productivity** — weather, IP info, timestamp, UUID, QR code, Lorem Ipsum, cron next

Install tools with `/add` or `/add <repo> <tool>`.

---

## License

MIT
