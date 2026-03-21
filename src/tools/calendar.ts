import type Anthropic from '@anthropic-ai/sdk'
import { googleApiFetch } from './gmail.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const CAL_API = 'https://www.googleapis.com/calendar/v3'
const PRIMARY = 'primary'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

interface CalAttendee {
  email: string
  displayName?: string
  responseStatus?: string
}

interface CalEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: CalDateTime
  end: CalDateTime
  attendees?: CalAttendee[]
  hangoutLink?: string
  htmlLink?: string
  status?: string
  organizer?: { email: string; displayName?: string }
  recurrence?: string[]
  colorId?: string
}

interface CalListResponse {
  items?: CalEvent[]
  nextPageToken?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return googleApiFetch<T>(`${CAL_API}${path}`, options)
}

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Format a CalDateTime for display.
 * All-day events use date only; timed events show date + time.
 */
function fmtTime(dt: CalDateTime): string {
  if (dt.date) {
    // All-day event
    const d = new Date(dt.date + 'T00:00:00')
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (dt.dateTime) {
    const d = new Date(dt.dateTime)
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return '(unknown time)'
}

function fmtRange(start: CalDateTime, end: CalDateTime): string {
  if (start.date) {
    // All-day: show start date (end is exclusive in Google Calendar)
    return fmtTime(start) + '  (all day)'
  }
  if (start.dateTime && end.dateTime) {
    const s = new Date(start.dateTime)
    const e = new Date(end.dateTime)
    const sameDay = s.toDateString() === e.toDateString()
    if (sameDay) {
      const startStr = s.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      const endStr = e.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
      return `${startStr} – ${endStr}`
    }
    return `${fmtTime(start)} – ${fmtTime(end)}`
  }
  return fmtTime(start)
}

function fmtEvent(ev: CalEvent, index?: number): string {
  const lines: string[] = []
  const prefix = index !== undefined ? `[${index}] ` : ''
  lines.push(
    `${prefix}${ev.summary ?? '(no title)'}` +
      (ev.id
        ? `  ${' '.repeat(Math.max(0, 46 - (ev.summary ?? '').length))}ID: ${ev.id}`
        : '')
  )
  lines.push(`    Time:     ${fmtRange(ev.start, ev.end)}`)
  if (ev.location) lines.push(`    Location: ${ev.location}`)
  if (ev.attendees?.length) {
    const guests = ev.attendees
      .map((a) => {
        const status =
          a.responseStatus === 'accepted'
            ? '✓'
            : a.responseStatus === 'declined'
              ? '✗'
              : a.responseStatus === 'tentative'
                ? '?'
                : '·'
        return `${a.email} ${status}`
      })
      .join(', ')
    lines.push(`    Guests:   ${guests}`)
  }
  if (ev.hangoutLink) lines.push(`    Meet:     ${ev.hangoutLink}`)
  if (ev.description) {
    const desc = ev.description.replace(/<[^>]+>/g, '').trim()
    if (desc) {
      const short = desc.length > 200 ? desc.slice(0, 200) + '…' : desc
      lines.push(`    Notes:    ${short}`)
    }
  }
  return lines.join('\n')
}

/** Parse a natural-language or ISO date string into a CalDateTime object. */
function toCalDateTime(
  input: string,
  allDay: boolean,
  tz: string
): CalDateTime {
  if (allDay) {
    // Expect YYYY-MM-DD
    const m = input.match(/\d{4}-\d{2}-\d{2}/)
    return { date: m ? m[0] : input }
  }
  // Expect ISO 8601 with or without timezone
  const d = new Date(input)
  if (isNaN(d.getTime())) {
    // Best-effort: return as-is
    return { dateTime: input, timeZone: tz }
  }
  // Ensure we have a timezone offset in the string
  const iso = d.toISOString().replace('Z', '')
  return { dateTime: iso, timeZone: tz }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const calendarListToolDef: Anthropic.Tool = {
  name: 'calendar_list',
  description:
    'List upcoming Google Calendar events. ' +
    'Returns title, time, location, guests, and event ID for each event. ' +
    'Use the event ID with calendar_update or calendar_delete.',
  input_schema: {
    type: 'object' as const,
    properties: {
      days: {
        type: 'number',
        description: 'How many days ahead to look (default 7, max 60).',
      },
      maxResults: {
        type: 'number',
        description: 'Max number of events to return (default 15, max 50).',
      },
      query: {
        type: 'string',
        description:
          'Free-text search query to filter events by title/description.',
      },
      calendarId: {
        type: 'string',
        description:
          'Calendar ID to query (default "primary"). ' +
          'Use "list" to see all available calendars.',
      },
    },
    required: [],
  },
}

export const calendarCreateToolDef: Anthropic.Tool = {
  name: 'calendar_create',
  description:
    'Create a new Google Calendar event. ' +
    'For timed events pass ISO 8601 datetime strings (e.g. "2024-06-15T14:00:00"). ' +
    'For all-day events pass a date string (e.g. "2024-06-15") and set allDay=true. ' +
    'The local system timezone is used automatically.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Event title / summary.',
      },
      start: {
        type: 'string',
        description:
          'Start time as ISO 8601 datetime ("2024-06-15T14:00:00") or date ("2024-06-15").',
      },
      end: {
        type: 'string',
        description:
          'End time as ISO 8601 datetime or date. For 1-hour meetings you can omit this and the event will be 1 hour long.',
      },
      description: {
        type: 'string',
        description: 'Event description / notes (optional).',
      },
      location: {
        type: 'string',
        description: 'Physical address or video call URL (optional).',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of attendee email addresses (optional).',
      },
      allDay: {
        type: 'boolean',
        description:
          'Set to true for all-day events. Start/end should be YYYY-MM-DD dates.',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (default "primary").',
      },
    },
    required: ['title', 'start'],
  },
}

export const calendarUpdateToolDef: Anthropic.Tool = {
  name: 'calendar_update',
  description:
    'Update an existing Google Calendar event. ' +
    'Get the event ID from calendar_list. Only the fields you provide will be changed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      eventId: {
        type: 'string',
        description: 'The event ID (from calendar_list output).',
      },
      title: { type: 'string', description: 'New event title.' },
      start: {
        type: 'string',
        description: 'New start time (ISO 8601).',
      },
      end: {
        type: 'string',
        description: 'New end time (ISO 8601).',
      },
      description: {
        type: 'string',
        description: 'New description.',
      },
      location: {
        type: 'string',
        description: 'New location.',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Replace attendee list with these email addresses.',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (default "primary").',
      },
    },
    required: ['eventId'],
  },
}

export const calendarDeleteToolDef: Anthropic.Tool = {
  name: 'calendar_delete',
  description:
    'Delete a Google Calendar event permanently. ' +
    'Get the event ID from calendar_list. This cannot be undone.',
  input_schema: {
    type: 'object' as const,
    properties: {
      eventId: {
        type: 'string',
        description: 'The event ID to delete (from calendar_list output).',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (default "primary").',
      },
    },
    required: ['eventId'],
  },
}

// ─── Implementations ──────────────────────────────────────────────────────────

export async function calendarList(input: {
  days?: number
  maxResults?: number
  query?: string
  calendarId?: string
}): Promise<string> {
  // Special case: list available calendars
  if (input.calendarId === 'list') {
    const data = await calFetch<{
      items?: Array<{ id: string; summary: string; primary?: boolean }>
    }>('/users/me/calendarList')
    const items = data.items ?? []
    if (!items.length) return 'No calendars found.'
    return items
      .map(
        (c) =>
          `${c.primary ? '● ' : '  '}${(c.summary ?? '').padEnd(40)} ID: ${c.id}`
      )
      .join('\n')
  }

  const calId = encodeURIComponent(input.calendarId ?? PRIMARY)
  const days = Math.min(input.days ?? 7, 60)
  const maxResults = Math.min(input.maxResults ?? 15, 50)
  const tz = localTz()

  const now = new Date()
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: tz,
  })
  if (input.query) params.set('q', input.query)

  const data = await calFetch<CalListResponse>(
    `/calendars/${calId}/events?${params.toString()}`
  )

  const events = data.items ?? []
  if (!events.length) {
    return `No events found in the next ${days} day${days !== 1 ? 's' : ''}.`
  }

  const header = `${events.length} event${events.length !== 1 ? 's' : ''} · next ${days} day${days !== 1 ? 's' : ''}`
  const body = events
    .map((ev, i) => fmtEvent(ev, i + 1))
    .join('\n\n' + '─'.repeat(60) + '\n\n')

  return `${header}\n\n${'─'.repeat(60)}\n\n${body}`
}

export async function calendarCreate(input: {
  title: string
  start: string
  end?: string
  description?: string
  location?: string
  attendees?: string[]
  allDay?: boolean
  calendarId?: string
}): Promise<string> {
  const calId = encodeURIComponent(input.calendarId ?? PRIMARY)
  const tz = localTz()
  const allDay = input.allDay ?? false

  const startDt = toCalDateTime(input.start, allDay, tz)

  let endDt: CalDateTime
  if (input.end) {
    endDt = toCalDateTime(input.end, allDay, tz)
  } else if (allDay) {
    // Default: 1-day event
    const d = new Date(input.start + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    endDt = { date: d.toISOString().slice(0, 10) }
  } else {
    // Default: 1-hour event
    const d = new Date(input.start)
    d.setHours(d.getHours() + 1)
    endDt = { dateTime: d.toISOString().replace('Z', ''), timeZone: tz }
  }

  const body: Record<string, unknown> = {
    summary: input.title,
    start: startDt,
    end: endDt,
  }
  if (input.description) body['description'] = input.description
  if (input.location) body['location'] = input.location
  if (input.attendees?.length) {
    body['attendees'] = input.attendees.map((email) => ({ email }))
  }

  const ev = await calFetch<CalEvent>(`/calendars/${calId}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return (
    `✓ Event created\n\n` +
    fmtEvent(ev) +
    (ev.htmlLink ? `\n    Link:     ${ev.htmlLink}` : '')
  )
}

export async function calendarUpdate(input: {
  eventId: string
  title?: string
  start?: string
  end?: string
  description?: string
  location?: string
  attendees?: string[]
  calendarId?: string
}): Promise<string> {
  const calId = encodeURIComponent(input.calendarId ?? PRIMARY)
  const tz = localTz()

  // Build patch body — only include fields the caller provided
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch['summary'] = input.title
  if (input.description !== undefined) patch['description'] = input.description
  if (input.location !== undefined) patch['location'] = input.location
  if (input.attendees !== undefined) {
    patch['attendees'] = input.attendees.map((email) => ({ email }))
  }

  if (input.start !== undefined) {
    const allDay = /^\d{4}-\d{2}-\d{2}$/.test(input.start)
    patch['start'] = toCalDateTime(input.start, allDay, tz)
    if (input.end !== undefined) {
      patch['end'] = toCalDateTime(input.end, allDay, tz)
    }
  } else if (input.end !== undefined) {
    const allDay = /^\d{4}-\d{2}-\d{2}$/.test(input.end)
    patch['end'] = toCalDateTime(input.end, allDay, tz)
  }

  if (Object.keys(patch).length === 0) {
    return 'Error: No fields to update were provided.'
  }

  const ev = await calFetch<CalEvent>(
    `/calendars/${calId}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  )

  return `✓ Event updated\n\n` + fmtEvent(ev)
}

export async function calendarDelete(input: {
  eventId: string
  calendarId?: string
}): Promise<string> {
  const calId = encodeURIComponent(input.calendarId ?? PRIMARY)

  // DELETE returns 204 No Content on success — googleApiFetch expects JSON,
  // so we call the raw fetch manually here.

  // Use a raw fetch with the token by calling googleApiFetch with a custom
  // response handler via a workaround: send a HEAD-like empty-body request
  // and treat a 204 as success.
  try {
    await calFetch<void>(
      `/calendars/${calId}/events/${encodeURIComponent(input.eventId)}`,
      { method: 'DELETE' }
    )
  } catch (err: unknown) {
    // Google returns 204 (no body), which our JSON-parsing helper treats as an
    // error. Catch it and check whether it was actually a success.
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('204') || msg.includes('Unexpected end')) {
      return `✓ Event ${input.eventId} deleted.`
    }
    throw err
  }

  return `✓ Event ${input.eventId} deleted.`
}
