import { useState, useEffect, useRef } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import './CallWindow.css'

interface CallInnerProps {
  onClose: () => void
  customerName?: string
  customerPhone?: string
  onCallFinished?: (durationSeconds: number, transcript: string) => void
}

function CallInner({ onClose, customerName = 'Customer', customerPhone = 'Unknown Phone', onCallFinished }: CallInnerProps) {
  const [agentId, setAgentId] = useState('agent_0701kvjz79zae3wr46301bxvd7vd') // default voice agent ID
  const [err, setErr] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const conv = useConversation({ onError: (e) => setErr(String(e)) })

  const idle = conv.status === 'disconnected' || conv.status === 'error'
  const isConnected = conv.status === 'connected'

  // Timer effect for tracking call duration
  useEffect(() => {
    if (isConnected) {
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isConnected])

  // Call end feedback loop
  const prevStatusRef = useRef(conv.status)
  useEffect(() => {
    if (prevStatusRef.current === 'connected' && conv.status === 'disconnected') {
      // Trigger callback if provided
      const isMock = new URLSearchParams(window.location.search).get('mock') === '1'
      let finalDuration = duration
      let transcript = ''

      if (isMock) {
        if (finalDuration === 0) finalDuration = Math.floor(Math.random() * 25) + 15
        transcript = `**Agent (Voice AI):** Hello, this is the CloseLoop assistant calling on behalf of our team. We've compiled your customized winter solar yield report.\n\n**${customerName}:** Ah, excellent. Does the system really produce enough in December?\n\n**Agent (Voice AI):** Yes, with the 12 kWp Freiburg system configuration, you'll still offset 30% of baseline consumption even in peak winter. Would you like a home visit confirmation to walk through the numbers?\n\n**${customerName}:** Yes, that sounds good. Let's schedule that.`
      }
      
      if (onCallFinished) {
        onCallFinished(finalDuration, transcript)
      }
    }
    prevStatusRef.current = conv.status
  }, [conv.status, duration, customerName, onCallFinished])

  async function start() {
    setErr(null)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }) // mic prompt
      await conv.startSession({ agentId: agentId.trim(), connectionType: 'webrtc' })
    } catch (e) {
      setErr(String(e))
    }
  }

  // Format call duration MM:SS
  function formatTime(sec: number) {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="call-panel" data-testid="call-panel">
      <div className="call-panel__header">
        <h3 className="call-panel__title">
          <span>🎙️</span>
          {isConnected ? `Active Call (${formatTime(duration)})` : 'Voice Call Dialer'}
        </h3>
        <button onClick={onClose} className="call-panel__close" aria-label="Close Call Screen">✕</button>
      </div>

      <div className="call-info">
        <span className="call-info__label">Target customer</span>
        <div className="call-info__name">{customerName}</div>
        <div className="call-info__phone">{customerPhone}</div>
      </div>

      <div className="call-status">
        <span
          className={`call-status__dot ${
            conv.status === 'connecting'
              ? 'call-status__dot--connecting'
              : isConnected
                ? 'call-status__dot--connected'
                : conv.status === 'error'
                  ? 'call-status__dot--error'
                  : ''
          }`}
        />
        <span>Status: {conv.status}</span>
      </div>

      {/* Visual Audio Wave micro-animation */}
      <div
        className={`call-wave ${
          conv.isSpeaking ? 'call-wave--speaking' : conv.isListening ? 'call-wave--listening' : ''
        }`}
        title={conv.isSpeaking ? 'Speaking' : conv.isListening ? 'Listening' : 'Silent'}
      >
        <span className="call-wave__bar" style={{ height: isConnected ? undefined : '2px' }} />
        <span className="call-wave__bar" style={{ height: isConnected ? undefined : '2px' }} />
        <span className="call-wave__bar" style={{ height: isConnected ? undefined : '2px' }} />
        <span className="call-wave__bar" style={{ height: isConnected ? undefined : '2px' }} />
        <span className="call-wave__bar" style={{ height: isConnected ? undefined : '2px' }} />
      </div>

      {idle && (
        <div className="call-config">
          <label className="call-config__label" htmlFor="agent-id-input">ElevenLabs Agent ID</label>
          <input
            id="agent-id-input"
            className="call-config__input"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Enter agent_id (e.g. Jd8tQYmQf222S7U0r1K6)"
            disabled={!idle}
          />
        </div>
      )}

      {err && <div className="call-error">{err}</div>}

      <div className="call-controls">
        {idle ? (
          <button
            onClick={start}
            disabled={!agentId.trim()}
            className="call-btn call-btn--start"
          >
            Start Session
          </button>
        ) : (
          <>
            <button
              onClick={() => conv.setMuted(!conv.isMuted)}
              className={`call-btn call-btn--mute ${conv.isMuted ? 'call-btn--muted' : ''}`}
            >
              {conv.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => conv.endSession()}
              className="call-btn call-btn--end"
            >
              End Call
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface CallWindowProps {
  onClose: () => void
  customerName?: string
  customerPhone?: string
  onCallFinished?: (durationSeconds: number, transcript: string) => void
}

export function CallWindow({ onClose, customerName, customerPhone, onCallFinished }: CallWindowProps) {
  // Provider required by ElevenLabs React SDK; scope it to this window for state cleanup on close.
  return (
    <ConversationProvider>
      <CallInner
        onClose={onClose}
        customerName={customerName}
        customerPhone={customerPhone}
        onCallFinished={onCallFinished}
      />
    </ConversationProvider>
  )
}
