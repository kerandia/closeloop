/**
 * ConversationPanel — the right-column communication surface.
 *
 * Shows ALL channels in a picker rail with the AI-recommended one first +
 * badged "Recommended" (the rep can follow or override). The selected channel
 * drives one of four conversation surfaces:
 *   voice_ai → AI-agent call transcript + Collected summary (recorded for the demo)
 *   phone    → rep-live-call transcript + live CoachingCard
 *   chat     → ChatWindow (whatsapp | sms | telegram) with live suggestion + send
 *   email    → handled by the ComposeDrawer overlay in DetailShell
 *   visit    → no conversation surface; show the rationale + log hint
 *
 * The live ElevenLabs dialer lives in the Sandbox, not here (see plan A4a):
 * the detail screen renders recorded/streamed transcript only — never connects
 * the agent to the local mic.
 */
import { useMemo, type ReactNode } from 'react'
import type { Channel, Customer, Interaction, Recommendation } from '../../api/types'
import { isMockMode } from '../../api/client'
import { ChannelIcon } from '../ChannelIcon'
import { CoachingCard } from './CoachingCard'
import { ChatWindow } from './ChatWindow'
import { CallTranscriptView } from './CallTranscriptView'
import { mockCollectedSummary } from './callTranscriptMock'
import './ConversationPanel.css'

// Telegram is demo-only for now: the backend messaging adapter sends WhatsApp/SMS
// only, so a real Telegram send would fail. Show it only in mock mode until the
// backend supports it.
const BASE_CHANNELS: Channel[] = ['voice_ai', 'phone', 'whatsapp', 'sms', 'email', 'visit']

function availableChannels(): Channel[] {
  return isMockMode()
    ? ['voice_ai', 'phone', 'whatsapp', 'sms', 'telegram', 'email', 'visit']
    : BASE_CHANNELS
}

const CHANNEL_LABEL: Record<Channel, string> = {
  voice_ai: 'AI call',
  phone: 'Rep call',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  telegram: 'Telegram',
  email: 'Email',
  visit: 'Visit',
  system: 'System',
}

const CHAT_CHANNELS = ['whatsapp', 'sms', 'telegram'] as const
type ChatChannel = (typeof CHAT_CHANNELS)[number]
const isChatChannel = (c: Channel): c is ChatChannel =>
  (CHAT_CHANNELS as readonly string[]).includes(c)

// Demo/stage fallback: shown when no real transcript exists yet for the channel,
// so the call surface is never empty during a live demo.
const MOCK_TRANSCRIPT: Record<'voice_ai' | 'phone', string> = {
  voice_ai:
    "**Agent:** Hallo Herr Müller, hier ist die Assistentin vom Solar-Team — ich melde mich kurz zu Ihrem Angebot.\n\n**Müller:** Ah ja, wir vergleichen gerade noch ein, zwei andere Firmen.\n\n**Agent:** Völlig verständlich. Darf ich fragen, was Ihnen am wichtigsten ist — die monatliche Ersparnis?\n\n**Müller:** Genau, die Stromrechnung steigt ständig. Aber im Winter, bringt das überhaupt was?",
  phone:
    "**Rep:** Hi Herr Müller, danke für Ihre Zeit. Ich wollte kurz die Winter-Frage klären.\n\n**Müller:** Ja, das ist meine größte Sorge ehrlich gesagt.\n\n**Rep:** Verstehe — lassen Sie uns die Zahlen gemeinsam durchgehen.",
}

interface Props {
  activeChannel: Channel | null
  recommendedChannel: Channel | null
  recommendation: Recommendation | null
  onSelectChannel: (c: Channel) => void
  customerId: string
  customer: Customer
  interactions: Interaction[]
  /** Log the shown call transcript → triggers analyze + score move. */
  onLogCall: (channel: 'voice_ai' | 'phone', transcriptMd: string) => void
  /** True once the rep explicitly started composing an email. */
  emailComposing: boolean
  /** Explicit "compose email" action — the only thing that approves the rec. */
  onComposeEmail: () => void
  /** Recommendation header (embedded RecommendationCard) merged into this card. */
  header?: ReactNode
  /** Return from a channel surface back to the info card. */
  onClose: () => void
}

export function ConversationPanel({
  activeChannel,
  recommendedChannel,
  recommendation,
  onSelectChannel,
  customerId,
  customer,
  interactions,
  onLogCall,
  emailComposing,
  onComposeEmail,
  header,
  onClose,
}: Props) {
  // Recommended channel first, then the rest in canonical order. Ignore a
  // recommendedChannel the picker doesn't render (e.g. 'system') so it can't
  // open a surface with no body.
  const ordered = useMemo<Channel[]>(() => {
    const channels = availableChannels()
    if (!recommendedChannel || !channels.includes(recommendedChannel)) return channels
    return [recommendedChannel, ...channels.filter((c) => c !== recommendedChannel)]
  }, [recommendedChannel])

  function transcriptFor(channel: 'voice_ai' | 'phone'): string {
    // Most recent transcript for this channel — don't depend on array order.
    const latest = interactions
      .filter((i) => i.channel === channel && i.transcript_md)
      .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))[0]
    return latest?.transcript_md ?? MOCK_TRANSCRIPT[channel]
  }

  // Info view (recommendation + channel picker) when no channel is active; the
  // selected channel's surface REPLACES it, with a Back affordance to return.
  if (activeChannel == null) {
    return (
      <section className="conversation-panel" data-slot="conversation-panel">
        {header && <div className="conversation-panel__header">{header}</div>}

        {/* ── Channel rail ────────────────────────────────────────────────── */}
        <div className="conversation-rail" role="group" aria-label="Channels">
          {ordered.map((c) => {
            const isRec = c === recommendedChannel
            return (
              <button
                key={c}
                type="button"
                className={`conversation-rail__chip${
                  isRec ? ' conversation-rail__chip--recommended' : ''
                }`}
                title={isRec && recommendation?.goal ? recommendation.goal : CHANNEL_LABEL[c]}
                onClick={() => onSelectChannel(c)}
              >
                <ChannelIcon channel={c} />
                <span className="conversation-rail__label">{CHANNEL_LABEL[c]}</span>
                {isRec && <span className="conversation-rail__badge">Recommended</span>}
              </button>
            )
          })}
        </div>
        <p className="conversation-hint">
          Pick a channel to start — the recommended one is highlighted.
        </p>
      </section>
    )
  }

  return (
    <section className="conversation-panel" data-slot="conversation-panel">
      {/* ── Surface bar with Back to the info card ───────────────────────── */}
      <div className="conversation-surface__bar">
        <button
          type="button"
          className="conversation-surface__back"
          onClick={onClose}
        >
          ← Back
        </button>
        <span className="conversation-surface__title">
          <ChannelIcon channel={activeChannel} />
          {CHANNEL_LABEL[activeChannel]}
        </span>
      </div>

      {/* ── Active surface ────────────────────────────────────────────────── */}
      <div className="conversation-body">
        {activeChannel === 'voice_ai' && (
          <div className="conversation-call">
            <CallTranscriptView
              transcriptMd={transcriptFor('voice_ai')}
              mode="voice_ai"
              collected={mockCollectedSummary}
            />
            <button
              type="button"
              className="conversation-call__log"
              onClick={() => onLogCall('voice_ai', transcriptFor('voice_ai'))}
            >
              Log call &amp; analyze
            </button>
          </div>
        )}

        {activeChannel === 'phone' && (
          <div className="conversation-call">
            <CallTranscriptView transcriptMd={transcriptFor('phone')} mode="phone" />
            <CoachingCard customerId={customerId} />
            <button
              type="button"
              className="conversation-call__log"
              onClick={() => onLogCall('phone', transcriptFor('phone'))}
            >
              Log call &amp; analyze
            </button>
          </div>
        )}

        {activeChannel && isChatChannel(activeChannel) && (
          <ChatWindow
            customerId={customerId}
            channel={activeChannel}
            interactions={interactions}
          />
        )}

        {activeChannel === 'email' &&
          (emailComposing ? (
            <p className="conversation-hint">Draft opens in the composer →</p>
          ) : (
            <button
              type="button"
              className="conversation-call__log"
              onClick={onComposeEmail}
            >
              Compose email draft
            </button>
          ))}

        {activeChannel === 'visit' && (
          <div className="conversation-visit">
            <p className="conversation-visit__rationale">
              {recommendation?.rationale ??
                `A home visit builds trust with ${customer.name}.`}
            </p>
            <p className="conversation-hint">Log the visit outcome in the timeline ↓</p>
          </div>
        )}
      </div>
    </section>
  )
}
