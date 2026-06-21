// Parse uploaded JSON/CSV into the backend import payload {customers, quotes}.
// Supports the realistic case of TWO files (a customers export + a quotes export)
// matched by a shared key, as well as a single combined file.
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

// keys used to MATCH a quote row to its customer (first present wins)
const CUSTOMER_KEYS = ['ref', 'id', 'customer_id', 'email', 'phone']
const QUOTE_KEYS = ['customer_ref', 'ref', 'customer_id', 'id', 'email', 'phone']

function num(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(String(v).replace(',', '.').replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function pickKey(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return undefined
}

function rowToCustomer(row: Record<string, unknown>, i: number): ImportCustomerInput {
  const get = (k: string) => row[k] ?? row[k.toLowerCase()]
  return {
    ref: pickKey(row, CUSTOMER_KEYS) ?? `import-${i}`,
    name: String(get('name') ?? '').trim(),
    email: (get('email') as string) || null,
    phone: (get('phone') as string) || null,
    language: (get('language') as string) || 'de',
    consent_voice: get('consent_voice') === undefined ? true : TRUTHY.has(String(get('consent_voice')).toLowerCase()),
    consent_marketing: get('consent_marketing') === undefined ? true : TRUTHY.has(String(get('consent_marketing')).toLowerCase()),
    source: 'import',
  }
}

function rowToQuote(row: Record<string, unknown>, customerRef: string): ImportQuoteInput {
  const get = (k: string) => row[k] ?? row[k.toLowerCase()]
  const quote: ImportQuoteInput = { customer_ref: customerRef }
  for (const f of QUOTE_FIELDS) {
    const v = get(f)
    if (v === undefined || v === null || String(v).trim() === '') continue
    ;(quote as Record<string, unknown>)[f] = NUMERIC.has(f) ? num(v) : String(v)
  }
  return quote
}

function hasQuoteData(q: ImportQuoteInput): boolean {
  return QUOTE_FIELDS.some((f) => (q as Record<string, unknown>)[f] != null)
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

/** Parse one file's text into either the native {customers,quotes} shape or a row list. */
function parseFile(text: string, filename: string): { native?: ImportPayload; rows?: Record<string, unknown>[] } {
  const t = text.trim()
  const isJson = filename.toLowerCase().endsWith('.json') || t.startsWith('{') || t.startsWith('[')
  if (isJson) {
    const data = JSON.parse(text)
    if (data && !Array.isArray(data) && Array.isArray(data.customers)) {
      return { native: { customers: data.customers, quotes: data.quotes ?? [] } }
    }
    return { rows: Array.isArray(data) ? data : [data] }
  }
  return { rows: parseCsv(text) }
}

/**
 * Build the import payload from a customers file and an OPTIONAL quotes file.
 * - Two files: customers + quotes matched by a shared key (ref/id/email/phone).
 * - One combined file: each row carries both customer and quote columns (1:1).
 */
export function buildImportPayload(
  custText: string, custName: string,
  quoteText?: string, quoteName?: string,
): ImportPayload {
  const cust = parseFile(custText, custName)
  if (cust.native) return cust.native // a full {customers,quotes} export — use as-is

  const custRows = cust.rows ?? []
  const customers = custRows.map(rowToCustomer)
  if (!customers.some((c) => c.name)) throw new Error('Customers file: no rows with a "name" found.')

  let quotes: ImportQuoteInput[]
  if (quoteText && quoteText.trim()) {
    // separate quotes file → match each quote to a customer by key value
    const q = parseFile(quoteText, quoteName ?? 'quotes')
    const baseQuotes = q.native
      ? q.native.quotes
      : (q.rows ?? []).map((r) => rowToQuote(r, pickKey(r, QUOTE_KEYS) ?? ''))
    const refs = new Set(customers.map((c) => c.ref))
    const unmatched = baseQuotes.filter((qq) => !qq.customer_ref || !refs.has(qq.customer_ref))
    if (unmatched.length) {
      throw new Error(
        `${unmatched.length} quote row(s) don't match any customer by ref/id/email/phone — ` +
        `both files must share a key column.`,
      )
    }
    quotes = baseQuotes
  } else {
    // combined single file → derive each row's quote, keep only rows with quote data
    quotes = custRows
      .map((r, i) => rowToQuote(r, customers[i].ref!))
      .filter(hasQuoteData)
  }
  return { customers, quotes }
}

/** Single-file convenience (a combined customers+quotes file). */
export function parseImportFile(text: string, filename: string): ImportPayload {
  return buildImportPayload(text, filename)
}

export const SAMPLE_IMPORT: ImportPayload = {
  customers: [
    { ref: 'a', name: 'Familie Becker', phone: '+49 170 0000001', email: 'becker@example.de', language: 'de' },
  ],
  quotes: [
    { customer_ref: 'a', system_size_kwp: 11, battery_kwh: 10, product_summary: '11 kWp + 10 kWh', price_eur: 17000, monthly_saving_eur: 130, payback_years: 9, annual_return_pct: 11, co2_tons_25y: 150 },
  ],
}
