import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import PatientForm, { depuisPatient, patientValide } from './PatientForm.jsx'

/**
 * Première connexion d'un compte patient : le dossier créé avec le compte est vide.
 * Tant qu'âge, sexe et consentement ne sont pas renseignés, cette modale bloque
 * l'accès au reste de l'application — elle ne se ferme qu'en enregistrant.
 */
export default function CompleterProfil() {
  const { user } = useAuth()
  const toast = useToast()
  const estPatient = user?.role === 'patient' && !!user?.patientId
  const dossier = useApi(estPatient ? `/api/patients/${user.patientId}` : null, null, { skip: !estPatient })
  const [form, setForm] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const incomplet = estPatient && dossier.data && !dossier.data.consentement

  useEffect(() => {
    if (incomplet && !form) setForm(depuisPatient(dossier.data))
  }, [incomplet, dossier.data, form])

  if (!incomplet || !form) return null

  const enregistrer = async (e) => {
    e.preventDefault()
    if (!form.consentement) return
    setEnvoi(true)
    try {
      await api.put(`/api/patients/${user.patientId}`, { ...form, age: Number(form.age) })
      toast.succes('Profil complété', 'Merci, votre dossier est prêt.')
      dossier.recharger()
    } catch (e2) { toast.erreur('Enregistrement refusé', e2.message) } finally { setEnvoi(false) }
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Compléter mon profil">
      <div className="modal wide">
        <div className="modal-head">
          <div>
            <h3>Complétez votre profil</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
              Ces informations sont nécessaires à votre prise en charge. Elles ne sont demandées qu’une fois.
            </p>
          </div>
        </div>
        <div className="modal-body">
          <PatientForm id="form-profil-patient" compact form={form} setForm={setForm} onSubmit={enregistrer} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" form="form-profil-patient" type="submit"
            disabled={envoi || !patientValide(form) || !form.consentement}>
            {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer mon profil'}
          </button>
        </div>
      </div>
    </div>
  )
}
