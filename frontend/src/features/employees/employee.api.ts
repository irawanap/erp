import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import { getDepartments } from '@/features/departments/department.api'
import type { Department } from '@/features/departments/department.types'
import type {
  Employee,
  EmployeeFilters,
  EmployeeInput,
} from './employee.types'

export async function getEmployees(
    filters: EmployeeFilters = {},
    signal?: AbortSignal,
) {
    const response = await api.get<PaginatedResponse<Employee>>(
        '/employees',
        { params: filters, signal },
    )
    return response.data
}

export async function getEmployee(id: string, signal?: AbortSignal) {
    const response = await api.get<ApiResponse<Employee>>(
        `/employees/${id}`,
        { signal },
    )
    return response.data.data
}

export async function createEmployee(input: EmployeeInput) {
    const response = await api.post<ApiResponse<Employee>>(
        '/employees',
        input,
    )
    return response.data.data
}

export async function updateEmployee(
    id: string,
    input: Partial<EmployeeInput>,
    ) {
    const response = await api.patch<ApiResponse<Employee>>(
        `/employees/${id}`,
        input,
    )
    return response.data.data
}

export async function getDepartmentOptions(signal?: AbortSignal) {
    const departments: Department[] = []
    let page = 1

    while (true) {
        const result = await getDepartments({ page, limit: 100 }, signal)
        departments.push(...result.data)

        if (page >= result.pagination.totalPages) break
        page += 1
    }
    return departments
}

export async function getSupervisorOptions(signal?: AbortSignal) {
    const linked = new Set<string>()
    for (let page = 1; ; page++) {
        const result = await api.get<PaginatedResponse<{ employee_id: string | null }>>('/users', {
            params: { page, limit: 100, role: 'Supervisor', isActive: 'true' }, signal,
        })
        result.data.data.forEach(user => { if (user.employee_id) linked.add(user.employee_id) })
        if (page >= result.data.pagination.totalPages) break
    }
    const employees: Employee[] = []
    for (let page = 1; ; page++) {
        const result = await getEmployees({ page, limit: 100, status: 'Active' }, signal)
        employees.push(...result.data.filter(employee => linked.has(employee.id)))
        if (page >= result.pagination.totalPages) return employees
    }
}
