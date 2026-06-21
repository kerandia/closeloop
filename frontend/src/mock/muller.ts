// Golden offline fixture: the Müller path never breaks (?mock=1).
import type {
  CustomerDetail,
  CustomerListItem,
  InteractionCreate,
  InteractionLogResponse,
  Message,
  RespondOutput,
  SendResponse,
} from '../api/types'

const MULLER_ID = '11111111-1111-1111-1111-111111111111'
const REP = { id: 'rep-1', name: 'Lena Brandt' }

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString()

export function mockListCustomers(): CustomerListItem[] {
  return [
    {
      id: MULLER_ID,
      name: 'Familie Müller',
      buyer_type: 'skeptic',
      sign_likelihood: 74,
      ghost_risk: 'medium',
      stage: 'in_progress',
      next_action: { channel: 'visit', timing_label: 'within 48h' },
      assigned_rep: REP,
      last_contact_at: iso(2),
    },
    {
      id: 'c-2',
      name: 'Sophie Wagner',
      buyer_type: 'investor',
      sign_likelihood: 61,
      ghost_risk: 'low',
      stage: 'quoted',
      next_action: { channel: 'email', timing_label: 'this week' },
      assigned_rep: REP,
      last_contact_at: iso(4),
    },
    {
      id: 'c-3',
      name: 'Thomas Becker',
      buyer_type: 'family',
      sign_likelihood: 48,
      ghost_risk: 'medium',
      stage: 'contacted',
      next_action: { channel: 'whatsapp', timing_label: 'within 72h' },
      assigned_rep: REP,
      last_contact_at: iso(6),
    },
    {
      id: 'c-4',
      name: 'Anna Hoffmann',
      buyer_type: 'environmentalist',
      sign_likelihood: 33,
      ghost_risk: 'high',
      stage: 'contacted',
      next_action: { channel: 'phone', timing_label: 'today' },
      assigned_rep: REP,
      last_contact_at: iso(11),
    },
  ]
}

export function mockGetCustomer(): CustomerDetail {
  return {
    customer: {
      id: MULLER_ID,
      name: 'Familie Müller',
      email: 'mueller@example.de',
      phone: '+49 170 0000000',
      address: { city: 'Freiburg', zip: '79100', street: 'Sonnenweg 12' },
      language: 'de',
      stage: 'in_progress',
      sign_likelihood: 74,
      ghost_risk: 'medium',
      last_contact_at: iso(2),
      next_action_at: iso(-2),
      consent_voice: true,
      consent_marketing: true,
    },
    quote: {
      id: 'q-1',
      system_size_kwp: 12,
      battery_kwh: 10,
      product_summary: '12 kWp roof + 10 kWh battery',
      price_eur: 28900,
      monthly_saving_eur: 210,
      payback_years: 9.5,
      annual_return_pct: 8.2,
      co2_tons_25y: 96,
      financing: { type: 'kfw', rate: 3.4, monthly: 240 },
      pdf_url: null,
      sent_at: iso(7),
    },
    profile: {
      id: 'p-1',
      motivation: 'peace_of_mind',
      motivation_conf: 0.8,
      negotiation: {
        multi_quote_risk: 'high',
        price_sensitivity: 'medium',
        decision_speed: 'slow',
        decision_makers: ['husband', 'wife'],
        blockers: ['spouse_buy_in'],
        buying_signals: ['asked about install date'],
      },
      buyer_type: 'skeptic',
      summary:
        'Cautious couple, sold on the idea but comparing vendors. Wife not yet on board; ' +
        'winter-yield doubt lingers. Wants reassurance more than a discount.',
      objections: [
        { key: 'need_other_quotes', note: 'wants to check other companies' },
        { key: 'winter_yield', note: 'doubts winter output' },
      ],
      completeness: 72,
      updated_at: iso(2),
    },
    signals: [
      {
        id: 's-1',
        layer: 'motivation',
        label: 'peace of mind',
        evidence_quote: 'We just want something reliable we don’t have to think about.',
        source_interaction_id: 'i-1',
        confidence: 0.8,
      },
      {
        id: 's-2',
        layer: 'negotiation',
        label: 'multi_quote_risk: HIGH',
        evidence_quote: 'We’ll need to check with a couple of other companies first.',
        source_interaction_id: 'i-1',
        confidence: 0.9,
      },
      {
        id: 's-3',
        layer: 'negotiation',
        label: 'decision: husband + wife',
        evidence_quote: 'I’ll have to talk it over with my wife.',
        source_interaction_id: 'i-1',
        confidence: 0.85,
      },
      {
        id: 's-4',
        layer: 'objection',
        label: 'winter-yield doubt',
        evidence_quote: 'Does it even produce anything in December?',
        source_interaction_id: 'i-1',
        confidence: 0.7,
      },
      {
        id: 's-5',
        layer: 'buying_signal',
        label: 'asked about install date',
        evidence_quote: 'If we did go ahead, how soon could you install?',
        source_interaction_id: 'i-1',
        confidence: 0.75,
      },
    ],
    interactions: [
      {
        id: 'i-1',
        rep_id: null,
        channel: 'voice_ai',
        direction: 'inbound',
        occurred_at: iso(2),
        content: null,
        transcript_md:
          '**Agent:** Hello Herr Müller…\n\n**Müller:** We’ll need to check with a couple of other companies first.',
        recording_url: null,
        outcome: 'reached, learned multi-quote risk + winter doubt',
        rep_gut_feel: null,
        created_by: 'voice_agent',
      },
      {
        id: 'i-0',
        rep_id: REP.id,
        channel: 'email',
        direction: 'outbound',
        occurred_at: iso(7),
        content: 'Sent the quote PDF.',
        transcript_md: null,
        recording_url: null,
        outcome: 'quote delivered',
        rep_gut_feel: null,
        created_by: 'rep',
      },
    ],
    extracted_actions: [
      {
        id: 'a-1',
        interaction_id: 'i-1',
        type: 'callback',
        detail: 'Call back Tue after 17:00',
        due_at: iso(-1),
        status: 'open',
      },
    ],
    recommendation: {
      id: 'r-1',
      channel: 'phone',
      timing_at: iso(-2),
      timing_label: 'today',
      goal: 'Call to answer winter-yield doubts and compare options',
      rationale:
        'Müller showed real intent but flagged a multi-quote comparison and winter-yield doubt. ' +
        'A quick phone call today will address the winter question with Freiburg yield stats and ' +
        'position us to schedule a follow-up home visit to close the deal.',
      play_key: 'phone_call_yield',
      priority: 10,
      status: 'pending',
    },
    assignment: {
      rep: REP,
      reason: 'Lena closes skeptics best (58%) and knows the Freiburg winter-yield numbers.',
    },
  }
}

export function mockRespond(): RespondOutput {
  return {
    read: 'Classic multi-quote stall — they’re anchoring on price comparison, not rejecting you.',
    type: 'objection',
    tone: 'warm, reassuring, no pressure',
    exact_lines: [
      'That’s completely fair — most people we work with do compare a few offers.',
      'What I’d suggest: let me come by for 20 minutes so you’re comparing like-for-like.',
      'I’ll bring the winter-yield numbers for your roof so there’s no guesswork.',
    ],
    why: 'Naming the multi-quote behaviour honestly disarms it, and a visit shifts the frame from price to trust — exactly what a skeptic needs.',
  }
}

// ── Mock write paths — keep the golden path fully offline (?mock=1) ──────────
export function mockLogInteraction(payload: InteractionCreate): InteractionLogResponse {
  const rec = mockGetCustomer().recommendation!
  return {
    interaction: {
      id: `i-${Date.now()}`,
      rep_id: REP.id,
      channel: payload.channel,
      direction: payload.direction ?? 'outbound',
      occurred_at: new Date().toISOString(),
      content: payload.content ?? null,
      transcript_md: payload.transcript_md ?? null,
      recording_url: null,
      outcome: payload.outcome ?? 'note logged',
      rep_gut_feel: payload.rep_gut_feel ?? null,
      created_by: 'rep',
    },
    // Visibly change the recommendation + score so the reveal beat lands offline.
    recommendation: {
      ...rec,
      channel: 'visit',
      goal: 'Get both decision-makers in the room',
      rationale:
        'New note logged: the wife is hesitant. Switch to a joint home visit that brings ' +
        'her on board and answers the winter-yield doubt together — before any competitor call.',
    },
    score: {
      sign_likelihood: 81,
      ghost_risk: 'low',
      components: null,
      reason: 'Engagement up after the logged touch',
    },
  }
}

export function mockApprove(): Message {
  return {
    id: `m-${Date.now()}`,
    recommendation_id: 'r-1',
    customer_id: MULLER_ID,
    channel: 'email',
    subject: 'Kurzer Besuch zu Ihrem Solar-Angebot',
    body:
      'Hallo Familie Müller,\n\n' +
      'danke für das offene Gespräch. Ich komme gern für 20 Minuten vorbei, damit Sie und ' +
      'Ihre Frau das Angebot in Ruhe vergleichen können — ich bringe die Winterertrags-Zahlen ' +
      'für Ihr Dach mit.\n\nWann passt es Ihnen diese Woche?\n\nViele Grüße\nLena',
    language: 'de',
    status: 'draft',
    sent_at: null,
  }
}

export function mockPatchMessage(patch: { subject?: string; body?: string }): Message {
  return {
    ...mockApprove(),
    subject: patch.subject ?? mockApprove().subject,
    body: patch.body ?? mockApprove().body,
    status: 'edited',
  }
}

export function mockSend(): SendResponse {
  return {
    ok: true,
    provider: { provider_id: 'mock-provider' },
    interaction: {
      id: `i-${Date.now()}`,
      rep_id: REP.id,
      channel: 'email',
      direction: 'outbound',
      occurred_at: new Date().toISOString(),
      content: 'Message sent',
      transcript_md: null,
      recording_url: null,
      outcome: 'sent via email (mock-provider)',
      rep_gut_feel: null,
      created_by: 'system',
    },
  }
}

export function mockCollect(): { question: string } {
  return {
    question:
      'Were you looking at paying upfront, or would financing options be helpful to see?',
  }
}

export const MOCK_MULLER_ID = MULLER_ID
