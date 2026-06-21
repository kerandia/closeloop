import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CallTranscriptView, type CollectedSummary } from './CallTranscriptView'
import { mockCollectedSummary } from './callTranscriptMock'

describe('CallTranscriptView', () => {
  test('parses transcript markdown into turns', () => {
    const transcriptMd = `**Agent:** Hello there.\n\n**Customer:** Hi, how are you?`
    render(<CallTranscriptView transcriptMd={transcriptMd} mode="voice_ai" />)

    expect(screen.getByText('Hello there.')).toBeInTheDocument()
    expect(screen.getByText('Hi, how are you?')).toBeInTheDocument()
  })

  test('renders collected summary card when passed with voice_ai mode', () => {
    const collected: CollectedSummary = {
      motivation: 'Test motivation',
      timeline: 'Test timeline',
      hesitations: ['Test hesitation 1', 'Test hesitation 2'],
      callback: 'Test callback',
    }

    render(
      <CallTranscriptView
        transcriptMd={`**Agent:** Test\n\n**Customer:** Test response`}
        mode="voice_ai"
        collected={collected}
      />
    )

    expect(screen.getByText('Collected Summary')).toBeInTheDocument()
    expect(screen.getByText('Test motivation')).toBeInTheDocument()
    expect(screen.getByText('Test timeline')).toBeInTheDocument()
    expect(screen.getByText('Test hesitation 1')).toBeInTheDocument()
    expect(screen.getByText('Test hesitation 2')).toBeInTheDocument()
    expect(screen.getByText('Test callback')).toBeInTheDocument()
  })

  test('does not render collected card when mode is phone', () => {
    const collected: CollectedSummary = { motivation: 'Test' }
    render(
      <CallTranscriptView
        transcriptMd={`**Agent:** Test\n\n**Customer:** Test`}
        mode="phone"
        collected={collected}
      />
    )

    expect(screen.queryByText('Collected Summary')).not.toBeInTheDocument()
  })

  test('renders empty state when no transcript or collected data', () => {
    render(<CallTranscriptView transcriptMd={null} mode="voice_ai" collected={null} />)
    expect(screen.getByText(/no transcript/i)).toBeInTheDocument()
  })

  test('uses mock collected summary in export', () => {
    expect(mockCollectedSummary.motivation).toBeDefined()
    expect(mockCollectedSummary.timeline).toBeDefined()
    expect(Array.isArray(mockCollectedSummary.hesitations)).toBe(true)
    expect(mockCollectedSummary.callback).toBeDefined()
  })
})
