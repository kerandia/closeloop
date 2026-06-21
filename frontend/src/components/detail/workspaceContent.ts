/**
 * workspaceContent — hardcoded demo content for each channel's three-column
 * workspace. DEMO ONLY: no backend, no real reasoning. The price + comparison
 * objection scenario is shared across channels so the demo tells one story.
 */
import type { Channel } from '../../api/types'
import type { ChatMessage } from './ChatSurface'
import type { CollectedSummary } from './CallTranscriptView'
import { mockCollectedSummary } from './callTranscriptMock'

const READ = 'Price + Comparison'

const REPLY =
  'Totally understand — a decision this big, you should compare a few. One thing worth saying ' +
  "though: the number to look at isn't really the sticker price, it's how much it takes off that " +
  'electricity bill that keeps climbing — every month, for years. Long-term the gap is bigger than ' +
  'it looks on a quote. Let me put the monthly savings on one page and send it over Wednesday — we ' +
  "can go through it together, and I'll lay the warranty and service out side by side so you've got " +
  'a clear basis to compare. Sound good?'

const WHY =
  "Read as price + comparison — 'expensive' usually isn't about price, it's unseen value; comparing " +
  'is normal but time-pressured. So re-frame the total as monthly savings and move the comparison ' +
  'from price to warranty and long-term value — not a discount or knocking the competition. The ' +
  'reply ends with a specific next step (the Wednesday breakdown) so the conversation keeps moving.'

const LINES = [
  'Acknowledge it: "A decision this size — comparing a couple of offers makes total sense."',
  'Reframe the number: "What matters isn\'t the sticker price, it\'s what it takes off your rising electricity bill — every month, for years."',
  'Move the comparison: "When you compare, look at warranty and service too — that\'s where the long-term value sits."',
  'Lock a next step: "I\'ll send a one-page monthly-savings breakdown Wednesday and we\'ll go through it together."',
]

// Shared opening for messaging channels.
const CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-rep-1',
    from: 'rep',
    text: "Hi! As promised, here's the quote for your 12 kWp system — happy to walk you through it whenever suits you.",
  },
  {
    id: 'msg-cust-1',
    from: 'customer',
    text: 'Honestly, the price is higher than we expected — and we still want to shop around a couple more places before we decide.',
  },
]

const EMAIL_BODY =
  'Hi Familie Hoffmann,\n\n' +
  "Totally understand wanting to compare a few options before a decision this size — that's the " +
  'sensible thing to do.\n\n' +
  "One thing worth keeping front of mind: the number that really matters isn't the sticker price, " +
  "it's how much the system takes off an electricity bill that keeps climbing — every month, for " +
  'years. Over the lifetime of the system that gap is bigger than it looks on a single quote.\n\n' +
  "I'll put the monthly savings on one page and send it across Wednesday, with the warranty and " +
  'service laid out side by side so you have a clear like-for-like basis to compare.\n\n' +
  'Would Wednesday afternoon suit for a quick call to go through it together?\n\n' +
  'Best,\nLena'

const CALL_TRANSCRIPT =
  '**Agent:** Hi Familie Hoffmann, quick courtesy call about your solar quote — is now an okay moment?\n\n' +
  '**Hoffmann:** Sure, briefly. Honestly the price came in higher than we expected.\n\n' +
  '**Agent:** Completely fair to weigh that up. May I ask — is it the total number, or how it compares to other offers?\n\n' +
  '**Hoffmann:** Both, really. We want to shop around a bit before deciding.'

const REP_TRANSCRIPT =
  '**Rep:** Hi Familie Hoffmann, thanks for taking the call. I saw the quote landed — what\'s your first reaction?\n\n' +
  '**Hoffmann:** The price is higher than we expected, and we want to compare a couple of others.\n\n' +
  '**Rep:** Makes total sense. Let\'s look at it as monthly savings rather than the sticker number.'

// ── Discriminated content per channel ─────────────────────────────────────────
interface ReplyRec {
  read: string
  reply: string
  why: string
}
interface LinesRec {
  read: string
  lines: string[]
  why: string
}

export type WorkspaceContent =
  | { kind: 'chat'; messages: ChatMessage[]; rec: ReplyRec }
  | { kind: 'call'; mode: 'voice_ai' | 'phone'; transcriptMd: string; collected?: CollectedSummary; rec: LinesRec }
  | { kind: 'email'; to: string; subject: string; body: string; rec: ReplyRec }
  | { kind: 'visit'; whenLabel: string; prep: string[]; rec: LinesRec }

const chatContent: WorkspaceContent = {
  kind: 'chat',
  messages: CHAT_MESSAGES,
  rec: { read: READ, reply: REPLY, why: WHY },
}

export const CHANNEL_CONTENT: Partial<Record<Channel, WorkspaceContent>> = {
  whatsapp: chatContent,
  sms: chatContent,
  telegram: chatContent,
  voice_ai: {
    kind: 'call',
    mode: 'voice_ai',
    transcriptMd: CALL_TRANSCRIPT,
    collected: mockCollectedSummary,
    rec: { read: READ, lines: LINES, why: WHY },
  },
  phone: {
    kind: 'call',
    mode: 'phone',
    transcriptMd: REP_TRANSCRIPT,
    rec: { read: READ, lines: LINES, why: WHY },
  },
  email: {
    kind: 'email',
    to: 'Familie Hoffmann <hoffmann@example.de>',
    subject: 'Your 12 kWp quote — the monthly-savings view',
    body: EMAIL_BODY,
    rec: { read: READ, reply: EMAIL_BODY, why: WHY },
  },
  visit: {
    kind: 'visit',
    whenLabel: 'Proposed: Wednesday, 16:00',
    prep: [
      'Bring the one-page monthly-savings breakdown for the 12 kWp system.',
      'Print the warranty + service terms, side by side with two competitor norms.',
      'Lead with the rising-bill framing, not the sticker price.',
      'Have Wednesday and Thursday slots ready to lock the follow-up.',
    ],
    rec: { read: READ, lines: LINES, why: WHY },
  },
}
