import type Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WttrCondition {
  temp_C: string
  temp_F: string
  FeelsLikeC: string
  FeelsLikeF: string
  weatherDesc: Array<{ value: string }>
  humidity: string
  windspeedKmph: string
  winddir16Point: string
  visibility: string
  pressure: string
  cloudcover: string
  uvIndex: string
  precipMM: string
}

interface WttrDay {
  date: string
  avgtempC: string
  avgtempF: string
  maxtempC: string
  maxtempF: string
  mintempC: string
  mintempF: string
  uvIndex: string
  astronomy: Array<{ sunrise: string; sunset: string; moonrise: string }>
  hourly: Array<{
    time: string
    tempC: string
    tempF: string
    weatherDesc: Array<{ value: string }>
    chanceofrain: string
    chanceofsnow: string
    windspeedKmph: string
    winddir16Point: string
  }>
}

interface WttrResponse {
  current_condition: WttrCondition[]
  nearest_area: Array<{
    areaName: Array<{ value: string }>
    region: Array<{ value: string }>
    country: Array<{ value: string }>
  }>
  weather: WttrDay[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function fmtHour(raw: string): string {
  // wttr.in encodes hours as 0, 100, 200, ..., 2300
  const h = Math.floor(parseInt(raw, 10) / 100)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${String(h12).padStart(2)}:00 ${ampm}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function windDesc(speedKmph: number): string {
  if (speedKmph < 1) return 'Calm'
  if (speedKmph < 20) return 'Light'
  if (speedKmph < 40) return 'Moderate'
  if (speedKmph < 60) return 'Strong'
  return 'Storm'
}

function uvDesc(uv: number): string {
  if (uv <= 2) return 'Low'
  if (uv <= 5) return 'Moderate'
  if (uv <= 7) return 'High'
  if (uv <= 10) return 'Very High'
  return 'Extreme'
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const getWeatherToolDef: Anthropic.Tool = {
  name: 'get_weather',
  description:
    'Get the current weather conditions and 3-day forecast for any location. ' +
    'No API key required. ' +
    'Location can be a city name, zip/postal code, airport code, or coordinates (lat,lon). ' +
    'Leave location empty to auto-detect from IP address.',
  input_schema: {
    type: 'object' as const,
    properties: {
      location: {
        type: 'string',
        description:
          'Where to get weather for. Examples: "London", "New York", "90210", ' +
          '"JFK", "48.8566,2.3522". Leave empty for current location.',
      },
      units: {
        type: 'string',
        description:
          'Temperature unit: "metric" (°C, km/h) or "imperial" (°F, mph). ' +
          'Defaults to metric.',
      },
      forecast: {
        type: 'boolean',
        description: 'Include the 3-day hourly forecast. Defaults to true.',
      },
    },
    required: [],
  },
}

// ─── Implementation ───────────────────────────────────────────────────────────

export async function getWeather(input: {
  location?: string
  units?: 'metric' | 'imperial'
  forecast?: boolean
}): Promise<string> {
  const metric = (input.units ?? 'metric') !== 'imperial'
  const showForecast = input.forecast !== false
  const loc = (input.location ?? '').trim()
  const query = loc ? encodeURIComponent(loc) : ''
  const url = `https://wttr.in/${query}?format=j1`

  let data: WttrResponse
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'opensage/4.1 personal-assistant' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (res.status === 404) {
        return `Error: Location not found: "${loc}". Try a different city name or coordinates.`
      }
      return `Error: Weather service returned ${res.status} ${res.statusText}`
    }

    data = (await res.json()) as WttrResponse
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Error: Could not reach weather service — ${msg}`
  }

  const cur = data.current_condition[0]
  const area = data.nearest_area[0]
  const days = data.weather

  if (!cur || !area) return 'Error: Unexpected response from weather service.'

  const city = area.areaName[0]?.value ?? ''
  const region = area.region[0]?.value ?? ''
  const country = area.country[0]?.value ?? ''
  const place = [city, region, country].filter(Boolean).join(', ')

  const temp = metric ? `${cur.temp_C}°C` : `${cur.temp_F}°F`
  const feels = metric ? `${cur.FeelsLikeC}°C` : `${cur.FeelsLikeF}°F`
  const wind = metric
    ? `${cur.windspeedKmph} km/h`
    : `${Math.round(parseInt(cur.windspeedKmph) * 0.621)} mph`
  const windSpd = parseInt(cur.windspeedKmph)
  const desc = cur.weatherDesc[0]?.value ?? 'Unknown'
  const humidity = parseInt(cur.humidity)
  const uv = parseInt(cur.uvIndex)
  const precip = parseFloat(cur.precipMM)

  const lines: string[] = []

  // ── Location & current ────────────────────────────────────────────────────
  lines.push(`Location  : ${place || 'Auto-detected'}`)
  lines.push(`Conditions: ${desc}`)
  lines.push(``)
  lines.push(`Temperature  : ${temp}  (feels like ${feels})`)
  lines.push(`Humidity     : ${humidity}%  [${bar(humidity, 16)}]`)
  lines.push(
    `Wind         : ${wind} ${cur.winddir16Point}  (${windDesc(windSpd)})`
  )
  lines.push(`Visibility   : ${cur.visibility} km`)
  lines.push(`Pressure     : ${cur.pressure} hPa`)
  lines.push(`UV Index     : ${uv}  (${uvDesc(uv)})`)
  if (precip > 0) lines.push(`Precip       : ${precip} mm`)
  lines.push(`Cloud Cover  : ${cur.cloudcover}%`)

  // ── Sunrise / sunset from today ───────────────────────────────────────────
  const today = days[0]
  if (today?.astronomy[0]) {
    const ast = today.astronomy[0]
    lines.push(``)
    lines.push(`Sunrise : ${ast.sunrise}    Sunset : ${ast.sunset}`)
    if (ast.moonrise) lines.push(`Moonrise: ${ast.moonrise}`)
  }

  // ── 3-day forecast ────────────────────────────────────────────────────────
  if (showForecast && days.length > 0) {
    lines.push(``)
    lines.push(`─── 3-Day Forecast ${'─'.repeat(42)}`)

    for (const day of days) {
      const dateStr = fmtDate(day.date)
      const hi = metric ? `${day.maxtempC}°C` : `${day.maxtempF}°F`
      const lo = metric ? `${day.mintempC}°C` : `${day.mintempF}°F`
      const avg = metric ? `${day.avgtempC}°C` : `${day.avgtempF}°F`
      lines.push(``)
      lines.push(
        `${dateStr.padEnd(16)}  ${lo} → ${hi}  avg ${avg}  UV ${day.uvIndex}`
      )

      // Pick 4 representative hours: 6am, 12pm, 6pm, 9pm
      const targetHours = [600, 1200, 1800, 2100]
      const hourSlots = targetHours
        .map((t) => day.hourly.find((h) => parseInt(h.time) === t))
        .filter((h): h is NonNullable<typeof h> => h !== undefined)

      for (const h of hourSlots) {
        const hTemp = metric ? `${h.tempC}°C` : `${h.tempF}°F`
        const hDesc = (h.weatherDesc[0]?.value ?? '').slice(0, 18).padEnd(18)
        const hWind = metric
          ? `${h.windspeedKmph} km/h ${h.winddir16Point}`
          : `${Math.round(parseInt(h.windspeedKmph) * 0.621)} mph ${h.winddir16Point}`
        const rain = parseInt(h.chanceofrain)
        const snow = parseInt(h.chanceofsnow)
        const precStr =
          rain > 0 ? `  rain ${rain}%` : snow > 0 ? `  snow ${snow}%` : ''

        lines.push(
          `  ${fmtHour(h.time)}  ${hTemp.padEnd(8)}${hDesc}  ${hWind}${precStr}`
        )
      }
    }
  }

  return lines.join('\n')
}
