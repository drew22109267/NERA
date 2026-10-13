import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, Etat, Empty, Alert, Bar } from '../components/ui.jsx'
import { SEV_PAR_NIVEAU, LIBELLE_TENSION, REF } from '../lib/referentiels.js'

export default function Admission() {
  const nav = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [choisi, setChoisi] = useState(null)
  const [f, setF] = useState({ modeEntree: REF.modesEntree[0], motif: '', motifLibre: '', serviceViseId: '' })
  const [envoi, setEnvoi] = useState(false)

  const motifs = useApi('/api/orientation/motifs')
  const services = useApi('/api/services', { hospitalisationSeule: true })
  const recherche = useApi('/api/patients', { q, pageSize: 6 }, { skip: q.trim().length < 2 })

  // Proposition d'orientation dès que le patient et le motif sont connus.
  const orientation = useApi('/api/orientation',
    choisi && f.motif ? {
      motif: f.motif, age: choisi.age, sexe: choisi.sexe,
      antecedents: (choisi.antecedents ?? []).join(',') || undefined
    } : null,
    { skip: !choisi || !f.motif })

  const propose = orientation.data?.propositions?.[0]

  const soumettre = async (e) => {
    e.preventDefault()
    if (!choisi || !f.motif) return
    setEnvoi(true)
    try {
      const p = await api.post('/api/passages', {
        patientId: choisi.id,
        modeEntree: f.modeEntree,
        motif: f.motif,
        motifLibre: f.motifLibre || null,
        serviceViseId: f.serviceViseId ? Number(f.serviceViseId) : (propose?.serviceId ?? null)
      })
      toast.succes('Arrivée enregistrée', `${p.reference} — passage au poste de triage.`)
      nav(`/triage/${p.id}`)
    } catch (e2) {
      toast.erreur('Enregistrement refusé', e2.message)
    } finally { setEnvoi(false) }
  }

  return (
    <>
      <PageHead kicker="Module triage · étape 1">
        Enregistrement d’arrivée en moins de deux minutes. Le service d’accueil est proposé
        automatiquement dès que le motif est connu, puis le passage bascule au poste de triage.
      </PageHead>

      <form className="grid g-side" onSubmit={soumettre}>
        <div className="stack">
          <Panel kicker="Identité" title="Patient">
            <Field label="Rechercher un dossier existant" hint="Nom, prénom, téléphone ou numéro de dossier">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone ou n° de dossier" />
            </Field>

            {q.trim().length >= 2 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Etat loading={recherche.loading} error={recherche.error} onRetry={recherche.recharger}
                  vide={!recherche.data?.items?.length}
                  videTitre="Aucun dossier trouvé"
                  videTexte="Créez-le depuis « Dossiers patients » avant d’enregistrer l’arrivée.">
                  <div className="stack-sm">
                    {recherche.data?.items?.map((p) => (
                      <button type="button" key={p.id}
                        className={`btn ${choisi?.id === p.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ justifyContent: 'flex-start' }}
                        onClick={() => setChoisi(p)}>
                        {p.nom} {p.prenom} — {p.age} ans · {p.reference}
                      </button>
                    ))}
                  </div>
                </Etat>
              </div>
            )}

            {choisi && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Alert level="info">
                  <strong>{choisi.nom} {choisi.prenom}</strong> · {choisi.age} ans ·
                  {choisi.sexe === 'F' ? ' Femme' : ' Homme'} · {choisi.modePaiement}
                  {choisi.antecedents?.length > 0 && (
                    <span style={{ display: 'block' }}>Antécédents : {choisi.antecedents.join(', ')}</span>
                  )}
                  {choisi.allergies && <span style={{ display: 'block' }}>Allergies : {choisi.allergies}</span>}
                </Alert>
              </div>
            )}
          </Panel>

          {choisi && f.motif && (
            <Panel kicker="Redistribution" title="Service d’accueil proposé">
              <Etat loading={orientation.loading} error={orientation.error} onRetry={orientation.recharger}
                vide={!orientation.data?.propositions?.length}
                videTitre="Aucun service compatible"
                videTexte="Un transfert externe est à envisager.">
                <>
                  <p className="text-muted" style={{ fontSize: 13.5 }}>{orientation.data?.explication}</p>
                  <div className="stack-sm">
                    {orientation.data?.propositions?.slice(0, 3).map((o) => (
                      <label key={o.serviceId} className="panel" style={{
                        padding: 12, cursor: 'pointer', display: 'block',
                        borderColor: String(f.serviceViseId || propose?.serviceId) === String(o.serviceId) ? 'var(--brand)' : 'var(--line)'
                      }}>
                        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                          <span className="check">
                            <input type="radio" name="svc"
                              checked={String(f.serviceViseId || propose?.serviceId) === String(o.serviceId)}
                              onChange={() => setF({ ...f, serviceViseId: String(o.serviceId) })} />
                            <strong>{o.nom}</strong>
                          </span>
                          <span className={`tag tag-${SEV_PAR_NIVEAU[o.niveau]}`}>{LIBELLE_TENSION[o.niveau]}</span>
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
          )}
        </div>

        <Panel kicker="Arrivée" title="Contexte du passage">
          <div className="stack-sm">
            <Field label="Mode d’entrée">
              <select className="input" value={f.modeEntree} onChange={(e) => setF({ ...f, modeEntree: e.target.value })}>
                {REF.modesEntree.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>

            <Etat loading={motifs.loading} error={motifs.error} onRetry={motifs.recharger}>
              <Field label="Motif de recours *">
                <select className="input" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value, serviceViseId: '' })} required>
                  <option value="">Choisir un motif…</option>
                  {(motifs.data ?? []).map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </Etat>

            <Field label="Motif déclaré par le patient" hint="Texte libre court, dans ses mots">
              <input className="input" value={f.motifLibre} onChange={(e) => setF({ ...f, motifLibre: e.target.value })}
                placeholder="« douleur au ventre depuis hier soir »" />
            </Field>

            <Field label="Service visé" hint="Pré-rempli par la proposition d’orientation">
              <select className="input" value={f.serviceViseId || propose?.serviceId || ''}
                onChange={(e) => setF({ ...f, serviceViseId: e.target.value })}>
                <option value="">À déterminer au triage</option>
                {(services.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.nom} — {s.libres} lit(s) libre(s)</option>
                ))}
              </select>
            </Field>

            <button className="btn btn-primary btn-block" type="submit" disabled={!choisi || !f.motif || envoi}>
              {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer et passer au triage'}
            </button>
            {!choisi && <Empty>Sélectionnez d’abord un dossier patient.</Empty>}
          </div>
        </Panel>
      </form>
    </>
  )
}
