import type { CollectedSummary } from './CallTranscriptView'

// Seeded "collected" summary for the demo voice_ai call (spec 04 §5).
export const mockCollectedSummary: CollectedSummary = {
  motivation: 'Customer interested in reducing monthly energy bills.',
  timeline: 'Wants to install system within 6 months.',
  hesitations: ['Worried about financing options', 'Concerned about roof integrity'],
  callback: 'Follow up next week with financing details',
}
