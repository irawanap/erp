import { Eye, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Employee } from '../employee.types'
import { employmentStatusLabels } from '../employee.constants'

interface EmployeeTableProps {
  employees: Employee[]
  onEdit?: (employee: Employee) => void
}

export function EmployeeTable({
  employees,
  onEdit,
}: EmployeeTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">Daftar karyawan</caption>

        <thead>
          <tr>
            <th scope="col">NIK</th>
            <th scope="col">Karyawan</th>
            <th scope="col">Departemen</th>
            <th scope="col">Status</th>
            <th scope="col">Aksi</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>{employee.nik}</td>

              <td>
                <strong>{employee.full_name}</strong>
                <span className="table-secondary">
                  {employee.position}
                </span>
              </td>

              <td>{employee.department_name}</td>

              <td>
                {employmentStatusLabels[employee.employment_status]}
              </td>

              <td>
                <div className="employee-row-actions">
                  <Link
                    className="button button-detail"
                    to={`/employees/${employee.id}`}
                    aria-label={`Detail ${employee.full_name}`}
                  >
                    <Eye size={16} aria-hidden="true" />
                    Detail
                  </Link>

                  {onEdit && (
                    <button
                      type="button"
                      className="button button-edit"
                      onClick={() => onEdit(employee)}
                      aria-label={`Edit ${employee.full_name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Edit
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}