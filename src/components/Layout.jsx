import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useApi, useEnLigne } from '../api/hooks.js'
import { NAV, canSee, titreSection } from '../nav.js'
import { Icon, Avatar } from './Icon.jsx'
import Recherche from './Recherche.jsx'
import CompleterProfil from './CompleterProfil.jsx'

const KEY_COLLAPSE = 'htl.sidebar.replie'

export default function Layout() {
  const [ouvert, setOuvert] = useState(false)
  const [replie, setReplie] = useState(() => {
    try { return localStorage.getItem(KEY_COLLAPSE) === '1' } catch { return false }
  })
  const [recherche, setRecherche] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  const { user, logout, roleLabel } = useAuth()
  const enLigne = useEnLigne()
  const loc = useLocation()
  const nav = useNavigate()

  // Compteur d'alertes : rafraîchi toutes les 30 s, source unique = API.
  const { data: bord } = useApi('/api/tableau-bord', null, { intervalMs: 30000 })
  const retards = bord?.delaisDepasses ?? 0

  useEffect(() => {
    try { localStorage.setItem(KEY_COLLAPSE, replie ? '1' : '0') } catch { /* ignoré */ }
  }, [replie])

  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setRecherche(true) }
      if (e.key === 'Escape') setMenu(false)
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [])

  // Le menu du compte se ferme au clic extérieur et à chaque changement de page.
  useEffect(() => {
    if (!menu) return
    const clic = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', clic)
    return () => document.removeEventListener('mousedown', clic)
  }, [menu])
  useEffect(() => { setMenu(false) }, [loc.pathname])

  const nomCourt = user.nom.split('—').pop().trim()

  return (
    <div className={`shell${ouvert ? ' open' : ''}${replie ? ' collapsed' : ''}`}>
      <div className="scrim" onClick={() => setOuvert(false)} />

      <aside className="sidebar">
        <div className="sidebar-top">
          <Link to="/" className="sidebar-brand" onClick={() => setOuvert(false)} title="NERA">
            <img className="brand-logo" src="/logo-na.png" alt="NERA" width="52" height="26" />
            <span className="brand-text">NERA</span>
          </Link>
          <button className="collapse-btn" onClick={() => setReplie((r) => !r)}
            aria-label={replie ? 'Déplier le menu' : 'Replier le menu'} title={replie ? 'Déplier' : 'Replier'}>
            <Icon name={replie ? 'expand' : 'collapse'} />
          </button>
        </div>

        <button className="sidebar-search" onClick={() => setRecherche(true)}
          aria-label="Rechercher" title="Rechercher (Ctrl K)">
          <Icon name="search" />
          <span>Rechercher</span>
          <kbd>Ctrl K</kbd>
        </button>

        <nav>
          {NAV.map((g) => {
            const items = g.items.filter((i) => canSee(i, user.role))
            if (!items.length) return null
            return (
              <div className="nav-group" key={g.group}>
                <h6>{g.group}</h6>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} title={i.label}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={() => setOuvert(false)}>
                    <Icon name={i.icon} />
                    <span>{i.label}</span>
                    {i.to === '/file' && retards > 0 && <span className="tag tag-sev-1 nav-count">{retards}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="main">
        {!enLigne && (
          <div className="offline-bar">
            <Icon name="wifi_off" />
            Hors ligne — les enregistrements sont suspendus jusqu’au retour du réseau.
          </div>
        )}

        <header className="topbar">
          <button className="icon-btn burger" onClick={() => setOuvert((o) => !o)} aria-label="Ouvrir le menu">
            <Icon name="menu" />
          </button>
          <Link to="/" className="topbar-brand" aria-label="Accueil">
            <img src="/logo-na.png" alt="NERA" width="44" height="22" />
          </Link>
          <h1 className="topbar-title">{titreSection(loc.pathname)}</h1>
          <span className="spacer" />

          <button className="icon-btn round" onClick={() => setRecherche(true)}
            aria-label="Rechercher" title="Rechercher (Ctrl K)">
            <Icon name="search" />
          </button>

          <Link to="/notifications" className="icon-btn round" aria-label="Notifications" title="Notifications & alertes">
            <Icon name="bell" />
            {retards > 0 && <span className="dot" />}
          </Link>

          <span className="topbar-sep" />

          <div className="compte" ref={menuRef}>
            <button className="avatar-btn" onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu" aria-expanded={menu} title={`${nomCourt} — ${roleLabel(user.role)}`}>
              <Avatar size={30} />
            </button>

            {menu && (
              <div className="compte-menu" role="menu">
                <div className="compte-tete">
                  <Avatar size={38} />
                  <span className="bloc">
                    <strong>{nomCourt}</strong>
                    <span className="text-muted">{roleLabel(user.role)}</span>
                  </span>
                </div>
                <button role="menuitem" onClick={() => nav('/profil')}>
                  <Icon name="user" /> Mon profil
                </button>
                {user.role === 'admin' && (
                  <button role="menuitem" onClick={() => nav('/admin')}>
                    <Icon name="settings" /> Administration
                  </button>
                )}
                <button role="menuitem" className="danger" onClick={logout}>
                  <Icon name="logout" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="page" key={loc.pathname}>
          <Outlet />
        </main>
      </div>

      {recherche && <Recherche onClose={() => setRecherche(false)} />}
      <CompleterProfil />
    </div>
  )
}
