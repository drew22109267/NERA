/** Référentiels d'interface. Aucune donnée de patient : tout vient de l'API. */

export const ROLES = ['accueil', 'infirmier', 'medecin', 'gestionnaire', 'direction', 'data', 'admin', 'patient']

export const ROLE_LABEL = {
  accueil: 'Agent d’accueil',
  infirmier: 'Infirmier de triage',
  medecin: 'Médecin',
  gestionnaire: 'Gestionnaire de lits',
  direction: 'Direction',
  data: 'Data manager',
  admin: 'Administrateur',
  patient: 'Patient'
}

export const CATEGORIES = [
  { id: 1, label: 'Immédiat', delaiMin: 0 },
  { id: 2, label: 'Très urgent', delaiMin: 10 },
  { id: 3, label: 'Urgent', delaiMin: 60 },
  { id: 4, label: 'Non urgent', delaiMin: 240 }
]
export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? '—'
export const catDelai = (id) => CATEGORIES.find((c) => c.id === id)?.delaiMin ?? 0

export const AVPU = ['Alerte', 'Réponse à la voix', 'Réponse à la douleur', 'Non évalué']
export const MODES_ENTREE = ['À pied', 'Ambulance', 'Référé par un centre de santé', 'Transfert d’un autre hôpital']
export const ANTECEDENTS = ['HTA', 'Diabète', 'Drépanocytose', 'VIH', 'Asthme', 'Insuffisance rénale', 'Épilepsie', 'Grossesse en cours', 'Cardiopathie', 'Autre']
export const PAIEMENTS = ['Paiement direct', 'Mutuelle', 'Employeur', 'Indigent', 'Gratuité ciblée']
export const GRAVITES = ['Léger', 'Modéré', 'Sévère']
export const DEVENIRS = ['Réorienté (centre de santé)', 'Transféré (autre hôpital)', 'Reparti sans soins', 'Admis plus tard', 'Inconnu']
export const CATEGORIES_PIECE = ['Photo de plaie', 'Résultat de laboratoire', 'Imagerie', 'Compte rendu', 'Autre']

export const ACTIONS_DECISION = [
  'Admettre immédiatement dans le service',
  'Admettre en zone de débordement',
  'Orienter vers un autre établissement',
  'Différer avec nouvelle date',
  'Sortie après consultation'
]

/** Bornes physiologiques — identiques à celles validées côté API. */
export const BORNES = {
  pas: { min: 30, max: 300, unite: 'mmHg', label: 'PA systolique' },
  pad: { min: 10, max: 200, unite: 'mmHg', label: 'PA diastolique' },
  fc: { min: 20, max: 250, unite: '/min', label: 'Fréquence cardiaque' },
  fr: { min: 4, max: 80, unite: '/min', label: 'Fréquence respiratoire' },
  temperature: { min: 25, max: 45, unite: '°C', label: 'Température', pas: 0.1 },
  spo2: { min: 40, max: 100, unite: '%', label: 'SpO₂' },
  glycemie: { min: 0.1, max: 10, unite: 'g/L', label: 'Glycémie capillaire', pas: 0.1 },
  poids: { min: 0.5, max: 300, unite: 'kg', label: 'Poids', pas: 0.1 },
  glasgow: { min: 3, max: 15, unite: '/15', label: 'Score de Glasgow' },
  eva: { min: 0, max: 10, unite: '/10', label: 'Douleur EVA' }
}

export const validerBorne = (champ, valeur) => {
  if (valeur === '' || valeur === null || valeur === undefined) return null
  const b = BORNES[champ]
  if (!b) return null
  const n = Number(valeur)
  if (Number.isNaN(n)) return 'Valeur numérique attendue.'
  if (n < b.min || n > b.max) return `${b.label} attendue entre ${b.min} et ${b.max} ${b.unite}.`
  return null
}

export const niveauTension = (taux) => (taux > 0.9 ? 'crit' : taux >= 0.7 ? 'warn' : 'ok')
export const LIBELLE_TENSION = { ok: 'Sous contrôle', warn: 'Tension', crit: 'Saturation' }
export const SEV_PAR_NIVEAU = { ok: 'sev-4', warn: 'sev-3', crit: 'sev-1' }

export const minutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`)
export const dateFr = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')
export const dateHeureFr = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
export const ilYa = (iso) => {
  if (!iso) return '—'
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? "à l'instant" : `il y a ${minutes(m)}`
}
export const initiales = (nom = '') =>
  nom.split('—').pop().trim().split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
