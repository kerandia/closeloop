/**
 * AddCustomerForm — a modal where the rep enters customer + quote info; on submit
 * it imports them and the backend builds the profile (ANALYZE), so the new
 * customer appears ranked on the dashboard.
 */
import { useState } from 'react'
import { importCustomers } from '../api/client'
import { buildImportPayload } from '../lib/importParse'
import './AddCustomerForm.css'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

export function AddCustomerForm({ onClose, onCreated }: Props) {
  // customer
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [language, setLanguage] = useState('de')
  const [consentVoice, setConsentVoice] = useState(true)
  const [consentMarketing, setConsentMarketing] = useState(true)
  // quote
  const [systemKwp, setSystemKwp] = useState('')
  const [batteryKwh, setBatteryKwh] = useState('')
  const [productSummary, setProductSummary] = useState('')
  const [priceEur, setPriceEur] = useState('')
  const [monthlySaving, setMonthlySaving] = useState('')
  const [paybackYears, setPaybackYears] = useState('')
  const [annualReturn, setAnnualReturn] = useState('')
  const [co2, setCo2] = useState('')

  // bulk import: a customers file (required) + an optional quotes file
  const [custFile, setCustFile] = useState<File | null>(null)
  const [quoteFile, setQuoteFile] = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  async function handleImportFiles() {
    if (!custFile) {
      setError('Choose a customers file (JSON or CSV). A quotes file is optional.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = buildImportPayload(
        await custFile.text(), custFile.name,
        quoteFile ? await quoteFile.text() : undefined,
        quoteFile?.name,
      )
      const res = await importCustomers(payload)
      onCreated(res.customer_ids[0] ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse / import those files')
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await importCustomers({
        customers: [
          {
            ref: 'new',
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            language,
            consent_voice: consentVoice,
            consent_marketing: consentMarketing,
            source: 'manual',
          },
        ],
        quotes: [
          {
            customer_ref: 'new',
            system_size_kwp: num(systemKwp),
            battery_kwh: num(batteryKwh),
            product_summary: productSummary.trim() || null,
            price_eur: num(priceEur),
            monthly_saving_eur: num(monthlySaving),
            payback_years: num(paybackYears),
            annual_return_pct: num(annualReturn),
            co2_tons_25y: num(co2),
          },
        ],
      })
      onCreated(res.customer_ids[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer')
      setSubmitting(false)
    }
  }

  return (
    <div className="addc-overlay" role="dialog" aria-modal="true" aria-label="Add customer">
      <div className="addc-dialog">
        <header className="addc-header">
          <h2 className="addc-title">Add customer</h2>
          <button className="addc-close" onClick={onClose} aria-label="Close" type="button">
            ×
          </button>
        </header>

        <form className="addc-form" onSubmit={handleSubmit}>
          {/* Bulk import (Reonic input formats: JSON / CSV). Two files match by
              a shared key (ref/id/email/phone); a single combined file works too. */}
          <div className="addc-upload">
            <span className="addc-upload__title">📄 Import JSON / CSV (bulk)</span>
            <div className="addc-upload__files">
              <label className="addc-upload__file">
                <span>Customers <em>*</em></span>
                <input type="file" accept=".json,.csv,text/csv,application/json"
                  onChange={(e) => setCustFile(e.target.files?.[0] ?? null)} disabled={submitting} />
              </label>
              <label className="addc-upload__file">
                <span>Quotes <em>(optional)</em></span>
                <input type="file" accept=".json,.csv,text/csv,application/json"
                  onChange={(e) => setQuoteFile(e.target.files?.[0] ?? null)} disabled={submitting} />
              </label>
            </div>
            <button type="button" className="addc-btn addc-btn--primary addc-upload__go"
              onClick={handleImportFiles} disabled={submitting || !custFile}>
              {submitting ? 'Importing…' : 'Import file(s)'}
            </button>
          </div>
          <p className="addc-upload__hint">
            Two files (a customers export + a quotes export) are matched by a shared
            key — <code>ref</code>, <code>id</code>, <code>email</code>, or <code>phone</code>.
            A single combined file (customer + quote columns per row) also works.
            Quote columns: <code>price_eur, monthly_saving_eur, payback_years,
            annual_return_pct, co2_tons_25y, system_size_kwp, battery_kwh, product_summary</code>.
            Or add one customer manually below.
          </p>

          <p className="addc-section mono">Customer</p>
          <div className="addc-grid">
            <label className="addc-field addc-field--wide">
              <span>Name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Familie Müller" />
            </label>
            <label className="addc-field">
              <span>Phone (WhatsApp/SMS)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 152 …" />
            </label>
            <label className="addc-field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.de" />
            </label>
            <label className="addc-field">
              <span>Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className="addc-field addc-consents">
              <label className="addc-check">
                <input type="checkbox" checked={consentVoice} onChange={(e) => setConsentVoice(e.target.checked)} />
                <span>Voice consent</span>
              </label>
              <label className="addc-check">
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                />
                <span>Marketing consent</span>
              </label>
            </div>
          </div>

          <p className="addc-section mono">Quote</p>
          <div className="addc-grid">
            <label className="addc-field addc-field--wide">
              <span>Product summary</span>
              <input
                value={productSummary}
                onChange={(e) => setProductSummary(e.target.value)}
                placeholder="10 kWp roof + 10 kWh battery"
              />
            </label>
            <label className="addc-field"><span>System size (kWp)</span>
              <input type="number" value={systemKwp} onChange={(e) => setSystemKwp(e.target.value)} /></label>
            <label className="addc-field"><span>Battery (kWh)</span>
              <input type="number" value={batteryKwh} onChange={(e) => setBatteryKwh(e.target.value)} /></label>
            <label className="addc-field"><span>Price (€)</span>
              <input type="number" value={priceEur} onChange={(e) => setPriceEur(e.target.value)} /></label>
            <label className="addc-field"><span>Monthly saving (€)</span>
              <input type="number" value={monthlySaving} onChange={(e) => setMonthlySaving(e.target.value)} /></label>
            <label className="addc-field"><span>Payback (years)</span>
              <input type="number" value={paybackYears} onChange={(e) => setPaybackYears(e.target.value)} /></label>
            <label className="addc-field"><span>Annual return (%)</span>
              <input type="number" value={annualReturn} onChange={(e) => setAnnualReturn(e.target.value)} /></label>
            <label className="addc-field"><span>CO₂ over 25y (t)</span>
              <input type="number" value={co2} onChange={(e) => setCo2(e.target.value)} /></label>
          </div>

          {error && <p className="addc-error" role="alert">{error}</p>}

          <div className="addc-actions">
            <button type="button" className="addc-btn addc-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="addc-btn addc-btn--primary" disabled={submitting || !name.trim()}>
              {submitting ? 'Analyzing…' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
