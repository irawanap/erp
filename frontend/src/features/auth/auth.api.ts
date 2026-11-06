import { api, clearCsrfToken, statusOf } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { CredentialsProof, LoginInput, User } from './auth.types'

export async function getCurrentUser(signal?: AbortSignal): Promise<User | null> {
  try {
    const response = await api.get<ApiResponse<User>>('/auth/me', { signal })
    return response.data.data
  } catch (error) {
    if (statusOf(error) === 401) return null
    throw error
  }
}

export async function login(input: LoginInput) {
  const { data } = await api.post<ApiResponse<{ user: User; csrfToken: string }>>('/auth/login', input)
  return data.data.user
}

export async function register(input: { email: string; password: string }) {
  const { data } = await api.post<{ success: true; message: string }>('/auth/register', input)
  return data.message
}

export async function logout() {
  await api.post('/auth/logout', {})
  clearCsrfToken()
}

export async function reauthenticate(input: CredentialsProof) {
  await api.post('/auth/reauthenticate', input)
}

export async function setupMfa(input: CredentialsProof) {
  const { data } = await api.post<ApiResponse<{ secret: string; uri: string }>>('/auth/mfa/setup', input)
  return data.data
}

export async function confirmMfa(otp: string) {
  const { data } = await api.post<ApiResponse<{ recoveryCodes: string[] }>>('/auth/mfa/confirm', { otp })
  clearCsrfToken()
  return data.data.recoveryCodes
}
