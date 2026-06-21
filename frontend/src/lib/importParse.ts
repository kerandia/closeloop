// Parse an uploaded JSON or CSV file into the backend import payload
// {customers, quotes} (Reonic track: "JSON with profile + quote" / "CSV upload").
import type { ImportCustomerInput, ImportQuoteInput } from '../api/types'

export interface ImportPayload {
  customers: ImportCustomerInput[]
  quotes: ImportQuoteInput[]
}

const QUOTE_FIELDS = [
  'system_size_kwp', 'battery_kwh', 'product_summary', 'price_eur',
  'monthly_saving_eur', 'payback_years', 'annual_return_pct', 'co2_tons_25y',
]
const NUMERIC = new Set(QUOTE_FIELDS.filter((f) => f !== 'product_summary'))
const TRUTHY = new Set(['true', '1', 'yes', 'y', 'ja'])

function num(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(String(v).replace(',', '.').replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Map one flat row (CSV row or JSON object) to a customer + quote pair. */
function rowToEntry(row: Record<string, unknown>, i: number): {
  customer: ImportCustomerInput
  quote: ImportQuoteInput
} {
  const ref = `import-${i}`
  const get = (k: string) => row[k] ?? row[k.toLowerCase()]
  const customer: ImportCustomerInput = {
    ref,
    name: String(get('name') ?? '').trim(),
    email: (get('email') as string) || null,
    phone: (get('phone') as string) || null,
    language: (get('language') as string) || 'de',
    consent_voice: get('consent_voice') === undefined ? true : TRUTHY.has(String(get('consent_voice')).toLowerCase()),
    consent_marketing: get('consent_marketing') === undefined ? true : TRUTHY.has(String(get('consent_marketing')).toLowerCase()),
    source: 'import',
  }
  const quote: ImportQuoteInput = { customer_ref: ref }
  for (const f of QUOTE_FIELDS) {
    const v = get(f)
    if (v === undefined || v === null || String(v).trim() === '') continue
    ;(quote as Record<string, unknown>)[f] = NUMERIC.has(f) ? num(v) : String(v)
  }
  return { customer, quote }
}

// ── CSV tokenizer (handles quoted fields, embedded commas/newlines, "" escapes) ──
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row) }
  if (!rows.length) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()])),
  )
}

/** Parse a file's text + name into the import payload. Throws on invalid input. */
export function parseImportFile(text: string, filename: string): ImportPayload {
  const isJson = filename.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')
  let rows: Record<string, unknown>[]

  if (isJson) {
    const data = JSON.parse(text)
    // already the backend shape?
    if (data && !Array.isArray(data) && Array.isArray(data.customers)) {
      return { customers: data.customers, quotes: data.quotes ?? [] }
    }
    rows = Array.isArray(data) ? data : [data]
  } else {
    rows = parseCsv(text)
  }

  const entries = rows
    .map((r, i) => rowToEntry(r, i))
    .filter((e) => e.customer.name)
  if (!entries.length) throw new Error('No rows with a "name" found.')
  return {
    customers: entries.map((e) => e.customer),
    quotes: entries.map((e) => e.quote),
  }
}

export const SAMPLE_IMPORT: ImportPayload = {
  customers: [
    { ref: 'a', name: 'Familie Becker', phone: '+49 170 0000001', email: 'becker@example.de', language: 'de' },
  ],
  quotes: [
    { customer_ref: 'a', system_size_kwp: 11, battery_kwh: 10, product_summary: '11 kWp + 10 kWh', price_eur: 17000, monthly_saving_eur: 130, payback_years: 9, annual_return_pct: 11, co2_tons_25y: 150 },
  ],
}
