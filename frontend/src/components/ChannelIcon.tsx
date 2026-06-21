import type { Channel } from '../api/types'

const GLYPH: Record<Channel, string> = {
  email: '✉',
  sms: '💬',
  whatsapp: '🟢',
  telegram: '📱',
  phone: '📞',
  visit: '🏠',
  voice_ai: '🎙',
  system: '⚙',
}

export function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  return (
    <span
      className="channel-icon"
      title={channel}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
      aria-label={channel}
    >
      {GLYPH[channel] ?? '•'}
    </span>
  )
}
