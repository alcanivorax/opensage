import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type Anthropic from '@anthropic-ai/sdk'

// ─── Storage paths ────────────────────────────────────────────────────────────

const AICHAT_DIR = path.join(os.homedir(), '.aichat')
const CREDS_FILE = path.join(AICHAT_DIR, 'google-creds.json')
const TOKENS_FILE = path.join(AICHAT_DIR, 'google-tokens.json')

// ─── Google OAuth2 constants ──────────────────────────────────────────────────

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'

// Redirect URI for installed/desktop apps — user pastes the code manually
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  // Calendar — included here so one /gmail-auth flow covers both
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleCreds {
  client_id: string
  client_secret: string
}

interface Tokens {
  access_token: string
  refresh_token: string
  expires_at: number // Unix ms — when the access token expires
}

interface GmailHeader {
  name: string
  value: string
}

interface GmailPart {
  mimeType: string
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate: string
  payload: GmailPart & { headers?: GmailHeader[] }
}

// ─── Credential / token helpers ───────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(AICHAT_DIR)) fs.mkdirSync(AICHAT_DIR, { recursive: true })
}

export function loadCreds(): GoogleCreds | null {
  if (!fs.existsSync(CREDS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')) as GoogleCreds
  } catch {
    return null
  }
}

export function saveCreds(creds: GoogleCreds): void {
  ensureDir()
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2))
}

function loadTokens(): Tokens | null {
  if (!fs.existsSync(TOKENS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) as Tokens
  } catch {
    return null
  }
}

function saveTokens(tokens: Tokens): void {
  ensureDir()
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2))
}

export function isGmailConfigured(): boolean {
  return fs.existsSync(CREDS_FILE) && fs.existsSync(TOKENS_FILE)
}

// ─── OAuth2 flow ──────────────────────────────────────────────────────────────

/** Build the Google consent URL the user must open in their browser. */
export function buildAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force refresh_token to be returned every time
  })
  return `${AUTH_URL}?${params.toString()}`
}

/** Exchange the one-time authorization code for access + refresh tokens. */
export async function exchangeAuthCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. ' +
        'Revoke app access at https://myaccount.google.com/permissions and try again.'
    )
  }

  const tokens: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  saveTokens(tokens)
  return tokens
}

/** Silently refresh the access token using the stored refresh token. */
async function refreshAccessToken(
  tokens: Tokens,
  creds: GoogleCreds
): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Token refresh failed (${res.status}): ${body}. ` +
        'Run /gmail-auth to re-authorize.'
    )
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }
  const refreshed: Tokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  saveTokens(refreshed)
  return refreshed
}

/** Returns a valid access token, refreshing automatically if needed. */
async function getAccessToken(): Promise<string> {
  const creds = loadCreds()
  if (!creds) {
    throw new Error('Gmail is not configured. Run /gmail-auth to set it up.')
  }

  let tokens = loadTokens()
  if (!tokens) {
    throw new Error('Gmail is not authorized. Run /gmail-auth to authorize.')
  }

  // Refresh 5 minutes before expiry so we never hit a mid-request expiry
  if (Date.now() >= tokens.expires_at - 5 * 60 * 1000) {
    tokens = await refreshAccessToken(tokens, creds)
  }

  return tokens.access_token
}

// ─── Shared Google API fetch ──────────────────────────────────────────────────
//
//  Exported so that other tools (calendar, drive, etc.) can reuse the same
//  OAuth token without duplicating auth logic.

export async function googleApiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google API ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── Gmail REST API helper ────────────────────────────────────────────────────

async function gmailFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  return googleApiFetch<T>(`${GMAIL_API}${endpoint}`, options)
}

// ─── Email parsing helpers ────────────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ''
  )
}

function decodeBase64Url(data: string): string {
  // Gmail uses base64url encoding (- instead of +, _ instead of /)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

/** Recursively extract the best plain-text representation of a MIME body. */
function extractBodyText(part: GmailPart, depth = 0): string {
  // Direct body data
  if (part.body?.data) {
    const text = decodeBase64Url(part.body.data)
    // For HTML parts strip tags when no plain-text alternative was found
    if (part.mimeType === 'text/html') {
      return text
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
    return text
  }

  // Multipart — prefer text/plain, fall back to text/html
  if (part.parts && depth < 6) {
    const plain = part.parts.find((p) => p.mimeType === 'text/plain')
    if (plain) {
      const text = extractBodyText(plain, depth + 1)
      if (text) return text
    }

    for (const p of part.parts) {
      const text = extractBodyText(p, depth + 1)
      if (text) return text
    }
  }

  return ''
}

function fmtDate(internalDate: string): string {
  return new Date(parseInt(internalDate)).toLocaleString()
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

/** Build a base64url-encoded RFC 2822 message string for the Gmail send API. */
function buildRawEmail(params: {
  to: string
  subject: string
  body: string
  cc?: string
  replyToMessageId?: string
}): string {
  const lines: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
  ]
  if (params.cc) lines.push(`Cc: ${params.cc}`)
  if (params.replyToMessageId) {
    lines.push(`In-Reply-To: <${params.replyToMessageId}>`)
    lines.push(`References: <${params.replyToMessageId}>`)
  }
  lines.push('', params.body)

  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const gmailListToolDef: Anthropic.Tool = {
  name: 'gmail_list',
  description:
    'List or search Gmail emails. Returns ID, sender, subject, date, and a short preview ' +
    'for each result. Use the ID with gmail_read to get the full content.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Gmail search query. Examples: "is:unread", "from:alice@example.com", ' +
          '"subject:invoice", "newer_than:2d", "has:attachment", "in:inbox". ' +
          'Leave empty for recent inbox emails.',
      },
      maxResults: {
        type: 'number',
        description: 'How many emails to return (1–50, default 10).',
      },
    },
    required: [],
  },
}

export const gmailReadToolDef: Anthropic.Tool = {
  name: 'gmail_read',
  description: 'Read the full content of a Gmail email by its message ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      messageId: {
        type: 'string',
        description: 'The message ID returned by gmail_list.',
      },
    },
    required: ['messageId'],
  },
}

export const gmailSendToolDef: Anthropic.Tool = {
  name: 'gmail_send',
  description:
    'Send a Gmail email. ' +
    'IMPORTANT: always show the complete draft (to, subject, full body) to the user and ' +
    'wait for explicit confirmation before calling this tool.',
  input_schema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address(es), comma-separated.',
      },
      subject: {
        type: 'string',
        description: 'Email subject line.',
      },
      body: {
        type: 'string',
        description: 'Plain-text email body.',
      },
      cc: {
        type: 'string',
        description: 'CC recipient(s), comma-separated (optional).',
      },
      replyToMessageId: {
        type: 'string',
        description:
          'The message ID of the email being replied to (optional). ' +
          'Keeps the email in the same thread.',
      },
      threadId: {
        type: 'string',
        description:
          'The thread ID to attach the message to (optional, from gmail_read output).',
      },
    },
    required: ['to', 'subject', 'body'],
  },
}

export const gmailDraftToolDef: Anthropic.Tool = {
  name: 'gmail_draft',
  description:
    'Save an email as a Gmail draft without sending it. ' +
    'The draft will appear in the Gmail Drafts folder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address(es), comma-separated.',
      },
      subject: {
        type: 'string',
        description: 'Email subject line.',
      },
      body: {
        type: 'string',
        description: 'Plain-text email body.',
      },
      cc: {
        type: 'string',
        description: 'CC recipient(s) (optional).',
      },
    },
    required: ['to', 'subject', 'body'],
  },
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export async function gmailList(input: {
  query?: string
  maxResults?: number
}): Promise<string> {
  const q = (input.query ?? 'in:inbox').trim()
  const maxResults = Math.max(1, Math.min(input.maxResults ?? 10, 50))

  const data = await gmailFetch<{ messages?: Array<{ id: string }> }>(
    `/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`
  )

  if (!data.messages?.length) return `No emails found for query: "${q}"`

  const rows: string[] = []

  for (const { id } of data.messages) {
    const msg = await gmailFetch<GmailMessage>(
      `/messages/${id}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    )

    const headers = msg.payload.headers ?? []
    const from = getHeader(headers, 'From')
    const subject = getHeader(headers, 'Subject') || '(no subject)'
    const date = fmtDate(msg.internalDate)
    const unread = msg.labelIds?.includes('UNREAD') ?? false
    const snippet = (msg.snippet ?? '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .slice(0, 160)

    rows.push(
      `ID:      ${id}\n` +
        `From:    ${from}\n` +
        `Subject: ${subject}${unread ? '  [UNREAD]' : ''}\n` +
        `Date:    ${date}\n` +
        `Preview: ${snippet}`
    )
  }

  return rows.join('\n\n' + '─'.repeat(60) + '\n\n')
}

export async function gmailRead(input: { messageId: string }): Promise<string> {
  const msg = await gmailFetch<GmailMessage>(
    `/messages/${input.messageId}?format=full`
  )

  const headers = msg.payload.headers ?? []
  const from = getHeader(headers, 'From')
  const to = getHeader(headers, 'To')
  const cc = getHeader(headers, 'Cc')
  const subject = getHeader(headers, 'Subject') || '(no subject)'
  const date = fmtDate(msg.internalDate)
  const unread = msg.labelIds?.includes('UNREAD') ?? false
  const body = extractBodyText(msg.payload)
  const bodySnip =
    body.length > 8000
      ? body.slice(0, 8000) +
        `\n\n… [${fmtBytes(body.length - 8000)} truncated]`
      : body

  const meta = [
    `ID:       ${msg.id}`,
    `Thread:   ${msg.threadId}`,
    `From:     ${from}`,
    `To:       ${to}`,
    cc ? `Cc:       ${cc}` : null,
    `Subject:  ${subject}${unread ? '  [UNREAD]' : ''}`,
    `Date:     ${date}`,
    `Labels:   ${(msg.labelIds ?? []).join(', ')}`,
    '',
    '─── Body ' + '─'.repeat(52),
    bodySnip || '(empty body)',
  ]
    .filter((l) => l !== null)
    .join('\n')

  return meta
}

export async function gmailSend(input: {
  to: string
  subject: string
  body: string
  cc?: string
  replyToMessageId?: string
  threadId?: string
}): Promise<string> {
  const raw = buildRawEmail({
    to: input.to,
    subject: input.subject,
    body: input.body,
    cc: input.cc,
    replyToMessageId: input.replyToMessageId,
  })

  const payload: Record<string, string> = { raw }
  if (input.threadId) payload['threadId'] = input.threadId

  const result = await gmailFetch<{ id: string; threadId: string }>(
    '/messages/send',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )

  return `✓ Email sent successfully (message ID: ${result.id}, thread: ${result.threadId})`
}

export async function gmailDraft(input: {
  to: string
  subject: string
  body: string
  cc?: string
}): Promise<string> {
  const raw = buildRawEmail({
    to: input.to,
    subject: input.subject,
    body: input.body,
    cc: input.cc,
  })

  const result = await gmailFetch<{ id: string; message: { id: string } }>(
    '/drafts',
    {
      method: 'POST',
      body: JSON.stringify({ message: { raw } }),
    }
  )

  return (
    `✓ Draft saved (draft ID: ${result.id}, message ID: ${result.message.id}). ` +
    `Find it in your Gmail Drafts folder.`
  )
}
