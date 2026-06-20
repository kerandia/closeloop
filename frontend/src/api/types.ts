// TS mirror of the backend response shapes (backend/app/schemas.py, serializers.py).
// Keep in sync with the live FastAPI contract.

export type BuyerType = 'family' | 'investor' | 'environmentalist' | 'skeptic'
export type GhostRisk = 'low' | 'medium' | 'high'
export type Channel = 'email' | 'sms' | 'whatsapp' | 'phone' | 'visit' | 'voice_ai' | 'system'
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

export interface CustomerListItem {
  id: string
  name: string
  buyer_type: BuyerType | null
  sign_likelihood: number | null
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

export type ActionType = 'callback' | 'send_info' | 'schedule_visit' | 'other'
export type ActionStatus = 'open' | 'done' | 'dismissed'

export interface ExtractedAction {
  id: string
  interaction_id: string | null
  type: ActionType
  detail: string
  due_at: string | null
  status: ActionStatus
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

export interface RespondOutput {
  read: string
  type: 'objection' | 'buying_signal' | 'question' | 'other'
  tone: string
  exact_lines: string[]
  why: string
}

export interface SendResponse {
  ok: boolean
  provider: Record<string, unknown>
  interaction: Interaction
}
