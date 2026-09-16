// Prévision d'occupation (substitut du SVR quantile) et probabilité de sortie
// (substitut du SVM de survie). Générateur déterministe : mêmes entrées,
// mêmes sorties, pour que l'interface reste stable entre deux rendus.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const hash = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function forecastService(service, horizon = 30, opts = {}) {
  const { hausseAdmissions = 0, reductionBlocage = 0, litsSupp = 0 } = opts
  const r = rng(hash(service.id))
  const capacite = Math.max(1, service.litsArmes + litsSupp)
  let base = service.occupes
  const points = []
  for (let j = 1; j <= horizon; j++) {
    const saison = Math.sin((j / 7) * Math.PI) * service.litsArmes * 0.05
    const bruit = (r() - 0.5) * service.litsArmes * 0.08
    const derive = service.tendance * j * 0.35
    const prog = service.programmes * (j <= 7 ? 1 : 0.4)
    base = base + derive + saison * 0.3 + bruit
    const attendu = base * (1 + hausseAdmissions / 100) - service.bloques * (reductionBlocage / 100) + prog * 0.1
    const largeur = Math.max(1.2, Math.sqrt(j) * service.litsArmes * 0.055)
    points.push({
      jour: j,
      median: Math.max(0, +attendu.toFixed(1)),
      bas: Math.max(0, +(attendu - largeur).toFixed(1)),
      haut: +(attendu + largeur).toFixed(1),
      capacite
    })
  }
  return points
}

// Probabilité de dépasser la capacité armée à l'horizon donné.
export function probSaturation(points, jour) {
  const p = points.find((x) => x.jour === jour) ?? points[points.length - 1]
  if (!p) return 0
  const sigma = Math.max(0.4, (p.haut - p.bas) / 3.29) // intervalle à 90 %
  const z = (p.capacite - p.median) / sigma
  const cdf = 1 / (1 + Math.exp(-1.702 * z)) // approximation logistique de Φ
  return Math.max(0, Math.min(1, 1 - cdf))
}

export function decomposition(service) {
  const urgences = Math.round(service.occupes * 0.46)
  const programmes = Math.round(service.occupes * 0.19)
  const presents = Math.max(0, service.occupes - urgences - programmes)
  return [
    { label: 'Patients déjà présents (séjour restant estimé)', val: presents },
    { label: 'Admissions programmées connues', val: programmes },
    { label: 'Urgences imprévues (estimation)', val: urgences }
  ]
}

// Probabilité de sortie par jour — sortie du modèle de survie.
export function probaSortie(sejour) {
  const r = rng(hash(sejour.id))
  const base = Math.min(0.92, 0.12 + sejour.jours * 0.09 + r() * 0.25)
  return {
    j0: +(base * 0.55).toFixed(2),
    j1: +(base * 0.8).toFixed(2),
    j2: +Math.min(0.97, base * 1.0).toFixed(2)
  }
}

export const tensionNiveau = (taux) => (taux > 0.9 ? 'crit' : taux >= 0.7 ? 'warn' : 'ok')
export const tensionLabel = { ok: 'Sous contrôle', warn: 'Tension', crit: 'Saturation' }
