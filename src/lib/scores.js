// Scores dérivés + moteur de triage (substitut du service SVM).
// En production, remplacer `predictTriage` par un appel à l'API du microservice modèle.

export const CATEGORIES = [
  { id: 1, label: 'Immédiat', delaiMin: 0 },
  { id: 2, label: 'Très urgent', delaiMin: 10 },
  { id: 3, label: 'Urgent', delaiMin: 60 },
  { id: 4, label: 'Non urgent', delaiMin: 240 }
]

export const MOTIFS = [
  'Traumatisme / accident', 'Douleur thoracique', 'Détresse respiratoire',
  'Fièvre / suspicion paludisme', 'Douleur abdominale', 'Trouble de la conscience',
  'Convulsions', 'Obstétrique / grossesse', 'Pédiatrie — fièvre/diarrhée',
  'Hémorragie', 'Intoxication / morsure', 'Complication diabète / HTA',
  'Drépanocytose — crise', 'Infection / plaie', 'Post-opératoire', 'Autre'
]

export const AVPU = ['Alerte', 'Réponse à la voix', 'Réponse à la douleur', 'Non évalué']

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export function derivedScores(v) {
  const pas = num(v.pas), pad = num(v.pad), fc = num(v.fc), fr = num(v.fr)
  const temp = num(v.temp), spo2 = num(v.spo2)
  const shockIndex = pas && fc ? +(fc / pas).toFixed(2) : null
  const pam = pas && pad ? Math.round((pas + 2 * pad) / 3) : null

  let qsofa = 0, qsofaKnown = 0
  if (fr !== null) { qsofaKnown++; if (fr >= 22) qsofa++ }
  if (pas !== null) { qsofaKnown++; if (pas <= 100) qsofa++ }
  if (v.avpu) { qsofaKnown++; if (v.avpu !== 'Alerte' && v.avpu !== 'Non évalué') qsofa++ }

  let mews = 0
  if (fr !== null) mews += fr <= 8 ? 2 : fr <= 14 ? 0 : fr <= 20 ? 1 : fr <= 29 ? 2 : 3
  if (fc !== null) mews += fc <= 40 ? 2 : fc <= 50 ? 1 : fc <= 100 ? 0 : fc <= 110 ? 1 : fc <= 129 ? 2 : 3
  if (pas !== null) mews += pas <= 70 ? 3 : pas <= 80 ? 2 : pas <= 100 ? 1 : pas <= 199 ? 0 : 2
  if (temp !== null) mews += temp < 35 ? 2 : temp <= 38.4 ? 0 : 2
  if (spo2 !== null) mews += spo2 < 90 ? 3 : spo2 < 94 ? 1 : 0
  if (v.avpu === 'Réponse à la voix') mews += 1
  if (v.avpu === 'Réponse à la douleur') mews += 2

  return { shockIndex, pam, qsofa, qsofaKnown, mews }
}

// Score de priorité — combinaison linéaire pondérée, structure identique à
// celle d'un SVM à noyau linéaire : chaque variable porte une contribution
// signée directement exposable comme explication (XAI).
const MOTIFS_GRAVES = ['Détresse respiratoire', 'Trouble de la conscience', 'Convulsions', 'Hémorragie', 'Douleur thoracique']

export function predictTriage(v) {
  const d = derivedScores(v)
  const contrib = []
  const push = (label, w) => { if (w) contrib.push({ label, w: +w.toFixed(2) }) }

  const fr = num(v.fr), fc = num(v.fc), pas = num(v.pas), spo2 = num(v.spo2)
  const temp = num(v.temp), age = num(v.age), gly = num(v.glycemie), eva = num(v.eva)

  if (fr !== null) push(`Fréquence respiratoire ${fr}/min`, fr >= 30 ? 1.3 : fr >= 22 ? 0.7 : fr < 10 ? 1.1 : -0.2)
  if (spo2 !== null) push(`SpO₂ ${spo2} %`, spo2 < 90 ? 1.5 : spo2 < 94 ? 0.6 : -0.3)
  if (pas !== null) push(`PA systolique ${pas} mmHg`, pas <= 80 ? 1.6 : pas <= 100 ? 0.8 : pas >= 200 ? 0.6 : -0.2)
  if (fc !== null) push(`Fréquence cardiaque ${fc}/min`, fc >= 130 ? 1.0 : fc >= 110 ? 0.5 : fc <= 45 ? 0.9 : -0.15)
  if (d.shockIndex !== null) push(`Index de choc ${d.shockIndex}`, d.shockIndex >= 1.2 ? 1.2 : d.shockIndex >= 0.9 ? 0.5 : 0)
  if (temp !== null) push(`Température ${temp} °C`, temp >= 39.5 ? 0.5 : temp < 35 ? 0.8 : 0)
  if (gly !== null) push(`Glycémie ${gly} g/L`, gly < 0.6 ? 1.1 : gly > 3 ? 0.6 : 0)
  if (v.avpu === 'Réponse à la voix') push('Conscience — réponse à la voix', 0.9)
  if (v.avpu === 'Réponse à la douleur') push('Conscience — réponse à la douleur', 1.7)
  if (age !== null) push(`Âge ${age} ans`, age >= 70 ? 0.4 : age <= 5 ? 0.5 : -0.1)
  if (eva !== null && eva >= 8) push(`Douleur EVA ${eva}/10`, 0.4)
  if (MOTIFS_GRAVES.includes(v.motif)) push(`Motif : ${v.motif}`, 0.6)
  if (v.modeEntree === 'Ambulance') push('Arrivée en ambulance', 0.4)
  if (v.antecedents?.includes('Grossesse en cours')) push('Grossesse en cours', 0.3)
  if (v.antecedents?.includes('Drépanocytose')) push('Drépanocytose', 0.25)

  const score = contrib.reduce((s, c) => s + c.w, 0)
  const categorie = score >= 3.2 ? 1 : score >= 1.8 ? 2 : score >= 0.6 ? 3 : 4

  // Confiance : marge à la frontière de décision la plus proche.
  const bornes = [3.2, 1.8, 0.6]
  const marge = Math.min(...bornes.map((b) => Math.abs(score - b)))
  const confiance = Math.max(0.42, Math.min(0.97, 0.55 + marge / 3))

  // Champs manquants — pénalisent la confiance, jamais imputés silencieusement.
  const manquants = [
    fr === null && 'fréquence respiratoire',
    pas === null && 'PA systolique',
    spo2 === null && 'SpO₂',
    (!v.avpu || v.avpu === 'Non évalué') && 'niveau de conscience'
  ].filter(Boolean)

  const conf = Math.max(0.35, confiance - manquants.length * 0.07)

  return {
    score: +score.toFixed(2),
    categorie,
    confiance: +conf.toFixed(2),
    incertain: conf < 0.65,
    manquants,
    contributions: contrib.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 5),
    derives: d,
    modele: 'svm-triage-r3'
  }
}

export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? '—'
export const catDelai = (id) => CATEGORIES.find((c) => c.id === id)?.delaiMin ?? 0

export function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

export function depassement(passage) {
  if (!passage.categorie || passage.statut !== 'En attente') return false
  return minutesSince(passage.arrivee) > catDelai(passage.categorie)
}
