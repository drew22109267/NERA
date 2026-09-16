import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, CatBadge, Etat, Alert, Bar, Empty } from '../components/ui.jsx'
import { ACTIONS_DECISION, minutes, catLabel, SEV_PAR_NIVEAU, LIBELLE_TENSION } from '../lib/referentiels.js'

export default function Decision() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()

  const passage = useApi(`/api/passages/${id}`)
  const p = passage.data
  const services = useApi('/api/services', { hospitalisationSeule: true })

  const orientation = useApi('/api/orientation',
    p ? { motif: p?.motif, age: p?.patientAge, sexe: p?.patientSexe, categorie: p?.categorie ?? undefined } : null,
    { skip: !p })

  const prevision = useApi(p?.serviceViseId ? `/api/services/${p?.serviceViseId}/prevision` : null,
    { horizon: 7 }, { skip: !p?.serviceViseId })

  const [choix, setChoix] = useState('')
  const [motif, setMotif] = useState('')
  const [serviceCible, setServiceCible] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const propose = orientation.data?.propositions?.[0]
  const cible = (services.data ?? []).find((s) => String(s.id) === String(serviceCible || propose?.serviceId || p?.serviceViseId))
  const libres = cible?.libres ?? 0
  const risque = prevision.data?.risques?.[3] ?? prevision.data?.risques?.[7] ?? null

  // Recommandation : urgence clinique × disponibilité réelle × prévision.
  const recommandation = (() => {
    if (!p?.categorie) return ACTIONS_DECISION[0]
    if (libres > 0 && p?.categorie <= 2) return ACTIONS_DECISION[0]
    if (libres > 0 && (risque === null || risque < 0.6)) return ACTIONS_DECISION[0]
    if (libres <= 0 && p?.categorie <= 2) return (risque ?? 0) > 0.8 ? ACTIONS_DECISION[2] : ACTIONS_DECISION[1]
    if (libres <= 0) return ACTIONS_DECISION[3]
    return ACTIONS_DECISION[1]
  })()

  const action = choix || recommandation
  const divergence = action !== recommandation

  const valider = async () => {
    if (divergence && !motif.trim()) return
    setEnvoi(true)
    try {
      await api.post(`/api/passages/${id}/decision`, {
        action,
        serviceId: serviceCible ? Number(serviceCible) : (propose?.serviceId ?? p?.serviceViseId ?? null),
        motif: motif || null,
        recommandation
      })
      if (action === ACTIONS_DECISION[2] || action === ACTIONS_DECISION[3]) {
        await api.post('/api/demandes', {
          serviceId: Number(serviceCible) || propose?.serviceId || p?.serviceViseId,
          patientId: p?.patientId,
          motif: libres <= 0 ? 'Aucun lit disponible' : (motif || 'Report décidé par le clinicien'),
          gravite: p?.categorie <= 2 ? 'Sévère' : p?.categorie === 3 ? 'Modéré' : 'Léger',
          devenir: action === ACTIONS_DECISION[2] ? 'Transféré (autre hôpital)' : 'Admis plus tard'
        }).catch(() => { /* la décision est déjà enregistrée */ })
        toast.info('Demande non satisfaite enregistrée', 'Elle alimente le registre de la demande réelle.')
      }
      toast.succes('Décision enregistrée', action)
      nav('/file')
    } catch (e) {
      toast.erreur('Décision refusée', e.message)
    } finally { setEnvoi(false) }
  }

  return (
    <>
      <PageHead kicker="Module décision & orchestration" title="Décision patient"
        actions={<Link className="btn btn-secondary" to="/file">Retour à la file</Link>} />

      <Etat loading={passage.loading} error={passage.error} onRetry={passage.recharger}>
        {p && !p?.triage && (
          <Alert level="warn" title="Triage manquant">
            Ce passage n’a pas encore de fiche de triage.{' '}
            <Link to={`/triage/${p?.id}`}>Compléter le triage</Link>.
          </Alert>
        )}

        {p && p?.triage && (
          <>
            <p className="text-muted" style={{ marginTop: -8, marginBottom: 20 }}>
              {p?.patientNom} · {p?.patientAge} ans · en attente depuis {minutes(p?.attenteMinutes)}.
            </p>

            <div className="grid g-side">
              <div className="stack">
                <Panel kicker="Triage" title={`Catégorie ${p?.categorie} · ${catLabel(p?.categorie)}`}
                  ton={p?.categorie === 1 ? 'urgent' : p?.categorie === 2 ? 'attention' : undefined}>
                  <div className="row" style={{ marginBottom: 12 }}><CatBadge cat={p?.categorie} /></div>
                  {p?.correction && (
                    <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                      Catégorie corrigée par {p?.correction.auteur} : « {p?.correction.motif} »
                    </p>
                  )}
                  <div className="grid g4" style={{ marginTop: 14, gap: 12 }}>
                    {[['PAS', p?.triage.pas, 'mmHg'], ['FC', p?.triage.fc, '/min'], ['FR', p?.triage.fr, '/min'], ['SpO₂', p?.triage.spo2, '%']].map(([k, val, u]) => (
                      <div className="kpi" key={k}>
                        <span className="label">{k}</span>
                        <span className="value" style={{ fontSize: 24 }}>
                          {val ?? '—'}{val != null && <small> {u}</small>}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel kicker="Redistribution" title="Services compatibles">
                  <Etat loading={orientation.loading} error={orientation.error} onRetry={orientation.recharger}
                    vide={!orientation.data?.propositions?.length}
                    videTitre="Aucun service compatible"
                    videTexte="Un transfert vers un autre établissement est à envisager.">
                    <>
                      <p className="text-muted" style={{ fontSize: 13.5 }}>{orientation.data?.explication}</p>
                      {orientation.data?.avertissement && (
                        <Alert level="warn" title="Attention">{orientation.data?.avertissement}</Alert>
                      )}
                      <div className="stack-sm" style={{ marginTop: 12 }}>
                        {orientation.data?.propositions?.map((o) => (
                          <label key={o.serviceId} className="panel" style={{
                            padding: 12, cursor: 'pointer', display: 'block',
                            borderColor: String(serviceCible || propose?.serviceId) === String(o.serviceId) ? 'var(--brand)' : 'var(--line)'
                          }}>
                            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                              <span className="check">
                                <input type="radio" name="cible" checked={String(serviceCible || propose?.serviceId) === String(o.serviceId)}
                                  onChange={() => setServiceCible(String(o.serviceId))} />
                                <strong>{o.nom}</strong>
                              </span>
                              <span className="row" style={{ gap: 6 }}>
                                {o.recommande && <span className="tag tag-brand">Recommandé</span>}
                                <span className={`tag tag-${SEV_PAR_NIVEAU[o.niveau]}`}>{LIBELLE_TENSION[o.niveau]}</span>
                              </span>
                            </div>
                            <div className="text-muted" style={{ fontSize: 12.5, margin: '6px 0 8px' }}>
                              {o.litsLibres} lit(s) libre(s) sur {o.litsArmes} · {o.raisons[0]}
                            </div>
                            <Bar value={o.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[o.niveau]} />
                          </label>
                        ))}
                      </div>
                    </>
                  </Etat>
                </Panel>
              </div>

              <div className="stack">
                <Panel kicker="Recommandation du moteur" title={recommandation}
                  ton={libres <= 0 ? 'attention' : undefined}>
                  <p className="text-muted" style={{ fontSize: 13.5 }}>
                    Combinaison de l’urgence clinique (catégorie {p?.categorie}), de la disponibilité
                    actuelle ({libres} lit(s) dans {cible?.nom ?? 'le service visé'})
                    {risque !== null && ` et du risque de saturation à court terme (${Math.round(risque * 100)} %)`}.
                  </p>
                  <Alert level="info">Recommandation indicative. Le médecin choisit toujours l’action finale.</Alert>
                </Panel>

                <Panel kicker="Action" title="Décision du médecin">
                  <div className="stack-sm">
                    <Field label="Action retenue">
                      <select className="input" value={action} onChange={(e) => setChoix(e.target.value)}>
                        {ACTIONS_DECISION.map((a) => (
                          <option key={a} value={a}>{a}{a === recommandation ? ' — recommandé' : ''}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Service de destination">
                      <select className="input" value={serviceCible || propose?.serviceId || p?.serviceViseId || ''}
                        onChange={(e) => setServiceCible(e.target.value)}>
                        <option value="">—</option>
                        {(services.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>{s.nom} — {s.libres} lit(s) libre(s)</option>
                        ))}
                      </select>
                    </Field>
                    {divergence && (
                      <Field label="Motif de divergence" hint="Obligatoire — audit d’équité et amélioration du modèle">
                        <input className="input" value={motif} onChange={(e) => setMotif(e.target.value)}
                          placeholder="Contexte social, comorbidité, refus du patient…" />
                      </Field>
                    )}
                    <button className="btn btn-primary btn-block" onClick={valider}
                      disabled={envoi || (divergence && !motif.trim())}>
                      {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer la décision'}
                    </button>
                    <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                      Un refus ou un différé faute de lit alimente automatiquement le registre des
                      demandes non satisfaites.
                    </p>
                  </div>
                </Panel>
              </div>
            </div>
          </>
        )}
      </Etat>
    </>
  )
}
