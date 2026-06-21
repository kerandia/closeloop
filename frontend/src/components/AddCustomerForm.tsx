/**
 * AddCustomerForm — a modal where the rep enters customer + quote info; on submit
 * it imports them and the backend builds the profile (ANALYZE), so the new
 * customer appears ranked on the dashboard.
 */
import { useState } from 'react'
import { importCustomers } from '../api/client'
import { parseImportFile } from '../lib/importParse'
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

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = parseImportFile(await file.text(), file.name)
      const res = await importCustomers(payload)
      onCreated(res.customer_ids[0] ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse / import that file')
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
          {/* Bulk import (Reonic input format: JSON profile+quote, or CSV) */}
          <label className="addc-upload">
            <span>📄 Import JSON / CSV (bulk)</span>
            <input type="file" accept=".json,.csv,text/csv,application/json" onChange={handleFile} disabled={submitting} />
          </label>
          <p className="addc-upload__hint">
            CSV header or JSON keys: <code>name, phone, email, language, price_eur,
            monthly_saving_eur, payback_years, annual_return_pct, co2_tons_25y,
            system_size_kwp, battery_kwh, product_summary</code>. Or paste a
            customer below.
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
