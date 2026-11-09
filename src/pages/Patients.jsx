import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi, useTri } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Modal } from '../components/Modal.jsx'
import { PageHead, Panel, Field, Etat, Pager, Th, Alert, RechercheTableau, PAR_PAGE } from '../components/ui.jsx'
import { dateFr } from '../lib/referentiels.js'
import PatientForm, { PATIENT_VIDE as vide, patientValide } from '../components/PatientForm.jsx'

export default function Patients() {
  const toast = useToast()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const { tri, basculer } = useTri({ cle: 'nom', sens: 'asc' })

  const liste = useApi('/api/patients', { q, page, pageSize: PAR_PAGE, tri: tri.cle, sens: tri.sens }, { intervalMs: 60000 })
  const doublons = useApi('/api/patients/doublons',
    form ? { nom: form.nom, sexe: form.sexe, age: Number(form.age) || 0 } : null,
    { skip: !form || form.nom.trim().length < 2 })

  const valide = useMemo(() => patientValide(form), [form])

  const soumettre = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const p = await api.post('/api/patients', { ...form, age: Number(form.age) })
      toast.succes('Dossier créé', `${p.nom} ${p.prenom} — ${p.reference}`)
      setForm(null)
      nav(`/patients/${p.id}`)
    } catch (e2) {
      toast.erreur('Création refusée', e2.message)
    } finally { setEnvoi(false) }
  }


  return (
    <>
      <PageHead kicker="Identité & dossier patient"
        actions={<button className="btn btn-primary" onClick={() => setForm(vide)}>Nouveau dossier</button>}>
        Recherche serveur par nom, téléphone ou numéro de dossier. Le rapprochement approché signale
        les doublons en l’absence d’identifiant national unique.
      </PageHead>

      <div className="toolbar">
        <RechercheTableau valeur={q} onChange={(v) => { setQ(v); setPage(1) }}
          placeholder="Nom, téléphone ou n° de dossier" />
      </div>

      <Panel>
        <Etat loading={liste.loading} error={liste.error} onRetry={liste.recharger}
          vide={!liste.data?.items?.length}
          videTitre={q ? 'Aucun dossier ne correspond' : 'Aucun dossier enregistré'}
          videTexte={q ? `Rien ne correspond à « ${q} ».` : 'Créez le premier dossier avec le bouton « Nouveau dossier ».'}>
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <Th cle="reference" tri={tri} onTri={(c) => { basculer(c); setPage(1) }}>Dossier</Th>
                    <Th cle="nom" tri={tri} onTri={(c) => { basculer(c); setPage(1) }}>Patient</Th>
                    <Th cle="age" tri={tri} onTri={(c) => { basculer(c); setPage(1) }}>Âge / sexe</Th>
                    <th>Résidence</th>
                    <th>Paiement</th>
                    <th>Antécédents</th>
                    <Th cle="creeLe" tri={tri} onTri={(c) => { basculer(c); setPage(1) }}>Créé le</Th>
                  </tr>
                </thead>
                <tbody>
                  {liste.data?.items?.map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/patients/${p.id}`}>{p.reference}</Link></td>
                      <td>{p.nom} {p.prenom}<span className="sub">{p.telephone ?? 'téléphone non renseigné'}</span></td>
                      <td>{p.age} ans · {p.sexe}</td>
                      <td>
                        {p.quartier ?? <span className="text-muted">—</span>}
                        <span className="sub">{[p.arrondissement, p.milieu].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td>{p.modePaiement}</td>
                      <td>{p.antecedents?.length ? p.antecedents.join(', ') : <span className="text-muted">—</span>}</td>
                      <td>{dateFr(p.creeLe)}</td>
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

      {form && (
        <Modal titre="Création de dossier" large onClose={() => setForm(null)}
          sousTitre="Les champs marqués sont nécessaires à l’identification du patient."
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn btn-primary" form="form-patient" type="submit" disabled={!valide || envoi}>
                {envoi ? <><span className="spinner" /> Création…</> : 'Créer le dossier'}
              </button>
            </>
          }>
          <PatientForm form={form} setForm={setForm} onSubmit={soumettre}>
            {doublons.data?.length > 0 && (
              <Alert level="warn" title="Doublon possible">
                {doublons.data?.map((d) => `${d.nom} ${d.prenom} (${d.age} ans, ${d.reference})`).join(' · ')}
              </Alert>
            )}
          </PatientForm>
        </Modal>
      )}
    </>
  )
}
