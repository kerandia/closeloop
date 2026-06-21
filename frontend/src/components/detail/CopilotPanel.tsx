/**
 * CopilotPanel — wrapper around CoachingCard (extracted coaching UI).
 * Preserves the original export + props for backward compatibility.
 *
 * The orchestrator can import:
 *   - CoachingCard from './CoachingCard' (Respond + Collect)
 *   - ChatWindow from './ChatWindow' (chat thread + live suggestion)
 */
import { CoachingCard } from './CoachingCard'
import type { CoachingCardProps } from './CoachingCard'

export type CopilotPanelProps = CoachingCardProps
export { CoachingCard } from './CoachingCard'
export { ChatWindow } from './ChatWindow'

export function CopilotPanel({ customerId }: CopilotPanelProps) {
  return <CoachingCard customerId={customerId} />
}
