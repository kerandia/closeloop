import { useState } from 'react'
import { ScoreBar } from '../components/ScoreBar'
import { BuyerTypeChip } from '../components/BuyerTypeChip'
import { GhostRiskPill } from '../components/GhostRiskPill'
import { ChannelIcon } from '../components/ChannelIcon'
import { StageBadge } from '../components/StageBadge'
import { CallWindow } from '../components/CallWindow'
import type { BuyerType, Channel, GhostRisk } from '../api/types'

const buyers: BuyerType[] = ['family', 'investor', 'environmentalist', 'skeptic']
const risks: GhostRisk[] = ['low', 'medium', 'high']
const channels: Channel[] = ['email', 'sms', 'whatsapp', 'phone', 'visit', 'voice_ai']

export function Sandbox() {
  const [showCall, setShowCall] = useState(false)
  return (
    <div style={{ padding: 32, display: 'grid', gap: 28, maxWidth: 720 }}>
      <h2>Primitive sandbox</h2>

      <section>
        <p className="mono">ElevenLabs voice agent</p>
        <button onClick={() => setShowCall(true)}>Test voice call</button>
      </section>
      {showCall && <CallWindow onClose={() => setShowCall(false)} />}

      <section>
        <p className="mono">ScoreBar — bands</p>
        <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
          <ScoreBar value={33} />
          <ScoreBar value={61} />
          <ScoreBar value={88} />
          <ScoreBar value={null} />
        </div>
      </section>

      <section>
        <p className="mono">BuyerTypeChip</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {buyers.map((b) => (
            <BuyerTypeChip key={b} type={b} />
          ))}
        </div>
      </section>

      <section>
        <p className="mono">GhostRiskPill</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {risks.map((r) => (
            <GhostRiskPill key={r} risk={r} />
          ))}
        </div>
      </section>

      <section>
        <p className="mono">ChannelIcon + StageBadge</p>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {channels.map((c) => (
            <ChannelIcon key={c} channel={c} />
          ))}
          <StageBadge stage="in_progress" />
        </div>
      </section>
    </div>
  )
}
