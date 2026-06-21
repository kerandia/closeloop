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
import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import type {
  CustomerDetail,
  Recommendation,
  Interaction,
  InteractionCreate,
  Message,
  Score,
  Channel,
} from '../../api/types'
import {
  logInteraction as apiLogInteraction,
  approveRecommendation,
} from '../../api/client'
import { withMock } from '../../lib/nav'
import { BuyerTypeChip } from '../BuyerTypeChip'
import { GhostRiskPill } from '../GhostRiskPill'
import { ScoreBar } from '../ScoreBar'
import { StageBadge } from '../StageBadge'
import { RecommendationCard } from './RecommendationCard'
import { ComposeDrawer } from './ComposeDrawer'
import { ProfilePanel } from './ProfilePanel'
import { CallNotesButton } from './CallNotesButton'
import { TodoList } from './TodoList'
import { InteractionTimeline } from './InteractionTimeline'
import { ConversationPanel } from './ConversationPanel'
import { ChannelWorkspace } from './ChannelWorkspace'
import { channelLabel } from '../../lib/format'
import './DetailShell.css'

// ── Reveal lifecycle ──────────────────────────────────────────────────────────
type Phase = 'idle' | 'analyzing' | 'revealed'

interface Props {
  data: CustomerDetail
  customerId: string
}

export function DetailShell({ data, customerId }: Props) {
  const { customer, quote, profile, signals, assignment } = data

  // ── Overlay state — updated after each logInteraction call ────────────────
  const [phase, setPhase] = useState<Phase>('idle')
  const [liveRec, setLiveRec] = useState<Recommendation | null>(null)
  const [liveScore, setLiveScore] = useState<Score | null>(null)
  const [extraInteractions, setExtraInteractions] = useState<Interaction[]>([])

  // ── Conversation window state ─────────────────────────────────────────────
  // activeChannel drives the right-column ConversationPanel mode; email also
  // opens the ComposeDrawer overlay. null = no channel selected yet.
  const [draftMessage, setDraftMessage] = useState<Message | null>(null)
  // null = show the info card (recommendation + picker); a value swaps in that
  // channel's call/chat surface. Back returns to null.
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  // Compose drawer is gated on this explicit flag, never on activeChannel alone,
  // so browsing to the email channel doesn't open the drawer or approve the rec.
  const [emailComposing, setEmailComposing] = useState(false)
  // Invalidates an in-flight compose request so a late resolve can't repopulate
  // a draft after the rep already closed the drawer.
  const composeToken = useRef(0)

  function cancelCompose(): void {
    composeToken.current++
    setEmailComposing(false)
    setDraftMessage(null)
  }

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
      setPhase('revealed')
    } catch (err) {
      // Revert to idle so the UI isn't stuck on "Analyzing", and re-throw so the
      // log-note form stays open with the typed note intact for a retry.
      setPhase('idle')
      throw err
    }
  }

  // ── Channel selection / compose ───────────────────────────────────────────
  /**
   * Rep selects a channel via the picker.
   * Selection alone NEVER mutates server state — email compose is an explicit
   * action (handleComposeEmail) triggered from the email surface button.
   */
  function handleSelectChannel(ch: Channel): void {
    setActiveChannel(ch)
  }

  /** Leave the conversation workspace back to the two-column default. */
  function exitWorkspace(): void {
    setActiveChannel(null)
    cancelCompose()
  }

  /** Explicit "Compose email": approve the rec to generate a draft, open drawer. */
  function handleComposeEmail(): void {
    if (!effectiveRec || emailComposing) return
    setEmailComposing(true)
    setDraftMessage(null) // clear any prior draft so the drawer shows "Composing…"
    const token = ++composeToken.current
    approveRecommendation(effectiveRec.id)
      .then((msg) => {
        // Ignore a late resolve if the rep closed/restarted compose meanwhile.
        if (composeToken.current === token) setDraftMessage(msg)
      })
      .catch(() => {
        if (composeToken.current === token) setEmailComposing(false)
      })
  }

  /** Log the shown call transcript → runs ANALYZE so the score moves. */
  async function handleLogCall(
    channel: 'voice_ai' | 'phone',
    transcriptMd: string,
  ): Promise<void> {
    try {
      await handleLogInteraction({
        channel,
        direction: 'outbound',
        outcome: 'call completed',
        transcript_md: transcriptMd,
      })
    } catch {
      // handleLogInteraction already reverts the analyzing overlay on failure.
    }
  }

  // ── Compose close / sent ──────────────────────────────────────────────────
  function handleComposeClose(): void {
    cancelCompose()
  }

  function handleSent(interaction: Interaction): void {
    cancelCompose()
    setExtraInteractions((prev) => [interaction, ...prev])
    setActiveChannel(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  // Customer-info column — identical in both the default and workspace layouts.
  const infoColumn = (
    <>
      <ProfilePanel profile={profile} signals={signals} quote={quote} />
      <CallNotesButton customerId={customerId} />
      <TodoList />
      <InteractionTimeline
        interactions={allInteractions}
        onLogInteraction={handleLogInteraction}
      />
    </>
  )

  // Selecting any channel opens a focused three-column workspace.
  const inWorkspace = activeChannel != null

  return (
    <div className="detail-shell">
      {/* ── Sticky header strip ──────────────────────────────────────────── */}
      <header className="detail-header">
        <Link to={withMock('/app')} className="detail-header__back">
          ← Pipeline
        </Link>
        <h1 className="detail-header__name">{customer.name}</h1>
        <BuyerTypeChip type={data.profile?.buyer_type ?? null} />
        <ScoreBar
          value={effectiveScore}
          trend={liveScore?.trend ?? customer.score_trend}
          reason={liveScore?.reason}
          compact
        />
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
        <Link to={withMock('/app')} className="detail-header__close" aria-label="Close">
          &times;
        </Link>
      </header>

      {inWorkspace && activeChannel ? (
        /* ── Conversation workspace — three equal columns ─────────────────── */
        <div className="detail-workspace-wrap">
          <div className="detail-workspace__bar">
            <button
              type="button"
              className="conversation-surface__back"
              onClick={exitWorkspace}
            >
              ← Back
            </button>
            <span className="detail-workspace__bar-title">
              {channelLabel(activeChannel)} conversation
            </span>
          </div>
          <div className="detail-workspace">
            {/* Left (1/3) — customer info, unchanged */}
            <div className="detail-workspace__col detail-workspace__col--info">
              {infoColumn}
            </div>
            {/* Middle + Right (1/3 each) — channel surface + AI recommendation */}
            <ChannelWorkspace key={activeChannel} channel={activeChannel} customer={customer} />
          </div>
        </div>
      ) : (
        /* ── Two-column body (default) ───────────────────────────────────── */
        <div className="detail-columns">
          {/* Left column — scrolls */}
          <div className="detail-left">{infoColumn}</div>

          {/* Right column — sticky, AI-territory */}
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
            ) : (
              <>
                <ConversationPanel
                  activeChannel={activeChannel}
                  recommendedChannel={effectiveRec?.channel ?? null}
                  recommendation={effectiveRec}
                  onSelectChannel={handleSelectChannel}
                  customerId={customerId}
                  customer={customer}
                  interactions={allInteractions}
                  onLogCall={handleLogCall}
                  emailComposing={emailComposing}
                  onComposeEmail={handleComposeEmail}
                  onClose={() => {
                    setActiveChannel(null)
                    cancelCompose()
                  }}
                  header={
                    <RecommendationCard recommendation={effectiveRec} embedded />
                  }
                />
                <ComposeDrawer
                  open={emailComposing}
                  message={draftMessage}
                  onClose={handleComposeClose}
                  onSent={handleSent}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
