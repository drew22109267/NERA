/**
 * Référentiels d'interface.
 *
 * Aucune liste métier n'est écrite ici : tout est chargé depuis
 * GET /api/referentiels au démarrage (voir ReferentielsContext) et déposé dans
 * `REF`. Les énumérations du domaine (statuts, catégories, bornes) appartiennent
 * au serveur ; les listes propres à l'établissement (salles, motifs, modes
 * d'entrée…) sont saisies dans Administration. Ce module ne garde que des
 * fonctions de présentation.
 */

/** Référentiels courants — remplis par ReferentielsProvider avant tout rendu. */
export let REF = {
  roles: {}, categories: [], bornes: {}, mesures: [],
  statutsPassage: [], statutsRendezVous: [], avpu: [], gravites: [], devenirs: [],
  categoriesPiece: [], actionsDecision: [], typesAudit: [],
  modesEntree: [], motifsBlocage: [], typesNotification: [], sallesBloc: [],
  antecedents: [], paiements: [], canaux: [], destinataires: [], motifsRecours: [],
  categoriesDiagnostic: [], issues: [], etablissements: [],
  services: [], vierge: true
}
export const setReferentiels = (r) => { REF = { ...REF, ...r } }

export const roleLabel = (r) => REF.roles?.[r] ?? r
export const catLabel = (id) => REF.categories.find((c) => c.id === id)?.label ?? '—'
export const catDelai = (id) => REF.categories.find((c) => c.id === id)?.delaiMin ?? 0

/** Validation d'une constante contre les bornes renvoyées par l'API. */
export const validerBorne = (champ, valeur) => {
  if (valeur === '' || valeur === null || valeur === undefined) return null
  const b = REF.bornes?.[champ]
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
