import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi, useTri } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Confirm } from '../components/Modal.jsx'
import { PageHead, Panel, Kpi, Bar, Etat, Th, Alert, Field, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { dateFr } from '../lib/referentiels.js'

const MOTIFS_BLOCAGE = ['Attente de paiement', 'Attente de transport', 'Attente de transfert',
  'Attente de place en aval', 'Absence de famille', 'Autre motif non médical']

export default function Discharges() {
  const toast = useToast()
  const [serviceId, setServiceId] = useState('')
  const [blocage, setBlocage] = useState(null)
  const [motif, setMotif] = useState(MOTIFS_BLOCAGE[0])
  const [sortie, setSortie] = useState(null)
  const { tri, basculer, trier } = useTri({ cle: 'j1', sens: 'desc' })

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
  const sous48 = items.filter((s) => s.probaJ1 >= 0.5)

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
      await api.post(`/api/sejours/${sortie.id}/sortie`)
      toast.succes('Sortie enregistrée', `Le lit ${sortie.lit ?? ''} est libéré.`)
      sejours.recharger()
    } catch (e) { toast.erreur('Sortie refusée', e.message) }
  }

  return (
    <>
      <PageHead kicker="Module lits">
        Probabilité de sortie par jour, pour préparer le dossier, le transport et la famille à l’avance.
        Un séjour prolongé pour motif non médical est signalé : c’est le levier de capacité le plus
        rapide à actionner.
      </PageHead>

      <Etat loading={sejours.loading} error={sejours.error} onRetry={sejours.recharger}>
        <div className="grid g3 section">
          <Kpi label="Patients hospitalisés" value={items.length} note="séjours en cours" />
          <Kpi label="Sorties probables sous 48 h" value={sous48.length}
            note={items.length ? `${Math.round((sous48.length / items.length) * 100)} % des séjours` : '—'} />
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
                      <Bar value={s.probaJ0 * 100} sev={s.probaJ0 >= 0.5 ? 'sev-4' : undefined} />
                      <span className="sub">{Math.round(s.probaJ0 * 100)} %</span>
                    </td>
                    <td className="num">{Math.round(s.probaJ1 * 100)} %</td>
                    <td className="num">{Math.round(s.probaJ2 * 100)} %</td>
                    <td>
                      {s.motifBlocage
                        ? <span className="tag tag-error"><span aria-hidden="true">⚠</span>{s.motifBlocage}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="row">
                        {s.motifBlocage
                          ? <button className="btn btn-ghost" onClick={() => leverBlocage(s)}>Lever</button>
                          : <button className="btn btn-ghost" onClick={() => { setBlocage(s); setMotif(MOTIFS_BLOCAGE[0]) }}>Signaler</button>}
                        <button className="btn btn-ghost" onClick={() => setSortie(s)}>Sortie</button>
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
                {MOTIFS_BLOCAGE.map((m) => <option key={m}>{m}</option>)}
              </select>
            </>
          }
          confirmer="Enregistrer le blocage" onConfirm={appliquerBlocage} onClose={() => setBlocage(null)} />
      )}

      {sortie && (
        <Confirm titre="Prononcer la sortie" confirmer="Confirmer la sortie"
          message={`${sortie.patientNom} quitte ${sortie.serviceNom}${sortie.lit ? ` (lit ${sortie.lit})` : ''}. Le lit redevient immédiatement disponible dans le compteur de capacité.`}
          onConfirm={prononcerSortie} onClose={() => setSortie(null)} />
      )}
    </>
  )
}
