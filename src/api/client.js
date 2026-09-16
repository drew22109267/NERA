const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5080'
const KEY_TOKEN = 'htl.token'

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const getToken = () => {
  try { return localStorage.getItem(KEY_TOKEN) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(KEY_TOKEN, t) : localStorage.removeItem(KEY_TOKEN) } catch { /* stockage bloqué */ }
}

let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, { body, formData, signal, auth = true } = {}) {
  const headers = {}
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method, headers, signal,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined)
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError(
      navigator.onLine
        ? "Le serveur ne répond pas. Vérifiez que l'API est démarrée."
        : 'Vous êtes hors ligne. La requête sera à relancer une fois la connexion revenue.',
      0
    )
  }

  if (res.status === 401 && auth) {
    setToken(null)
    onUnauthorized?.()
    throw new ApiError('Session expirée. Reconnectez-vous.', 401)
  }
  if (res.status === 204) return null

  const texte = await res.text()
  let data = null
  if (texte) { try { data = JSON.parse(texte) } catch { data = texte } }

  if (!res.ok) {
    // ProblemDetails d'ASP.NET : agrège les erreurs de validation par champ.
    let message = data?.message || data?.title || `Erreur ${res.status}`
    const champs = data?.errors
    if (champs && typeof champs === 'object') {
      const premier = Object.values(champs).flat()[0]
      if (premier) message = premier
    }
    throw new ApiError(message, res.status, champs)
  }
  return data
}

const qs = (params) => {
  const p = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'Tous') p.append(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: (p, params, opts) => request('GET', p + qs(params), opts),
  post: (p, body, opts) => request('POST', p, { body, ...opts }),
  put: (p, body, opts) => request('PUT', p, { body, ...opts }),
  patch: (p, body, opts) => request('PATCH', p, { body, ...opts }),
  del: (p, opts) => request('DELETE', p, opts),
  upload: (p, formData) => request('POST', p, { formData }),
  fichierUrl: (p) => `${BASE}${p}`,
  base: BASE,

  // ── Authentification ──
  login: (email, motDePasse) => request('POST', '/api/auth/login', { body: { email, motDePasse }, auth: false }),
  signup: (dto) => request('POST', '/api/auth/signup', { body: dto, auth: false }),
  moi: () => request('GET', '/api/auth/moi'),
  sante: () => request('GET', '/api/sante', { auth: false })
}
