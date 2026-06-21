import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { CustomerDetail } from '../api/types'
import { getCustomer } from '../api/client'
import { DetailShell } from '../components/detail/DetailShell'
import '../components/detail/DetailShell.css'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: CustomerDetail }

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<State>({ status: 'loading' })

  const fetch = useCallback(() => {
    if (!id) return
    setState({ status: 'loading' })
    getCustomer(id)
      .then((data) => setState({ status: 'ok', data }))
      .catch((err: unknown) => {
        console.error('Failed to load customer:', err)
        setState({
          status: 'error',
          message: 'Could not load this customer. Try again.',
        })
      })
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  if (state.status === 'loading') {
    return (
      <div className="detail-skeleton" data-testid="detail-skeleton">
        <div className="detail-skeleton__bar detail-skeleton__bar--wide" />
        <div className="detail-skeleton__bar detail-skeleton__bar--mid" />
        <div className="detail-skeleton__bar detail-skeleton__bar--short" />
        <div className="detail-skeleton__bar detail-skeleton__bar--wide" />
        <div className="detail-skeleton__bar detail-skeleton__bar--mid" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="detail-error">
        <p className="detail-error__message">{state.message}</p>
        <button className="detail-error__retry" onClick={fetch}>
          Retry
        </button>
      </div>
    )
  }

  return <DetailShell data={state.data} customerId={id!} />
}
