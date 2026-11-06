import type { Role, User } from '@/features/auth/auth.types'

export type ManagedUser = User
export interface UserInput { email: string; password: string; role: Role }
export interface UserFilters { page: number; limit: number; search: string; role?: Role; isActive?: 'true' | 'false' }
export type UserAction =
  | { kind: 'create'; input: UserInput }
  | { kind: 'update'; id: string; input: Partial<Omit<UserInput, 'password'>> & { isActive?: boolean } }
  | { kind: 'link'; id: string; employeeId: string | null }
  | { kind: 'deactivate'; id: string }
