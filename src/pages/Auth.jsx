import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { ROLES, ROLE_LABEL } from '../lib/referentiels.js'

const I = {
  user: 'M16 19v-1.2A3.8 3.8 0 0 0 12.2 14h-4.4A3.8 3.8 0 0 0 4 17.8V19M10 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5',
  mail: 'M3.5 6.5h13v11h-13zM3.5 7l6.5 5 6.5-5',
  lock: 'M5.5 9.5h9v8h-9zM7.5 9.5V7a2.5 2.5 0 0 1 5 0v2.5',
  badge: 'M4 5.5h12v9H4zM7 9.5h6M7 12h4'
}
const Ico = ({ d }) => (
  <svg width="17" height="17" viewBox="0 0 20 22" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

const emailValide = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export default function Auth() {
  const { login, signup } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const mode = loc.pathname === '/signup' ? 'signup' : 'login'

  const [f, setF] = useState({ nom: '', email: '', motDePasse: '', confirme: '', role: 'infirmier' })
  const [etape, setEtape] = useState(1)   // inscription : 1 = identité, 2 = mot de passe
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // Changer d'écran remet l'assistant à zéro : jamais d'état à moitié rempli.
  useEffect(() => { setErr(''); setNote(''); setEtape(1) }, [mode])

  const suivant = (e) => {
    e.preventDefault()
    if (f.nom.trim().length < 2) return setErr('Indiquez votre nom et votre fonction.')
    if (!emailValide(f.email)) return setErr('Adresse électronique invalide.')
    setErr(''); setEtape(2)
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (mode === 'signup') {
      if (f.motDePasse.length < 8) return setErr('Le mot de passe doit faire au moins 8 caractères.')
      if (f.motDePasse !== f.confirme) return setErr('Les deux mots de passe ne correspondent pas.')
    }
    setEnvoi(true)
    try {
      const r = mode === 'login'
        ? await login(f.email.trim(), f.motDePasse)
        : await signup({ nom: f.nom.trim(), email: f.email.trim(), motDePasse: f.motDePasse, role: f.role })
      if (r.ok) nav('/', { replace: true })
      else { setErr(r.error); if (mode === 'signup') setEtape(1) }
    } finally { setEnvoi(false) }
  }

  const panel = mode === 'login'
    ? { h: 'Bonjour !', p: 'Pas encore de compte ? Demandez votre accès à l’administrateur ou créez-le ici.', cta: 'Créer un compte', to: '/signup' }
    : { h: 'Content de vous revoir !', p: 'Pour rester connecté à votre service, identifiez-vous avec vos accès personnels.', cta: 'Se connecter', to: '/login' }

  const identite = mode === 'login' || etape === 1
  const titre = mode === 'login' ? 'Connexion'
    : etape === 1 ? 'Créer un compte' : 'Choisir un mot de passe'

  return (
    <div className="auth-page">
      <span className="auth-blob b1" />
      <span className="auth-blob b2" />
      <span className="auth-blob b3" />

      <div className={`auth-card ${mode}`}>
        <section className="auth-panel">
          <span className="deco d1" /><span className="deco d2" /><span className="deco d3" />
          <div className="brand">
            <img className="mk" src="/logo-na.png" alt="NERA" width="48" height="26" />
            NERA
          </div>
          <h2>{panel.h}</h2>
          <p>{panel.p}</p>
          <button className="btn-outline" type="button" onClick={() => nav(panel.to, { replace: true })}>
            {panel.cta}
          </button>
        </section>

        <section className="auth-side">
          <h2>{titre}</h2>

          {mode === 'signup' && (
            <ol className="auth-steps" aria-label="Progression de l’inscription">
              <li className={etape === 1 ? 'on' : 'fait'}>Identité</li>
              <li className={etape === 2 ? 'on' : ''}>Mot de passe</li>
            </ol>
          )}

          <p className="hint-line">
            {mode === 'login'
              ? 'Identifiez-vous avec votre adresse professionnelle.'
              : etape === 1 ? 'Renseignez votre identité et votre fonction.'
                : 'Au moins 8 caractères.'}
          </p>

          <form onSubmit={mode === 'signup' && etape === 1 ? suivant : submit}>
            {mode === 'signup' && etape === 1 && (
              <>
                <span className="auth-input">
                  <Ico d={I.user} />
                  <input value={f.nom} onChange={set('nom')} placeholder="Nom et fonction" required minLength={2} />
                </span>
                <span className="auth-input">
                  <Ico d={I.badge} />
                  <select value={f.role} onChange={set('role')}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </span>
              </>
            )}

            {identite && (
              <span className="auth-input">
                <Ico d={I.mail} />
                <input type="email" autoComplete="username" value={f.email} onChange={set('email')}
                  placeholder="Adresse électronique" required />
              </span>
            )}

            {(mode === 'login' || etape === 2) && (
              <span className="auth-input">
                <Ico d={I.lock} />
                <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={f.motDePasse} onChange={set('motDePasse')} placeholder="Mot de passe" required
                  minLength={mode === 'signup' ? 8 : undefined} />
              </span>
            )}

            {mode === 'signup' && etape === 2 && (
              <span className="auth-input">
                <Ico d={I.lock} />
                <input type="password" autoComplete="new-password" value={f.confirme} onChange={set('confirme')}
                  placeholder="Confirmer le mot de passe" required minLength={8} />
              </span>
            )}

            {err && <p className="auth-error">{err}</p>}
            {note && <p className="hint-line">{note}</p>}

            <button className="auth-submit" type="submit" disabled={envoi}>
              {envoi ? 'Envoi…'
                : mode === 'login' ? 'Se connecter'
                  : etape === 1 ? 'Continuer' : 'S’inscrire'}
            </button>

            {mode === 'login' && (
              <button className="auth-link" type="button"
                onClick={() => setNote('Contactez l’administrateur de l’établissement pour réinitialiser votre mot de passe.')}>
                Mot de passe oublié ?
              </button>
            )}
            {mode === 'signup' && etape === 2 && (
              <button className="auth-link" type="button" onClick={() => { setErr(''); setEtape(1) }}>
                ← Revenir à l’étape précédente
              </button>
            )}
          </form>

          <p className="auth-bascule">
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Vous avez déjà un compte ? '}
            <button type="button" className="auth-link" onClick={() => nav(panel.to, { replace: true })}>
              {panel.cta}
            </button>
          </p>
        </section>
      </div>
    </div>
  )
}
