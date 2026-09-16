import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [liste, setListe] = useState([])

  const retirer = useCallback((id) => setListe((l) => l.filter((t) => t.id !== id)), [])

  const pousser = useCallback((niveau, titre, texte, duree = 4200) => {
    const id = Math.random().toString(36).slice(2)
    setListe((l) => [...l, { id, niveau, titre, texte }])
    if (duree) setTimeout(() => retirer(id), duree)
  }, [retirer])

  const toast = {
    succes: (titre, texte) => pousser('ok', titre, texte),
    erreur: (titre, texte) => pousser('err', titre, texte, 7000),
    info: (titre, texte) => pousser('info', titre, texte)
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {liste.map((t) => (
          <div key={t.id} className={`toast ${t.niveau}`}>
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: '20px' }}>
              {t.niveau === 'ok' ? '✓' : t.niveau === 'err' ? '⚠' : 'i'}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong>{t.titre}</strong>
              {t.texte && <span className="text-muted" style={{ display: 'block', fontSize: 13 }}>{t.texte}</span>}
            </span>
            <button onClick={() => retirer(t.id)} aria-label="Fermer">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
