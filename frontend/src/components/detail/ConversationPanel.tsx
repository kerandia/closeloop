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
import { useMemo } from 'react'
import type { Channel, Customer, Interaction, Recommendation } from '../../api/types'
import { ChannelIcon } from '../ChannelIcon'
import { CoachingCard } from './CoachingCard'
import { ChatWindow } from './ChatWindow'
import { CallTranscriptView } from './CallTranscriptView'
import { mockCollectedSummary } from './callTranscriptMock'
import './ConversationPanel.css'

const ALL_CHANNELS: Channel[] = [
  'voice_ai',
  'phone',
  'whatsapp',
  'sms',
  'telegram',
  'email',
  'visit',
]

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

// ponytail: demo fallback so the transcript surface is never empty on stage.
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
}: Props) {
  // Recommended channel first, then the rest in canonical order.
  const ordered = useMemo<Channel[]>(() => {
    if (!recommendedChannel) return ALL_CHANNELS
    return [recommendedChannel, ...ALL_CHANNELS.filter((c) => c !== recommendedChannel)]
  }, [recommendedChannel])

  function transcriptFor(channel: 'voice_ai' | 'phone'): string {
    const hit = interactions.find((i) => i.channel === channel && i.transcript_md)
    return hit?.transcript_md ?? MOCK_TRANSCRIPT[channel]
  }

  return (
    <section className="conversation-panel" data-slot="conversation-panel">
      {/* ── Channel rail ──────────────────────────────────────────────────── */}
      <div className="conversation-rail" role="tablist" aria-label="Channels">
        {ordered.map((c) => {
          const isRec = c === recommendedChannel
          const isActive = c === activeChannel
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`conversation-rail__chip${isActive ? ' conversation-rail__chip--active' : ''}${
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

      {/* ── Active surface ────────────────────────────────────────────────── */}
      <div className="conversation-body">
        {activeChannel == null && (
          <p className="conversation-hint">
            Pick a channel above — the recommended one is highlighted.
          </p>
        )}

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
          <div className="conversation-call conversation-call--rep">
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

        {activeChannel === 'email' && (
          <p className="conversation-hint">
            Draft opens in the composer →
          </p>
        )}

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
