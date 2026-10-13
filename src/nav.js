export const NAV = [
  { group: 'Menu principal', items: [
    { to: '/', label: 'Tableau de bord', icon: 'home', roles: ['accueil', 'infirmier', 'medecin', 'gestionnaire', 'direction', 'data', 'admin'] },
    { to: '/mon-espace', label: 'Mon espace santé', icon: 'heart', roles: ['patient'] },
    { to: '/patients', label: 'Dossiers patients', icon: 'users', roles: ['accueil', 'infirmier', 'medecin', 'admin'] },
    { to: '/admission', label: 'Nouvelle admission', icon: 'plus', roles: ['accueil', 'infirmier', 'admin'] },
    { to: '/file', label: 'File d\u2019attente', icon: 'list', roles: ['accueil', 'infirmier', 'medecin', 'admin'] },
    { to: '/orientation', label: 'Orientation des patients', icon: 'shuffle', roles: ['accueil', 'infirmier', 'medecin', 'gestionnaire', 'admin'] }
  ]},
  { group: 'Lits & capacité', items: [
    { to: '/lits', label: 'Occupation temps réel', icon: 'bed', roles: ['gestionnaire', 'medecin', 'direction', 'admin'] },
    { to: '/prevision', label: 'Prévision & simulateur', icon: 'chart', roles: ['gestionnaire', 'medecin', 'direction', 'admin'] },
    { to: '/sorties', label: 'Sorties attendues', icon: 'exit', roles: ['gestionnaire', 'medecin', 'admin'] },
    { to: '/demandes', label: 'Demandes non satisfaites', icon: 'clipboard', roles: ['gestionnaire', 'direction', 'admin'] }
  ]},
  { group: 'Programmation', items: [
    { to: '/rendez-vous', label: 'Rendez-vous & bloc', icon: 'calendar', roles: ['accueil', 'medecin', 'gestionnaire', 'admin', 'patient'] }
  ]},
  { group: 'Pilotage', items: [
    { to: '/rapports', label: 'Rapports & indicateurs', icon: 'report', roles: ['direction', 'gestionnaire', 'data', 'admin'] },
    { to: '/qualite', label: 'Qualité, audit & XAI', icon: 'shield', roles: ['data', 'admin', 'direction'] },
    { to: '/donnees', label: 'Dataset de recherche', icon: 'file', roles: ['data', 'admin', 'direction'] },
    { to: '/admin', label: 'Administration', icon: 'settings', roles: ['admin'] }
  ]}
]

export const canSee = (item, role) => item.roles === '*' || item.roles.includes(role)

/** Titres des écrans qui ne figurent pas dans le menu. */
export const TITRES_HORS_MENU = {
  '/mon-espace': 'Mon espace santé',
  '/profil': 'Mon profil',
  '/notifications': 'Notifications & alertes',
  '/utilisateurs': 'Utilisateur',
  '/patients': 'Dossiers patients',
  '/triage': 'Triage',
  '/decision': 'Décision d’orientation'
}

/**
 * Titre de la section courante — affiché dans la barre du haut, comme dans
 * la référence de design. Les pages n'affichent plus de titre elles-mêmes.
 */
export const titreSection = (pathname = '/') => {
  if (pathname === '/') return 'Tableau de bord'
  const exact = NAV.flatMap((g) => g.items).find((i) => i.to === pathname)
  if (exact) return exact.label
  const racine = '/' + pathname.split('/').filter(Boolean)[0]
  const parent = NAV.flatMap((g) => g.items).find((i) => i.to === racine)
  return TITRES_HORS_MENU[racine] ?? parent?.label ?? 'NERA'
}
