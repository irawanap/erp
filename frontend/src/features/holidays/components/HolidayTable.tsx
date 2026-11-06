import { Pencil } from 'lucide-react'
import type { Holiday } from '../holiday.types'

export function HolidayTable({ items, onEdit }: { items: Holiday[]; onEdit?: (item: Holiday) => void }) {
  return <div className="table-scroll"><table className="data-table"><caption className="sr-only">Daftar hari libur</caption>
    <thead><tr><th scope="col">Tanggal</th><th scope="col">Hari libur</th><th scope="col">Status</th>{onEdit && <th scope="col">Aksi</th>}</tr></thead>
    <tbody>{items.map(item => <tr key={item.id}><td>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(item.holiday_date + 'T00:00:00Z'))}</td><td>{item.name}</td><td>{item.is_active ? 'Aktif' : 'Nonaktif'}</td>{onEdit && <td><button className="button button-edit" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={16} aria-hidden="true" />Edit</button></td>}</tr>)}</tbody>
  </table></div>
}
