import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { CredentialsProof } from '@/features/auth/auth.types'

export interface ActiveSession {
  id: string
  created_at: string
  last_seen_at: string
  expires_at: string
  is_current: boolean
}
export async function getSessions() {
  const { data } = await api.get<ApiResponse<ActiveSession[]>>('/auth/sessions')
  return data.data
}
export async function revokeSession(id: string) { await api.delete(`/auth/sessions/${id}`) }
export async function logoutAll() { await api.post('/auth/logout-all', {}) }
export async function changePassword(input: CredentialsProof & { newPassword: string }) {
  await api.post('/auth/change-password', input)
}
