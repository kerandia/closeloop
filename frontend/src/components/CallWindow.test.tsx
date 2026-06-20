import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CallWindow } from './CallWindow'

// Mock the ElevenLabs React SDK
vi.mock('@elevenlabs/react', () => ({
  ConversationProvider: ({ children }: any) => <div data-testid="mock-provider">{children}</div>,
  useConversation: () => ({
    status: 'disconnected',
    isMuted: false,
    setMuted: vi.fn(),
    isSpeaking: false,
    isListening: false,
    startSession: vi.fn(),
    endSession: vi.fn(),
  }),
}))

describe('CallWindow Component', () => {
  test('renders target customer name and phone number', () => {
    const handleClose = vi.fn()
    
    render(
      <CallWindow
        onClose={handleClose}
        customerName="Max Mustermann"
        customerPhone="+49 123 456789"
      />
    )

    expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
    expect(screen.getByText('+49 123 456789')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument()
  })

  test('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    
    render(
      <CallWindow
        onClose={handleClose}
        customerName="Max Mustermann"
        customerPhone="+49 123 456789"
      />
    )

    const closeBtn = screen.getByRole('button', { name: /close call screen/i })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledOnce()
  })
})
