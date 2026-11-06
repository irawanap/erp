import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import {
    createEmployee,
    getDepartmentOptions,
    getEmployee,
    getEmployees,
    updateEmployee,
} from './employee.api'
import type { EmployeeFilters, EmployeeInput } from './employee.types'

export function useEmployees(filters: EmployeeFilters = {}) {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['employees', user?.id, 'list', filters],
        queryFn: ({ signal }) => getEmployees(filters, signal),
        enabled: !!user,
    })
}

export function useEmployee(id?: string) {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['employees', user?.id, 'detail', id],
        queryFn: ({ signal }) => {
            if (!id) throw new Error('ID karyawan wajib diisi.')
            return getEmployee(id, signal)
        },
        enabled: !!user && !!id,
    })
}

export function useEmployeeDepartments() {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['departments', user?.id, 'options'],
        queryFn: ({ signal }) => getDepartmentOptions(signal),
        enabled: !!user,
    })
}

export function useCreateEmployee() {
    const client = useQueryClient()

    return useMutation({
        mutationFn: createEmployee,
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ['employees'] }),
                client.invalidateQueries({ queryKey: ['dashboard'] }),
            ])
        },
    })
}

export function useUpdateEmployee() {
    const client = useQueryClient()

    return useMutation({
        mutationFn: ({ id, input }: {
            id: string
            input: Partial<EmployeeInput>
        }) => updateEmployee(id, input),

        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ['employees'] }),
                client.invalidateQueries({ queryKey: ['dashboard'] }),
            ])
        },
    })
}
