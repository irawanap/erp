import type { Department } from '../department.types'

interface DepartmentTableProps {
    departments: Department[]
    onEdit?: (department: Department) => void
}

export function DepartmentTable({
    departments,
    onEdit,
}: DepartmentTableProps) {
    if (departments.length === 0) {
        return (
            <div className="table-state">
                <p>Tidak ada departemen untuk ditampilkan.</p>
            </div>
        )
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <caption className="sr-only">Daftar departemen</caption>

                <thead>
                    <tr>
                        <th scope="col">Kode</th>
                        <th scope="col">Nama departemen</th>
                        {onEdit && <th scope="col">Aksi</th>}
                    </tr>
                </thead>

                <tbody>
                    {departments.map((department) => (
                        <tr key={department.id}>
                        <td>{department.code}</td>
                        <td>{department.name}</td>

                        {onEdit && (
                            <td>
                            <button
                                type="button"
                                className="button button-outline"
                                aria-label={`Edit departemen ${department.name}`}
                                onClick={() => onEdit(department)}
                            >
                                Edit
                            </button>
                            </td>
                        )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}