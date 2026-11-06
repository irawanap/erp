export interface Department {
    id: string
    code: string
    name: string
    created_at: string
    updated_at: string
}

export interface DepartmentInput {
    code: string
    name: string
}

export interface DepartmentFilters {
    page?: number
    limit?: number
    search?: string
}
