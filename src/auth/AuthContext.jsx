import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setToken, getToken, setUnauthorizedHandler } from '../api/client.js'
import { roleLabel } from '../lib/referentiels.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [pret, setPret] = useState(false)

  // Le jeton est la seule chose conservée localement ; aucun mot de passe.
  useEffect(() => {
    let vivant = true
    const init = async () => {
      if (!getToken()) { setPret(true); return }
      try {
        const u = await api.moi()
        if (vivant) setUser(u)
      } catch {
        setToken(null)
      } finally {
        if (vivant) setPret(true)
      }
    }
    init()
    return () => { vivant = false }
  }, [])

  useEffect(() => { setUnauthorizedHandler(() => setUser(null)) }, [])

  const login = useCallback(async (email, motDePasse) => {
    try {
      const s = await api.login(email, motDePasse)
      setToken(s.token)
      setUser(s.utilisateur)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [])

  const signup = useCallback(async (dto) => {
    try {
      const s = await api.signup(dto)
      setToken(s.token)
      setUser(s.utilisateur)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [])

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  return (
    <AuthCtx.Provider value={{ user, pret, login, signup, logout, roleLabel }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
