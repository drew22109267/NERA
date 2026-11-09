import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { REF, catLabel } from '../lib/referentiels.js'
import { Icon } from './Icon.jsx'

/** Toutes les listes de l'application se lisent six lignes à la fois. */
export const PAR_PAGE = 6

/**
 * Le titre de la section est porté par la barre du haut (voir Layout) : une
 * page n'affiche plus ni titre, ni salutation, ni texte d'explication — elle
 * ne garde que ses actions, alignées à droite au-dessus du contenu.
 */
export function PageHead({ actions }) {
  // Les actions de la page se placent dans la barre du haut, à droite du titre : aucune
  // ligne vide au-dessus du contenu pour un seul bouton.
  const [cible, setCible] = useState(null)
  useEffect(() => { setCible(document.getElementById('actions-page')) }, [])
  if (!actions || !cible) return null
  return createPortal(<div className="row" style={{ flexWrap: 'nowrap' }}>{actions}</div>, cible)
}

export function Panel({ title, kicker, actions, children, style, ton, flush = false }) {
  const cls = `panel${ton === 'urgent' ? ' urgent' : ton === 'attention' ? ' attention' : ''}${flush ? ' flush' : ''}`
  return (
    <section className={cls} style={style}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {kicker && <div className="card-kicker">{kicker}</div>}
            {title && <h4>{title}</h4>}
          </div>
          {actions && <div className="spacer row row-end">{actions}</div>}
        </div>
      )}
      {flush ? <div className="panel-body">{children}</div> : children}
    </section>
  )
}

export function Kpi({ label, value, unit, note }) {
  return (
    <div className="kpi">
      <span className="label">{label}</span>
      <span className="value">{value}{unit && <small> {unit}</small>}</span>
      {note && <span className="note">{note}</span>}
    </div>
  )
}

export function StatCard({ title, value, sub, pct, delta, deltaDir = 'up', deltaNote, visual, children }) {
  // « 0 écart », « 0 refus » : pas une tendance, donc pas de flèche ni de couleur.
  if (/^\s*0(\D|$)/.test(String(delta ?? ''))) deltaDir = 'neutral'
  return (
    <div className="stat-card">
      <div className="head"><span className="t">{title}</span></div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <span className="big">{value}{sub && <small>{sub}</small>}</span>
            {pct !== undefined && pct !== null && <span className="pct">{pct}</span>}
          </div>
          {children}
        </div>
        {visual}
      </div>
      {(delta || deltaNote) && (
        <div className="foot">
          {deltaNote && <span>{deltaNote}</span>}
          {delta && (
            <span className={`delta ${deltaDir}`} style={{ marginLeft: 'auto' }}>
              {deltaDir === 'up' ? '↑ ' : deltaDir === 'down' ? '↓ ' : ''}{delta}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function CatBadge({ cat }) {
  if (!cat) return <span className="tag tag-neutral">Non trié</span>
  return (
    <span className={`cat cat-${cat}`}>
      <span className="chip">{cat}</span>
      {catLabel(cat)}
    </span>
  )
}

/** `sev` : sev-1 (le plus grave) à sev-4. La trame renforce la couleur. */
export function Bar({ value, max = 100, sev }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`bar${sev ? ` ${sev}` : ''}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Field({ label, hint, erreur, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {erreur ? <span className="err">{erreur}</span> : hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function CatSelect({ value, onChange }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">—</option>
      {REF.categories.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}
    </select>
  )
}

export function Empty({ titre, children }) {
  return (
    <div className="empty">
      {titre && <strong>{titre}</strong>}
      {children}
    </div>
  )
}

export function Alert({ level = 'info', title, children }) {
  // Une icône seulement quand elle porte un sens (danger, réussite) ; une information n'en a pas.
  const icone = { crit: 'alert', warn: 'alert', ok: 'check' }[level]
  return (
    <div className={`alert ${level}`} role={level === 'crit' ? 'alert' : undefined}>
      {icone && <span className="ico" aria-hidden="true"><Icon name={icone} /></span>}
      <div>
        {title && <strong>{title} — </strong>}
        {children}
      </div>
    </div>
  )
}

/** Enveloppe unique pour les trois états d'une ressource distante. */
export function Etat({ loading, error, vide, videTitre, videTexte, onRetry, children }) {
  if (loading) return <div className="load-center"><span className="spinner" /> Chargement…</div>
  if (error) {
    return (
      <Alert level="crit" title="Données indisponibles">
        {error.message}
        {onRetry && <> <button className="btn btn-ghost btn-sm" onClick={onRetry}>Réessayer</button></>}
      </Alert>
    )
  }
  if (vide) return <Empty titre={videTitre ?? 'Aucune donnée'}>{videTexte ?? 'Rien à afficher pour le moment.'}</Empty>
  return children
}

export function Pager({ page, pages, total, pageSize, onPage }) {
  if (!total) return null
  const debut = (page - 1) * pageSize + 1
  const fin = Math.min(total, page * pageSize)
  const nums = []
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i)
  return (
    <div className="pager">
      <span>{debut}–{fin} sur {total}</span>
      <span className="spacer" />
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Page précédente">‹</button>
      {nums[0] > 1 && <button onClick={() => onPage(1)}>1</button>}
      {nums[0] > 2 && <span>…</span>}
      {nums.map((n) => (
        <button key={n} aria-current={n === page} onClick={() => onPage(n)}>{n}</button>
      ))}
      {nums.at(-1) < pages - 1 && <span>…</span>}
      {nums.at(-1) < pages && <button onClick={() => onPage(pages)}>{pages}</button>}
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Page suivante">›</button>
    </div>
  )
}

export function Th({ cle, tri, onTri, children, className }) {
  if (!cle) return <th className={className}>{children}</th>
  const actif = tri.cle === cle
  return (
    <th className={`sortable ${className ?? ''}`} onClick={() => onTri(cle)}
      aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {children}<span className="arrow">{actif ? (tri.sens === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  )
}


/**
 * Recherche et pagination pour un tableau tenu côté client.
 * `champs` : accesseurs dont le texte concaténé sert de matière à la recherche.
 */
export function useTableau(lignes, champs = [], parPage = PAR_PAGE) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase()
    const tout = lignes ?? []
    if (!t) return tout
    return tout.filter((l) => champs.some((f) => {
      const v = typeof f === 'function' ? f(l) : l?.[f]
      return v !== null && v !== undefined && String(v).toLowerCase().includes(t)
    }))
  }, [lignes, q, champs])

  const total = filtrees.length
  const pages = Math.max(1, Math.ceil(total / parPage))
  const courante = Math.min(page, pages)
  const visibles = filtrees.slice((courante - 1) * parPage, courante * parPage)

  return {
    q,
    setQ: (v) => { setQ(v); setPage(1) },
    page: courante, setPage, pages, total, parPage, visibles
  }
}

/** Champ de recherche d'un tableau — même présentation partout. */
export function RechercheTableau({ valeur, onChange, placeholder = 'Rechercher…', total, libelle = 'résultat' }) {
  return (
    <div className="tbl-recherche">
      <span className="champ">
        <Icon name="search" />
        <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          aria-label={placeholder} />
        {valeur && (
          <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche">
            <Icon name="close" />
          </button>
        )}
      </span>
      {total !== undefined && (
        <span className="text-muted" style={{ fontSize: 13 }}>
          {total} {libelle}{total > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}


/**
 * Champ de mot de passe avec bouton « afficher / masquer ».
 * Saisir un mot de passe à l'aveugle est la première cause d'échec de connexion :
 * le bouton est systématique, sur tous les écrans qui en demandent un.
 */
export function MotDePasse({ className = 'input', ...rest }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="champ-mdp">
      <input {...rest} className={className} type={visible ? 'text' : 'password'} />
      <button type="button" className="voir" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible} title={visible ? 'Masquer' : 'Afficher'} tabIndex={-1}>
        <Icon name={visible ? 'eye_off' : 'eye'} />
      </button>
    </span>
  )
}
