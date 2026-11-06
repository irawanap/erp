import { createContext } from 'react'
import type { User } from './auth.types'

export interface AuthState {
  user: User | null
  notice: string
  loading: boolean
  unavailable: boolean
  acceptUser: (user: User) => Promise<void>
  clearSession: (notice?: string) => void
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
export const authQueryKey = ['auth', 'me'] as const
