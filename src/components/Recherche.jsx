import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { Icon } from './Icon.jsx'
import { Empty } from './ui.jsx'

/** Palette de recherche globale — Ctrl+K (ou ⌘K). Interroge réellement l'API. */
export default function Recherche({ onClose }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const nav = useNavigate()
  const champ = useRef(null)

  useEffect(() => { champ.current?.focus() }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); setErreur(null); return }
    const t = setTimeout(async () => {
      setChargement(true)
      try {
        setRes(await api.get('/api/tableau-bord/recherche', { q }))
        setErreur(null)
      } catch (e) { setErreur(e.message) } finally { setChargement(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const aller = (lien) => { onClose(); nav(lien) }

  return (
    <div className="modal-scrim" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Recherche">
        <div className="modal-head" style={{ alignItems: 'center' }}>
          <Icon name="search" style={{ color: 'var(--muted-2)' }} />
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Patient, n° de dossier, passage, service…"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            style={{ border: 0, outline: 'none', font: 'inherit', fontSize: 16, flex: 1, minWidth: 0 }} />
          <button onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          {q.trim().length < 2 && (
            <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
              Saisissez au moins deux caractères. La recherche porte sur les dossiers patients,
              les passages et les services.
            </p>
          )}
          {chargement && <div className="load-center"><span className="spinner" /></div>}
          {erreur && <p style={{ color: 'var(--sev-1-ink)', fontSize: 13.5 }}>{erreur}</p>}
          {!chargement && !erreur && q.trim().length >= 2 && res.length === 0 && (
            <Empty titre="Aucun résultat">Rien ne correspond à « {q} ».</Empty>
          )}
          <div className="stack-sm">
            {res.map((r) => (
              <button key={`${r.type}-${r.id}`} className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 12px' }}
                onClick={() => aller(r.lien)}>
                <span className="tag tag-neutral">{r.type}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{r.titre}</strong>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>{r.sousTitre}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
