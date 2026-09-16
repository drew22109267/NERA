# Triage & Lits — application hospitalière

Frontend React + Vite. **Aucune donnée n'est simulée côté client** : tout provient de
l'API .NET (`../backend`). Si une donnée manque, l'écran l'indique explicitement
plutôt que d'afficher une valeur inventée.

## Démarrer

```bash
# 1. l'API doit tourner (voir ../backend/README.md)
cd backend/HopitalApi && dotnet run      # http://localhost:5080

# 2. le frontend
cd app
cp .env.example .env      # adapter VITE_API_URL si l'API n'est pas sur le port 5080
npm install
npm run dev               # http://localhost:5173
```


*
Production : `npm run build` puis `npm run preview`.

## Connexion

Les comptes sont créés par l'API au premier démarrage, avec le mot de passe
d'amorçage de sa configuration (`demo1234` par défaut) :

| Rôle | Adresse | Ce qu'il voit |
| --- | --- | --- |
| Agent d'accueil | accueil@hopital.cm | Dossiers, admissions, file, orientation |
| Infirmier de triage | infirmier@hopital.cm | + fiche de triage |
| Médecin | medecin@hopital.cm | + décision, lits, prévision, sorties |
| Gestionnaire de lits | lits@hopital.cm | Lits, prévision, sorties, demandes, bloc |
| Direction | direction@hopital.cm | Rapports, qualité, capacité |
| Data manager | data@hopital.cm | Qualité, audit, journal des modèles |
| Administrateur | admin@hopital.cm | Tout, plus le paramétrage |

Le rôle **patient** se crée depuis l'écran d'inscription : il ouvre l'espace patient
(suivi de statut, demande de rendez-vous, droits sur ses données) et ne donne accès
à aucun autre dossier.

## Écrans

**Soins** — Tableau de bord · Dossiers patients (pagination, tri, détection de
doublons, pièces jointes) · Nouvelle admission · Fiche de triage (constantes bornées,
scores dérivés, score expliqué, validation ou correction motivée) · File d'attente
priorisée · Décision patient · **Orientation des patients** (redistribution par
pathologie).

**Lits & capacité** — Occupation temps réel par pôle et par service · Prévision avec
intervalle et simulateur « et si » · Sorties attendues et blocages non médicaux ·
Registre des demandes non satisfaites.

**Programmation** — Rendez-vous et bloc opératoire (créneaux pondérés par le risque de
saturation du service d'aval) · Notifications et alertes, avec aperçu du SMS patient.

**Pilotage** — Rapports et indicateurs (export CSV, sauvegarde JSON, impression) ·
Qualité, audit et explicabilité (complétude et équité calculées sur les données
réelles, journal des prédictions, journal d'accès aux dossiers) · Administration.

## Redistribution des patients

L'écran **Orientation** croise quatre sources et justifie chaque proposition en clair :
la filière clinique du motif de recours, les bornes d'âge et de sexe du service, la
catégorie de triage, et les lits réellement libres. Le référentiel couvre les services
d'un hôpital de 1re catégorie : urgences, réanimation, USI, médecine interne et
spécialités médicales, chirurgies, mère-enfant, néonatalogie, psychiatrie, plateau
technique et unité d'isolement.

## Structure

```
src/
  api/client.js        appels HTTP, jeton, erreurs en français
  api/hooks.js         useApi / useAction / useEnLigne / useTri
  auth/AuthContext.jsx session JWT (seul le jeton est conservé localement)
  components/          shell, graphiques SVG, toasts, modales, pagination, tri
  lib/referentiels.js  libellés, catégories, bornes physiologiques, formatage
  pages/               un fichier par écran
  styles/theme.css     système visuel complet
```

## Système visuel

Trois familles de couleur strictement séparées, pour qu'une teinte n'ait jamais deux
sens selon l'écran :

1. **Marque** (orange) — logo, action primaire, focus. Rien d'autre.
2. **Gravité** (`--sev-1` à `--sev-4`) — triage, tension des lits, gravité d'un refus.
   Toujours accompagnée d'un libellé et d'une trame, pour rester lisible sans
   distinguer les teintes (deutéranopie).
3. **Séries de données** (`--viz-*`) — graphiques, sans aucun sens clinique.

Une anomalie système porte un contour et un triangle ⚠ ; une catégorie de triage porte
un chiffre dans un disque plein. Deux formes distinctes, jamais confondues.

## Points connus, à dire en soutenance

- **Aucun modèle d'apprentissage n'est déployé.** Le score de triage, la prévision et
  la probabilité de sortie sont des règles pondérées, à l'emplacement exact du futur
  appel au microservice de modèles. Chaque appel est déjà journalisé avec son entrée,
  sa sortie, son explication et la décision humaine : le jeu d'entraînement se
  constitue dès la mise en service.
- Les échanges entre postes se font par interrogation périodique (30 à 60 s) ; un hub
  SignalR est le prochain ajout pour du temps réel strict.
- Installation en PWA disponible (manifeste + service worker). La coquille est mise en
  cache pour ouvrir l'application hors réseau, mais **aucune donnée clinique n'est
  servie depuis le cache** : hors ligne, l'interface le dit et suspend les
  enregistrements. Une file d'écriture locale (IndexedDB) reste à ajouter.
- La passerelle SMS/USSD n'est pas connectée : les messages sont enregistrés et
  affichés, avec un aperçu du rendu côté téléphone, sans envoi réel.
- Textes en français uniquement ; l'internationalisation n'est pas en place.
- Pas de mode sombre.
