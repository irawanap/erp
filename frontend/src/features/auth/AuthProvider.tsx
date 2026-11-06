import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthContext, authQueryKey } from './auth-context'
import { getCurrentUser } from './auth.api'
import { clearCsrfToken } from '@/lib/api'
import type { User } from './auth.types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: authQueryKey, queryFn: ({ signal }) => getCurrentUser(signal),
    retry: false, staleTime: 60_000, refetchOnWindowFocus: true })

  function clearPrivateQueries() {
    client.removeQueries({ predicate: (entry) => entry.queryKey[0] !== 'auth' })
  }

  async function acceptUser(user: User) {
    await client.cancelQueries({ queryKey: authQueryKey })
    clearPrivateQueries()
    setNotice('')
    client.setQueryData(authQueryKey, user)
  }

  function clearSession(message = '') {
    void client.cancelQueries({ queryKey: authQueryKey })
    setNotice(message)
    clearCsrfToken()
    clearPrivateQueries()
    client.setQueryData(authQueryKey, null)
  }

  return <AuthContext.Provider value={{
    user: query.data || null,
    notice,
    loading: query.isPending,
    unavailable: query.isError && !query.data,
    acceptUser, clearSession,
    refresh: async () => { await query.refetch() },
  }}>{children}</AuthContext.Provider>
}
