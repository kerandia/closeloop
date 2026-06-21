/**
 * ChannelWorkspace — the MIDDLE + RIGHT columns of the three-column conversation
 * workspace (the LEFT customer-info column stays in DetailShell).
 *
 * DEMO ONLY. Given a channel, it renders the matching conversation surface in the
 * middle and a hardcoded AI recommendation on the right, wiring "Use this …" so
 * the suggested text drops into the middle surface. Owns its own local draft
 * state; mounted with key={channel} so switching channels resets it.
 */
import { useState, useEffect } from 'react'
import type { Channel, Customer } from '../../api/types'
import { ChatSurface, type ChatMessage } from './ChatSurface'
import { ScriptedChat } from './ScriptedChat'
import { EmailSurface } from './EmailSurface'
import { VisitSurface } from './VisitSurface'
import { CallTranscriptView } from './CallTranscriptView'
import { ConversationRecommendation } from './ConversationRecommendation'
import { CHANNEL_CONTENT } from './workspaceContent'

interface Props {
  channel: Channel
  customer: Customer
}

export function ChannelWorkspace({ channel, customer }: Props) {
  const content = CHANNEL_CONTENT[channel]

  // Local-only demo state. The email body starts empty so "Use this draft"
  // visibly fills it, mirroring the chat "Use this reply" interaction.
  const [chatDraft, setChatDraft] = useState('')
  const [chatSent, setChatSent] = useState<ChatMessage[]>([])
  const [emailBody, setEmailBody] = useState('')
  // WhatsApp runs a scripted auto-play; bumping this signal starts playback
  // (from Send inside the chat, or "Use this reply" in the right column).
  const [playSignal, setPlaySignal] = useState(0)

  const isWhatsApp = channel === 'whatsapp'

  // Live Demo Call State
  const [liveTurns, setLiveTurns] = useState<{role: string; text: string}[] | null>(null)
  const [callFinished, setCallFinished] = useState(false)
  
  useEffect(() => {
    // Only automatically trigger demo for voice_ai channel in mock mode
    if (channel !== 'voice_ai') return
    const isMock = new URLSearchParams(window.location.search).get('mock') === '1'
    if (!isMock) return

    const bc = new BroadcastChannel('live-call-demo')
    
    // Auto-start the call on the test-call tab
    bc.postMessage({ type: 'START_CALL', customerName: customer.name })
    setLiveTurns([]) // Initialize live array to override static markdown
    setCallFinished(false)

    bc.onmessage = (event) => {
      if (event.data?.type === 'TRANSCRIPT_TURN') {
        setLiveTurns(prev => [...(prev || []), { role: event.data.role, text: event.data.text }])
      } else if (event.data?.type === 'CALL_ENDED' || event.data?.type === 'CALL_DECLINED') {
        setCallFinished(true)
      }
    }

    return () => {
      bc.postMessage({ type: 'END_CALL' }) // clean up if user navigates away
      bc.close()
    }
  }, [channel, customer.name])

  if (!content) {
    // No demo content for this channel yet — keep the layout intact.
    return (
      <>
        <div className="detail-workspace__col detail-workspace__col--surface">
          <p className="conversation-hint">No conversation surface for this channel yet.</p>
        </div>
        <div className="detail-workspace__col detail-workspace__col--rec" />
      </>
    )
  }

  function sendChat() {
    const text = chatDraft.trim()
    if (!text) return
    setChatSent((prev) => [...prev, { id: `chat-out-${prev.length + 1}`, from: 'rep', text }])
    setChatDraft('')
  }

  // ── Middle column ───────────────────────────────────────────────────────────
  let middle: React.ReactNode = null
  if (content.kind === 'chat') {
    middle = isWhatsApp ? (
      <ScriptedChat customerName={customer.name} playSignal={playSignal} />
    ) : (
      <ChatSurface
        channel={channel}
        customerName={customer.name}
        initialMessages={content.messages}
        draft={chatDraft}
        onDraftChange={setChatDraft}
        onSend={sendChat}
        sentMessages={chatSent}
      />
    )
  } else if (content.kind === 'call') {
    middle = (
      <section className="call-surface">
        <header className="call-surface__header">
          {content.mode === 'voice_ai' ? 'AI call' : 'Rep call'} · recorded
        </header>
        <div className="call-surface__body">
          <CallTranscriptView
            transcriptMd={content.transcriptMd}
            mode={content.mode}
            collected={(liveTurns && !callFinished) ? null : (content.collected ?? null)}
            liveTurns={liveTurns}
          />
        </div>
      </section>
    )
  } else if (content.kind === 'email') {
    middle = (
      <EmailSurface
        to={content.to}
        subject={content.subject}
        body={emailBody}
        onBodyChange={setEmailBody}
      />
    )
  } else if (content.kind === 'visit') {
    middle = (
      <VisitSurface customerName={customer.name} whenLabel={content.whenLabel} prep={content.prep} />
    )
  }

  // ── Right column (AI recommendation) ────────────────────────────────────────
  let rec: React.ReactNode
  if (content.kind === 'chat') {
    rec = (
      <ConversationRecommendation
        read={content.rec.read}
        reply={content.rec.reply}
        why={content.rec.why}
        // WhatsApp: "Use this reply" plays the scripted conversation.
        // Other chat channels: it fills the chat input.
        onUse={isWhatsApp ? () => setPlaySignal((s) => s + 1) : setChatDraft}
        useLabel="Use this reply"
      />
    )
  } else if (content.kind === 'email') {
    rec = (
      <ConversationRecommendation
        read={content.rec.read}
        reply={content.rec.reply}
        why={content.rec.why}
        onUse={setEmailBody}
        useLabel="Use this draft"
      />
    )
  } else {
    // call / visit — live talking points, nothing to type into.
    rec = (
      <ConversationRecommendation
        read={content.rec.read}
        lines={content.rec.lines}
        why={content.rec.why}
      />
    )
  }

  return (
    <>
      <div className="detail-workspace__col detail-workspace__col--surface">{middle}</div>
      <div className="detail-workspace__col detail-workspace__col--rec">{rec}</div>
    </>
  )
}
