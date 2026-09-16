/**
 * Statistiques de l'espace patient — tout est dérivé des données déjà
 * renvoyées par l'API (dossier, passages, rendez-vous, séjours). Aucune
 * valeur n'est inventée : quand une mesure manque, elle vaut `null` et
 * l'interface l'affiche comme « non mesuré ».
 *
 * Les montants sont des ESTIMATIONS calculées à partir de la grille
 * tarifaire ci-dessous ; elle est à aligner sur la grille réelle de
 * l'établissement (ou à remplacer par un appel de facturation).
 */

/**
 * Grille tarifaire et couverture : AUCUNE valeur par défaut n'est inventée.
 * Les montants viennent des paramètres de l'établissement (/api/parametres),
 * saisis par l'administrateur. Sans paramétrage, l'espace patient n'affiche
 * simplement aucune statistique de dépense.
 *
 * Clés attendues côté paramètres :
 *   tarif.consultation, tarif.triage, tarif.categorie.1 … .4,
 *   tarif.journeeHospitalisation, tarif.laboratoire, tarif.imagerie,
 *   tarif.medicaments, tarif.rendezVous
 *   couverture.<mode de paiement>  (part couverte, 0 à 1)
 */
export const CLES_TARIFS = {
  consultation: 'tarif.consultation',
  triage: 'tarif.triage',
  cat1: 'tarif.categorie.1',
  cat2: 'tarif.categorie.2',
  cat3: 'tarif.categorie.3',
  cat4: 'tarif.categorie.4',
  journeeHospitalisation: 'tarif.journeeHospitalisation',
  laboratoire: 'tarif.laboratoire',
  imagerie: 'tarif.imagerie',
  medicaments: 'tarif.medicaments',
  rendezVous: 'tarif.rendezVous'
}

const valeurParam = (parametres, cle) => {
  const p = (parametres ?? []).find((x) => x.cle === cle)
  if (!p) return null
  const n = Number(p.valeur)
  return Number.isFinite(n) ? n : null
}

/**
 * Construit la grille à partir des paramètres. Renvoie null si aucun tarif
 * n'est renseigné : l'interface doit alors ne rien afficher plutôt que
 * d'estimer sur des montants imaginaires.
 */
export function tarifsDepuisParametres(parametres) {
  const t = {}
  Object.entries(CLES_TARIFS).forEach(([k, cle]) => { t[k] = valeurParam(parametres, cle) })
  const renseignes = Object.values(t).filter((v) => v !== null && v > 0)
  if (!renseignes.length) return null
  const v = (x) => x ?? 0
  return {
    consultation: v(t.consultation),
    triage: v(t.triage),
    parCategorie: { 1: v(t.cat1), 2: v(t.cat2), 3: v(t.cat3), 4: v(t.cat4) },
    journeeHospitalisation: v(t.journeeHospitalisation),
    laboratoire: v(t.laboratoire),
    imagerie: v(t.imagerie),
    medicaments: v(t.medicaments),
    rendezVous: v(t.rendezVous),
    clesRenseignees: renseignes.length
  }
}

/** Part prise en charge par le tiers payeur — paramétrable, sinon inconnue. */
export function couvertureDepuisParametres(parametres, modePaiement) {
  if (!modePaiement) return null
  const v = valeurParam(parametres, `couverture.${modePaiement}`)
  if (v === null) return null
  return Math.max(0, Math.min(1, v > 1 ? v / 100 : v))
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export const fcfa = (m) =>
  `${Math.round(m || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const jours = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null)

/** Les n derniers mois, du plus ancien au plus récent. */
export function derniersMois(n = 12) {
  const out = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ cle: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: MOIS_COURTS[m.getMonth()] })
  }
  return out
}

const cleMois = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Compte des éléments par mois sur la fenêtre demandée. */
export function parMois(items, champDate, mois = derniersMois()) {
  const index = new Map(mois.map((m) => [m.cle, 0]))
  ;(items ?? []).forEach((it) => {
    const k = cleMois(typeof champDate === 'function' ? champDate(it) : it?.[champDate])
    if (k && index.has(k)) index.set(k, index.get(k) + 1)
  })
  return mois.map((m) => index.get(m.cle))
}

/** Somme par mois d'une valeur portée par chaque élément. */
export function sommeParMois(items, champDate, valeur, mois = derniersMois()) {
  const index = new Map(mois.map((m) => [m.cle, 0]))
  ;(items ?? []).forEach((it) => {
    const k = cleMois(typeof champDate === 'function' ? champDate(it) : it?.[champDate])
    if (k && index.has(k)) index.set(k, index.get(k) + (valeur(it) || 0))
  })
  return mois.map((m) => index.get(m.cle))
}

/** Passages du patient, du plus récent au plus ancien. */
export const mesPassages = (passages, patientId) =>
  (passages ?? [])
    .filter((p) => patientId === undefined || String(p.patientId) === String(patientId))
    .slice()
    .sort((a, b) => new Date(b.arrivee) - new Date(a.arrivee))

/* ─────────────────────────────────────────────────────────────
   1. Constantes dans le temps
   ──────────────────────────────────────────────────────────── */

export const MESURES = [
  { cle: 'pas', label: 'Tension (PA systolique)', unite: ' mmHg', normal: { min: 100, max: 139 }, couleur: 'var(--viz-1)' },
  { cle: 'fc', label: 'Fréquence cardiaque', unite: '/min', normal: { min: 60, max: 100 }, couleur: 'var(--viz-2)' },
  { cle: 'spo2', label: 'SpO₂', unite: ' %', normal: { min: 95, max: 100 }, couleur: 'var(--viz-3)' },
  { cle: 'temperature', label: 'Température', unite: ' °C', normal: { min: 36, max: 37.8 }, couleur: 'var(--sev-2)' },
  { cle: 'glycemie', label: 'Glycémie capillaire', unite: ' g/L', normal: { min: 0.7, max: 1.1 }, couleur: 'var(--viz-2)' },
  { cle: 'poids', label: 'Poids', unite: ' kg', normal: null, couleur: 'var(--viz-4)' }
]

/**
 * Série chronologique des constantes relevées à chaque triage.
 * Les mesures absentes restent trouées : la courbe ne les invente pas.
 */
export function serieConstantes(passages, patientId) {
  const avec = mesPassages(passages, patientId)
    .filter((p) => p.triage)
    .slice(0, 10)
    .reverse()
  return avec.map((p) => {
    const t = p.triage ?? {}
    return {
      date: p.arrivee,
      reference: p.reference,
      pas: num(t.pas),
      pad: num(t.pad),
      fc: num(t.fc),
      fr: num(t.fr),
      spo2: num(t.spo2),
      temperature: num(t.temperature ?? t.temp),
      glycemie: num(t.glycemie),
      poids: num(t.poids),
      eva: num(t.eva),
      avpu: t.avpu ?? null
    }
  })
}

export const derniereMesure = (serie, cle) => {
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i][cle] !== null) return serie[i][cle]
  return null
}

/* ─────────────────────────────────────────────────────────────
   2. Risque de réadmission à 30 jours
   ──────────────────────────────────────────────────────────── */

/**
 * Score explicable (0–100) : chaque facteur apporte des points visibles à
 * l'écran, comme le fait le triage. Heuristique documentée, jamais une
 * prédiction opaque — à remplacer par le microservice modèle en production.
 */
export function risqueReadmission({ dossier, passages, rdv }) {
  const p12 = mesPassages(passages).filter((p) => jours(p.arrivee) !== null && jours(p.arrivee) <= 365)
  const dernier = p12[0]
  const serie = serieConstantes(passages)
  const contributions = []
  const add = (label, points, detail) => { if (points) contributions.push({ label, points, detail }) }

  const n = p12.length
  add(`${n} passage${n > 1 ? 's' : ''} sur 12 mois`,
    n >= 4 ? 28 : n === 3 ? 20 : n === 2 ? 12 : n === 1 ? 5 : 0,
    'Un recours répété aux urgences est le premier facteur de réadmission.')

  const jDernier = dernier ? jours(dernier.arrivee) : null
  add(jDernier !== null ? `Dernier passage il y a ${jDernier} jour${jDernier > 1 ? 's' : ''}` : 'Aucun passage récent',
    jDernier === null ? 0 : jDernier <= 30 ? 18 : jDernier <= 90 ? 8 : 0,
    'La fenêtre de risque est la plus forte dans les 30 jours qui suivent un passage.')

  const age = num(dossier?.age)
  add(age !== null ? `Âge ${age} ans` : 'Âge non renseigné',
    age === null ? 0 : age >= 70 ? 12 : age >= 60 ? 7 : age <= 5 ? 8 : 0,
    'Les âges extrêmes majorent le risque de retour.')

  const ant = dossier?.antecedents ?? []
  add(ant.length ? `${ant.length} antécédent${ant.length > 1 ? 's' : ''} déclaré${ant.length > 1 ? 's' : ''}` : 'Aucun antécédent déclaré',
    Math.min(21, ant.length * 7),
    ant.length ? ant.join(' · ') : 'Déclarez vos antécédents à l’accueil pour affiner ce score.')

  const graves = p12.filter((p) => p.categorie === 1 || p.categorie === 2).length
  add(graves ? `${graves} passage${graves > 1 ? 's' : ''} en priorité 1–2` : 'Aucun passage en priorité haute',
    graves ? Math.min(14, 7 * graves) : 0,
    'Une prise en charge urgente récente pèse sur le risque de retour.')

  const manques = (rdv ?? []).filter((r) => r.statut === 'Manqué').length
  add(manques ? `${manques} rendez-vous manqué${manques > 1 ? 's' : ''}` : 'Rendez-vous honorés',
    manques ? Math.min(12, 6 * manques) : -4,
    'Le suivi programmé est ce qui évite le mieux un retour aux urgences.')

  const spo2 = derniereMesure(serie, 'spo2')
  add(spo2 !== null ? `SpO₂ ${spo2} % au dernier triage` : 'SpO₂ non mesurée',
    spo2 === null ? 0 : spo2 < 94 ? 8 : 0, 'Saturation basse au dernier relevé.')

  const pas = derniereMesure(serie, 'pas')
  add(pas !== null ? `PA systolique ${pas} mmHg` : 'Tension non mesurée',
    pas === null ? 0 : pas >= 160 || pas <= 90 ? 7 : 0, 'Tension hors cible au dernier relevé.')

  const gly = derniereMesure(serie, 'glycemie')
  add(gly !== null ? `Glycémie ${gly} g/L` : 'Glycémie non mesurée',
    gly === null ? 0 : gly >= 2 ? 7 : 0, 'Glycémie élevée au dernier relevé.')

  const score = Math.max(2, Math.min(96, contributions.reduce((s, c) => s + c.points, 0)))
  const niveau = score >= 60 ? 'crit' : score >= 35 ? 'warn' : 'ok'
  const manquants = [
    spo2 === null && 'SpO₂',
    pas === null && 'tension artérielle',
    age === null && 'âge'
  ].filter(Boolean)

  return {
    score,
    niveau,
    libelle: { crit: 'Risque élevé', warn: 'Risque modéré', ok: 'Risque faible' }[niveau],
    horizon: '30 jours',
    contributions: contributions.sort((a, b) => b.points - a.points),
    manquants,
    confiance: Math.max(0.4, 0.95 - manquants.length * 0.12)
  }
}

/* ─────────────────────────────────────────────────────────────
   3. Risques liés aux maladies chroniques
   ──────────────────────────────────────────────────────────── */

const REGLES = {
  HTA: {
    nom: 'Hypertension artérielle',
    suivi: 'Tension à chaque passage, objectif < 140/90 mmHg',
    evaluer: ({ serie }) => {
      const pas = derniereMesure(serie, 'pas')
      const pad = derniereMesure(serie, 'pad')
      if (pas === null) return { score: 45, detail: 'Tension non relevée au dernier passage — contrôle à programmer.' }
      const s = pas >= 180 ? 88 : pas >= 160 ? 72 : pas >= 140 ? 55 : pas >= 130 ? 38 : 22
      return { score: s, detail: `Dernière mesure ${pas}${pad ? `/${pad}` : ''} mmHg.` }
    }
  },
  Diabète: {
    nom: 'Diabète',
    suivi: 'Glycémie capillaire, objectif 0,7–1,1 g/L à jeun',
    evaluer: ({ serie }) => {
      const g = derniereMesure(serie, 'glycemie')
      if (g === null) return { score: 45, detail: 'Glycémie non relevée — contrôle à programmer.' }
      const s = g >= 3 ? 90 : g >= 2 ? 74 : g >= 1.26 ? 56 : g < 0.6 ? 80 : 24
      return { score: s, detail: `Dernière glycémie ${g} g/L.` }
    }
  },
  Asthme: {
    nom: 'Asthme',
    suivi: 'SpO₂ et fréquence respiratoire',
    evaluer: ({ serie, crises }) => {
      const spo2 = derniereMesure(serie, 'spo2')
      const fr = derniereMesure(serie, 'fr')
      let s = 28 + crises * 12
      if (spo2 !== null && spo2 < 94) s += 25
      if (fr !== null && fr >= 22) s += 15
      return { score: Math.min(92, s), detail: `SpO₂ ${spo2 ?? 'non mesurée'}${spo2 !== null ? ' %' : ''} · ${crises} crise(s) respiratoire(s) sur 12 mois.` }
    }
  },
  Drépanocytose: {
    nom: 'Drépanocytose',
    suivi: 'Fréquence des crises vaso-occlusives',
    evaluer: ({ crises }) => ({
      score: Math.min(92, 34 + crises * 16),
      detail: `${crises} crise(s) enregistrée(s) sur les 12 derniers mois.`
    })
  },
  'Insuffisance rénale': {
    nom: 'Insuffisance rénale',
    suivi: 'Tension, poids et créatinine',
    evaluer: ({ serie }) => {
      const pas = derniereMesure(serie, 'pas')
      const s = pas !== null && pas >= 150 ? 72 : 48
      return { score: s, detail: `Suivi néphrologique à maintenir · tension ${pas ?? 'non mesurée'}${pas !== null ? ' mmHg' : ''}.` }
    }
  },
  Cardiopathie: {
    nom: 'Cardiopathie',
    suivi: 'Fréquence cardiaque et tension',
    evaluer: ({ serie }) => {
      const fc = derniereMesure(serie, 'fc')
      const s = fc !== null && (fc >= 110 || fc <= 50) ? 74 : 46
      return { score: s, detail: `Fréquence cardiaque ${fc ?? 'non mesurée'}${fc !== null ? '/min' : ''}.` }
    }
  },
  VIH: {
    nom: 'VIH',
    suivi: 'Observance du traitement et infections répétées',
    evaluer: ({ infections }) => ({
      score: Math.min(88, 36 + infections * 12),
      detail: `${infections} épisode(s) infectieux sur 12 mois.`
    })
  },
  Épilepsie: {
    nom: 'Épilepsie',
    suivi: 'Fréquence des crises convulsives',
    evaluer: ({ convulsions }) => ({
      score: Math.min(90, 32 + convulsions * 18),
      detail: `${convulsions} crise(s) convulsive(s) enregistrée(s) sur 12 mois.`
    })
  },
  'Grossesse en cours': {
    nom: 'Grossesse en cours',
    suivi: 'Tension et consultations prénatales',
    evaluer: ({ serie }) => {
      const pas = derniereMesure(serie, 'pas')
      const s = pas !== null && pas >= 140 ? 78 : 40
      return { score: s, detail: `Tension ${pas ?? 'non mesurée'}${pas !== null ? ' mmHg' : ''} — surveillance de la pré-éclampsie.` }
    }
  }
}

const niveauDe = (s) => (s >= 65 ? 'crit' : s >= 40 ? 'warn' : 'ok')

/**
 * Un risque par maladie chronique déclarée, plus les dépistages suggérés
 * quand une constante sort des bornes sans antécédent connu.
 */
export function risquesChroniques({ dossier, passages }) {
  const serie = serieConstantes(passages)
  const p12 = mesPassages(passages).filter((p) => jours(p.arrivee) !== null && jours(p.arrivee) <= 365)
  const compte = (mot) => p12.filter((p) => (p.motif ?? '').toLowerCase().includes(mot)).length
  const ctx = {
    serie,
    crises: compte('drépan') + compte('respiratoire'),
    infections: compte('infection') + compte('fièvre'),
    convulsions: compte('convulsion')
  }

  const suivis = (dossier?.antecedents ?? [])
    .map((a) => {
      const r = REGLES[a]
      if (!r) return { nom: a, score: 42, niveau: 'warn', detail: 'Antécédent déclaré — pas de règle de suivi automatique.', suivi: 'Suivi clinique', declare: true }
      const e = r.evaluer(ctx)
      return { nom: r.nom, score: e.score, niveau: niveauDe(e.score), detail: e.detail, suivi: r.suivi, declare: true }
    })

  const dejaSuivi = (n) => suivis.some((s) => s.nom === n)
  const depistages = []
  const pas = derniereMesure(serie, 'pas')
  const gly = derniereMesure(serie, 'glycemie')
  const spo2 = derniereMesure(serie, 'spo2')
  if (pas !== null && pas >= 140 && !dejaSuivi('Hypertension artérielle')) {
    depistages.push({ nom: 'Hypertension à confirmer', score: pas >= 160 ? 62 : 46, niveau: niveauDe(pas >= 160 ? 62 : 46), detail: `Tension ${pas} mmHg relevée sans antécédent d’HTA déclaré.`, suivi: 'Trois mesures à distance des urgences', declare: false })
  }
  if (gly !== null && gly >= 1.26 && !dejaSuivi('Diabète')) {
    depistages.push({ nom: 'Hyperglycémie à confirmer', score: gly >= 2 ? 64 : 45, niveau: niveauDe(gly >= 2 ? 64 : 45), detail: `Glycémie ${gly} g/L relevée sans diabète déclaré.`, suivi: 'Glycémie à jeun en laboratoire', declare: false })
  }
  if (spo2 !== null && spo2 < 94 && !dejaSuivi('Asthme')) {
    depistages.push({ nom: 'Saturation basse à explorer', score: spo2 < 90 ? 70 : 48, niveau: niveauDe(spo2 < 90 ? 70 : 48), detail: `SpO₂ ${spo2} % au dernier triage.`, suivi: 'Consultation pneumologique', declare: false })
  }

  return [...suivis, ...depistages].sort((a, b) => b.score - a.score)
}

/* ─────────────────────────────────────────────────────────────
   4. Dépenses estimées
   ──────────────────────────────────────────────────────────── */

const coutPassage = (p, t) => {
  let m = t.consultation
  if (p.triage) m += t.triage
  m += t.parCategorie[p.categorie] ?? 0
  if (p.categorie === 1 || p.categorie === 2) m += t.laboratoire + t.imagerie
  else if (p.categorie === 3) m += t.laboratoire
  m += t.medicaments
  return m
}

/**
 * Reconstitue une estimation de dépense par passage, par rendez-vous honoré
 * et par journée d'hospitalisation, puis répartit entre part couverte et
 * reste à charge selon le mode de paiement du dossier.
 */
export function depenses({ dossier, passages, rdv, sejours, mois = derniersMois(), tarifs }) {
  if (!tarifs) return { configure: false, total: 0, parPoste: [], serieMensuelle: mois.map(() => 0) }

  const t = tarifs
  const p = mesPassages(passages)
  const rdvHonores = (rdv ?? []).filter((r) => r.statut === 'Honoré')
  const sej = sejours ?? []

  const serieMensuelle = mois.map((m, i) => {
    const passagesMois = sommeParMois(p, 'arrivee', (x) => coutPassage(x, t), mois)[i]
    const rdvMois = sommeParMois(rdvHonores, 'date', () => t.rendezVous, mois)[i]
    const sejMois = sommeParMois(sej, 'entree', (s) => (s.jours ?? 0) * t.journeeHospitalisation, mois)[i]
    return passagesMois + rdvMois + sejMois
  })

  const parPoste = [
    { nom: 'Consultations & triage', montant: p.length * t.consultation + p.filter((x) => x.triage).length * t.triage },
    { nom: 'Actes selon priorité', montant: p.reduce((s, x) => s + (t.parCategorie[x.categorie] ?? 0), 0) },
    { nom: 'Laboratoire & imagerie', montant: p.reduce((s, x) => s + (x.categorie === 1 || x.categorie === 2 ? t.laboratoire + t.imagerie : x.categorie === 3 ? t.laboratoire : 0), 0) },
    { nom: 'Médicaments', montant: p.length * t.medicaments },
    { nom: 'Hospitalisation', montant: sej.reduce((s, x) => s + (x.jours ?? 0) * t.journeeHospitalisation, 0) },
    { nom: 'Consultations programmées', montant: rdvHonores.length * t.rendezVous }
  ].filter((x) => x.montant > 0).sort((a, b) => b.montant - a.montant)

  const total = parPoste.reduce((s, x) => s + x.montant, 0)
  const partCouverte = tarifs.couverture ?? null

  return {
    configure: true,
    total,
    couvert: partCouverte === null ? null : Math.round(total * partCouverte),
    resteACharge: partCouverte === null ? total : Math.round(total * (1 - partCouverte)),
    partCouverte,
    modePaiement: dossier?.modePaiement ?? 'non renseigné',
    serieMensuelle,
    total12Mois: serieMensuelle.reduce((s, v) => s + v, 0),
    moyenneParPassage: p.length ? Math.round(total / p.length) : 0,
    parPoste
  }
}

/* ─────────────────────────────────────────────────────────────
   5. Recours aux soins et assiduité
   ──────────────────────────────────────────────────────────── */

export function recours({ passages, rdv, mois = derniersMois() }) {
  const p = mesPassages(passages)
  const p12 = p.filter((x) => jours(x.arrivee) !== null && jours(x.arrivee) <= 365)
  const attentes = p.map((x) => num(x.attenteMinutes)).filter((v) => v !== null)

  const categories = [1, 2, 3, 4].map((c) => ({
    cat: c,
    n: p12.filter((x) => x.categorie === c).length
  }))
  const nonTries = p12.filter((x) => !x.categorie).length

  const r = rdv ?? []
  const honores = r.filter((x) => x.statut === 'Honoré').length
  const manques = r.filter((x) => x.statut === 'Manqué').length
  const annules = r.filter((x) => x.statut === 'Annulé').length
  const aVenir = r.filter((x) => x.statut !== 'Annulé' && new Date(x.date) >= new Date(new Date().toDateString())).length
  const passes = honores + manques

  return {
    passages12Mois: p12.length,
    passagesTotal: p.length,
    serieMensuelle: parMois(p, 'arrivee', mois),
    attenteMoyenne: attentes.length ? Math.round(attentes.reduce((s, v) => s + v, 0) / attentes.length) : null,
    attenteSerie: p.slice(0, 8).reverse().map((x) => num(x.attenteMinutes) ?? 0),
    motifFrequent: (() => {
      const c = new Map()
      p12.forEach((x) => c.set(x.motif, (c.get(x.motif) ?? 0) + 1))
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    })(),
    categories,
    nonTries,
    rdv: { honores, manques, annules, aVenir, total: r.length, assiduite: passes ? Math.round((honores / passes) * 100) : null }
  }
}
