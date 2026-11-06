import { afterEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { api, clearCsrfToken, messageOf } from '@/lib/api'
import type { AxiosAdapter } from 'axios'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  vi.restoreAllMocks()
  api.defaults.adapter = originalAdapter
  clearCsrfToken()
})

it('fetches CSRF once and attaches it to subsequent mutations', async () => {
  const csrf = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { csrfToken: 'first-token' } } })
  const adapter = vi.fn<AxiosAdapter>(async config => ({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config }))
  api.defaults.adapter = adapter
  await api.post('/example', {})
  await api.patch('/example/one', {})
  expect(csrf).toHaveBeenCalledTimes(1)
  expect(adapter.mock.calls[0][0].headers.get('X-CSRF-Token')).toBe('first-token')
  expect(adapter.mock.calls[1][0].headers.get('X-CSRF-Token')).toBe('first-token')
})
it('uses the rotated CSRF returned by reauthentication', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { csrfToken: 'old-token' } } })
  const adapter = vi.fn<AxiosAdapter>(async config => ({ data: config.url === '/auth/reauthenticate' ? { data: { csrfToken: 'new-token' } } : {}, status: 200, statusText: 'OK', headers: {}, config }))
  api.defaults.adapter = adapter
  await api.post('/auth/reauthenticate', {})
  await api.post('/sensitive-operation', {})
  expect(adapter.mock.calls[1][0].headers.get('X-CSRF-Token')).toBe('new-token')
})
it('does not retry a failed mutation automatically', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { csrfToken: 'token' } } })
  const adapter = vi.fn<AxiosAdapter>(async config => { throw new AxiosError('Offline', 'ERR_NETWORK', config) })
  api.defaults.adapter = adapter
  await expect(api.post('/leave-requests', {})).rejects.toThrow('Offline')
  expect(adapter).toHaveBeenCalledTimes(1)
  expect(messageOf(new AxiosError('Offline'))).toContain('Server belum dapat dihubungi')
})
