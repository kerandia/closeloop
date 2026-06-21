import type { CustomerListItem } from '../../api/types'
import { CustomerTable } from '../CustomerTable'

interface Props {
  customers: CustomerListItem[]
}

export function MgmtNeedsAttention({ customers }: Props) {
  return (
    <section className="mgmt-needs">
      <h2 className="mono mgmt-needs__heading">
        Needs Attention
        <span className="mgmt-needs__count">{customers.length}</span>
      </h2>
      {customers.length === 0 ? (
        <p className="mgmt-needs__empty">All clear — nobody going quiet</p>
      ) : (
        <CustomerTable customers={customers} />
      )}
    </section>
  )
}
