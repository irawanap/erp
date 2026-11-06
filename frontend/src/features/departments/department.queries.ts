import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import {
    createDepartment,
    getDepartment,
    getDepartments,
    updateDepartment,
} from './department.api'
import type { DepartmentFilters, DepartmentInput } from './department.types'

const departmentKeys = {
    all: ['departments'] as const,
    list: (userId: string | undefined, filters: DepartmentFilters) =>
        ['departments', userId, 'list', filters] as const,
    detail: (userId: string | undefined, id: string | undefined) =>
        ['departments', userId, 'detail', id] as const,
}

export function useDepartments(filters: DepartmentFilters = {}) {
    const { user } = useAuth()

    return useQuery({
        queryKey: departmentKeys.list(user?.id, filters),
        queryFn: ({ signal }) => getDepartments(filters, signal),
        enabled: !!user,
    })
}

export function useDepartment(id?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: departmentKeys.detail(user?.id, id),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('ID departemen wajib diisi.')
      return getDepartment(id, signal)
    },
    enabled: !!user && !!id,
  })
}

export function useCreateDepartment() {
    const client = useQueryClient()

    return useMutation({
        mutationFn: createDepartment,
        onSuccess: () => client.invalidateQueries({ queryKey: departmentKeys.all }),
    })
}

export function useUpdateDepartment() {
    const client = useQueryClient()

    return useMutation({
        mutationFn: ({ id, input }: {
        id: string
        input: Partial<DepartmentInput>
        }) => updateDepartment(id, input),
        onSuccess: () => client.invalidateQueries({ queryKey: departmentKeys.all }),
    })
}
