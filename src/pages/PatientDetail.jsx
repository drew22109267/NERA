import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { Confirm } from '../components/Modal.jsx'
import { PageHead, Panel, CatBadge, Etat, Empty, Bar, Alert, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { dateFr, dateHeureFr, ilYa, initiales, REF } from '../lib/referentiels.js'

const Info = ({ icon, k, v }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <span style={{
      width: 32, height: 32, borderRadius: 5, flex: 'none', display: 'grid', placeItems: 'center',
      background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--muted)'
    }}><Icon name={icon} /></span>
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-2)' }}>{k}</span>
      <span style={{ display: 'block', fontWeight: 600, wordBreak: 'break-word' }}>{v || '—'}</span>
    </span>
  </div>
)

const ko = (o) => (o > 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.round(o / 1024)} ko`)

export default function PatientDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const fichier = useRef(null)
  const [categorie, setCategorie] = useState(REF.categoriesPiece[0])
  const [envoi, setEnvoi] = useState(false)
  const [confirmer, setConfirmer] = useState(false)

  const patient = useApi(`/api/patients/${id}`)
  const passages = useApi('/api/passages', { q: '', pageSize: 50 })
  const sejours = useApi('/api/sejours', null, { skip: user.role === 'patient' })
  const rdv = useApi('/api/rendezvous')
  const pieces = useApi(`/api/pieces-jointes/patient/${id}`)

  const p = patient.data
  const mesPassages = (passages.data?.items ?? []).filter((x) => String(x.patientId) === String(id))
  const tblPassages = useTableau(mesPassages, ['reference', 'motif', 'statut'])
  const mesSejours = (sejours.data ?? []).filter((x) => String(x.patientId) === String(id))
  const mesRdv = (rdv.data ?? []).filter((x) => String(x.patientId) === String(id))
  const dernier = mesPassages.find((x) => x.triage)

  const deposer = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setEnvoi(true)
    try {
      const fd = new FormData()
      fd.append('fichier', f)
      fd.append('patientId', id)
      fd.append('categorie', categorie)
      await api.upload('/api/pieces-jointes', fd)
      toast.succes('Pièce jointe déposée', f.name)
      pieces.recharger()
    } catch (e2) {
      toast.erreur('Dépôt refusé', e2.message)
    } finally {
      setEnvoi(false)
      if (fichier.current) fichier.current.value = ''
    }
  }

  const anonymiser = async () => {
    try {
      await api.del(`/api/patients/${id}`)
      toast.succes('Dossier anonymisé', 'Les données nominatives ont été effacées.')
      patient.recharger()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  return (
    <>
      <PageHead kicker={p ? `Dossier ${p?.reference}` : 'Dossier patient'}
        title={p ? `${p?.nom} ${p?.prenom}` : 'Chargement…'}
        actions={
          <>
            {user.role !== 'patient' && <Link className="btn btn-secondary" to="/patients">Retour</Link>}
            {(user.role === 'patient' || user.role === 'admin') && p && (
              <button className="btn btn-secondary" onClick={() => setConfirmer(true)}>Effacer mes données</button>
            )}
          </>
        }>
        {p && `${p?.age} ans · ${p?.sexe === 'F' ? 'Femme' : 'Homme'} · ${[p?.quartier, p?.arrondissement].filter(Boolean).join(', ') || 'résidence non renseignée'}`}
      </PageHead>

      <Etat loading={patient.loading} error={patient.error} onRetry={patient.recharger}>
        {p && (
          <div className="grid g-side">
            <div className="stack">
              <Panel title="Informations patient">
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 110, height: 124, borderRadius: 6, background: 'var(--brand-soft)',
                      color: 'var(--brand-ink)', display: 'grid', placeItems: 'center',
                      fontSize: 32, fontWeight: 700
                    }}>{initiales(`${p?.prenom} ${p?.nom}`)}</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{p?.prenom} {p?.nom}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{p?.reference}</div>
                  </div>
                  <div className="grid g2" style={{ gap: 'var(--space-4)' }}>
                    <Info icon="user" k="Sexe" v={p?.sexe === 'F' ? 'Femme' : 'Homme'} />
                    <Info icon="phone" k="Téléphone" v={p?.telephone} />
                    <Info icon="calendar" k="Âge" v={`${p?.age} ans`} />
                    <Info icon="mail" k="Adresse électronique" v={p?.email} />
                    <Info icon="pin" k="Résidence" v={[p?.quartier, p?.arrondissement, p?.milieu].filter(Boolean).join(' · ')} />
                    <Info icon="clipboard" k="Mode de paiement" v={p?.modePaiement} />
                    <Info icon="shield" k="Contact d’urgence" v={p?.contactUrgence} />
                    <Info icon="alert" k="Allergies" v={p?.allergies} />
                  </div>
                </div>
                {!p?.consentement && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <Alert level="warn" title="Consentement non recueilli">
                      Le traitement des données de santé de ce patient n’a pas été explicitement accepté.
                    </Alert>
                  </div>
                )}
              </Panel>

              <Panel title="Antécédents">
                {!p?.antecedents?.length
                  ? <Empty titre="Aucun antécédent connu">Renseignés à la création du dossier ou au triage.</Empty>
                  : (
                    <div className="grid g3">
                      {p?.antecedents.map((a) => (
                        <div key={a} style={{ display: 'flex', gap: 10 }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: 5, flex: 'none', display: 'grid', placeItems: 'center',
                            background: 'var(--brand-soft)', color: 'var(--brand-ink)'
                          }}><Icon name="heart" /></span>
                          <span>
                            <strong style={{ display: 'block', fontSize: 14 }}>{a}</strong>
                            <span className="text-muted" style={{ fontSize: 12.5 }}>Signalé au triage.</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </Panel>

              <Panel title="Historique des passages">
                <RechercheTableau valeur={tblPassages.q} onChange={tblPassages.setQ}
                  placeholder="Rechercher un passage, un motif, un statut…"
                  total={tblPassages.total} libelle="passage" />
                <Etat loading={passages.loading} error={passages.error} onRetry={passages.recharger}
                  vide={!tblPassages.total} videTitre="Aucun passage enregistré"
                  videTexte="Les passages apparaîtront après un premier enregistrement d’arrivée.">
                  <>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Passage</th><th>Arrivée</th><th>Motif</th><th>Catégorie</th><th>Statut</th><th /></tr></thead>
                      <tbody>
                        {tblPassages.visibles.map((x) => (
                          <tr key={x.id}>
                            <td>{x.reference}</td>
                            <td>{dateHeureFr(x.arrivee)}<span className="sub">{ilYa(x.arrivee)}</span></td>
                            <td>{x.motif}</td>
                            <td><CatBadge cat={x.categorie} /></td>
                            <td>{x.statut}</td>
                            <td>
                              {user.role !== 'patient' && (
                                <Link className="btn btn-ghost" to={x.triage ? `/decision/${x.id}` : `/triage/${x.id}`}>
                                  {x.triage ? 'Décision' : 'Trier'}
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager page={tblPassages.page} pages={tblPassages.pages} total={tblPassages.total}
                    pageSize={tblPassages.parPage} onPage={tblPassages.setPage} />
                  </>
                </Etat>
              </Panel>

              <Panel title="Pièces jointes"
                kicker="Photo de plaie, résultat de laboratoire, imagerie"
                actions={user.role !== 'patient' && (
                  <div className="row">
                    <select className="input" style={{ minHeight: 36, width: 'auto' }}
                      value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                      {REF.categoriesPiece.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button className="btn btn-secondary btn-sm" disabled={envoi}
                      onClick={() => fichier.current?.click()}>
                      {envoi ? <><span className="spinner" /> Envoi…</> : 'Ajouter'}
                    </button>
                    <input ref={fichier} type="file" hidden accept="image/*,application/pdf" onChange={deposer} />
                  </div>
                )}>
                <Etat loading={pieces.loading} error={pieces.error} onRetry={pieces.recharger}
                  vide={!pieces.data?.length} videTitre="Aucune pièce jointe"
                  videTexte="Formats acceptés : JPEG, PNG, WebP, PDF — 12 Mo maximum.">
                  <div className="stack-sm">
                    {pieces.data?.map((pj) => (
                      <div key={pj.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                        <span className="row" style={{ gap: 10, minWidth: 0 }}>
                          <Icon name="file" style={{ color: 'var(--muted-2)' }} />
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: 13.5 }}>{pj.nomFichier}</strong>
                            <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                              {pj.categorie} · {ko(pj.taille)} · {dateFr(pj.deposeLe)}
                            </span>
                          </span>
                        </span>
                        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer"
                          href={api.fichierUrl(`/api/pieces-jointes/${pj.id}/contenu`)}>Ouvrir</a>
                      </div>
                    ))}
                  </div>
                </Etat>
              </Panel>
            </div>

            <div className="stack">
              <Panel title="Constantes du dernier triage">
                {!dernier?.triage
                  ? <Empty titre="Aucune constante enregistrée">Elles apparaîtront après le premier triage.</Empty>
                  : (
                    <div className="stack-sm">
                      {[['Fréquence cardiaque', dernier.triage.fc, 250, '/min'],
                        ['Fréquence respiratoire', dernier.triage.fr, 80, '/min'],
                        ['SpO₂', dernier.triage.spo2, 100, ' %'],
                        ['Température', dernier.triage.temperature, 45, ' °C'],
                        ['PA systolique', dernier.triage.pas, 300, ' mmHg']].map(([k, val, max, u]) => (
                        <div key={k}>
                          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                            <span>{k}</span>
                            <strong>{val ?? 'non mesuré'}{val != null ? u : ''}</strong>
                          </div>
                          <Bar value={Number(val) || 0} max={max}
                            sev={k === 'SpO₂' && val != null && Number(val) < 94 ? 'sev-1' : undefined} />
                        </div>
                      ))}
                      <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
                        Relevé du {dateHeureFr(dernier.arrivee)} · passage {dernier.reference}.
                      </p>
                    </div>
                  )}
              </Panel>

              <Panel title="Rendez-vous">
                <Etat loading={rdv.loading} error={rdv.error} onRetry={rdv.recharger}
                  vide={!mesRdv.length} videTitre="Aucun rendez-vous">
                  <div>
                    {mesRdv.map((r, i) => (
                      <div className={`timeline-item${i === 0 ? ' now' : ''}`} key={r.id}>
                        <span className="mark"><i /><span /></span>
                        <span className="body">
                          <strong>{r.motif}</strong>
                          <span>{dateFr(r.date)} · {r.heure} — {r.serviceNom}</span><br />
                          <span className="tag tag-neutral">{r.statut}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </Etat>
              </Panel>

              {user.role !== 'patient' && (
                <Panel title="Séjours">
                  <Etat loading={sejours.loading} error={sejours.error} onRetry={sejours.recharger}
                    vide={!mesSejours.length} videTitre="Aucun séjour en cours">
                    <div className="stack-sm">
                      {mesSejours.map((s) => (
                        <div key={s.id} className="row" style={{ gap: 10 }}>
                          <span style={{
                            width: 34, height: 34, borderRadius: 5, flex: 'none', display: 'grid', placeItems: 'center',
                            background: 'var(--viz-1-soft)', color: '#12609c'
                          }}><Icon name="bed" /></span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: 14 }}>{s.serviceNom}{s.lit ? ` · ${s.lit}` : ''}</strong>
                            <span className="text-muted" style={{ fontSize: 12.5 }}>
                              Depuis le {dateFr(s.entree)} · {s.jours} jour(s)
                            </span>
                          </span>
                          {s.motifBlocage && <span className="tag tag-error">{s.motifBlocage}</span>}
                        </div>
                      ))}
                    </div>
                  </Etat>
                </Panel>
              )}
            </div>
          </div>
        )}
      </Etat>

      {confirmer && (
        <Confirm titre="Effacer les données nominatives" danger confirmer="Effacer définitivement"
          message="Le nom, les coordonnées et les antécédents seront remplacés par une référence anonyme. L'historique de soins reste conservé pour la continuité des soins et la traçabilité réglementaire. Cette action est irréversible."
          onConfirm={anonymiser} onClose={() => setConfirmer(false)} />
      )}
    </>
  )
}
