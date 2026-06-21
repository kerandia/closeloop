import { describe, test, expect } from 'vitest'
import { parseCsv, parseImportFile } from './importParse'

describe('parseCsv', () => {
  test('parses headers + quoted fields with embedded commas', () => {
    const csv = 'name,phone,product_summary\n"Müller, Familie",+49 170,"10 kWp, 10 kWh"\n'
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Müller, Familie')
    expect(rows[0].product_summary).toBe('10 kWp, 10 kWh')
  })
})

describe('parseImportFile', () => {
  test('CSV → customers + quotes with numeric coercion', () => {
    const csv = 'name,phone,price_eur,payback_years\nFrau Weber,+49 171,15000,10\n'
    const p = parseImportFile(csv, 'leads.csv')
    expect(p.customers).toHaveLength(1)
    expect(p.customers[0].name).toBe('Frau Weber')
    expect(p.quotes[0].price_eur).toBe(15000)
    expect(p.quotes[0].payback_years).toBe(10)
    // customer_ref links the quote to its customer
    expect(p.quotes[0].customer_ref).toBe(p.customers[0].ref)
  })

  test('flat JSON array', () => {
    const json = JSON.stringify([{ name: 'Herr Fischer', phone: '+49 172', price_eur: 16000 }])
    const p = parseImportFile(json, 'leads.json')
    expect(p.customers[0].name).toBe('Herr Fischer')
    expect(p.quotes[0].price_eur).toBe(16000)
  })

  test('native {customers, quotes} JSON passes through', () => {
    const json = JSON.stringify({
      customers: [{ ref: 'x', name: 'Familie Schmidt' }],
      quotes: [{ customer_ref: 'x', price_eur: 12000 }],
    })
    const p = parseImportFile(json, 'data.json')
    expect(p.customers[0].name).toBe('Familie Schmidt')
    expect(p.quotes[0].price_eur).toBe(12000)
  })

  test('throws when no named rows', () => {
    expect(() => parseImportFile('foo,bar\n1,2\n', 'x.csv')).toThrow(/name/i)
  })
})
