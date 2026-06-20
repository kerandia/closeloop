import { useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'

// ponytail: public ElevenLabs agent only. Private agent needs a backend-minted
// signedUrl/conversationToken — add a /api/voice endpoint then swap startSession args.

function CallInner({ onClose }: { onClose: () => void }) {
  const [agentId, setAgentId] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const conv = useConversation({ onError: (e) => setErr(String(e)) })

  const idle = conv.status === 'disconnected' || conv.status === 'error'

  async function start() {
    setErr(null)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }) // mic prompt
      await conv.startSession({ agentId: agentId.trim(), connectionType: 'webrtc' })
    } catch (e) {
      setErr(String(e))
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>🎙 Test voice call</strong>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <input
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="ElevenLabs agent_id"
          disabled={!idle}
          style={{ padding: 8, fontFamily: 'monospace' }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={start} disabled={!idle || !agentId.trim()}>Start</button>
          <button onClick={() => conv.endSession()} disabled={conv.status !== 'connected'}>End</button>
        </div>

        <div className="mono" style={{ fontSize: 13 }}>
          status: {conv.status}
          {conv.status === 'connected' && (conv.isSpeaking ? ' · agent speaking 🔊' : ' · listening 👂')}
        </div>
        {err && <div style={{ color: 'crimson', fontSize: 13 }}>{err}</div>}
      </div>
    </div>
  )
}

export function CallWindow({ onClose }: { onClose: () => void }) {
  // Provider required by the SDK; scope it to the window so it tears down on close.
  return (
    <ConversationProvider>
      <CallInner onClose={onClose} />
    </ConversationProvider>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const panel: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20, width: 340,
  display: 'grid', gap: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
}
