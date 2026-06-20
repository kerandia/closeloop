/**
 * CopilotPanel — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   customerId  string
 *     Used to call copilotCollect(customerId) for the "Suggest next question" flow,
 *     and as the customer_id field in copilotRespond() payloads.
 *
 * This panel exposes two sub-features (spec §E):
 *
 *   Respond sub-panel
 *     Input: "What did the customer just say?" → submit.
 *     Calls copilotRespond({ customer_id, utterance }).
 *     Response shape (RespondOutput): { read, type, tone, exact_lines[], why }
 *     L1: drive against the mockRespond() fixture (isMockMode() or always mock).
 *         Reveal exact_lines[] one item at a time with a short stagger delay
 *         (simulated streaming — never render raw partial JSON).
 *     L2: real POST /api/copilot/respond stream (UI unchanged).
 *
 *   Collect sub-panel
 *     "Suggest next question" button.
 *     Calls GET /api/copilot/collect/:id → { question: string }.
 *     Shows the returned question so the rep can ask it live.
 */

export interface CopilotPanelProps {
  customerId: string
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function CopilotPanel({ customerId: _customerId }: CopilotPanelProps) {
  return (
    <div className="detail-stub" data-slot="copilot-panel">
      <p className="mono">Co-pilot Panel</p>
    </div>
  )
}
