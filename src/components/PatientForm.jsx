import { Field } from './ui.jsx'
import { REF } from '../lib/referentiels.js'

/** Dossier vierge — même forme que le corps attendu par PUT/POST /api/patients. */
export const PATIENT_VIDE = {
  nom: '', prenom: '', sexe: 'F', age: '', telephone: '', email: '', quartier: '',
  arrondissement: '', milieu: 'Urbain', modePaiement: '', contactUrgence: '',
  antecedents: [], allergies: '', consentement: false
}

/** Un dossier est exploitable quand identité, sexe et âge sont connus. */
export const patientValide = (f) =>
  !!f && f.nom.trim().length >= 2 && f.prenom.trim().length >= 2
  && f.age !== '' && Number(f.age) >= 0 && Number(f.age) <= 120

/** Reconstruit un formulaire à partir d'un dossier renvoyé par l'API. */
export const depuisPatient = (p) => ({
  ...PATIENT_VIDE, ...p,
  age: p?.age ?? '', telephone: p?.telephone ?? '', email: p?.email ?? '',
  quartier: p?.quartier ?? '', arrondissement: p?.arrondissement ?? '',
  contactUrgence: p?.contactUrgence ?? '', allergies: p?.allergies ?? '',
  antecedents: p?.antecedents ?? [], consentement: !!p?.consentement
})

/**
 * Champs d'un dossier patient. `compact` réduit le formulaire à l'essentiel
 * clinique — ce qu'un patient complète lui-même à sa première connexion.
 */
export default function PatientForm({ form, setForm, id = 'form-patient', onSubmit, compact = false, children }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const cocher = (a, on) => setForm({
    ...form, antecedents: on ? [...form.antecedents, a] : form.antecedents.filter((x) => x !== a)
  })

  return (
    <form id={id} className="stack" onSubmit={onSubmit}>
      <div className="form-grid">
        <Field label="Nom *"><input className="input" value={form.nom} onChange={set('nom')} required minLength={2} /></Field>
        <Field label="Prénom *"><input className="input" value={form.prenom} onChange={set('prenom')} required minLength={2} /></Field>
        <Field label="Sexe *">
          <select className="input" value={form.sexe} onChange={set('sexe')}>
            <option value="F">Féminin</option><option value="M">Masculin</option>
          </select>
        </Field>
        <Field label="Âge (ou estimé) *" hint="0 à 120">
          <input className="input" type="number" min="0" max="120" value={form.age} onChange={set('age')} required />
        </Field>
        <Field label="Téléphone"><input className="input" value={form.telephone} onChange={set('telephone')} placeholder="+237 6 .. .. .. .." /></Field>
        {!compact && (
          <Field label="Adresse électronique" hint="Permet au patient d’ouvrir son espace">
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </Field>
        )}
        <Field label="Quartier"><input className="input" value={form.quartier} onChange={set('quartier')} /></Field>
        <Field label="Arrondissement"><input className="input" value={form.arrondissement} onChange={set('arrondissement')} /></Field>
        <Field label="Milieu">
          <select className="input" value={form.milieu} onChange={set('milieu')}><option>Urbain</option><option>Rural</option></select>
        </Field>
        <Field label="Mode de paiement">
          <select className="input" value={form.modePaiement} onChange={set('modePaiement')}>
            {REF.paiements.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Contact d’urgence"><input className="input" value={form.contactUrgence} onChange={set('contactUrgence')} placeholder="Nom · téléphone" /></Field>
        <Field label="Allergies connues"><input className="input" value={form.allergies} onChange={set('allergies')} /></Field>
      </div>

      <div>
        <div className="card-kicker">Antécédents connus</div>
        <div className="row">
          {REF.antecedents.map((a) => (
            <label className="check" key={a}>
              <input type="checkbox" checked={form.antecedents.includes(a)} onChange={(e) => cocher(a, e.target.checked)} />
              {a}
            </label>
          ))}
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={form.consentement} onChange={(e) => setForm({ ...form, consentement: e.target.checked })} />
        {compact
          ? 'J’accepte que ces informations de santé soient traitées pour ma prise en charge'
          : 'Consentement recueilli pour le traitement des données de santé'}
      </label>

      {children}
    </form>
  )
}
