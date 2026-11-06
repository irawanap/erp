import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { useAuth } from '@/features/auth/use-auth'

vi.mock('@/features/auth/use-auth', () => ({ useAuth: vi.fn() }))

function renderRoute() {
  return render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/login" element={<p>Login screen</p>} /><Route element={<ProtectedRoute />}><Route path="/" element={<p>Private workspace</p>} /></Route></Routes></MemoryRouter>)
}

it('redirects an anonymous user to login when backend is unavailable', async () => {
  vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, unavailable: true, notice: '', acceptUser: vi.fn(), clearSession: vi.fn(), refresh: vi.fn() })
  renderRoute()
  expect(await screen.findByText('Login screen')).toBeInTheDocument()
  expect(screen.queryByText('Private workspace')).not.toBeInTheDocument()
})
it('waits for session verification before rendering private content', () => {
  vi.mocked(useAuth).mockReturnValue({ user: null, loading: true, unavailable: false, notice: '', acceptUser: vi.fn(), clearSession: vi.fn(), refresh: vi.fn() })
  renderRoute()
  expect(screen.getByText('Menyiapkan workspace Anda…')).toBeInTheDocument()
  expect(screen.queryByText('Private workspace')).not.toBeInTheDocument()
})
