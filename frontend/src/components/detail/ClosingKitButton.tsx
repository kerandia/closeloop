/**
 * ClosingKitButton — one-click "generate a buyer-tailored visual" for this
 * customer. Calls the Closing Kit agent (OpenAI Code Interpreter; SVG fallback)
 * and renders the returned image. Isolated, additive.
 */
import { useState } from 'react'
import { generateClosingKit } from '../../api/client'
import type { ClosingKitResult } from '../../api/types'
import './ClosingKitButton.css'

export function ClosingKitButton({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false)
  const [art, setArt] = useState<ClosingKitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      setArt(await generateClosingKit(customerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the visual')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="ckit" data-slot="closing-kit">
      <div className="ckit__bar">
        <span className="ckit__label mono">Closing visual</span>
        <button className="ckit__btn" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : art ? 'Regenerate' : '✨ Generate visual'}
        </button>
      </div>
      {error && <p className="ckit__err" role="alert">{error}</p>}
      {art && (
        <figure className="ckit__fig">
          <img className="ckit__img" src={art.url} alt={art.title} />
          <figcaption className="ckit__cap mono">
            {art.source === 'agent' ? 'AI-generated · Code Interpreter' : 'auto-generated'}
          </figcaption>
        </figure>
      )}
    </section>
  )
}
