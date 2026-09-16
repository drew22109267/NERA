import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { PageHead, Panel, Field, CatSelect, Etat, Empty, Alert, Bar } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { ANTECEDENTS, SEV_PAR_NIVEAU, LIBELLE_TENSION } from '../lib/referentiels.js'

/**
 * Redistribution des patients : la règle clinique croisée avec la disponibilité
 * réelle des lits. Le classement et les raisons viennent du backend.
 */
export default function Orientation() {
  const motifs = useApi('/api/orientation/motifs')
  const services = useApi('/api/services', { hospitalisationSeule: true })

  const [f, setF] = useState({ motif: '', age: '', sexe: 'F', categorie: null, antecedents: [] })
  const [res, setRes] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const lancer = async (e) => {
    e.preventDefault()
    setChargement(true); setErreur(null); setRes(null)
    try {
      setRes(await api.get('/api/orientation', {
        motif: f.motif, age: Number(f.age), sexe: f.sexe,
        categorie: f.categorie ?? undefined,
        antecedents: f.antecedents.join(',') || undefined
      }))
    } catch (e2) { setErreur(e2.message) } finally { setChargement(false) }
  }

  const parPole = (services.data ?? []).reduce((acc, s) => {
    (acc[s.pole] ??= []).push(s)
    return acc
  }, {})

  return (
    <>
      <PageHead kicker="Redistribution des patients">
        Croise la filière clinique du motif de recours, les bornes d’âge et de sexe du service,
        la catégorie de triage et les lits réellement libres. Chaque proposition est justifiée en clair.
      </PageHead>

      <div className="grid g-side section">
        <Panel kicker="Critères" title="Situation du patient">
          <Etat loading={motifs.loading} error={motifs.error} onRetry={motifs.recharger}>
            <form className="stack" onSubmit={lancer}>
              <div className="form-grid">
                <Field label="Motif de recours">
                  <select className="input" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} required>
                    <option value="">Choisir un motif…</option>
                    {(motifs.data ?? []).map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Âge (ans)">
                  <input className="input" type="number" min="0" max="120" value={f.age}
                    onChange={(e) => setF({ ...f, age: e.target.value })} required />
                </Field>
                <Field label="Sexe">
                  <select className="input" value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}>
                    <option value="F">Féminin</option>
                    <option value="M">Masculin</option>
                  </select>
                </Field>
                <Field label="Catégorie de triage" hint="Si le triage est déjà fait">
                  <CatSelect value={f.categorie} onChange={(c) => setF({ ...f, categorie: c })} />
                </Field>
              </div>

              <div>
                <div className="card-kicker">Antécédents connus</div>
                <div className="row">
                  {ANTECEDENTS.map((a) => (
                    <label className="check" key={a}>
                      <input type="checkbox" checked={f.antecedents.includes(a)}
                        onChange={(e) => setF({
                          ...f,
                          antecedents: e.target.checked
                            ? [...f.antecedents, a]
                            : f.antecedents.filter((x) => x !== a)
                        })} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={chargement || !f.motif || f.age === ''}>
                {chargement ? <><span className="spinner" /> Calcul…</> : <><Icon name="shuffle" /> Proposer un service</>}
              </button>
            </form>
          </Etat>
        </Panel>

        <Panel kicker="Résultat" title="Services proposés">
          {erreur && <Alert level="crit" title="Calcul impossible">{erreur}</Alert>}
          {!res && !erreur && (
            <Empty titre="Aucun calcul lancé">
              Renseignez le motif et l’âge, puis lancez la proposition.
            </Empty>
          )}
          {res && (
            <div className="stack-sm">
              <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>{res.explication}</p>
              {res.avertissement && <Alert level="warn" title="Attention">{res.avertissement}</Alert>}

              {res.propositions.length === 0
                ? <Empty titre="Aucun service compatible">Un transfert vers un autre établissement est à envisager.</Empty>
                : res.propositions.map((p, i) => (
                  <div key={p.serviceId} className="panel" style={{
                    padding: 14,
                    borderColor: p.recommande ? 'var(--brand)' : 'var(--line)',
                    boxShadow: p.recommande ? '0 0 0 3px var(--brand-soft)' : 'none'
                  }}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <span>
                        <strong style={{ fontSize: 15 }}>{i + 1}. {p.nom}</strong>
                        <span className="text-muted" style={{ display: 'block', fontSize: 12.5 }}>
                          {p.pole} · code {p.code}
                        </span>
                      </span>
                      {p.recommande && <span className="tag tag-brand">Recommandé</span>}
                    </div>

                    <div className="row" style={{ gap: 14, marginTop: 10, fontSize: 13 }}>
                      <span><strong>{p.litsLibres}</strong> lit(s) libre(s) sur {p.litsArmes}</span>
                      <span className={`tag tag-${SEV_PAR_NIVEAU[p.niveau]}`}>{LIBELLE_TENSION[p.niveau]}</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Bar value={p.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[p.niveau]} />
                    </div>

                    <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--muted)' }}>
                      {p.raisons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel kicker="Établissement" title="Carte des services et de leur charge"
        actions={<Link className="btn btn-ghost" to="/lits">Occupation détaillée</Link>}>
        <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
          vide={!services.data?.length} videTitre="Aucun service paramétré"
          videTexte="Renseignez les services depuis l’écran Administration.">
          <div className="stack">
            {Object.entries(parPole).map(([pole, list]) => (
              <div key={pole}>
                <div className="card-kicker">{pole}</div>
                <div className="grid g3" style={{ gap: 12 }}>
                  {list.map((s) => (
                    <div key={s.id} style={{
                      border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12
                    }}>
                      <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                        <strong style={{ fontSize: 13.5 }}>{s.nom}</strong>
                        <span className={`tag tag-${SEV_PAR_NIVEAU[s.niveau]}`}>{Math.round(s.tauxOccupation * 100)} %</span>
                      </div>
                      <div className="text-muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                        {s.libres} libre(s) · {s.occupes}/{s.litsArmes} armés
                        {s.ageMax < 120 && ` · ${s.ageMin}–${s.ageMax} ans`}
                      </div>
                      <Bar value={s.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[s.niveau]} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Etat>
      </Panel>
    </>
  )
}
