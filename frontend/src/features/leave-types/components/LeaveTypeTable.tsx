import { Pencil } from 'lucide-react'
import type { LeaveType } from '../leave-type.types'

export function LeaveTypeTable({ items, onEdit }: { items: LeaveType[]; onEdit?: (item: LeaveType) => void }) {
  return <div className="table-scroll"><table className="data-table"><caption className="sr-only">Daftar jenis cuti</caption>
    <thead><tr><th scope="col">Kode</th><th scope="col">Jenis cuti</th><th scope="col">Saldo</th><th scope="col">Status</th>{onEdit && <th scope="col">Aksi</th>}</tr></thead>
    <tbody>{items.map(item => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.requires_balance ? 'Menggunakan saldo' : 'Tanpa saldo'}</td><td>{item.is_active ? 'Aktif' : 'Nonaktif'}</td>{onEdit && <td><button className="button button-edit" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={16} aria-hidden="true" />Edit</button></td>}</tr>)}</tbody>
  </table></div>
}
