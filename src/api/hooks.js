import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './client.js'

/**
 * Charge une ressource de l'API. Renvoie systématiquement les trois états
 * dont l'interface a besoin : chargement, erreur, données — jamais de valeur
 * inventée en cas d'absence de donnée.
 */
export function useApi(path, params, { skip = false, intervalMs = 0 } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const cle = JSON.stringify(params ?? null)
  const premier = useRef(true)

  const charger = useCallback(async (silencieux = false) => {
    if (skip || !path) { setLoading(false); return }
    if (!silencieux) setLoading(true)
    try {
      const d = await api.get(path, params)
      setData(d)
      setError(null)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e instanceof ApiError ? e : new ApiError(e.message, 0))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, cle, skip])

  useEffect(() => {
    charger(!premier.current)
    premier.current = false
  }, [charger])

  useEffect(() => {
    if (!intervalMs || skip) return
    const id = setInterval(() => charger(true), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, skip, charger])

  return { data, loading, error, recharger: () => charger(true), setData }
}

/** Appel d'écriture : gère l'état « en cours » et remonte l'erreur en clair. */
export function useAction(fn) {
  const [enCours, setEnCours] = useState(false)
  const [error, setError] = useState(null)

  const executer = useCallback(async (...args) => {
    setEnCours(true)
    setError(null)
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e) {
      setError(e)
      return { ok: false, error: e }
    } finally {
      setEnCours(false)
    }
  }, [fn])

  return { executer, enCours, error, resetError: () => setError(null) }
}

/** Indicateur de connectivité — le triage se fait aussi en zone mal couverte. */
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setEnLigne(true)
    const off = () => setEnLigne(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return enLigne
}

/** Tri local d'un tableau déjà paginé côté serveur. */
export function useTri(defaut = { cle: null, sens: 'asc' }) {
  const [tri, setTri] = useState(defaut)
  const basculer = (cle) => setTri((t) => ({
    cle,
    sens: t.cle === cle && t.sens === 'asc' ? 'desc' : 'asc'
  }))
  const trier = (liste, accesseurs = {}) => {
    if (!tri.cle || !Array.isArray(liste)) return liste ?? []
    const get = accesseurs[tri.cle] ?? ((x) => x[tri.cle])
    return [...liste].sort((a, b) => {
      const va = get(a), vb = get(b)
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      const r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
      return tri.sens === 'asc' ? r : -r
    })
  }
  return { tri, basculer, trier }
}
