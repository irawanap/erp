import axios from 'axios'
import type { ApiErrorBody, ApiResponse } from '@/types/api'

let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
})

export function clearCsrfToken() {
  csrfToken = null
  csrfRequest = null
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfRequest) {
    csrfRequest = api.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf')
      .then(({ data }) => {
        csrfToken = data.data.csrfToken
        return csrfToken
      })
      .finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

api.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method?.toLowerCase() || 'get')) {
    config.headers.set('X-CSRF-Token', await getCsrfToken())
  }
  return config
})

api.interceptors.response.use((response) => {
  const token = response.data?.data?.csrfToken
  if (typeof token === 'string') csrfToken = token
  return response
}, (error: unknown) => {
  if (axios.isAxiosError<ApiErrorBody>(error) && error.response?.status === 403
      && error.response.data.message === 'CSRF token tidak valid') clearCsrfToken()
  return Promise.reject(error)
})

export function statusOf(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export function messageOf(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'Server belum dapat dihubungi. Periksa koneksi dan pastikan backend berjalan.'
    if (error.response.status === 429) return 'Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.'
    if (error.response.status === 403 && error.response.data.message === 'CSRF token tidak valid') {
      return 'Sesi keamanan berubah. Silakan kirim kembali formulir ini.'
    }
    return error.response.data.message || 'Permintaan belum berhasil. Silakan coba kembali.'
  }
  return 'Terjadi kendala. Silakan coba kembali.'
}

export function retryAfter(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return 0
  const raw = error.response.headers['retry-after']
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds)
  const date = Date.parse(String(raw))
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : 60
}
