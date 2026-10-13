import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client.js'
import { REF, setReferentiels } from './referentiels.js'

const Ctx = createContext(null)

/**
 * Charge les référentiels depuis l'API avant le premier rendu des écrans.
 * Tant qu'ils ne sont pas là, rien n'est affiché avec des listes vides : on
 * montre le chargement, puis l'erreur avec un bouton pour réessayer.
 */
export function ReferentielsProvider({ children }) {
  const [etat, setEtat] = useState({ pret: false, erreur: null, ref: REF })

  const charger = useCallback(async () => {
    setEtat((e) => ({ ...e, erreur: null }))
    try {
      const r = await api.get('/api/referentiels', null, { auth: false })
      setReferentiels(r)
      setEtat({ pret: true, erreur: null, ref: { ...REF } })
    } catch (e) {
      setEtat((s) => ({ ...s, erreur: e instanceof ApiError ? e : new ApiError(e.message, 0) }))
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  if (!etat.pret) {
    return (
      <div className="load-center" style={{ minHeight: '100vh' }}>
        {etat.erreur
          ? <>
              <strong style={{ color: 'var(--sev-1-ink)' }}>Référentiels indisponibles</strong>
              <span>{etat.erreur.message}</span>
              <button className="btn btn-primary" onClick={charger}>Réessayer</button>
            </>
          : <><span className="spinner" /> Chargement des référentiels…</>}
      </div>
    )
  }
  return <Ctx.Provider value={{ ref: etat.ref, recharger: charger }}>{children}</Ctx.Provider>
}

/** Référentiels courants et fonction de rechargement (après une modification en Administration). */
export function useReferentiels() {
  const c = useContext(Ctx)
  return c ?? { ref: REF, recharger: () => {} }
}
