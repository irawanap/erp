export type EmploymentStatus = 'Active' | 'Inactive' | 'Resigned'

export interface Employee {
    id: string
    nik: string
    full_name: string
    department_id: string
    department_name: string
    position: string
    supervisor_id: string | null
    supervisor_name: string | null
    join_date: string
    employment_status: EmploymentStatus
    created_at: string
    updated_at: string
}

export interface EmployeeInput {
    nik: string
    fullName: string
    departmentId: string
    position: string
    supervisorId: string | null
    joinDate: string
    employmentStatus: EmploymentStatus
}

export interface EmployeeFilters {
    page?: number
    limit?: number
    search?: string
    departmentId?: string
    status?: EmploymentStatus
}
