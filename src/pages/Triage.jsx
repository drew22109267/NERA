import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, CatBadge, CatSelect, Etat, Alert, Empty } from '../components/ui.jsx'
import { AVPU, BORNES, validerBorne, catDelai, catLabel } from '../lib/referentiels.js'

const CHAMPS = ['pas', 'pad', 'fc', 'fr', 'temperature', 'spo2', 'glycemie', 'poids']
const vide = { pas: '', pad: '', fc: '', fr: '', temperature: '', spo2: '', glycemie: '', poids: '', avpu: 'Alerte', glasgow: '', eva: '', categorieManuelle: null }

const nombre = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function Triage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const passage = useApi(`/api/passages/${id}`)

  const [v, setV] = useState(vide)
  const [eval_, setEval] = useState(null)
  const [evalErr, setEvalErr] = useState(null)
  const [correction, setCorrection] = useState({ active: false, cat: null, motif: '' })
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (passage.data?.triage) {
      setV({ ...vide, ...Object.fromEntries(Object.entries(passage.data?.triage).map(([k, x]) => [k, x ?? ''])) })
    }
  }, [passage.data])

  const erreurs = useMemo(() => {
    const e = {}
    for (const c of [...CHAMPS, 'glasgow', 'eva']) {
      const msg = validerBorne(c, v[c])
      if (msg) e[c] = msg
    }
    if (v.pas && v.pad && Number(v.pad) >= Number(v.pas)) e.pad = 'La diastolique doit rester inférieure à la systolique.'
    return e
  }, [v])

  const corps = useMemo(() => ({
    pas: nombre(v.pas), pad: nombre(v.pad), fc: nombre(v.fc), fr: nombre(v.fr),
    temperature: nombre(v.temperature), spo2: nombre(v.spo2), glycemie: nombre(v.glycemie),
    poids: nombre(v.poids), avpu: v.avpu, glasgow: nombre(v.glasgow), eva: nombre(v.eva),
    categorieManuelle: v.categorieManuelle
  }), [v])

  // Évaluation par l'API, à chaque modification stabilisée.
  useEffect(() => {
    if (!passage.data || Object.keys(erreurs).length) return
    const t = setTimeout(async () => {
      try {
        setEval(await api.post(`/api/passages/${id}/evaluer`, corps))
        setEvalErr(null)
      } catch (e) { setEvalErr(e.message) }
    }, 350)
    return () => clearTimeout(t)
  }, [corps, erreurs, id, passage.data])

  const valider = async () => {
    if (Object.keys(erreurs).length) { toast.erreur('Constantes hors plage', 'Corrigez les valeurs signalées.'); return }
    if (correction.active && (!correction.cat || !correction.motif.trim())) return
    setEnvoi(true)
    try {
      await api.post(`/api/passages/${id}/triage`, {
        constantes: corps,
        categorieRetenue: correction.active ? correction.cat : (eval_?.categorie ?? null),
        motifCorrection: correction.active ? correction.motif : null
      })
      toast.succes('Triage enregistré', correction.active ? 'Correction motivée journalisée.' : 'Catégorie validée et journalisée.')
      nav('/file')
    } catch (e) {
      toast.erreur('Enregistrement refusé', e.message)
    } finally { setEnvoi(false) }
  }

  const p = passage.data
  const d = eval_?.derives

  return (
    <>
      <PageHead kicker="Module triage · étape 2" title="Fiche de triage"
        actions={<Link className="btn btn-secondary" to="/file">Retour à la file</Link>} />

      <Etat loading={passage.loading} error={passage.error} onRetry={passage.recharger}>
        {p && (
          <>
            <p className="text-muted" style={{ marginTop: -8, marginBottom: 20 }}>
              {p?.patientNom} · {p?.patientAge} ans · {p?.motif} · arrivé par « {p?.modeEntree} ».
              Aucune valeur n’est imputée automatiquement : laissez vide ce qui n’a pas été mesuré.
            </p>

            <div className="grid g-side">
              <div className="stack">
                <Panel kicker="Constantes vitales" title="Mesures">
                  <div className="form-grid">
                    {CHAMPS.map((c) => (
                      <Field key={c} label={`${BORNES[c].label} (${BORNES[c].unite})`}
                        hint={`Plage acceptée : ${BORNES[c].min}–${BORNES[c].max}`} erreur={erreurs[c]}>
                        <input className={`input${erreurs[c] ? ' invalid' : ''}`} type="number"
                          min={BORNES[c].min} max={BORNES[c].max} step={BORNES[c].pas ?? 1}
                          value={v[c]} onChange={(e) => setV({ ...v, [c]: e.target.value })} />
                      </Field>
                    ))}
                  </div>
                </Panel>

                <Panel kicker="Conscience & douleur" title="Évaluation clinique">
                  <div className="form-grid">
                    <Field label="AVPU" hint="« Non évalué » est une valeur explicite">
                      <select className="input" value={v.avpu} onChange={(e) => setV({ ...v, avpu: e.target.value })}>
                        {AVPU.map((a) => <option key={a}>{a}</option>)}
                      </select>
                    </Field>
                    <Field label="Score de Glasgow" hint="Optionnel — 3 à 15" erreur={erreurs.glasgow}>
                      <input className={`input${erreurs.glasgow ? ' invalid' : ''}`} type="number" min="3" max="15"
                        value={v.glasgow} onChange={(e) => setV({ ...v, glasgow: e.target.value })} />
                    </Field>
                    <Field label="Douleur EVA (0–10)" erreur={erreurs.eva}>
                      <input className={`input${erreurs.eva ? ' invalid' : ''}`} type="number" min="0" max="10"
                        value={v.eva} onChange={(e) => setV({ ...v, eva: e.target.value })} />
                    </Field>
                    <Field label="Tri manuel (protocole local)" hint="Pour comparaison avec le modèle">
                      <CatSelect value={v.categorieManuelle} onChange={(c) => setV({ ...v, categorieManuelle: c })} />
                    </Field>
                  </div>
                </Panel>

                <Panel kicker="Calcul automatique" title="Scores dérivés">
                  {d ? (
                    <div className="grid g4">
                      <div className="kpi"><span className="label">Index de choc</span><span className="value" style={{ fontSize: 26 }}>{d.indexChoc ?? '—'}</span><span className="note">FC / PAS</span></div>
                      <div className="kpi"><span className="label">PAM</span><span className="value" style={{ fontSize: 26 }}>{d.pam ?? '—'}</span><span className="note">mmHg</span></div>
                      <div className="kpi"><span className="label">qSOFA</span><span className="value" style={{ fontSize: 26 }}>{d.qSofa}/{d.qSofaConnus}</span><span className="note">critères renseignés</span></div>
                      <div className="kpi"><span className="label">MEWS</span><span className="value" style={{ fontSize: 26 }}>{d.mews}</span><span className="note">alerte précoce</span></div>
                    </div>
                  ) : <Empty titre="En attente de mesures">Renseignez au moins une constante.</Empty>}
                </Panel>
              </div>

              <div className="stack">
                <Panel kicker={eval_ ? `Modèle ${eval_.modele}` : 'Modèle'} title="Priorité proposée"
                  ton={eval_?.categorie === 1 ? 'urgent' : eval_?.categorie === 2 ? 'attention' : undefined}>
                  {evalErr && <Alert level="crit" title="Évaluation indisponible">{evalErr}</Alert>}
                  {!eval_ && !evalErr && <Empty titre="Pas encore de proposition">Saisissez les constantes pour obtenir une catégorie.</Empty>}
                  {eval_ && (
                    <div className="stack-sm">
                      <div className="row" style={{ gap: 12 }}>
                        <CatBadge cat={eval_.categorie} />
                        <span className="text-muted" style={{ fontSize: 13 }}>
                          confiance {Math.round(eval_.confiance * 100)} %
                        </span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
                        {eval_.categorie} · {catLabel(eval_.categorie)}
                      </div>
                      <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                        Délai maximal d’attente : {catDelai(eval_.categorie) === 0 ? 'immédiat' : `${catDelai(eval_.categorie)} min`}.
                      </p>
                      {eval_.incertain && (
                        <Alert level="warn" title="À vérifier cliniquement">
                          Le modèle est peu sûr de cette prédiction. Votre jugement prime.
                        </Alert>
                      )}
                      {eval_.manquants?.length > 0 && (
                        <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                          Non renseigné : {eval_.manquants.join(', ')}. La confiance est réduite en conséquence.
                        </p>
                      )}
                    </div>
                  )}
                </Panel>

                {eval_?.contributions?.length > 0 && (
                  <Panel kicker="Explicabilité (XAI)" title="Pourquoi ce score">
                    <div className="stack-sm">
                      {eval_.contributions.map((c) => (
                        <div className="contrib" key={c.label}>
                          <span>{c.label}</span>
                          <span className="track">
                            <i className={c.poids >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.min(50, Math.abs(c.poids) * 25)}%` }} />
                          </span>
                          <span className="val">{c.poids > 0 ? '+' : ''}{c.poids}</span>
                        </div>
                      ))}
                      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                        Contributions au score total ({eval_.score}). Vers la droite : aggrave la priorité.
                        Vers la gauche : l’atténue.
                      </p>
                    </div>
                  </Panel>
                )}

                <Panel kicker="Décision infirmière" title="Validation">
                  <div className="stack-sm">
                    {v.categorieManuelle && eval_ && v.categorieManuelle !== eval_.categorie && (
                      <Alert level="info">
                        Votre tri manuel (catégorie {v.categorieManuelle}) diverge de la proposition du modèle
                        (catégorie {eval_.categorie}).
                      </Alert>
                    )}
                    <label className="check">
                      <input type="checkbox" checked={correction.active}
                        onChange={(e) => setCorrection({
                          ...correction, active: e.target.checked,
                          cat: e.target.checked ? (v.categorieManuelle ?? eval_?.categorie ?? null) : null
                        })} />
                      Corriger la catégorie proposée
                    </label>
                    {correction.active && (
                      <>
                        <Field label="Catégorie retenue">
                          <CatSelect value={correction.cat} onChange={(c) => setCorrection({ ...correction, cat: c })} />
                        </Field>
                        <Field label="Motif de la correction" hint="Obligatoire — alimente l’audit et le réentraînement">
                          <input className="input" value={correction.motif}
                            onChange={(e) => setCorrection({ ...correction, motif: e.target.value })}
                            placeholder="Douleur non contrôlée, contexte drépanocytaire…" />
                        </Field>
                      </>
                    )}
                    <button className="btn btn-primary btn-block" onClick={valider}
                      disabled={envoi || !eval_ || Object.keys(erreurs).length > 0
                        || (correction.active && (!correction.cat || !correction.motif.trim()))}>
                      {envoi ? <><span className="spinner" /> Enregistrement…</>
                        : correction.active ? 'Enregistrer la correction' : 'Valider la catégorie proposée'}
                    </button>
                    <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                      Horodaté, signé et journalisé côté serveur.
                    </p>
                  </div>
                </Panel>

                {p?.categorie && (
                  <Panel kicker="Historique" title="Triage précédent">
                    <div className="row"><CatBadge cat={p?.categorie} /></div>
                    {p?.correction && (
                      <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                        Corrigé de {p?.correction.ancienne} à {p?.correction.nouvelle} —
                        « {p?.correction.motif} » ({p?.correction.auteur})
                      </p>
                    )}
                  </Panel>
                )}
              </div>
            </div>
          </>
        )}
      </Etat>
    </>
  )
}
