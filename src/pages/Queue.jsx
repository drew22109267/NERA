import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi, useTri } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, CatBadge, Etat, Alert, Pager, Th, PAR_PAGE } from '../components/ui.jsx'
import { REF, minutes, catDelai } from '../lib/referentiels.js'

const STATUTS = () => ['Tous', ...REF.statutsPassage]

export default function Queue() {
  const toast = useToast()
  const [statut, setStatut] = useState('En attente')
  const [serviceId, setServiceId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { tri, basculer, trier } = useTri({ cle: null, sens: 'asc' })

  const services = useApi('/api/services')
  const liste = useApi('/api/passages', { statut, serviceId, q, page, pageSize: PAR_PAGE }, { intervalMs: 30000 })

  const items = trier(liste.data?.items ?? [], {
    patient: (p) => p.patientNom,
    categorie: (p) => p.categorie ?? 9,
    attente: (p) => p.attenteMinutes,
    service: (p) => p.serviceViseNom ?? ''
  })
  const retards = items.filter((p) => p.delaiDepasse)

  const prendreEnCharge = async (p) => {
    try {
      await api.post(`/api/passages/${p.id}/statut`, { statut: 'En cours' })
      toast.succes('Patient pris en charge', `${p.patientNom} — ${p.reference}`)
      liste.recharger()
    } catch (e) { toast.erreur('Changement de statut refusé', e.message) }
  }

  const changer = (fn) => (v) => { fn(v); setPage(1) }

  return (
    <>
      <PageHead kicker="Module triage · vue partagée"
        actions={<Link className="btn btn-primary" to="/admission">Nouvelle admission</Link>}>
        Triée par catégorie puis par heure d’arrivée. Les postes voient la même file, rafraîchie
        toutes les trente secondes.
      </PageHead>

      {retards.length > 0 && (
        <div className="section">
          <Alert level="crit" title="Réévaluation requise">
            {retards.length} patient(s) au-delà du délai maximal de leur catégorie :{' '}
            {retards.slice(0, 3).map((p) => p.patientNom).join(' · ')}
            {retards.length > 3 && ` et ${retards.length - 3} autre(s)`}.
          </Alert>
        </div>
      )}

      <div className="toolbar">
        <Field label="Statut">
          <select className="input" value={statut} onChange={(e) => changer(setStatut)(e.target.value)}>
            {STATUTS().map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Service visé">
          <select className="input" value={serviceId} onChange={(e) => changer(setServiceId)(e.target.value)}>
            <option value="">Tous</option>
            {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </Field>
        <Field label="Recherche">
          <input className="input" value={q} onChange={(e) => changer(setQ)(e.target.value)}
            placeholder="Nom ou n° de passage" />
        </Field>
        <button className="btn btn-secondary" onClick={liste.recharger}>Rafraîchir</button>
      </div>

      <Panel>
        <Etat loading={liste.loading} error={liste.error} onRetry={liste.recharger}
          vide={!items.length}
          videTitre="Aucun patient dans cette vue"
          videTexte={statut === 'Tous'
            ? 'Aucun passage enregistré. Commencez par une nouvelle admission.'
            : `Aucun passage au statut « ${statut} ». Changez le filtre pour élargir.`}>
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <Th cle="categorie" tri={tri} onTri={basculer}>Catégorie</Th>
                    <Th cle="patient" tri={tri} onTri={basculer}>Patient</Th>
                    <th>Motif</th>
                    <Th cle="service" tri={tri} onTri={basculer}>Service visé</Th>
                    <Th cle="attente" tri={tri} onTri={basculer}>Attente</Th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td><CatBadge cat={p.categorie} /></td>
                      <td>{p.patientNom}<span className="sub">{p.patientAge} ans · {p.reference}</span></td>
                      <td>{p.motif}<span className="sub">{p.modeEntree}</span></td>
                      <td>{p.serviceViseNom ?? <span className="text-muted">non défini</span>}</td>
                      <td style={{ whiteSpace: 'nowrap', color: p.delaiDepasse ? 'var(--sev-1)' : undefined, fontWeight: p.delaiDepasse ? 700 : 500 }}>
                        {minutes(p.attenteMinutes)}
                        {p.categorie && <span className="sub">max {catDelai(p.categorie)} min</span>}
                      </td>
                      <td>
                        <span className={`tag ${p.delaiDepasse ? 'tag-error' : 'tag-neutral'}`}>
                          {p.delaiDepasse && <span aria-hidden="true">⚠</span>}{p.statut}
                        </span>
                      </td>
                      <td>
                        <div className="row">
                          <Link className="btn btn-ghost" to={p.triage ? `/decision/${p.id}` : `/triage/${p.id}`}>
                            {p.triage ? 'Décision' : 'Trier'}
                          </Link>
                          {p.statut === 'En attente' && (
                            <button className="btn btn-ghost" onClick={() => prendreEnCharge(p)}>Prendre en charge</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={liste.data?.page} pages={liste.data?.pages} total={liste.data?.total}
              pageSize={liste.data?.pageSize} onPage={setPage} />
          </>
        </Etat>
      </Panel>
    </>
  )
}
