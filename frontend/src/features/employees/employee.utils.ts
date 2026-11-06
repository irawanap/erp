import type { Employee, EmployeeInput } from './employee.types'

export function employeeValues(employee: Employee): EmployeeInput {
  return {
    nik: employee.nik,
    fullName: employee.full_name,
    departmentId: employee.department_id,
    position: employee.position,
    supervisorId: employee.supervisor_id,
    joinDate: employee.join_date,
    employmentStatus: employee.employment_status,
  }
}

export function changedFields(original: EmployeeInput, values: EmployeeInput): Partial<EmployeeInput> {
  return Object.fromEntries(Object.entries(values).filter(
    ([key, value]) => original[key as keyof EmployeeInput] !== value,
  )) as Partial<EmployeeInput>
}
