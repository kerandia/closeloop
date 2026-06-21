// Management dashboard fixture: re-aggregates the same shape of data the pipeline
// uses, for the manager lens (?mock=1). Two period snapshots drive the deltas.
import type {
  CustomerListItem,
  FunnelStage,
  MgmtStats,
  RepStat,
  TrendPoint,
} from '../api/types'

const REPS = {
  lena: { id: 'rep-1', name: 'Lena Brandt' },
  max: { id: 'rep-2', name: 'Max Schulz' },
  nina: { id: 'rep-3', name: 'Nina Koch' },
}

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString()

// 15 customers across 5 stages: lead(3) contacted(4) quoted(4) in_progress(3) won(1)
const CUSTOMERS: CustomerListItem[] = [
  // lead (3)
  { id: 'm-1', name: 'Familie Klein', buyer_type: 'family', sign_likelihood: 22, score_trend: 'flat', ghost_risk: 'low', stage: 'lead', next_action: { channel: 'phone', timing_label: 'this week' }, assigned_rep: REPS.lena, last_contact_at: iso(3) },
  { id: 'm-2', name: 'Jonas Vogel', buyer_type: 'skeptic', sign_likelihood: 18, score_trend: 'down', ghost_risk: 'medium', stage: 'lead', next_action: { channel: 'email', timing_label: 'today' }, assigned_rep: REPS.max, last_contact_at: iso(5) },
  { id: 'm-3', name: 'Petra Lang', buyer_type: 'investor', sign_likelihood: 27, score_trend: 'up', ghost_risk: 'low', stage: 'lead', next_action: { channel: 'phone', timing_label: 'within 72h' }, assigned_rep: REPS.nina, last_contact_at: iso(2) },
  // contacted (4)
  { id: 'm-4', name: 'Thomas Becker', buyer_type: 'family', sign_likelihood: 41, score_trend: 'up', ghost_risk: 'medium', stage: 'contacted', next_action: { channel: 'whatsapp', timing_label: 'within 72h' }, assigned_rep: REPS.lena, last_contact_at: iso(6) },
  { id: 'm-5', name: 'Anna Hoffmann', buyer_type: 'environmentalist', sign_likelihood: 35, score_trend: 'down', ghost_risk: 'high', stage: 'contacted', next_action: { channel: 'phone', timing_label: 'today' }, assigned_rep: REPS.max, last_contact_at: iso(16) },
  { id: 'm-6', name: 'David Fuchs', buyer_type: 'investor', sign_likelihood: 44, score_trend: 'flat', ghost_risk: 'low', stage: 'contacted', next_action: { channel: 'email', timing_label: 'this week' }, assigned_rep: REPS.nina, last_contact_at: iso(4) },
  { id: 'm-7', name: 'Sabine Roth', buyer_type: 'skeptic', sign_likelihood: 38, score_trend: 'down', ghost_risk: 'high', stage: 'contacted', next_action: { channel: 'phone', timing_label: 'today' }, assigned_rep: REPS.lena, last_contact_at: iso(19) },
  // quoted (4)
  { id: 'm-8', name: 'Sophie Wagner', buyer_type: 'investor', sign_likelihood: 61, score_trend: 'up', ghost_risk: 'low', stage: 'quoted', next_action: { channel: 'email', timing_label: 'this week' }, assigned_rep: REPS.lena, last_contact_at: iso(4) },
  { id: 'm-9', name: 'Markus Weber', buyer_type: 'family', sign_likelihood: 57, score_trend: 'flat', ghost_risk: 'medium', stage: 'quoted', next_action: { channel: 'whatsapp', timing_label: 'within 48h' }, assigned_rep: REPS.max, last_contact_at: iso(7) },
  { id: 'm-10', name: 'Julia Schmidt', buyer_type: 'environmentalist', sign_likelihood: 66, score_trend: 'up', ghost_risk: 'low', stage: 'quoted', next_action: { channel: 'visit', timing_label: 'within 48h' }, assigned_rep: REPS.nina, last_contact_at: iso(3) },
  { id: 'm-11', name: 'Peter Krause', buyer_type: 'skeptic', sign_likelihood: 52, score_trend: 'down', ghost_risk: 'high', stage: 'quoted', next_action: { channel: 'phone', timing_label: 'today' }, assigned_rep: REPS.max, last_contact_at: iso(21) },
  // in_progress (3)
  { id: 'm-12', name: 'Familie Müller', buyer_type: 'skeptic', sign_likelihood: 74, score_trend: 'up', ghost_risk: 'medium', stage: 'in_progress', next_action: { channel: 'visit', timing_label: 'within 48h' }, assigned_rep: REPS.lena, last_contact_at: iso(2) },
  { id: 'm-13', name: 'Laura Neumann', buyer_type: 'investor', sign_likelihood: 79, score_trend: 'up', ghost_risk: 'low', stage: 'in_progress', next_action: { channel: 'email', timing_label: 'this week' }, assigned_rep: REPS.nina, last_contact_at: iso(1) },
  { id: 'm-14', name: 'Stefan Bauer', buyer_type: 'family', sign_likelihood: 71, score_trend: 'flat', ghost_risk: 'low', stage: 'in_progress', next_action: { channel: 'whatsapp', timing_label: 'within 72h' }, assigned_rep: REPS.max, last_contact_at: iso(5) },
  // won (1)
  { id: 'm-15', name: 'Familie Schäfer', buyer_type: 'environmentalist', sign_likelihood: 96, score_trend: 'up', ghost_risk: 'low', stage: 'won', next_action: null, assigned_rep: REPS.nina, last_contact_at: iso(8) },
]

const STAGE_ORDER = ['lead', 'contacted', 'quoted', 'in_progress', 'won']
const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  quoted: 'Quoted',
  in_progress: 'In Progress',
  won: 'Won',
}
// Rough avg deal value per stage (EUR) for the funnel value column.
const STAGE_VALUE: Record<string, number> = {
  lead: 0,
  contacted: 18_000,
  quoted: 27_000,
  in_progress: 29_000,
  won: 31_000,
}

function buildFunnel(): FunnelStage[] {
  const counts = STAGE_ORDER.map(
    (s) => CUSTOMERS.filter((c) => c.stage === s).length,
  )
  return STAGE_ORDER.map((stage, i) => ({
    stage,
    label: STAGE_LABEL[stage],
    count: counts[i],
    value_eur: counts[i] * STAGE_VALUE[stage],
    conversion_to_next_pct:
      i < counts.length - 1 && counts[i] > 0
        ? Math.round((counts[i + 1] / counts[i]) * 100)
        : null,
  }))
}

function repStat(
  rep: { id: string; name: string },
  contacted: number,
  closed: number,
  revenue: number,
): RepStat {
  const owned = CUSTOMERS.filter((c) => c.assigned_rep?.id === rep.id)
  const breakdown: Record<string, number> = {}
  for (const s of STAGE_ORDER) {
    breakdown[s] = owned.filter((c) => c.stage === s).length
  }
  return {
    rep,
    customers_owned: owned.length,
    contacted_this_period: contacted,
    deals_closed: closed,
    conversion_rate_pct: owned.length ? Math.round((closed / owned.length) * 100) : 0,
    revenue_eur: revenue,
    stage_breakdown: breakdown,
  }
}

const TRENDS: TrendPoint[] = [
  { month: 'Jan', conversion_pct: 14, revenue_eur: 52_000, deals_closed: 2 },
  { month: 'Feb', conversion_pct: 17, revenue_eur: 61_000, deals_closed: 2 },
  { month: 'Mar', conversion_pct: 16, revenue_eur: 58_000, deals_closed: 2 },
  { month: 'Apr', conversion_pct: 21, revenue_eur: 74_000, deals_closed: 3 },
  { month: 'May', conversion_pct: 24, revenue_eur: 88_000, deals_closed: 3 },
  { month: 'Jun', conversion_pct: 27, revenue_eur: 96_000, deals_closed: 4 },
]

// needs_attention: high ghost risk OR no contact in >14 days.
const NEEDS_ATTENTION = CUSTOMERS.filter((c) => {
  if (c.ghost_risk === 'high') return true
  if (!c.last_contact_at) return false
  const days = (Date.now() - new Date(c.last_contact_at).getTime()) / 86_400_000
  return days > 14
})

const funnel = buildFunnel()

// Period snapshots — only the headline KPIs + deltas + reps differ by period.
const SNAPSHOTS: Record<'week' | 'month', Omit<MgmtStats, 'funnel' | 'trends' | 'customers' | 'needs_attention' | 'period'>> = {
  week: {
    new_leads: 6,
    active_pipeline: 11,
    deals_closed: 1,
    revenue_eur: 31_000,
    conversion_rate_pct: 9,
    forecast_eur: 124_000,
    delta_new_leads: 2,
    delta_conversion_pct: 1.5,
    delta_revenue_eur: 8_000,
    reps: [
      repStat(REPS.lena, 5, 0, 0),
      repStat(REPS.max, 4, 0, 0),
      repStat(REPS.nina, 3, 1, 31_000),
    ],
  },
  month: {
    new_leads: 23,
    active_pipeline: 14,
    deals_closed: 4,
    revenue_eur: 96_000,
    conversion_rate_pct: 27,
    forecast_eur: 412_000,
    delta_new_leads: 5,
    delta_conversion_pct: 3,
    delta_revenue_eur: 21_000,
    reps: [
      repStat(REPS.lena, 14, 1, 29_000),
      repStat(REPS.max, 11, 1, 28_000),
      repStat(REPS.nina, 9, 2, 60_000),
    ],
  },
}

export function mockMgmtStats(period: 'week' | 'month' = 'month'): MgmtStats {
  return {
    period,
    ...SNAPSHOTS[period],
    funnel,
    trends: TRENDS,
    customers: CUSTOMERS,
    needs_attention: NEEDS_ATTENTION,
  }
}
