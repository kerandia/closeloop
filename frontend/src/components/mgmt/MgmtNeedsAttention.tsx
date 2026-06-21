import type { CustomerListItem } from '../../api/types'
import { CustomerTable } from '../CustomerTable'

interface Props {
  customers: CustomerListItem[]
}

export function MgmtNeedsAttention({ customers }: Props) {
  return (
    <section className="mgmt-needs">
      <h2 className="mono" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        Needs Attention
        <span style={{ fontSize: '12px', color: 'var(--paper-40)', fontWeight: '400' }}>
          {customers.length}
        </span>
      </h2>
      {customers.length === 0 ? (
        <p style={{ color: 'var(--paper-40)', fontSize: '14px', margin: 0 }}>
          All clear — nobody going quiet
        </p>
      ) : (
        <CustomerTable customers={customers} />
      )}
    </section>
  )
}
