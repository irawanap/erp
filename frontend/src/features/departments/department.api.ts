import { api } from "@/lib/api";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
    Department,
    DepartmentFilters,
    DepartmentInput,
} from './department.types';

export async function getDepartments(
    filters: DepartmentFilters = {},
    signal?: AbortSignal,
) {
    const response = await api.get<PaginatedResponse<Department>>(
        '/departments',
        {
            params: filters,
            signal,
        },
    )
    return response.data
}

export async function getDepartment(
    id: string,
    signal?: AbortSignal,
) {
    const response = await api.get<ApiResponse<Department>>(
        `/departments/${id}`,
        { signal },
    )
    return response.data.data
}

export async function createDepartment(input: DepartmentInput) {
    const response = await api.post<ApiResponse<Department>>(
        '/departments',
        input,
    )
    return response.data.data
}

export async function updateDepartment(
    id: string,
    input: Partial<DepartmentInput>,
) {
    const response = await api.patch<ApiResponse<Department>>(
        `/departments/${id}`,
        input,
    )
    return response.data.data
}
