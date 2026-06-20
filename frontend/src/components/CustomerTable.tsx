import { useNavigate } from 'react-router-dom'
import type { CustomerListItem, Channel } from '../api/types'
import { ScoreBar } from './ScoreBar'
import { BuyerTypeChip } from './BuyerTypeChip'
import { GhostRiskPill } from './GhostRiskPill'
import { StageBadge } from './StageBadge'
import { ChannelIcon } from './ChannelIcon'
import { relativeTime } from '../lib/format'
import { withMock } from '../lib/nav'
import './CustomerTable.css'

/** "Lena Brandt" → "LB" */
function repInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

/** "voice_ai" → "Voice Ai", "visit" → "Visit" */
function channelLabel(channel: Channel): string {
  return channel
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface Props {
  customers: CustomerListItem[]
}

export function CustomerTable({ customers }: Props) {
  const navigate = useNavigate()

  return (
    <table className="ct">
      <thead>
        <tr className="ct__head-row">
          <th className="mono ct__th">Customer</th>
          <th className="mono ct__th">Likelihood</th>
          <th className="mono ct__th">Risk</th>
          <th className="mono ct__th">Stage</th>
          <th className="mono ct__th">Next Action</th>
          <th className="mono ct__th">Rep</th>
          <th className="mono ct__th">Last Contact</th>
        </tr>
      </thead>
      <tbody>
        {customers.map(c => (
          <tr
            key={c.id}
            className="ct__row"
            onClick={() => navigate(withMock(`/customers/${c.id}`))}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(withMock(`/customers/${c.id}`))
              }
            }}
          >
            <td className="ct__cell ct__cell--name">
              <span className="ct__name">{c.name}</span>
              <BuyerTypeChip type={c.buyer_type} />
            </td>
            <td className="ct__cell">
              <ScoreBar value={c.sign_likelihood} trend={c.score_trend} compact />
            </td>
            <td className="ct__cell">
              <GhostRiskPill risk={c.ghost_risk} />
            </td>
            <td className="ct__cell">
              <StageBadge stage={c.stage} />
            </td>
            <td className="ct__cell ct__cell--action">
              {c.next_action ? (
                <>
                  <ChannelIcon channel={c.next_action.channel} size={14} />
                  <span className="ct__action-label">
                    {' '}
                    {channelLabel(c.next_action.channel)} · {c.next_action.timing_label}
                  </span>
                </>
              ) : (
                <span className="ct__action-label ct__action-label--none">—</span>
              )}
            </td>
            <td className="ct__cell ct__cell--rep">
              {c.assigned_rep ? (
                <span className="ct__rep-avatar" title={c.assigned_rep.name}>
                  {repInitials(c.assigned_rep.name)}
                </span>
              ) : (
                <span className="ct__rep-avatar ct__rep-avatar--none">—</span>
              )}
            </td>
            <td className="ct__cell ct__cell--time mono">
              {relativeTime(c.last_contact_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
