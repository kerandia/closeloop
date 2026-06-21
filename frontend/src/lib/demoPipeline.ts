/**
 * demoPipeline — DEMO-ONLY presentation layer over the customer list/detail.
 *
 * The backend seeds everyone at "quoted". For the demo we want a realistic
 * installer sales funnel, a couple of extra rows to populate it, and a Risk
 * column that only flags who needs rescuing. This is applied in api/client.ts
 * (the real-fetch path only) so component tests — which mock the client — are
 * unaffected. No backend changes; all hardcoded.
 */
import type { CustomerListItem, CustomerDetail, BuyerType } from '../api/types'

// ── Funnel stages (the only valid stages, in order) ───────────────────────────
export interface FunnelStage {
  value: string
  label: string
}

export const FUNNEL_STAGES: FunnelStage[] = [
  { value: 'new_lead', label: 'New lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'in_discussion', label: 'In discussion' },
  { value: 'visit_booked', label: 'Visit booked' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

// Per-customer demo distribution (spread the seed rows across the funnel).
const STAGE_BY_NAME: Record<string, string> = {
  'Familie Hoffmann': 'in_discussion',
  'Familie Müller': 'quoted',
  'Herr Fischer': 'in_discussion',
  'Herr Schmidt': 'quoted',
  'Frau Weber': 'contacted',
}

// Fallback for any other name: map the old backend stage onto the new funnel.
const STAGE_NORMALIZE: Record<string, string> = {
  imported: 'new_lead',
  new: 'new_lead',
  contacted: 'contacted',
  quoted: 'quoted',
  in_progress: 'in_discussion',
  won: 'won',
  lost: 'lost',
}

/** Resolve a customer's demo funnel stage from their name (then old stage). */
export function demoStage(name: string, currentStage: string): string {
  return STAGE_BY_NAME[name] ?? STAGE_NORMALIZE[currentStage] ?? currentStage
}

// ── Extra rows so the funnel looks populated (Visit booked + Won) ─────────────
const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString()

const DEMO_REP = { id: 'rep-demo', name: 'Lena Vogt' }

const EXTRA_ROWS: CustomerListItem[] = [
  {
    id: 'demo-visit-booked',
    name: 'Familie Keller',
    buyer_type: 'family',
    sign_likelihood: 78,
    score_trend: 'up',
    ghost_risk: 'low',
    stage: 'visit_booked',
    next_action: { channel: 'visit', timing_label: 'Wed 16:00' },
    assigned_rep: DEMO_REP,
    last_contact_at: daysAgoIso(1),
  },
  {
    id: 'demo-won',
    name: 'Herr Wagner',
    buyer_type: 'investor',
    sign_likelihood: 95,
    score_trend: 'up',
    ghost_risk: 'low',
    stage: 'won',
    next_action: null,
    assigned_rep: DEMO_REP,
    last_contact_at: daysAgoIso(3),
  },
]

/** Overlay demo stages, append the extra rows, keep the score-ranked order. */
export function applyDemoList(rows: CustomerListItem[]): CustomerListItem[] {
  const mapped = rows.map((c) => ({ ...c, stage: demoStage(c.name, c.stage) }))
  return [...mapped, ...EXTRA_ROWS].sort(
    (a, b) => (b.sign_likelihood ?? 0) - (a.sign_likelihood ?? 0),
  )
}

/** Keep the detail view's stage consistent with the list. */
export function applyDemoDetail(detail: CustomerDetail): CustomerDetail {
  if (!detail?.customer) return detail
  return {
    ...detail,
    customer: {
      ...detail.customer,
      stage: demoStage(detail.customer.name, detail.customer.stage),
    },
  }
}

// ── Conditional risk — only flag rows that actually need rescuing ─────────────
/** At risk = going quiet (high ghost risk) OR the score is trending down. */
export function isAtRisk(c: Pick<CustomerListItem, 'ghost_risk' | 'score_trend'>): boolean {
  return c.ghost_risk === 'high' || c.score_trend === 'down'
}

// ── Buyer-type filter options ─────────────────────────────────────────────────
export const BUYER_TYPE_OPTIONS: { value: BuyerType; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'skeptic', label: 'Skeptic' },
  { value: 'investor', label: 'Investor' },
  { value: 'environmentalist', label: 'Environmentalist' },
]
