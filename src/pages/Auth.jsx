import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { Icon } from '../components/Icon.jsx'

/** Bouton « afficher / masquer » posé dans un champ de mot de passe. */
const Oeil = ({ visible, onToggle }) => (
  <button type="button" className="voir" onClick={onToggle} tabIndex={-1}
    aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    aria-pressed={visible} title={visible ? 'Masquer' : 'Afficher'}>
    <Icon name={visible ? 'eye_off' : 'eye'} />
  </button>
)

const emailValide = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/**
 * Deux espaces, deux images (dossier public/, photos Unsplash, licence libre) :
 *  - le personnel se connecte avec un compte créé par l'administrateur ;
 *  - un patient peut créer son compte lui-même (suivi, rendez-vous, droits sur ses données).
 * Le choix est mémorisé sur cet appareil ; ?espace=patient l'impose (lien envoyé à un patient).
 */
const ESPACES = {
  pro: {
    onglet: 'Professionnel de santé',
    photo: '/connexion-medecin.jpg', position: '50% 22%', credit: 'Ato Aikins',
    alt: 'Médecin en blouse blanche, stéthoscope autour du cou',
    accroche: 'Le bon patient, au bon niveau de soin, dans le bon lit.',
    texte: 'Priorité de triage et prévision des lits, calculées à partir des registres du service.',
    connexion: 'Identifiez-vous avec votre adresse professionnelle.'
  },
  patient: {
    onglet: 'Patient',
    photo: '/connexion-patient.jpg', position: '78% 50%', credit: 'Francisco Venâncio',
    alt: 'Médecin en consultation avec une enfant',
    accroche: 'Votre suivi, vos rendez-vous et vos données, au même endroit.',
    texte: 'Suivez votre passage, demandez un rendez-vous et décidez qui peut consulter votre dossier.',
    connexion: 'Identifiez-vous avec l’adresse donnée lors de votre inscription.'
  }
}
const CLE_ESPACE = 'nera.espace'

function espaceInitial(search) {
  const q = new URLSearchParams(search).get('espace')
  if (q === 'patient' || q === 'pro') return q
  try { return localStorage.getItem(CLE_ESPACE) === 'patient' ? 'patient' : 'pro' } catch { return 'pro' }
}

export default function Auth() {
  const { login, signup } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const mode = loc.pathname === '/signup' ? 'signup' : 'login'

  const [espace, setEspace] = useState(() => espaceInitial(loc.search))
  const [f, setF] = useState({ nom: '', email: '', motDePasse: '', confirme: '' })
  const [etape, setEtape] = useState(1)   // inscription : 1 = identité, 2 = mot de passe
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [voirMdp, setVoirMdp] = useState(false)
  const [voirConfirme, setVoirConfirme] = useState(false)
  const [photoKo, setPhotoKo] = useState({})
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const E = ESPACES[espace]

  // Changer d'écran ou d'espace remet l'assistant à zéro : jamais d'état à moitié rempli.
  useEffect(() => { setErr(''); setNote(''); setEtape(1) }, [mode, espace])
  useEffect(() => { try { localStorage.setItem(CLE_ESPACE, espace) } catch { /* ignoré */ } }, [espace])
  // Les photos sont chargées d'avance : passer d'un espace à l'autre est instantané.
  useEffect(() => { Object.values(ESPACES).forEach((e) => { const i = new Image(); i.src = e.photo }) }, [])

  const suivant = (e) => {
    e.preventDefault()
    if (f.nom.trim().length < 2) return setErr('Indiquez votre nom et votre prénom.')
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
        : await signup({ nom: f.nom.trim(), email: f.email.trim(), motDePasse: f.motDePasse, role: 'patient' })
      if (r.ok) nav('/', { replace: true })
      else { setErr(r.error); if (mode === 'signup') setEtape(1) }
    } finally { setEnvoi(false) }
  }

  const aller = (m) => nav({ pathname: m === 'signup' ? '/signup' : '/login', search: espace === 'patient' ? '?espace=patient' : '' }, { replace: true })
  // L'inscription n'existe que pour les patients.
  const inscriptionPro = mode === 'signup' && espace === 'pro'

  const titre = mode === 'login' ? 'Connexion' : 'Créer votre compte patient'
  const sousTitre = mode === 'login' ? E.connexion
    : inscriptionPro ? ''
      : etape === 1 ? 'Votre nom et l’adresse à laquelle vous joindre.' : 'Choisissez un mot de passe d’au moins 8 caractères.'

  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link to="/login" className="auth-brand" aria-label="NERA">
          <img src="/logo-na.png" alt="" width="48" height="24" />
          <span>NERA</span>
        </Link>

        <div className="auth-form-wrap">
          <div className="auth-espaces" role="tablist" aria-label="Espace">
            {Object.entries(ESPACES).map(([k, v]) => (
              <button key={k} type="button" role="tab" aria-selected={espace === k}
                className={espace === k ? 'on' : ''} onClick={() => setEspace(k)}>
                {v.onglet}
              </button>
            ))}
          </div>

          <h1>{inscriptionPro ? 'Accès du personnel' : titre}</h1>
          {sousTitre && <p className="hint-line">{sousTitre}</p>}

          {inscriptionPro ? (
            <div className="auth-info">
              <p>Les comptes du personnel sont créés par l’administrateur de l’établissement : ils donnent accès aux dossiers des patients.</p>
              <p>Demandez votre accès à l’administrateur, puis connectez-vous avec l’adresse et le mot de passe qu’il vous a transmis.</p>
              <button className="auth-submit" type="button" onClick={() => aller('login')}>Aller à la connexion</button>
            </div>
          ) : (
            <>
              {mode === 'signup' && (
                <ol className="auth-steps" aria-label="Progression de l’inscription">
                  <li className={etape === 1 ? 'on' : 'fait'}>Identité</li>
                  <li className={etape === 2 ? 'on' : ''}>Mot de passe</li>
                </ol>
              )}

              <form onSubmit={mode === 'signup' && etape === 1 ? suivant : submit} noValidate={mode === 'signup' && etape === 1}>
                {mode === 'signup' && etape === 1 && (
                  <div className="auth-field">
                    <label htmlFor="a-nom">Nom et prénom</label>
                    <span className="auth-input">
                      <input id="a-nom" value={f.nom} onChange={set('nom')} autoComplete="name" required minLength={2} />
                    </span>
                  </div>
                )}

                {(mode === 'login' || etape === 1) && (
                  <div className="auth-field">
                    <label htmlFor="a-email">Adresse électronique</label>
                    <span className="auth-input">
                      <input id="a-email" type="email" autoComplete="username" value={f.email} onChange={set('email')}
                        placeholder={espace === 'pro' ? 'nom@hopital.cm' : 'vous@exemple.com'} required autoFocus={mode === 'login'} />
                    </span>
                  </div>
                )}

                {(mode === 'login' || etape === 2) && (
                  <div className="auth-field">
                    <div className="ligne">
                      <label htmlFor="a-mdp">Mot de passe</label>
                      {mode === 'login' && (
                        <button className="auth-link discret" type="button"
                          onClick={() => setNote(espace === 'pro'
                            ? 'Contactez l’administrateur de l’établissement pour réinitialiser votre mot de passe.'
                            : 'Présentez-vous à l’accueil de l’hôpital avec une pièce d’identité pour réinitialiser votre mot de passe.')}>
                          Mot de passe oublié ?
                        </button>
                      )}
                    </div>
                    <span className="auth-input">
                      <input id="a-mdp" type={voirMdp ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={f.motDePasse} onChange={set('motDePasse')} required minLength={mode === 'signup' ? 8 : undefined} />
                      <Oeil visible={voirMdp} onToggle={() => setVoirMdp((v) => !v)} />
                    </span>
                  </div>
                )}

                {mode === 'signup' && etape === 2 && (
                  <div className="auth-field">
                    <label htmlFor="a-conf">Confirmer le mot de passe</label>
                    <span className="auth-input">
                      <input id="a-conf" type={voirConfirme ? 'text' : 'password'} autoComplete="new-password" value={f.confirme}
                        onChange={set('confirme')} required minLength={8} />
                      <Oeil visible={voirConfirme} onToggle={() => setVoirConfirme((v) => !v)} />
                    </span>
                  </div>
                )}

                {err && <p className="auth-error" role="alert">{err}</p>}
                {note && <p className="auth-note">{note}</p>}

                <button className="auth-submit" type="submit" disabled={envoi}>
                  {envoi ? 'Un instant…'
                    : mode === 'login' ? 'Se connecter'
                      : etape === 1 ? 'Continuer' : 'Créer mon compte'}
                </button>

                {mode === 'signup' && etape === 2 && (
                  <button className="auth-link discret" type="button" onClick={() => { setErr(''); setEtape(1) }}>
                    Revenir à l’étape précédente
                  </button>
                )}
              </form>
            </>
          )}

          {espace === 'patient' && (
            <p className="auth-bascule">
              {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
              <button type="button" className="auth-link" onClick={() => aller(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Créer un compte patient' : 'Se connecter'}
              </button>
            </p>
          )}
        </div>

        <footer className="auth-foot">
          <span>NERA — triage et gestion des lits</span>
          <span>Données hébergées par l’établissement</span>
        </footer>
      </section>

      <figure className="auth-visual">
        {Object.entries(ESPACES).map(([k, v]) => !photoKo[k] && (
          <img key={k} src={v.photo} alt={espace === k ? v.alt : ''} aria-hidden={espace !== k}
            className={espace === k ? 'on' : ''} style={{ objectPosition: v.position }}
            onError={() => setPhotoKo((p) => ({ ...p, [k]: true }))} />
        ))}
        {!photoKo[espace] && <span className="credit">Photo : {E.credit}, Unsplash</span>}
        <figcaption key={espace}>
          <strong>{E.accroche}</strong>
          <span>{E.texte}</span>
        </figcaption>
      </figure>
    </div>
  )
}
