// TS mirror of the backend response shapes (backend/app/schemas.py, serializers.py).
// Keep in sync with the live FastAPI contract.

export type BuyerType = 'family' | 'investor' | 'environmentalist' | 'skeptic'
export type GhostRisk = 'low' | 'medium' | 'high'
// NOTE: `telegram` is a frontend-anticipated chat channel — the UI supports it as
// a WhatsApp/SMS-style surface, but the backend contract does not emit it yet.
// Remove this note once the backend adds telegram to its channel enum.
export type Channel = 'email' | 'sms' | 'whatsapp' | 'telegram' | 'phone' | 'visit' | 'voice_ai' | 'system'
export type RecStatus =
  | 'pending'
  | 'approved'
  | 'composing'
  | 'ready'
  | 'sent'
  | 'dismissed'
  | 'superseded'

export interface RepBrief {
  id: string
  name: string
}

export interface NextAction {
  channel: Channel
  timing_label: string | null
}

export type ScoreTrend = 'up' | 'down' | 'flat'

export interface CustomerListItem {
  id: string
  name: string
  buyer_type: BuyerType | null
  sign_likelihood: number | null
  score_trend?: ScoreTrend | null
  ghost_risk: GhostRisk | null
  stage: string
  next_action: NextAction | null
  assigned_rep: RepBrief | null
  last_contact_at: string | null
}

export interface Quote {
  id: string
  system_size_kwp: number | null
  battery_kwh: number | null
  product_summary: string | null
  price_eur: number | null
  monthly_saving_eur: number | null
  payback_years: number | null
  annual_return_pct: number | null
  co2_tons_25y: number | null
  financing: Record<string, unknown> | null
  pdf_url: string | null
  sent_at: string | null
}

export interface Negotiation {
  multi_quote_risk?: string | null
  price_sensitivity?: string | null
  decision_speed?: string | null
  decision_makers?: string[]
  blockers?: string[]
  buying_signals?: string[]
}

export interface Profile {
  id: string
  motivation: string | null
  motivation_conf: number | null
  negotiation: Negotiation
  buyer_type: BuyerType | null
  summary: string | null
  objections: { key: string; note?: string | null }[]
  completeness: number
  updated_at: string | null
}

export type SignalLayer = 'motivation' | 'negotiation' | 'objection' | 'buying_signal'

export interface Signal {
  id: string
  layer: SignalLayer
  label: string
  evidence_quote: string | null
  source_interaction_id: string | null
  confidence: number | null
}

export interface Interaction {
  id: string
  rep_id: string | null
  channel: Channel
  direction: 'inbound' | 'outbound'
  occurred_at: string | null
  content: string | null
  transcript_md: string | null
  recording_url: string | null
  outcome: string | null
  rep_gut_feel: string | null
  created_by: string
}

export type ActionType = 'callback' | 'send_info' | 'schedule_visit' | 'hook' | 'other'
export type ActionStatus = 'open' | 'done' | 'dismissed'
export type ActionSource = 'analyze' | 'copilot'

export interface ExtractedAction {
  id: string
  interaction_id: string | null
  type: ActionType
  detail: string
  due_at: string | null
  status: ActionStatus
  // Cadence provenance (Level 2 co-pilot): a 'copilot' action is an advance hook
  // promoted to a to-do, carrying its channel + why.
  source?: ActionSource
  channel?: Channel | null
  why?: string | null
}

export interface Recommendation {
  id: string
  channel: Channel
  timing_at: string | null
  timing_label: string | null
  goal: string | null
  rationale: string
  play_key: string | null
  priority: number
  status: RecStatus
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: Record<string, unknown>
  language: string
  stage: string
  sign_likelihood: number | null
  score_trend?: ScoreTrend | null
  ghost_risk: GhostRisk | null
  last_contact_at: string | null
  next_action_at: string | null
  consent_voice: boolean
  consent_marketing: boolean
}

export interface Assignment {
  rep: RepBrief | null
  reason: string | null
}

export interface CustomerDetail {
  customer: Customer
  quote: Quote | null
  profile: Profile | null
  signals: Signal[]
  interactions: Interaction[]
  extracted_actions: ExtractedAction[]
  recommendation: Recommendation | null
  assignment: Assignment | null
}

export interface Message {
  id: string
  recommendation_id: string | null
  customer_id: string
  channel: Channel
  subject: string | null
  body: string
  language: string
  status: 'draft' | 'edited' | 'sent'
  sent_at: string | null
}

export interface Score {
  sign_likelihood: number | null
  ghost_risk: GhostRisk | null
  band?: string | null
  trend?: ScoreTrend | null
  components: Record<string, number> | null
  reason: string | null
}

export interface InteractionLogResponse {
  interaction: Interaction
  recommendation: Recommendation | null
  score: Score | null
}

export interface InteractionCreate {
  channel: Channel
  direction?: 'inbound' | 'outbound'
  content?: string | null
  rep_gut_feel?: string | null
  outcome?: string | null
  transcript_md?: string | null
  rep_id?: string | null
}

export interface CopilotTodo {
  detail: string
  channel: Channel
  why: string
  when_label?: string | null
  due_at?: string | null
}

export type LoopAction = 'advance' | 'handle_new_concern' | 'downgrade'

export interface RespondOutput {
  read: string
  type: 'objection' | 'buying_signal' | 'question' | 'other'
  tone: string
  exact_lines: string[]
  why: string
  // Level 2 co-pilot (objection playbook) — additive:
  category?: string | null // matched playbook key, e.g. 'price_too_high'
  advance_hook?: string | null // the next step to offer after handling
  todo?: CopilotTodo | null // the advance hook promoted to a Cadence to-do
  loop_action?: LoopAction // service-decided transition vs the open hook
}

export interface SendResponse {
  ok: boolean
  provider: Record<string, unknown>
  interaction: Interaction
}

// Auto call notes (Phase 3) — structured notes from a call/visit transcript
export interface CallNotes {
  summary: string
  key_points: string[]
  objections: string[]
  buying_signals: string[]
  next_steps: string[]
  source_interaction_id: string | null
  channel?: string
  occurred_at?: string | null
}

// Live co-pilot suggestion for an inbound WhatsApp message (real-time)
export interface CopilotSuggestion {
  id: string
  customer_id: string
  utterance: string | null
  read: string | null
  category: string | null
  exact_lines: string[]
  why: string | null
  advance_hook: string | null
  todo: Record<string, unknown> | null
  channel: string
  status: 'new' | 'sent' | 'dismissed'
  created_at: string | null
}

export interface CopilotStreamEvent {
  type: string // 'suggestion'
  suggestion?: CopilotSuggestion
}

export interface MessagingSendResponse {
  ok: boolean
  within_window: boolean
  provider: Record<string, unknown>
}

// ── Management dashboard (frontend-only re-aggregation of existing data) ──────
// Not a backend contract — computed from CustomerListItem fixtures in mock/management.ts.

export interface FunnelStage {
  stage: string
  label: string
  count: number
  value_eur: number
  conversion_to_next_pct: number | null // null for last stage
}

export interface RepStat {
  rep: RepBrief
  customers_owned: number
  contacted_this_period: number
  deals_closed: number
  conversion_rate_pct: number
  revenue_eur: number
  stage_breakdown: Record<string, number>
}

export interface TrendPoint {
  month: string // e.g. "Jan", "Feb"
  conversion_pct: number
  revenue_eur: number
  deals_closed: number
}

export interface MgmtStats {
  period: 'week' | 'month'
  new_leads: number
  active_pipeline: number
  deals_closed: number
  revenue_eur: number
  conversion_rate_pct: number
  forecast_eur: number
  // deltas vs prior period
  delta_new_leads: number
  delta_conversion_pct: number
  delta_revenue_eur: number
  funnel: FunnelStage[]
  reps: RepStat[]
  trends: TrendPoint[] // 6 months for AreaChart
  customers: CustomerListItem[] // full pool for table
  needs_attention: CustomerListItem[] // ghost_risk=high or stuck
}

// The AI's proactive recommended opener for a channel (no inbound message needed)
export interface MessagingDraft {
  channel: string
  read: string | null
  why: string | null
  subject: string | null
  exact_lines: string[]
  proactive: true
}

// Import / add-customer (rep enters quote + customer info → profile is built)
export interface ImportCustomerInput {
  ref?: string
  name: string
  email?: string | null
  phone?: string | null
  language?: string
  consent_voice?: boolean
  consent_marketing?: boolean
  source?: string
}

export interface ImportQuoteInput {
  customer_ref?: string
  system_size_kwp?: number | null
  battery_kwh?: number | null
  product_summary?: string | null
  price_eur?: number | null
  monthly_saving_eur?: number | null
  payback_years?: number | null
  annual_return_pct?: number | null
  co2_tons_25y?: number | null
}

export interface ImportResponse {
  imported: number
  customer_ids: string[]
}
