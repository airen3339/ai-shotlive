/**
 * 认证 Context
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { auth, setToken, getAuthToken } from '@/api/client'

interface User { id: number; username: string }

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (u: string, p: string) => Promise<void>
  register: (u: string, p: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>(null!)
export function useAuth(): AuthContextValue { return useContext(AuthContext) }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setIsLoading(false); return }
    auth.me().then(r => setUser(r.user)).catch(() => setToken(null)).finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => { setUser(null); setToken(null) }
    window.addEventListener('auth:invalid', handler)
    return () => window.removeEventListener('auth:invalid', handler)
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const resp = await auth.login(u, p); setToken(resp.token); setUser(resp.user)
  }, [])

  const register = useCallback(async (u: string, p: string) => {
    const resp = await auth.register(u, p); setToken(resp.token); setUser(resp.user)
  }, [])

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
}
