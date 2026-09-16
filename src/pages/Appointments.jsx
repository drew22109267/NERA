import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, Etat, Empty, Alert, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { dateFr } from '../lib/referentiels.js'

const ONGLETS = [['rdv', 'Consultations'], ['bloc', 'Bloc opératoire'], ['suivi', 'Relances']]
const PERTE = ['Léger', 'Modéré', 'Sévère']
const SALLES = ['Salle 1', 'Salle 2', 'Salle 3', 'Salle septique']
const aujourdhui = () => new Date().toISOString().slice(0, 10)

export default function Appointments() {
  const { user } = useAuth()
  const toast = useToast()
  const estPatient = user.role === 'patient'
  const [onglet, setOnglet] = useState('rdv')

  const services = useApi('/api/services')
  const rdv = useApi('/api/rendezvous')

  const [f, setF] = useState({ patientId: '', serviceId: '', date: '', heure: '', motif: '' })
  const [c, setC] = useState({
    patientId: '', serviceId: '', date: '', heure: '08:00', motif: '', dureeMinutes: 60,
    litAvalServiceId: '', dureeSejourJours: 3, perteDeChance: 'Modéré', salleBloc: SALLES[0]
  })
  const [envoi, setEnvoi] = useState(false)

  const patients = useApi('/api/patients', { pageSize: 100 }, { skip: estPatient })
  const creneaux = useApi('/api/rendezvous/creneaux',
    f.serviceId && f.date ? { serviceId: f.serviceId, date: f.date } : null,
    { skip: !f.serviceId || !f.date })
  const creneauxBloc = useApi('/api/rendezvous/creneaux',
    c.litAvalServiceId && c.date ? { serviceId: c.litAvalServiceId, date: c.date } : null,
    { skip: !c.litAvalServiceId || !c.date })

  const creerRdv = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const r = await api.post('/api/rendezvous', {
        patientId: estPatient ? 0 : Number(f.patientId),
        serviceId: Number(f.serviceId), date: f.date, heure: f.heure, motif: f.motif
      })
      toast.succes('Rendez-vous créé', `${r.reference} — ${dateFr(r.date)} à ${r.heure}. Rappel SMS programmé.`)
      setF({ ...f, date: '', heure: '', motif: '' })
      rdv.recharger()
    } catch (e2) { toast.erreur('Création refusée', e2.message) } finally { setEnvoi(false) }
  }

  const creerBloc = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const r = await api.post('/api/rendezvous', {
        patientId: Number(c.patientId), serviceId: Number(c.serviceId), date: c.date, heure: c.heure,
        motif: c.motif, estChirurgie: true, dureeMinutes: Number(c.dureeMinutes),
        litAvalServiceId: c.litAvalServiceId ? Number(c.litAvalServiceId) : null,
        dureeSejourJours: Number(c.dureeSejourJours), perteDeChance: c.perteDeChance, salleBloc: c.salleBloc
      })
      toast.succes('Intervention inscrite au carnet opératoire', r.reference)
      setC({ ...c, date: '', motif: '' })
      rdv.recharger()
    } catch (e2) { toast.erreur('Programmation refusée', e2.message) } finally { setEnvoi(false) }
  }

  const changerStatut = async (r, statut) => {
    try {
      await api.post(`/api/rendezvous/${r.id}/statut`, { statut })
      toast.succes('Rendez-vous mis à jour', `${r.reference} → ${statut}`)
      rdv.recharger()
    } catch (e) { toast.erreur('Modification refusée', e.message) }
  }

  const tous = rdv.data ?? []
  const tbl = useTableau(tous, ['motif', 'statut',
    (r) => r.patientNom, (r) => r.serviceNom, (r) => r.date])
  const manques = tous.filter((r) => r.statut === 'Manqué')
  const demandes = tous.filter((r) => r.statut === 'Demandé')
  const bloc = tous.filter((r) => r.estChirurgie)
  const onglets = estPatient ? [ONGLETS[0]] : ONGLETS

  return (
    <>
      <PageHead kicker={estPatient ? 'Mes rendez-vous' : 'Module rendez-vous & programmation'}>
        {estPatient
          ? 'Demandez un créneau et suivez vos rendez-vous. Une demande est confirmée par le service après vérification.'
          : 'Les créneaux affichent le risque de saturation du service d’aval à la date choisie. Rappels SMS à J-2 et J-0 ; annulation par SMS (« ANNULER » / « REPORTER »).'}
      </PageHead>

      {!estPatient && demandes.length > 0 && (
        <div className="section">
          <Alert level="info" title="Demandes patients en attente">
            {demandes.length} demande(s) déposée(s) depuis l’espace patient, à confirmer ou refuser.
          </Alert>
        </div>
      )}

      {onglets.length > 1 && (
        <div className="seg" style={{ marginBottom: 'var(--space-4)' }}>
          {onglets.map(([k, label]) => (
            <label className="seg-opt" key={k}>
              <input type="radio" name="onglet" checked={onglet === k} onChange={() => setOnglet(k)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {onglet === 'rdv' && (
        <div className="grid g-side">
          <Panel kicker="Agenda" title={estPatient ? 'Mes rendez-vous' : 'Rendez-vous à venir'}
            actions={<button className="btn btn-secondary btn-sm" onClick={rdv.recharger}>Rafraîchir</button>}>
            <RechercheTableau valeur={tbl.q} onChange={tbl.setQ}
              placeholder="Rechercher un patient, un service, un motif…"
              total={tbl.total} libelle="rendez-vous" />
            <Etat loading={rdv.loading} error={rdv.error} onRetry={rdv.recharger}
              vide={!tbl.total} videTitre="Aucun rendez-vous"
              videTexte="Créez le premier créneau dans le panneau de droite.">
              <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th>{!estPatient && <th>Patient</th>}<th>Service</th><th>Motif</th><th>Statut</th><th /></tr>
                  </thead>
                  <tbody>
                    {tbl.visibles.map((r) => (
                      <tr key={r.id}>
                        <td>{dateFr(r.date)}<span className="sub">{r.heure} · {r.rappel ?? 'sans rappel'}</span></td>
                        {!estPatient && <td>{r.patientNom}<span className="sub">{r.patientTel ?? '—'}</span></td>}
                        <td>{r.serviceNom}</td>
                        <td>
                          {r.motif}
                          {r.estChirurgie && (
                            <span className="sub">
                              Bloc {r.salleBloc ?? ''} · {r.dureeMinutes} min · séjour {r.dureeSejourJours} j
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`tag ${r.statut === 'Manqué' ? 'tag-error'
                            : r.statut === 'Demandé' ? 'tag-blue'
                              : r.statut === 'Honoré' ? 'tag-sev-4' : 'tag-neutral'}`}>{r.statut}</span>
                        </td>
                        <td>
                          <div className="row">
                            {estPatient
                              ? r.statut !== 'Annulé' && (
                                <button className="btn btn-ghost" onClick={() => changerStatut(r, 'Annulé')}>Annuler</button>
                              )
                              : (
                                <>
                                  {r.statut === 'Demandé' && (
                                    <button className="btn btn-ghost" onClick={() => changerStatut(r, 'Confirmé')}>Confirmer</button>
                                  )}
                                  <button className="btn btn-ghost" onClick={() => changerStatut(r, 'Honoré')}>Honoré</button>
                                  <button className="btn btn-ghost" onClick={() => changerStatut(r, 'Annulé')}>Annuler</button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={tbl.page} pages={tbl.pages} total={tbl.total}
                pageSize={tbl.parPage} onPage={tbl.setPage} />
              </>
            </Etat>
          </Panel>

          <Panel kicker={estPatient ? 'Demande de rendez-vous' : 'Prise de rendez-vous'} title="Nouveau créneau">
            <form className="stack-sm" onSubmit={creerRdv}>
              {!estPatient && (
                <Etat loading={patients.loading} error={patients.error} onRetry={patients.recharger}
                  vide={!patients.data?.items?.length} videTitre="Aucun dossier patient"
                  videTexte="Créez un dossier avant de programmer un rendez-vous.">
                  <Field label="Patient *">
                    <select className="input" value={f.patientId} onChange={(e) => setF({ ...f, patientId: e.target.value })} required>
                      <option value="">Choisir…</option>
                      {patients.data?.items?.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom} {p.prenom} — {p.reference}</option>
                      ))}
                    </select>
                  </Field>
                </Etat>
              )}

              <Field label="Service / spécialité *">
                <select className="input" value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value, heure: '' })} required>
                  <option value="">Choisir…</option>
                  {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </Field>

              <Field label="Date *">
                <input className="input" type="date" min={aujourdhui()} value={f.date}
                  onChange={(e) => setF({ ...f, date: e.target.value, heure: '' })} required />
              </Field>

              {f.serviceId && f.date && (
                <Etat loading={creneaux.loading} error={creneaux.error} onRetry={creneaux.recharger}>
                  <>
                    {creneaux.data?.risqueSaturation > 0.5 && (
                      <Alert level="warn" title="Journée sous tension">
                        {Math.round(creneaux.data?.risqueSaturation * 100)} % de risque de saturation
                        dans ce service à cette date. Un autre jour réduirait le risque de report.
                      </Alert>
                    )}
                    <Field label="Créneau *" hint="Les créneaux déjà pris sont désactivés">
                      <div className="row" style={{ gap: 6 }}>
                        {(creneaux.data?.creneaux ?? []).map((cr) => (
                          <button key={cr.heure} type="button" disabled={!cr.libre}
                            className={`btn btn-sm ${f.heure === cr.heure ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setF({ ...f, heure: cr.heure })}>
                            {cr.heure}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </>
                </Etat>
              )}

              <Field label="Motif *">
                <input className="input" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })}
                  placeholder="Suivi hypertension, consultation prénatale…" required minLength={3} />
              </Field>

              <button className="btn btn-primary btn-block" type="submit"
                disabled={envoi || !f.serviceId || !f.date || !f.heure || !f.motif.trim() || (!estPatient && !f.patientId)}>
                {envoi ? <><span className="spinner" /> Enregistrement…</>
                  : estPatient ? 'Demander ce créneau' : 'Confirmer le rendez-vous'}
              </button>
              <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                Un identifiant de rendez-vous et un rappel SMS J-2 sont générés automatiquement.
              </p>
            </form>
          </Panel>
        </div>
      )}

      {onglet === 'bloc' && !estPatient && (
        <div className="grid g-side">
          <Panel kicker="Carnet opératoire" title="Interventions programmées">
            <Etat loading={rdv.loading} error={rdv.error} onRetry={rdv.recharger}
              vide={!bloc.length} videTitre="Aucune intervention programmée"
              videTexte="Utilisez le formulaire pour inscrire une intervention au carnet.">
              <div className="stack-sm">
                {bloc.map((r) => (
                  <div key={r.id} className="panel" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 14.5 }}>{r.motif}</strong>
                      <span className="tag tag-neutral">{r.salleBloc ?? 'salle à définir'}</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                      {dateFr(r.date)} · {r.heure} → {r.dureeMinutes} min · {r.patientNom}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <span className="tag tag-blue">Séjour attendu {r.dureeSejourJours} j</span>
                      {r.perteDeChance && (
                        <span className={`tag ${r.perteDeChance === 'Sévère' ? 'tag-sev-1'
                          : r.perteDeChance === 'Modéré' ? 'tag-sev-3' : 'tag-sev-4'}`}>
                          Perte de chance si report : {r.perteDeChance.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Etat>
          </Panel>

          <Panel kicker="Programmation" title="Inscrire une intervention">
            <form className="stack-sm" onSubmit={creerBloc}>
              <div className="form-grid">
                <Field label="Patient *">
                  <select className="input" value={c.patientId} onChange={(e) => setC({ ...c, patientId: e.target.value })} required>
                    <option value="">Choisir…</option>
                    {(patients.data?.items ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Service opérateur *">
                  <select className="input" value={c.serviceId} onChange={(e) => setC({ ...c, serviceId: e.target.value })} required>
                    <option value="">Choisir…</option>
                    {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </Field>
                <Field label="Intervention *">
                  <input className="input" value={c.motif} onChange={(e) => setC({ ...c, motif: e.target.value })}
                    placeholder="Cure de hernie inguinale" required minLength={3} />
                </Field>
                <Field label="Salle">
                  <select className="input" value={c.salleBloc} onChange={(e) => setC({ ...c, salleBloc: e.target.value })}>
                    {SALLES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Date *">
                  <input className="input" type="date" min={aujourdhui()} value={c.date}
                    onChange={(e) => setC({ ...c, date: e.target.value })} required />
                </Field>
                <Field label="Heure d’incision">
                  <input className="input" type="time" value={c.heure} onChange={(e) => setC({ ...c, heure: e.target.value })} />
                </Field>
                <Field label="Durée estimée (min)" hint="10 à 720">
                  <input className="input" type="number" min="10" max="720" value={c.dureeMinutes}
                    onChange={(e) => setC({ ...c, dureeMinutes: e.target.value })} />
                </Field>
                <Field label="Service de lit d’aval *" hint="Là où le patient récupère">
                  <select className="input" value={c.litAvalServiceId}
                    onChange={(e) => setC({ ...c, litAvalServiceId: e.target.value })} required>
                    <option value="">Choisir…</option>
                    {(services.data ?? []).filter((s) => s.hospitalisation).map((s) => (
                      <option key={s.id} value={s.id}>{s.nom} — {s.libres} lit(s) libre(s)</option>
                    ))}
                  </select>
                </Field>
                <Field label="Durée de séjour attendue (j)">
                  <input className="input" type="number" min="0" max="90" value={c.dureeSejourJours}
                    onChange={(e) => setC({ ...c, dureeSejourJours: e.target.value })} />
                </Field>
                <Field label="Perte de chance en cas de report" hint="Alimente l’arbitrage en cas de tension">
                  <select className="input" value={c.perteDeChance} onChange={(e) => setC({ ...c, perteDeChance: e.target.value })}>
                    {PERTE.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              {creneauxBloc.data?.risqueSaturation > 0.5 && (
                <Alert level="warn" title="Lit d’aval incertain">
                  {Math.round(creneauxBloc.data?.risqueSaturation * 100)} % de risque de saturation du service
                  de récupération à cette date. Proposer une autre date ou prévoir un transfert.
                </Alert>
              )}

              <button className="btn btn-primary btn-block" type="submit"
                disabled={envoi || !c.patientId || !c.serviceId || !c.date || !c.motif.trim() || !c.litAvalServiceId}>
                {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Inscrire au carnet opératoire'}
              </button>
            </form>
          </Panel>
        </div>
      )}

      {onglet === 'suivi' && !estPatient && (
        <Panel kicker="Relances" title="Patients à recontacter">
          <Etat loading={rdv.loading} error={rdv.error} onRetry={rdv.recharger}
            vide={!manques.length} videTitre="Aucun rendez-vous manqué"
            videTexte="Les rendez-vous marqués « Manqué » apparaissent ici pour relance.">
            <div className="stack-sm">
              {manques.map((r) => (
                <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <span>
                    <strong>{r.patientNom}</strong> — {r.motif}
                    <span className="sub">{dateFr(r.date)} · {r.serviceNom} · {r.patientTel ?? 'téléphone non renseigné'}</span>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => changerStatut(r, 'Reprogrammé')}>
                    Marquer reprogrammé
                  </button>
                </div>
              ))}
            </div>
          </Etat>
        </Panel>
      )}
    </>
  )
}
