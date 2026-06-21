import { useEffect, useState } from 'react'
import { CallWindow } from '../components/CallWindow'
import './TestCallPage.css'

export function TestCallPage() {
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected'>('idle')
  const [customerName, setCustomerName] = useState('Customer')

  useEffect(() => {
    const channel = new BroadcastChannel('live-call-demo')

    channel.onmessage = (event) => {
      if (event.data?.type === 'START_CALL') {
        if (event.data.customerName) setCustomerName(event.data.customerName)
        setCallState('ringing')
      } else if (event.data?.type === 'END_CALL') {
        setCallState('idle')
      }
    }

    return () => {
      channel.close()
    }
  }, [])

  function handleAccept() {
    setCallState('connected')
  }

  function handleDecline() {
    setCallState('idle')
    const channel = new BroadcastChannel('live-call-demo')
    channel.postMessage({ type: 'CALL_DECLINED' })
    channel.close()
  }

  function handleCallFinished() {
    setCallState('idle')
  }

  return (
    <div className="test-call-page">
      <div className="phone-container">
        {callState === 'idle' && (
          <div className="phone-screen phone-screen--idle">
            <div className="phone-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="phone-status">Waiting for incoming call...</div>
          </div>
        )}

        {callState === 'ringing' && (
          <div className="phone-screen phone-screen--ringing">
            <div className="incoming-label">Incoming Call</div>
            <div className="incoming-caller">CloseLoop Rep</div>
            <div className="incoming-for">For: {customerName}</div>
            
            <div className="phone-actions">
              <button className="phone-btn phone-btn--decline" onClick={handleDecline}>
                Decline
              </button>
              <button className="phone-btn phone-btn--accept" onClick={handleAccept}>
                Accept
              </button>
            </div>
          </div>
        )}

        {callState === 'connected' && (
          <div className="phone-screen phone-screen--connected">
            <CallWindow 
              customerName={customerName}
              customerPhone="Test Call"
              onClose={handleCallFinished}
              onCallFinished={handleCallFinished}
            />
          </div>
        )}
      </div>
    </div>
  )
}
