import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Modal } from '../components/Modal.jsx'
import { PageHead, Panel, Field, Kpi, Etat, Pager, Bar, PAR_PAGE, RechercheTableau } from '../components/ui.jsx'
import { dateHeureFr, REF } from '../lib/referentiels.js'

const SEV_GRAVITE = { Sévère: 'sev-1', Modéré: 'sev-3', Léger: 'sev-4' }

export default function UnmetDemand() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const services = useApi('/api/services', { hospitalisationSeule: true })
  const liste = useApi('/api/demandes', { recherche: q, page, pageSize: PAR_PAGE })

  const items = liste.data?.items ?? []
  const total = liste.data?.total ?? 0
  const severes = items.filter((d) => d.gravite === 'Sévère').length

  // Concentration par service, sur la page affichée.
  const parService = Object.entries(items.reduce((a, d) => {
    a[d.serviceNom] = (a[d.serviceNom] ?? 0) + 1
    return a
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxService = parService[0]?.[1] || 1

  const ouvrir = () => setForm({
    serviceId: services.data?.[0]?.id ?? '', motif: '', gravite: 'Modéré', devenir: REF.devenirs[0], patientId: ''
  })

  const soumettre = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      await api.post('/api/demandes', {
        serviceId: Number(form.serviceId),
        patientId: form.patientId ? Number(form.patientId) : null,
        motif: form.motif, gravite: form.gravite, devenir: form.devenir
      })
      toast.succes('Demande enregistrée', 'Elle documente la demande réelle, non censurée par la capacité.')
      setForm(null)
      setPage(1)
      liste.recharger()
    } catch (e2) {
      toast.erreur('Enregistrement refusé', e2.message)
    } finally { setEnvoi(false) }
  }

  return (
    <>
      <PageHead kicker="Module lits"
        actions={<button className="btn btn-primary" onClick={ouvrir} disabled={!services.data?.length}>
          Enregistrer un refus
        </button>}>
        Mesure la demande réelle plutôt que celle que la capacité a laissé passer. C’est la pièce
        justificative d’une demande d’extension de capacité auprès de la tutelle.
      </PageHead>

      <Etat loading={liste.loading} error={liste.error} onRetry={liste.recharger}>
        <div className="grid g3 section">
          <Kpi label="Demandes refusées ou différées" value={total} note="depuis l’ouverture du registre" />
          <Kpi label="Dont gravité sévère" value={severes}
            note={items.length ? `${Math.round((severes / items.length) * 100)} % de la page affichée` : '—'} />
          <Kpi label="Service le plus concerné" value={parService[0]?.[0] ?? '—'}
            note={parService[0] ? `${parService[0][1]} demande(s)` : 'aucune donnée'} />
        </div>
      </Etat>

      {parService.length > 0 && (
        <Panel kicker="Concentration" title="Répartition par service" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="stack-sm">
            {parService.map(([nom, n]) => (
              <div className="meter-row" key={nom}>
                <span>{nom}</span>
                <Bar value={(n / maxService) * 100} sev="sev-2" />
                <span className="num">{n}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <RechercheTableau valeur={q} onChange={(v) => { setQ(v); setPage(1) }}
          placeholder="Rechercher une référence, un service, un motif…"
          total={total} libelle="demande" />
        <Etat loading={liste.loading} error={liste.error} onRetry={liste.recharger}
          vide={!items.length} videTitre="Aucune demande enregistrée"
          videTexte="Un refus ou un différé faute de lit est ajouté automatiquement depuis l’écran de décision.">
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Réf.</th><th>Date</th><th>Service demandé</th><th>Motif</th><th>Gravité</th><th>Devenir</th><th>Dossier</th></tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id}>
                      <td>{d.reference}</td>
                      <td>{dateHeureFr(d.date)}</td>
                      <td>{d.serviceNom}</td>
                      <td>{d.motif}</td>
                      <td><span className={`tag tag-${SEV_GRAVITE[d.gravite] ?? 'neutral'}`}>{d.gravite}</span></td>
                      <td>{d.devenir}</td>
                      <td>{d.patientId ?? <span className="text-muted">anonyme</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={liste.data?.page} pages={liste.data?.pages} total={total}
              pageSize={liste.data?.pageSize} onPage={setPage} />
          </>
        </Etat>
      </Panel>

      {form && (
        <Modal titre="Nouveau refus ou différé" onClose={() => setForm(null)}
          sousTitre="À renseigner même lorsque le patient repart de lui-même : c’est la donnée qui manque le plus souvent."
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn btn-primary" form="form-demande" type="submit"
                disabled={envoi || !form.motif.trim() || !form.serviceId}>
                {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer'}
              </button>
            </>
          }>
          <form id="form-demande" className="stack" onSubmit={soumettre}>
            <div className="form-grid">
              <Field label="Service demandé *">
                <select className="input" value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required>
                  {(services.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} — {s.libres} lit(s) libre(s)</option>
                  ))}
                </select>
              </Field>
              <Field label="Gravité estimée *">
                <select className="input" value={form.gravite} onChange={(e) => setForm({ ...form, gravite: e.target.value })}>
                  {REF.gravites.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Devenir du patient *">
                <select className="input" value={form.devenir} onChange={(e) => setForm({ ...form, devenir: e.target.value })}>
                  {REF.devenirs.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Identifiant de dossier" hint="Laisser vide si le patient n’a pas été enregistré">
                <input className="input" type="number" value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })} />
              </Field>
            </div>
            <Field label="Motif du refus *">
              <input className="input" value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}
                placeholder="Aucun lit armé disponible, lits bloqués, absence de spécialiste…" required minLength={3} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  )
}
