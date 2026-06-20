/**
 * DetailShell — the layout and reveal orchestration scaffold for Screen 2.
 *
 * Owns:
 *   - 44% left / 56% right two-column layout with sticky header strip
 *   - The "analyzing → revealed" lifecycle: fires when the rep logs an interaction
 *   - Slot wiring: passes typed props down to each panel stub
 *   - Approve / Dismiss handlers for the recommendation card lifecycle
 *
 * The reveal scaffold (onLogInteraction → analyze → reveal):
 *   1. InteractionTimeline calls onLogInteraction(payload)
 *   2. DetailShell sets phase = 'analyzing' → right column shows "Analyzing…" overlay
 *   3. DetailShell calls logInteraction(customerId, payload)
 *   4. On full JSON response: updates liveRec, liveScore, prepends new interaction
 *   5. Sets phase = 'revealed' → right column drop-animates the updated card
 *   NEVER render partial JSON — "Analyzing…" persists until the full response lands.
 *
 * Step 3 agents implement the panel bodies without touching this file or props.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  CustomerDetail,
  Recommendation,
  Interaction,
  InteractionCreate,
  RecStatus,
  Message,
  Score,
} from '../../api/types'
import {
  logInteraction as apiLogInteraction,
  approveRecommendation,
  dismissRecommendation,
} from '../../api/client'
import { withMock } from '../../lib/nav'
import { BuyerTypeChip } from '../BuyerTypeChip'
import { GhostRiskPill } from '../GhostRiskPill'
import { ScoreBar } from '../ScoreBar'
import { StageBadge } from '../StageBadge'
import { RecommendationCard } from './RecommendationCard'
import { ComposeDrawer } from './ComposeDrawer'
import { ProfilePanel } from './ProfilePanel'
import { CallActionsList } from './CallActionsList'
import { CopilotPanel } from './CopilotPanel'
import { InteractionTimeline } from './InteractionTimeline'
import { CallWindow } from '../CallWindow'
import './DetailShell.css'

// ── Reveal lifecycle ──────────────────────────────────────────────────────────
type Phase = 'idle' | 'analyzing' | 'revealed'

interface Props {
  data: CustomerDetail
  customerId: string
}

export function DetailShell({ data, customerId }: Props) {
  const { customer, quote, profile, signals, extracted_actions, assignment } = data

  // ── Overlay state — updated after each logInteraction call ────────────────
  const [phase, setPhase] = useState<Phase>('idle')
  const [liveRec, setLiveRec] = useState<Recommendation | null>(null)
  const [liveScore, setLiveScore] = useState<Score | null>(null)
  const [extraInteractions, setExtraInteractions] = useState<Interaction[]>([])

  // ── Compose drawer state ──────────────────────────────────────────────────
  const [composeOpen, setComposeOpen] = useState(false)
  const [draftMessage, setDraftMessage] = useState<Message | null>(null)
  const [localStatus, setLocalStatus] = useState<RecStatus | null>(null)
  const [callOpen, setCallOpen] = useState(false)

  // ── Derived values ────────────────────────────────────────────────────────
  const effectiveRec = liveRec ?? data.recommendation
  const effectiveScore = liveScore?.sign_likelihood ?? customer.sign_likelihood
  const effectiveRisk = liveScore?.ghost_risk ?? customer.ghost_risk
  const allInteractions: Interaction[] = [...extraInteractions, ...data.interactions]

  // ── Reveal scaffold ───────────────────────────────────────────────────────
  /**
   * onLogInteraction — called by InteractionTimeline when the rep submits a note.
   * Drives the idle → analyzing → revealed lifecycle.
   */
  async function handleLogInteraction(payload: InteractionCreate): Promise<void> {
    setPhase('analyzing')
    try {
      const response = await apiLogInteraction(customerId, payload)
      // Prepend the new interaction immediately
      setExtraInteractions((prev) => [response.interaction, ...prev])
      // Overlay new score + recommendation from the full JSON response.
      // Set unconditionally so a cleared (null) value doesn't leave a stale overlay.
      setLiveScore(response.score)
      setLiveRec(response.recommendation)
      // Reset local status so card re-shows its buttons for the new recommendation
      setLocalStatus(null)
      setPhase('revealed')
    } catch (err) {
      // Revert to idle so the UI isn't stuck on "Analyzing", and re-throw so the
      // log-note form stays open with the typed note intact for a retry.
      setPhase('idle')
      throw err
    }
  }

  // ── Approve handler ───────────────────────────────────────────────────────
  function handleApprove(recId: string): void {
    const isPhoneCall = effectiveRec?.channel === 'phone' || effectiveRec?.channel === 'voice_ai'
    setLocalStatus('approved')
    if (isPhoneCall) {
      setCallOpen(true)
      approveRecommendation(recId)
        .then(() => setLocalStatus('ready'))
        .catch(() => {
          setLocalStatus(null)
          setCallOpen(false)
        })
    } else {
      setComposeOpen(true)
      approveRecommendation(recId)
        .then((msg) => {
          setDraftMessage(msg)
          setLocalStatus('ready')
        })
        .catch(() => {
          // Rollback so rep can retry
          setLocalStatus(null)
          setComposeOpen(false)
        })
    }
  }

  function handleCallClose(): void {
    setCallOpen(false)
    setLocalStatus(null)
  }

  async function handleCallFinished(durationSeconds: number, transcript: string): Promise<void> {
    setCallOpen(false)
    setLocalStatus(null)
    const isVoiceAI = effectiveRec?.channel === 'voice_ai'
    await handleLogInteraction({
      channel: isVoiceAI ? 'voice_ai' : 'phone',
      direction: 'outbound',
      outcome: `call completed (${durationSeconds}s)`,
      transcript_md: transcript,
    })
  }

  // ── Dismiss handler ───────────────────────────────────────────────────────
  function handleDismiss(recId: string): void {
    setLocalStatus('dismissed')
    dismissRecommendation(recId).catch(() => {
      setLocalStatus(null)
    })
  }

  // ── Compose close / sent ──────────────────────────────────────────────────
  function handleComposeClose(): void {
    setComposeOpen(false)
    setDraftMessage(null)
    // Revert card so rep can still dismiss or re-approve
    setLocalStatus(null)
  }

  function handleSent(interaction: Interaction): void {
    setComposeOpen(false)
    setDraftMessage(null)
    setLocalStatus('sent')
    setExtraInteractions((prev) => [interaction, ...prev])
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="detail-shell">
      {/* ── Sticky header strip ──────────────────────────────────────────── */}
      <header className="detail-header">
        <Link to={withMock('/')} className="detail-header__back">
          ← Pipeline
        </Link>
        <h1 className="detail-header__name">{customer.name}</h1>
        <BuyerTypeChip type={data.profile?.buyer_type ?? null} />
        <ScoreBar value={effectiveScore} trend={customer.score_trend} compact />
        <StageBadge stage={customer.stage} />
        <GhostRiskPill risk={effectiveRisk} />
        <span className="detail-header__spacer" />
        {assignment?.rep && (
          <span
            className="detail-header__assignment mono"
            title={assignment.reason ?? undefined}
          >
            {assignment.rep.name}
          </span>
        )}
        <Link to={withMock('/')} className="detail-header__close" aria-label="Close">
          &times;
        </Link>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="detail-columns">
        {/* Left column (44%) — scrolls */}
        <div className="detail-left">
          <ProfilePanel profile={profile} signals={signals} quote={quote} />
          <CallActionsList actions={extracted_actions} />
          <CopilotPanel customerId={customerId} />
          <InteractionTimeline
            interactions={allInteractions}
            onLogInteraction={handleLogInteraction}
          />
        </div>

        {/* Right column (56%) — sticky, AI-territory */}
        <div className="detail-right" data-phase={phase}>
          {phase === 'analyzing' ? (
            // ── Analyzing overlay — shown until full JSON lands ────────────
            <div className="detail-analyzing" data-testid="analyzing-state">
              <div className="detail-analyzing__dots">
                <span className="detail-analyzing__dot" />
                <span className="detail-analyzing__dot" />
                <span className="detail-analyzing__dot" />
              </div>
              Analyzing…
            </div>
          ) : callOpen ? (
            <CallWindow
              onClose={handleCallClose}
              customerName={customer.name}
              customerPhone={customer.phone ?? undefined}
              onCallFinished={handleCallFinished}
            />
          ) : (
            <>
              <RecommendationCard
                recommendation={effectiveRec}
                customer={customer}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
                status={localStatus}
              />
              <ComposeDrawer
                open={composeOpen}
                message={draftMessage}
                onClose={handleComposeClose}
                onSent={handleSent}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
