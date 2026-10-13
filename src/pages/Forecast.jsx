import { useState } from 'react'
import { useApi } from '../api/hooks.js'
import { PageHead, Panel, Field, Kpi, Etat, Alert, Empty } from '../components/ui.jsx'
import ForecastChart from '../components/ForecastChart.jsx'

const HORIZONS = [7, 14, 30, 60]

export default function Forecast() {
  const services = useApi('/api/services', { hospitalisationSeule: true })
  const parametres = useApi('/api/parametres')

  const [serviceId, setServiceId] = useState('')
  const [horizon, setHorizon] = useState(30)
  const [sim, setSim] = useState({ hausseAdmissions: 0, reductionBlocage: 0, litsSupp: 0 })

  const choisi = serviceId || services.data?.[0]?.id || ''
  const actif = sim.hausseAdmissions !== 0 || sim.reductionBlocage !== 0 || sim.litsSupp !== 0

  const base = useApi(choisi ? `/api/services/${choisi}/prevision` : null, { horizon }, { skip: !choisi })
  const simule = useApi(choisi ? `/api/services/${choisi}/prevision` : null,
    { horizon, ...sim }, { skip: !choisi || !actif })

  const p = actif ? (simule.data ?? base.data) : base.data
  const service = (services.data ?? []).find((s) => String(s.id) === String(choisi))
  const param = (cle, defaut) => Number(parametres.data?.find((x) => x.cle === cle)?.valeur ?? defaut)
  const seuilOcc = param('seuil.occupation', 85)
  const seuilBas = param('seuil.occupation.bas', 75)
  const horizonAlerte = param('seuil.horizonJours', 3)

  // Sans modèle branché, l'API ne renvoie ni courbe ni risque : rien n'est affiché à leur place.
  const disponible = !!base.data?.disponible
  const risqueAlerte = p?.risques?.[horizonAlerte] ?? p?.risques?.[7] ?? null
  const alerte = disponible && risqueAlerte !== null && risqueAlerte * 100 > (100 - seuilOcc)
  const totalDecomp = (p?.decomposition ?? []).reduce((a, d) => a + d.valeur, 0) || 1

  return (
    <>
      <PageHead kicker="Module prévision">
        Médiane et intervalle à 90 % renvoyés par le modèle de prévision de l’API. Tant qu’aucun modèle
        validé n’est branché, aucune courbe n’est affichée ; le simulateur apparaît avec le modèle.
      </PageHead>

      <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
        vide={!services.data?.length} videTitre="Aucun service paramétré"
        videTexte="Renseignez les capacités depuis l’écran Administration avant de prévoir.">
        <>
          <div className="toolbar">
            <Field label="Service">
              <select className="input" value={choisi} onChange={(e) => setServiceId(e.target.value)}>
                {services.data?.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </Field>
            <Field label="Horizon">
              <select className="input" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {HORIZONS.map((h) => <option key={h} value={h}>{h} jours</option>)}
              </select>
            </Field>
            {actif && (
              <button className="btn btn-secondary"
                onClick={() => setSim({ hausseAdmissions: 0, reductionBlocage: 0, litsSupp: 0 })}>
                Revenir au scénario de référence
              </button>
            )}
          </div>

          {alerte && service && (
            <div className="section">
              <Alert level="warn" title={`Alerte capacité — ${service.nom}`}>
                Le risque de dépassement à J+{horizonAlerte} franchit le seuil paramétré ({seuilOcc} %).
                Leviers disponibles : accélérer les sorties, lever les lits bloqués pour motif non médical,
                différer des admissions programmées non urgentes, ouvrir une unité, transférer vers un partenaire.
                Règle d’hystérésis : aucune fermeture d’unité n’est proposée avant retour sous {seuilBas} %.
              </Alert>
            </div>
          )}

          <div className="grid g-side section">
            <Panel kicker={`Prévision · ${service?.nom ?? ''}`} title={`Occupation à ${horizon} jours`}>
              <Etat loading={base.loading} error={base.error} onRetry={base.recharger}
                vide={!p?.points?.length} videTitre="Prévision indisponible"
                videTexte={p?.raison ?? 'Aucun modèle de prévision n’est branché.'}>
                <>
                  <ForecastChart points={p?.points} capacite={p?.capacite} />
                  <div className="legend" style={{ marginTop: 12 }}>
                    <span><i style={{ background: 'var(--viz-3)' }} />Médiane prévue</span>
                    <span><i style={{ background: 'var(--viz-3)', opacity: .3 }} />Intervalle à 90 %</span>
                    <span><i style={{ background: 'var(--sev-1)' }} />Capacité armée</span>
                  </div>
                  <div className="grid g4" style={{ marginTop: 'var(--space-4)' }}>
                    {Object.entries(p?.risques ?? {}).map(([j, r]) => (
                      <Kpi key={j} label={`Saturation J+${j}`} value={Math.round(r * 100)} unit="%"
                        note={actif && base.data?.risques?.[j] !== undefined
                          ? `sans action : ${Math.round(base.data?.risques[j] * 100)} %`
                          : undefined} />
                    ))}
                  </div>
                  <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
                    Modèle actif : {p?.modele}.
                  </p>
                </>
              </Etat>
            </Panel>

            <div className="stack">
              <Panel kicker="Décomposition explicable" title="D’où vient la charge">
                {!p?.decomposition?.length
                  ? <Empty titre="Aucune charge à décomposer" />
                  : (
                    <div className="stack-sm">
                      {p?.decomposition.map((d) => (
                        <div key={d.label}>
                          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                            <span>{d.label}</span><strong>{d.valeur}</strong>
                          </div>
                          <div className="bar"><span style={{ width: `${(d.valeur / totalDecomp) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
              </Panel>

              {disponible && (
              <Panel kicker="Simulateur « et si »" title="Scénario alternatif">
                <div className="stack-sm">
                  <Field label={`Variation des admissions : ${sim.hausseAdmissions > 0 ? '+' : ''}${sim.hausseAdmissions} %`}>
                    <input type="range" min="-30" max="60" step="5" value={sim.hausseAdmissions}
                      onChange={(e) => setSim({ ...sim, hausseAdmissions: Number(e.target.value) })} />
                  </Field>
                  <Field label={`Réduction du blocage de lits : ${sim.reductionBlocage} %`}
                    hint={service?.bloques ? `${service.bloques} lit(s) actuellement bloqué(s)` : undefined}>
                    <input type="range" min="0" max="100" step="10" value={sim.reductionBlocage}
                      onChange={(e) => setSim({ ...sim, reductionBlocage: Number(e.target.value) })} />
                  </Field>
                  <Field label={`Lits supplémentaires ouverts : ${sim.litsSupp}`}
                    hint={service ? `${service.litsInstalles - service.litsArmes} lit(s) installé(s) mais non armé(s)` : undefined}>
                    <input type="range" min="0" max="20" step="1" value={sim.litsSupp}
                      onChange={(e) => setSim({ ...sim, litsSupp: Number(e.target.value) })} />
                  </Field>
                  {actif && simule.loading && <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>Recalcul…</p>}
                  <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                    Le scénario n’écrit rien en base : il sert à comparer deux trajectoires avant décision.
                  </p>
                </div>
              </Panel>
              )}
            </div>
          </div>
        </>
      </Etat>
    </>
  )
}
