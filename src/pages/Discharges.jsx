import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi, useTri } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Confirm, Modal } from '../components/Modal.jsx'
import { PageHead, Panel, Kpi, Bar, Etat, Th, Alert, Field, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { REF, dateFr } from '../lib/referentiels.js'


export default function Discharges() {
  const toast = useToast()
  const [serviceId, setServiceId] = useState('')
  const [blocage, setBlocage] = useState(null)
  const [motif, setMotif] = useState(REF.motifsBlocage[0])
  const [sortie, setSortie] = useState(null)
  const [issue, setIssue] = useState('')
  const { tri, basculer, trier } = useTri({ cle: 'jours', sens: 'desc' })

  const services = useApi('/api/services', { hospitalisationSeule: true })
  const sejours = useApi('/api/sejours', { serviceId }, { intervalMs: 60000 })

  const items = trier(sejours.data ?? [], {
    patient: (s) => s.patientNom,
    service: (s) => s.serviceNom,
    jours: (s) => s.jours,
    j1: (s) => s.probaJ1
  })
  const tbl = useTableau(items, ['lit', (x) => x.patientNom, (x) => x.serviceNom, (x) => x.motifBlocage])
  const bloques = items.filter((s) => s.motifBlocage)
  // Les probabilités de sortie n'existent qu'avec un modèle de survie branché ; sinon elles valent null.
  const modeleSortie = items.some((s) => s.probaJ1 !== null && s.probaJ1 !== undefined)
  const sous48 = items.filter((s) => s.probaJ1 >= 0.5)
  const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`)

  const appliquerBlocage = async () => {
    try {
      await api.post(`/api/sejours/${blocage.id}/blocage`, { motif })
      toast.succes('Blocage enregistré', `${blocage.patientNom} — ${motif}`)
      sejours.recharger()
    } catch (e) { toast.erreur('Enregistrement refusé', e.message) }
  }

  const leverBlocage = async (s) => {
    try {
      await api.post(`/api/sejours/${s.id}/blocage`, { motif: null })
      toast.succes('Blocage levé', `${s.patientNom} — le lit redevient mobilisable.`)
      sejours.recharger()
    } catch (e) { toast.erreur('Opération refusée', e.message) }
  }

  const prononcerSortie = async () => {
    try {
      await api.post(`/api/sejours/${sortie.id}/sortie`, { issue })
      toast.succes('Sortie enregistrée', `${issue} — le lit ${sortie.lit ?? ''} est libéré.`)
      sejours.recharger()
    } catch (e) { toast.erreur('Sortie refusée', e.message) }
  }

  return (
    <>
      <PageHead kicker="Module lits">
        Probabilité de sortie par jour (affichée une fois le modèle de survie branché), pour préparer
        le dossier, le transport et la famille à l’avance.
        Un séjour prolongé pour motif non médical est signalé : c’est le levier de capacité le plus
        rapide à actionner.
      </PageHead>

      <Etat loading={sejours.loading} error={sejours.error} onRetry={sejours.recharger}>
        <div className="grid g3 section">
          <Kpi label="Patients hospitalisés" value={items.length} note="séjours en cours" />
          {modeleSortie
            ? <Kpi label="Sorties probables sous 48 h" value={sous48.length}
                note={items.length ? `${Math.round((sous48.length / items.length) * 100)} % des séjours` : '—'} />
            : <Kpi label="Sorties probables sous 48 h" value="—" note="aucun modèle de sortie branché" />}
          <Kpi label="Sorties différées (motif non médical)" value={bloques.length}
            note={items.length ? `≈ ${Math.round((bloques.length / items.length) * 100)} % de capacité mobilisable` : '—'} />
        </div>
      </Etat>

      {bloques.length > 0 && (
        <div className="section">
          <Alert level="warn" title="Blocages à traiter">
            {bloques.map((b) => `${b.patientNom} (${b.motifBlocage}, ${b.jours} j)`).join(' · ')}
          </Alert>
        </div>
      )}

      <div className="toolbar">
        <Field label="Service">
          <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Tous</option>
            {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </Field>
        <button className="btn btn-secondary" onClick={sejours.recharger}>Rafraîchir</button>
      </div>

      <Panel>
        <RechercheTableau valeur={tbl.q} onChange={tbl.setQ}
          placeholder="Rechercher un patient, un service, un lit…" total={tbl.total} libelle="séjour" />
        <Etat loading={sejours.loading} error={sejours.error} onRetry={sejours.recharger}
          vide={!tbl.total} videTitre="Aucun séjour en cours"
          videTexte="Les séjours apparaissent après une décision d’admission dans un service.">
          <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <Th cle="patient" tri={tri} onTri={basculer}>Patient</Th>
                  <Th cle="service" tri={tri} onTri={basculer}>Service</Th>
                  <th>Lit</th>
                  <Th cle="jours" tri={tri} onTri={basculer} className="num">Durée</Th>
                  <th style={{ minWidth: 150 }}>Sortie aujourd’hui</th>
                  <Th cle="j1" tri={tri} onTri={basculer} className="num">J+1</Th>
                  <th className="num">J+2</th>
                  <th>Blocage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tbl.visibles.map((s) => (
                  <tr key={s.id}>
                    <td>{s.patientNom || <span className="text-muted">non renseigné</span>}<span className="sub">{s.reference}</span></td>
                    <td>{s.serviceNom}</td>
                    <td>{s.lit ?? <span className="text-muted">—</span>}</td>
                    <td className="num">{s.jours} j<span className="sub">{dateFr(s.entree)}</span></td>
                    <td>
                      {s.probaJ0 === null || s.probaJ0 === undefined
                        ? <span className="text-muted">—</span>
                        : <>
                            <Bar value={s.probaJ0 * 100} sev={s.probaJ0 >= 0.5 ? 'sev-4' : undefined} />
                            <span className="sub">{pct(s.probaJ0)}</span>
                          </>}
                    </td>
                    <td className="num">{pct(s.probaJ1)}</td>
                    <td className="num">{pct(s.probaJ2)}</td>
                    <td>
                      {s.motifBlocage
                        ? <span className="tag tag-error"><span aria-hidden="true">⚠</span>{s.motifBlocage}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="row">
                        {s.motifBlocage
                          ? <button className="btn btn-ghost" onClick={() => leverBlocage(s)}>Lever</button>
                          : <button className="btn btn-ghost" onClick={() => { setBlocage(s); setMotif(REF.motifsBlocage[0]) }}>Signaler</button>}
                        <button className="btn btn-ghost" onClick={() => { setSortie(s); setIssue('') }}>Sortie</button>
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

      {blocage && (
        <Confirm titre="Signaler un blocage non médical"
          message={
            <>
              <span style={{ display: 'block', marginBottom: 12 }}>
                {blocage.patientNom} — {blocage.serviceNom}. Le lit reste comptabilisé comme bloqué
                jusqu’à la levée du motif.
              </span>
              <select className="input" value={motif} onChange={(e) => setMotif(e.target.value)}>
                {REF.motifsBlocage.map((m) => <option key={m}>{m}</option>)}
              </select>
            </>
          }
          confirmer="Enregistrer le blocage" onConfirm={appliquerBlocage} onClose={() => setBlocage(null)} />
      )}

      {sortie && (
        <Modal titre="Prononcer la sortie" onClose={() => setSortie(null)}
          actions={<>
            <button className="btn btn-secondary" onClick={() => setSortie(null)}>Annuler</button>
            <button className="btn btn-primary" disabled={!issue}
              onClick={() => { prononcerSortie(); setSortie(null) }}>Confirmer la sortie</button>
          </>}>
          <div className="stack-sm">
            <p style={{ margin: 0 }}>
              {sortie.patientNom} quitte {sortie.serviceNom}{sortie.lit ? ` (lit ${sortie.lit})` : ''}. Le lit
              redevient immédiatement disponible dans le compteur de capacité.
            </p>
            <Field label="Issue du séjour *" hint="Même vocabulaire que le dataset des registres : un décès ou un transfert n’est pas une sortie ordinaire">
              <select className="input" value={issue} onChange={(e) => setIssue(e.target.value)}>
                <option value="">—</option>
                {REF.issues.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
