import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Modal } from '../components/Modal.jsx'
import { Link } from 'react-router-dom'
import { PageHead, Panel, Field, Etat, Alert, Empty, Bar, Pager, PAR_PAGE, RechercheTableau, useTableau, MotDePasse } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { useReferentiels } from '../lib/ReferentielsContext.jsx'
import { Confirm } from '../components/Modal.jsx'
import PatientForm, { PATIENT_VIDE, patientValide, depuisPatient } from '../components/PatientForm.jsx'
import { REF, roleLabel, dateFr, dateHeureFr, SEV_PAR_NIVEAU } from '../lib/referentiels.js'

const ONGLETS = [['etablissement', 'Hôpitaux'], ['services', 'Services & lits'], ['orientation', 'Règles d’orientation'],
  ['listes', 'Listes & tarifs'], ['seuils', 'Seuils & coûts'], ['comptes', 'Comptes'], ['patients', 'Patients'], ['modeles', 'Modèles']]

export default function Admin() {
  const toast = useToast()
  const [onglet, setOnglet] = useState('etablissement')
  const [edition, setEdition] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [compteNouveau, setCompteNouveau] = useState(null)
  const [compteSuppr, setCompteSuppr] = useState(null)
  const [qPat, setQPat] = useState('')
  const [pagePat, setPagePat] = useState(1)
  const [patientForm, setPatientForm] = useState(null)   // { id?, ...champs }
  const [patientSuppr, setPatientSuppr] = useState(null)
  const [fiche, setFiche] = useState(null)          // création / édition d'un service
  const [serviceSuppr, setServiceSuppr] = useState(null)
  const [regle, setRegle] = useState(null)          // création / édition d'une règle
  const [regleSuppr, setRegleSuppr] = useState(null)
  const [etabForm, setEtabForm] = useState(null)      // { id?, nom, code, … }
  const [etabSuppr, setEtabSuppr] = useState(null)
  const [filtreEtab, setFiltreEtab] = useState('')
  const { ref, recharger: rechargerRef } = useReferentiels()

  const services = useApi('/api/services')
  const parametres = useApi('/api/parametres')
  const comptes = useApi('/api/auth/utilisateurs')
  const etabs = useApi('/api/etablissements')
  const listeEtabs = etabs.data ?? []
  const actifs = listeEtabs.filter((e) => e.actif)
  const nomEtab = (id) => listeEtabs.find((e) => e.id === id)?.nom ?? '—'
  const regles = useApi('/api/orientation/regles', null, { skip: onglet !== 'orientation' })
  const patients = useApi('/api/patients', { q: qPat, page: pagePat, pageSize: PAR_PAGE }, { skip: onglet !== 'patients' })

  const param = (cle, defaut) => parametres.data?.find((p) => p.cle === cle)?.valeur ?? defaut

  const enregistrerParam = async (cle, valeur) => {
    try {
      await api.put(`/api/parametres/${cle}`, { valeur: String(valeur) })
      parametres.recharger()
    } catch (e) { toast.erreur('Paramètre non enregistré', e.message) }
  }

  const enregistrerService = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      await api.put(`/api/services/${edition.id}`, {
        litsInstalles: Number(edition.litsInstalles), litsArmes: Number(edition.litsArmes),
        occupes: Number(edition.occupes), bloques: Number(edition.bloques),
        programmes: Number(edition.programmes), tendance: Number(edition.tendance ?? 0), actif: true
      })
      toast.succes('Capacité mise à jour', edition.nom)
      setEdition(null)
      services.recharger()
    } catch (e2) { toast.erreur('Modification refusée', e2.message) } finally { setEnvoi(false) }
  }

  const basculerCompte = async (u) => {
    try {
      await api.patch(`/api/auth/utilisateurs/${u.id}`, { actif: !u.actif })
      toast.succes(u.actif ? 'Compte désactivé' : 'Compte réactivé', u.email)
      comptes.recharger()
    } catch (e) { toast.erreur('Opération refusée', e.message) }
  }

  const changerRole = async (u, role) => {
    try {
      await api.patch(`/api/auth/utilisateurs/${u.id}`, { role })
      toast.succes('Rôle modifié', `${u.nom} → ${roleLabel(role)}`)
      comptes.recharger()
    } catch (e) { toast.erreur('Modification refusée', e.message) }
  }

  const creerCompte = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      await api.post('/api/auth/utilisateurs', {
        nom: compteNouveau.nom.trim(), email: compteNouveau.email.trim(),
        motDePasse: compteNouveau.motDePasse, role: compteNouveau.role
      })
      toast.succes('Compte créé', compteNouveau.email)
      setCompteNouveau(null)
      comptes.recharger()
    } catch (e2) { toast.erreur('Création refusée', e2.message) } finally { setEnvoi(false) }
  }

  const supprimerCompte = async (u) => {
    try {
      await api.del(`/api/auth/utilisateurs/${u.id}`)
      toast.succes('Compte supprimé', u.email)
      comptes.recharger()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const SERVICE_VIDE = { code: '', nom: '', pole: '', hospitalisation: true, urgencesCompatible: false, ageMin: 0, ageMax: 120, litsInstalles: 0, litsArmes: 0 }
  const REGLE_VIDE = { motif: '', serviceCode: '', serviceAlternatifCode: '', ageMin: 0, ageMax: 120, sexeRequis: '', categorieMax: '', commentaire: '', priorite: 100 }

  const enregistrerFiche = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const corps = { ...fiche, ageMin: Number(fiche.ageMin), ageMax: Number(fiche.ageMax),
        litsInstalles: Number(fiche.litsInstalles), litsArmes: Number(fiche.litsArmes),
        etablissementId: fiche.etablissementId ? Number(fiche.etablissementId) : null }
      delete corps.id
      if (fiche.id) await api.put(`/api/services/${fiche.id}/fiche`, corps)
      else await api.post('/api/services', corps)
      toast.succes(fiche.id ? 'Service modifié' : 'Service créé', fiche.nom)
      setFiche(null); services.recharger(); rechargerRef()
    } catch (e2) { toast.erreur('Enregistrement refusé', e2.message) } finally { setEnvoi(false) }
  }

  const supprimerService = async (svc) => {
    try {
      const r = await api.del(`/api/services/${svc.id}`)
      toast.succes(r?.desactive ? 'Service désactivé' : 'Service supprimé', r?.message ?? svc.nom)
      services.recharger(); rechargerRef()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const enregistrerRegle = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const corps = { ...regle, ageMin: Number(regle.ageMin), ageMax: Number(regle.ageMax),
        priorite: Number(regle.priorite), categorieMax: regle.categorieMax === '' ? null : Number(regle.categorieMax),
        serviceAlternatifCode: regle.serviceAlternatifCode || null, sexeRequis: regle.sexeRequis || null }
      delete corps.id
      if (regle.id) await api.put(`/api/orientation/regles/${regle.id}`, corps)
      else await api.post('/api/orientation/regles', corps)
      toast.succes(regle.id ? 'Règle modifiée' : 'Règle créée', regle.motif)
      setRegle(null); regles.recharger(); rechargerRef()
    } catch (e2) { toast.erreur('Enregistrement refusé', e2.message) } finally { setEnvoi(false) }
  }

  const supprimerRegle = async (r) => {
    try {
      await api.del(`/api/orientation/regles/${r.id}`)
      toast.succes('Règle supprimée', r.motif)
      regles.recharger(); rechargerRef()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const enregistrerEtab = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const corps = { nom: etabForm.nom, code: etabForm.code, categorie: etabForm.categorie, ville: etabForm.ville, region: etabForm.region }
      if (etabForm.id) await api.put(`/api/etablissements/${etabForm.id}`, corps)
      else await api.post('/api/etablissements', corps)
      toast.succes(etabForm.id ? 'Hôpital modifié' : 'Hôpital ajouté', etabForm.nom)
      setEtabForm(null); etabs.recharger(); rechargerRef()
    } catch (e2) { toast.erreur('Enregistrement refusé', e2.message) } finally { setEnvoi(false) }
  }

  const supprimerEtab = async (h) => {
    try {
      const r = await api.del(`/api/etablissements/${h.id}`)
      toast.succes(r?.desactive ? 'Hôpital désactivé' : 'Hôpital supprimé', r?.message ?? h.nom)
      etabs.recharger(); rechargerRef()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const enregistrerListe = async (cle, texte) => {
    try {
      await api.put(`/api/parametres/${cle}`, { valeur: texte })
      parametres.recharger(); rechargerRef()
      toast.succes('Liste enregistrée')
    } catch (e) { toast.erreur('Liste non enregistrée', e.message) }
  }

  const enregistrerPatient = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      const corps = { ...patientForm, age: Number(patientForm.age) }
      delete corps.id
      if (patientForm.id) await api.put(`/api/patients/${patientForm.id}`, corps)
      else await api.post('/api/patients', corps)
      toast.succes(patientForm.id ? 'Dossier modifié' : 'Dossier créé', `${patientForm.nom} ${patientForm.prenom}`)
      setPatientForm(null)
      patients.recharger()
    } catch (e2) { toast.erreur('Enregistrement refusé', e2.message) } finally { setEnvoi(false) }
  }

  const supprimerPatient = async (p) => {
    try {
      await api.del(`/api/patients/${p.id}/definitif`)
      toast.succes('Dossier supprimé', p.reference)
      patients.recharger()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const tblComptes = useTableau(comptes.data ?? [],
    ['nom', 'email', (u) => roleLabel(u.role) ?? u.role])
  const tblServices = useTableau((services.data ?? []).filter((s) => !filtreEtab || String(s.etablissementId) === filtreEtab),
    ['nom', 'code', 'pole', (s) => nomEtab(s.etablissementId)])

  const poles = [...new Set(tblServices.visibles.map((s) => s.pole))]

  return (
    <>
      <PageHead kicker="Administration & paramétrage"
        actions={<button className="btn btn-secondary" onClick={() => window.open(`${api.base}/swagger`, '_blank')}>
          Documentation de l’API
        </button>}>
        Hôpitaux, services et lits, règles d’orientation, listes, tarifs, seuils, comptes et modèles : tout se configure ici.
      </PageHead>

      <div className="seg" style={{ marginBottom: 'var(--space-4)' }}>
        {ONGLETS.map(([k, l]) => (
          <label className="seg-opt" key={k}>
            <input type="radio" name="adm" checked={onglet === k} onChange={() => setOnglet(k)} />
            {l}
          </label>
        ))}
      </div>

      {onglet === 'services' && (
        <Panel kicker="Paramétrage" title="Services et lits"
          actions={<>
            {actifs.length > 1 && (
              <select className="input" style={{ minHeight: 34, width: 'auto' }} value={filtreEtab}
                onChange={(e) => setFiltreEtab(e.target.value)} aria-label="Hôpital">
                <option value="">Tous les hôpitaux</option>
                {actifs.map((h) => <option key={h.id} value={h.id}>{h.nom || h.code || `Hôpital ${h.id}`}</option>)}
              </select>
            )}
            <button className="btn btn-primary btn-sm"
              onClick={() => setFiche({ ...SERVICE_VIDE, etablissementId: filtreEtab || (actifs.length === 1 ? String(actifs[0].id) : '') })}>
              <Icon name="plus" /> Nouveau service</button>
          </>}>
          <RechercheTableau valeur={tblServices.q} onChange={tblServices.setQ}
            placeholder="Rechercher un service, un code, un pôle…"
            total={tblServices.total} libelle="service" />
          <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
            vide={!services.data?.length} videTitre="Aucun service"
            videTexte="Aucun service n’est pré-rempli : créez-les avec le bouton « Nouveau service ».">
            <div className="stack">
              {poles.map((pole) => (
                <div key={pole}>
                  <div className="card-kicker">{pole}</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>Service</th><th className="num">Installés</th><th className="num">Armés</th>
                          <th className="num">Occupés</th><th className="num">Bloqués</th>
                          <th className="num">Programmés</th><th>Occupation</th><th /></tr>
                      </thead>
                      <tbody>
                        {tblServices.visibles.filter((s) => s.pole === pole).map((s) => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>{s.nom}<span className="sub">{s.code}
                              {actifs.length > 1 && ` · ${nomEtab(s.etablissementId)}`}
                              {!s.hospitalisation && ' · sans lits'}</span></td>
                            <td className="num">{s.litsInstalles}</td>
                            <td className="num">{s.litsArmes}</td>
                            <td className="num">{s.occupes}</td>
                            <td className="num">{s.bloques}</td>
                            <td className="num">{s.programmes}</td>
                            <td style={{ minWidth: 120 }}>
                              {s.litsArmes > 0
                                ? <><Bar value={s.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[s.niveau]} />
                                  <span className="sub">{Math.round(s.tauxOccupation * 100)} %</span></>
                                : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEdition({ ...s })}>Occupation</button>
                                <button className="icon-btn" title="Modifier la fiche"
                                  onClick={() => setFiche({ id: s.id, etablissementId: String(s.etablissementId), code: s.code, nom: s.nom, pole: s.pole, hospitalisation: s.hospitalisation, urgencesCompatible: s.urgencesCompatible, ageMin: s.ageMin, ageMax: s.ageMax, litsInstalles: s.litsInstalles, litsArmes: s.litsArmes })}>
                                  <Icon name="edit" /></button>
                                <button className="icon-btn danger" title="Supprimer" onClick={() => setServiceSuppr(s)}><Icon name="trash" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <Pager page={tblServices.page} pages={tblServices.pages} total={tblServices.total}
                pageSize={tblServices.parPage} onPage={tblServices.setPage} />
            </div>
          </Etat>
        </Panel>
      )}

      {onglet === 'etablissement' && (
        <div className="grid g-side">
          <Panel kicker="Identité" title="Hôpitaux"
            actions={<button className="btn btn-primary btn-sm"
              onClick={() => setEtabForm({ nom: '', code: '', categorie: '', ville: '', region: '' })}>
              <Icon name="plus" /> Nouvel hôpital
            </button>}>
            <Etat loading={etabs.loading} error={etabs.error} onRetry={etabs.recharger}
              vide={!listeEtabs.length} videTitre="Aucun hôpital">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Hôpital</th><th>Localisation</th><th className="num">Services</th><th>Rôle dans l’étude</th><th>État</th><th /></tr></thead>
                  <tbody>
                    {listeEtabs.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 600 }}>{h.nom || <span className="text-muted">non renseigné</span>}
                          <span className="sub">{[h.code, h.categorie].filter(Boolean).join(' · ') || '—'}</span></td>
                        <td>{[h.ville, h.region].filter(Boolean).join(' · ') || <span className="text-muted">—</span>}</td>
                        <td className="num">{h.services}</td>
                        <td>{h.roleRecherche
                          ? <span className={`tag ${h.roleRecherche === 'Développement' ? 'tag-brand' : 'tag-sev-4'}`}>{h.roleRecherche}</span>
                          : <Link to="/donnees" className="text-muted">à définir</Link>}</td>
                        <td><span className={`tag ${h.actif ? 'tag-sev-4' : 'tag-error'}`}>{h.actif ? 'Actif' : 'Désactivé'}</span></td>
                        <td>
                          <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                            <button className="icon-btn" title="Modifier"
                              onClick={() => setEtabForm({ id: h.id, nom: h.nom, code: h.code, categorie: h.categorie, ville: h.ville, region: h.region })}>
                              <Icon name="edit" /></button>
                            <button className="icon-btn danger" title="Supprimer" onClick={() => setEtabSuppr(h)}><Icon name="trash" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Etat>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
              Chaque hôpital a ses services et ses registres. Le rôle dans l’étude (développement ou
              validation externe) se choisit dans « Dataset de recherche », au vu de la comparaison des données.
            </p>
          </Panel>
          <Panel kicker="Mise en service" title="Ce qu’il reste à configurer">
            <div className="stack-sm">
              {[
                ['Hôpitaux renseignés', actifs.length > 0 && actifs.every((h) => !!h.nom)],
                ['Au moins un service avec des lits', (services.data ?? []).some((x) => x.litsArmes > 0)],
                ['Règles d’orientation', ref.motifsRecours.length > 0],
                ['Salles du bloc opératoire', ref.sallesBloc.length > 0],
                ['Grille tarifaire', (parametres.data ?? []).some((x) => x.cle.startsWith('tarif.') && x.valeur)]
              ].map(([l, ok]) => (
                <div key={l} className="row" style={{ gap: 10 }}>
                  <span className={`tag ${ok ? 'tag-sev-4' : 'tag-neutral'}`}>{ok ? 'Fait' : 'À faire'}</span>
                  <span style={{ fontSize: 14 }}>{l}</span>
                </div>
              ))}
            </div>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
              Rien n’est pré-rempli : chaque valeur affichée dans l’application vient de ce que vous saisissez ici.
            </p>
          </Panel>
        </div>
      )}

      {onglet === 'orientation' && (
        <Panel kicker="Redistribution" title="Règles motif → service"
          actions={<button className="btn btn-primary btn-sm" onClick={() => setRegle({ ...REGLE_VIDE })}>
            <Icon name="plus" /> Nouvelle règle</button>}>
          <Etat loading={regles.loading} error={regles.error} onRetry={regles.recharger}
            vide={!regles.data?.length} videTitre="Aucune règle"
            videTexte="Une règle associe un motif de recours à un service d’accueil, avec ses conditions d’âge, de sexe et de gravité.">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Priorité</th><th>Motif</th><th>Service</th><th>Repli</th><th>Âge</th><th>Sexe</th><th>Cat. max</th><th /></tr></thead>
                <tbody>
                  {regles.data?.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{r.priorite}</td>
                      <td style={{ fontWeight: 600 }}>{r.motif}{r.commentaire && <span className="sub">{r.commentaire}</span>}</td>
                      <td>{r.serviceCode}</td>
                      <td>{r.serviceAlternatifCode ?? <span className="text-muted">—</span>}</td>
                      <td>{r.ageMin}–{r.ageMax} ans</td>
                      <td>{r.sexeRequis ?? <span className="text-muted">tous</span>}</td>
                      <td>{r.categorieMax ?? <span className="text-muted">—</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <button className="icon-btn" title="Modifier" onClick={() => setRegle({ ...REGLE_VIDE, ...r, serviceAlternatifCode: r.serviceAlternatifCode ?? '', sexeRequis: r.sexeRequis ?? '', categorieMax: r.categorieMax ?? '', commentaire: r.commentaire ?? '' })}><Icon name="edit" /></button>
                          <button className="icon-btn danger" title="Supprimer" onClick={() => setRegleSuppr(r)}><Icon name="trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Etat>
        </Panel>
      )}

      {onglet === 'listes' && (
        <Etat loading={parametres.loading} error={parametres.error} onRetry={parametres.recharger}>
          <div className="grid g2">
            <Panel kicker="Listes de l’établissement" title="Valeurs proposées dans les formulaires">
              <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>Une valeur par ligne. Vide = valeur par défaut du système.</p>
              <div className="stack-sm">
                {(parametres.data ?? []).filter((x) => x.cle.startsWith('liste.')).map((x) => (
                  <Field key={x.cle} label={x.libelle}>
                    <textarea className="input" rows={3} defaultValue={x.valeur} key={x.cle + x.valeur}
                      onBlur={(e) => { if (e.target.value !== x.valeur) enregistrerListe(x.cle, e.target.value) }} />
                  </Field>
                ))}
              </div>
            </Panel>
            <Panel kicker="Grille tarifaire" title="Tarifs et couverture (FCFA)">
              <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>Sans tarif saisi, l’espace patient n’affiche aucune estimation de dépense.</p>
              <div className="form-grid">
                {(parametres.data ?? []).filter((x) => x.cle.startsWith('tarif.') || x.cle.startsWith('couverture.')).map((x) => (
                  <Field key={x.cle} label={x.libelle} hint={x.cle.startsWith('couverture.') ? 'Part couverte, de 0 à 1' : undefined}>
                    <input className="input" type="number" min="0" step={x.cle.startsWith('couverture.') ? '0.05' : '1'}
                      defaultValue={x.valeur} key={x.cle + x.valeur}
                      onBlur={(e) => { if (e.target.value !== x.valeur) enregistrerParam(x.cle, e.target.value) }} />
                  </Field>
                ))}
              </div>
            </Panel>
          </div>
        </Etat>
      )}

      {onglet === 'seuils' && (
        <Etat loading={parametres.loading} error={parametres.error} onRetry={parametres.recharger}>
          <div className="grid g-side">
            <Panel kicker="Alertes" title="Seuils de déclenchement">
              <div className="form-grid">
                {[['seuil.occupation', 'Seuil d’occupation (%)', 'Alerte au gestionnaire de lits', 50, 100],
                  ['seuil.occupation.bas', 'Seuil bas — hystérésis (%)', 'Aucune fermeture d’unité avant retour sous ce seuil', 40, 95],
                  ['seuil.horizonJours', 'Horizon d’alerte (jours)', 'Profondeur de la prévision surveillée', 1, 30],
                  ['seuil.delaiLitMax', 'Délai max d’attente d’un lit (min)', 'Au-delà, une demande non satisfaite est attendue', 15, 1440]
                ].map(([cle, label, hint, min, max]) => (
                  <Field key={cle} label={label} hint={hint}>
                    <input className="input" type="number" min={min} max={max}
                      defaultValue={param(cle, '')} key={param(cle, '')}
                      onBlur={(e) => enregistrerParam(cle, e.target.value)} />
                  </Field>
                ))}
              </div>
              <p className="text-muted" style={{ fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
                Les valeurs sont enregistrées dès que vous quittez le champ. La règle d’hystérésis
                évite les décisions oscillantes d’ouverture et de fermeture d’unité.
              </p>
            </Panel>

            <Panel kicker="Coût asymétrique" title="Rapport τ">
              <Field label={`τ = coût(pénurie) / (coût(pénurie) + coût(surcapacité)) — ${param('cout.tau', '0.7')}`}
                hint="Pilote le quantile visé par la prévision et le seuil des alertes">
                <input type="range" min="0.5" max="0.95" step="0.05"
                  defaultValue={param('cout.tau', '0.7')} key={param('cout.tau', '0.7')}
                  onChange={(e) => enregistrerParam('cout.tau', e.target.value)} />
              </Field>
              <p className="text-muted" style={{ fontSize: 13 }}>
                Une valeur élevée signifie qu’un lit manquant coûte plus cher qu’un lit inoccupé, et
                pousse la prévision vers le haut de l’intervalle.
              </p>
              <Alert level="info" title="Métrique recommandée">
                Lorsque la calibration monétaire est difficile, préférez un indicateur clinique direct —
                patients réorientés évités — à un coût exprimé en francs CFA.
              </Alert>
            </Panel>

            <Panel kicker="Dataset de recherche" title="Indicateurs hospitaliers et coffre-fort">
              <div className="form-grid">
                <Field label="Début de la période de test final" hint="Les jours à partir de cette date ne sont comptés dans aucun indicateur">
                  <input className="input" type="date" defaultValue={param('recherche.dateVerrou', '')} key={param('recherche.dateVerrou', '')}
                    onBlur={(e) => e.target.value && enregistrerParam('recherche.dateVerrou', e.target.value)} />
                </Field>
                <Field label="Fenêtre de censure (jours)" hint="Un séjour sans sortie admis depuis moins longtemps est jugé encore en cours">
                  <input className="input" type="number" min="1" max="365" defaultValue={param('recherche.fenetreCensure', '30')}
                    key={param('recherche.fenetreCensure', '30')} onBlur={(e) => enregistrerParam('recherche.fenetreCensure', e.target.value)} />
                </Field>
              </div>
              <p className="text-muted" style={{ fontSize: 12.5, margin: 'var(--space-3) 0 0' }}>
                Nombre de jours sans date de sortie : les deux façons de compter (nuits, ou jour d’entrée et de sortie compris)
                sont prises en compte automatiquement, d’après les lignes où la sortie est écrite. Rien à régler ici.
              </p>
            </Panel>
          </div>
        </Etat>
      )}

      {onglet === 'comptes' && (
        <Panel kicker="Sécurité" title="Comptes et rôles"
          actions={
            <button className="btn btn-primary btn-sm"
              onClick={() => setCompteNouveau({ nom: '', email: '', motDePasse: '', confirme: '', role: 'infirmier' })}>
              <Icon name="plus" /> Nouveau compte
            </button>
          }>
          <RechercheTableau valeur={tblComptes.q} onChange={tblComptes.setQ}
            placeholder="Rechercher un nom, une adresse, un rôle…"
            total={tblComptes.total} libelle="compte" />

          <Etat loading={comptes.loading} error={comptes.error} onRetry={comptes.recharger}
            vide={!tblComptes.total} videTitre="Aucun compte"
            videTexte={tblComptes.q ? 'Aucun compte ne correspond à cette recherche.' : 'Créez le premier compte.'}>
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Nom</th><th>Adresse</th><th>Rôle</th><th>Dernière connexion</th><th>État</th><th /></tr>
                  </thead>
                  <tbody>
                    {tblComptes.visibles.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>
                          <Link to={`/utilisateurs/${u.id}`}>{u.nom}</Link>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <select className="input" style={{ minHeight: 34, width: 'auto' }}
                            value={u.role} onChange={(e) => changerRole(u, e.target.value)}>
                            {Object.keys(REF.roles).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                          </select>
                        </td>
                        <td>{u.derniereConnexion ? dateHeureFr(u.derniereConnexion) : <span className="text-muted">jamais</span>}</td>
                        <td><span className={`tag ${u.actif ? 'tag-sev-4' : 'tag-error'}`}>{u.actif ? 'Actif' : 'Désactivé'}</span></td>
                        <td>
                          <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                            <Link to={`/utilisateurs/${u.id}`} className="icon-btn" title="Consulter le profil">
                              <Icon name="user" />
                            </Link>
                            <button className="icon-btn" title={u.actif ? 'Désactiver' : 'Réactiver'}
                              onClick={() => basculerCompte(u)}>
                              <Icon name={u.actif ? 'ban' : 'check'} />
                            </button>
                            <button className="icon-btn danger" title="Supprimer"
                              onClick={() => setCompteSuppr(u)}>
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={tblComptes.page} pages={tblComptes.pages} total={tblComptes.total}
                pageSize={tblComptes.parPage} onPage={tblComptes.setPage} />
              <Alert level="warn" title="Avant mise en service">
                Les comptes initiaux partagent le mot de passe d’amorçage défini dans la configuration
                de l’API. Ils doivent être changés, et l’authentification à deux facteurs activée pour
                les rôles d’administration. Les mots de passe sont hachés (BCrypt) côté serveur et ne
                transitent jamais en clair dans le navigateur.
              </Alert>
            </>
          </Etat>
        </Panel>
      )}

      {onglet === 'patients' && (
        <Panel kicker="Dossiers" title="Patients"
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => setPatientForm({ ...PATIENT_VIDE })}>
              <Icon name="plus" /> Nouveau dossier
            </button>
          }>
          <RechercheTableau valeur={qPat} onChange={(v) => { setQPat(v); setPagePat(1) }}
            placeholder="Rechercher un nom, un téléphone, un n° de dossier…"
            total={patients.data?.total} libelle="dossier" />
          <Etat loading={patients.loading} error={patients.error} onRetry={patients.recharger}
            vide={!patients.data?.items?.length} videTitre="Aucun dossier"
            videTexte={qPat ? 'Aucun dossier ne correspond à cette recherche.' : 'Créez le premier dossier.'}>
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Dossier</th><th>Patient</th><th>Âge / sexe</th><th>Téléphone</th><th>Créé le</th><th /></tr>
                  </thead>
                  <tbody>
                    {patients.data?.items?.map((p) => (
                      <tr key={p.id}>
                        <td><Link to={`/patients/${p.id}`}>{p.reference}</Link></td>
                        <td style={{ fontWeight: 600 }}>{p.nom} {p.prenom}
                          <span className="sub">{p.email ?? 'sans adresse'}</span></td>
                        <td>{p.age} ans · {p.sexe}</td>
                        <td>{p.telephone ?? <span className="text-muted">—</span>}</td>
                        <td>{dateFr(p.creeLe)}</td>
                        <td>
                          <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                            <Link to={`/patients/${p.id}`} className="icon-btn" title="Consulter le dossier">
                              <Icon name="file" />
                            </Link>
                            <button className="icon-btn" title="Modifier"
                              onClick={() => setPatientForm({ id: p.id, ...depuisPatient(p) })}>
                              <Icon name="edit" />
                            </button>
                            <button className="icon-btn danger" title="Supprimer définitivement"
                              onClick={() => setPatientSuppr(p)}>
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={patients.data?.page} pages={patients.data?.pages} total={patients.data?.total}
                pageSize={patients.data?.pageSize} onPage={setPagePat} />
            </>
          </Etat>
        </Panel>
      )}

      {onglet === 'modeles' && (
        <div className="grid g-side">
          <Panel kicker="Couche modèles" title="Versions déployées">
            <Etat loading={parametres.loading} error={parametres.error} onRetry={parametres.recharger}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Usage</th><th>Clé</th><th>Version active</th><th>État</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Triage — score de priorité</td>
                      <td>modele.triage</td>
                      <td>
                        <input className="input" style={{ minHeight: 34 }} defaultValue={param('modele.triage', '')}
                          key={param('modele.triage', '')} onBlur={(e) => enregistrerParam('modele.triage', e.target.value)} />
                      </td>
                      <td><span className="tag tag-brand">Règles</span></td>
                    </tr>
                    <tr>
                      <td>Prévision de capacité</td>
                      <td>modele.prevision</td>
                      <td>
                        <input className="input" style={{ minHeight: 34 }} defaultValue={param('modele.prevision', '')}
                          key={param('modele.prevision', '')} onBlur={(e) => enregistrerParam('modele.prevision', e.target.value)} />
                      </td>
                      <td><span className="tag tag-brand">Règles</span></td>
                    </tr>
                    <tr>
                      <td>Probabilité de sortie</td>
                      <td>—</td>
                      <td><span className="text-muted">intégrée à la prévision</span></td>
                      <td><span className="tag tag-neutral">Règles</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Etat>
          </Panel>

          <Panel kicker="Apprentissage automatique" title="Emplacement prévu">
            <p style={{ fontSize: 13.5 }}>
              Aucun modèle d’apprentissage n’est déployé. Trois fonctions du backend renvoient
              « non disponible » et exposent exactement la signature qu’aura l’appel au microservice
              de modèles — aucune valeur n’est simulée en attendant :
            </p>
            <ul style={{ fontSize: 13, paddingLeft: 18, color: 'var(--muted)' }}>
              <li><code>TriageScoreService.Evaluer</code> — catégorie et explication de triage (les scores cliniques publiés restent calculés)</li>
              <li><code>PrevisionCapaciteService.Prevoir</code> — médiane et intervalle d’occupation</li>
              <li><code>PrevisionCapaciteService.ProbaSortie</code> — probabilité de sortie par jour</li>
            </ul>
            <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
              Chaque appel est déjà journalisé avec son entrée, sa sortie, son explication et la
              décision humaine : le jeu d’entraînement se constitue dès la mise en service, et le
              retour arrière vers une version antérieure se fait en changeant la clé ci-contre.
            </p>
          </Panel>
        </div>
      )}

      {fiche && (
        <Modal titre={fiche.id ? 'Modifier le service' : 'Nouveau service'} large onClose={() => setFiche(null)}
          sousTitre="Les lits individuels sont créés ou retirés automatiquement selon le nombre de lits armés."
          actions={<>
            <button className="btn btn-secondary" onClick={() => setFiche(null)}>Annuler</button>
            <button className="btn btn-primary" form="form-fiche" type="submit" disabled={envoi}>Enregistrer</button>
          </>}>
          <form id="form-fiche" className="stack" onSubmit={enregistrerFiche}>
            <div className="form-grid">
              {actifs.length > 1 && (
                <Field label="Hôpital *" hint={fiche.id ? 'Un service ne change pas d’hôpital' : undefined}>
                  <select className="input" required disabled={!!fiche.id} value={fiche.etablissementId ?? ''}
                    onChange={(e) => setFiche({ ...fiche, etablissementId: e.target.value })}>
                    <option value="">—</option>
                    {actifs.map((h) => <option key={h.id} value={h.id}>{h.nom || h.code}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Code *" hint="Court, unique dans l’hôpital (ex. SAU, MED, PED)">
                <input className="input" required minLength={2} maxLength={12} value={fiche.code}
                  onChange={(e) => setFiche({ ...fiche, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Nom *"><input className="input" required minLength={2} value={fiche.nom} onChange={(e) => setFiche({ ...fiche, nom: e.target.value })} /></Field>
              <Field label="Pôle *"><input className="input" required minLength={2} value={fiche.pole} onChange={(e) => setFiche({ ...fiche, pole: e.target.value })} list="poles" /></Field>
              <Field label="Lits installés"><input className="input" type="number" min="0" value={fiche.litsInstalles} onChange={(e) => setFiche({ ...fiche, litsInstalles: e.target.value })} /></Field>
              <Field label="Lits armés (avec personnel)"><input className="input" type="number" min="0" value={fiche.litsArmes} onChange={(e) => setFiche({ ...fiche, litsArmes: e.target.value })} /></Field>
              <Field label="Âge minimum"><input className="input" type="number" min="0" max="120" value={fiche.ageMin} onChange={(e) => setFiche({ ...fiche, ageMin: e.target.value })} /></Field>
              <Field label="Âge maximum"><input className="input" type="number" min="0" max="120" value={fiche.ageMax} onChange={(e) => setFiche({ ...fiche, ageMax: e.target.value })} /></Field>
            </div>
            <datalist id="poles">{poles.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="row" style={{ gap: 18 }}>
              <label className="check"><input type="checkbox" checked={fiche.hospitalisation} onChange={(e) => setFiche({ ...fiche, hospitalisation: e.target.checked })} /> Service d’hospitalisation (avec lits)</label>
              <label className="check"><input type="checkbox" checked={fiche.urgencesCompatible} onChange={(e) => setFiche({ ...fiche, urgencesCompatible: e.target.checked })} /> Accueille des patients depuis les urgences</label>
            </div>
          </form>
        </Modal>
      )}

      {serviceSuppr && (
        <Confirm titre="Supprimer ce service" danger confirmer="Supprimer"
          message={`« ${serviceSuppr.nom} » et ses lits seront supprimés. S’il a un historique de passages ou de séjours, il sera seulement désactivé.`}
          onConfirm={() => supprimerService(serviceSuppr)} onClose={() => setServiceSuppr(null)} />
      )}

      {regle && (
        <Modal titre={regle.id ? 'Modifier la règle' : 'Nouvelle règle d’orientation'} large onClose={() => setRegle(null)}
          actions={<>
            <button className="btn btn-secondary" onClick={() => setRegle(null)}>Annuler</button>
            <button className="btn btn-primary" form="form-regle" type="submit" disabled={envoi || !regle.motif.trim() || !regle.serviceCode}>Enregistrer</button>
          </>}>
          <form id="form-regle" className="stack" onSubmit={enregistrerRegle}>
            <div className="form-grid">
              <Field label="Motif de recours *"><input className="input" required value={regle.motif} onChange={(e) => setRegle({ ...regle, motif: e.target.value })} list="motifs" /></Field>
              <Field label="Service d’accueil *">
                <select className="input" required value={regle.serviceCode} onChange={(e) => setRegle({ ...regle, serviceCode: e.target.value })}>
                  <option value="">—</option>{(services.data ?? []).map((x) => <option key={x.id} value={x.code}>{x.code} · {x.nom}</option>)}
                </select></Field>
              <Field label="Service de repli">
                <select className="input" value={regle.serviceAlternatifCode} onChange={(e) => setRegle({ ...regle, serviceAlternatifCode: e.target.value })}>
                  <option value="">aucun</option>{(services.data ?? []).map((x) => <option key={x.id} value={x.code}>{x.code} · {x.nom}</option>)}
                </select></Field>
              <Field label="Priorité" hint="1 = examinée en premier"><input className="input" type="number" min="1" value={regle.priorite} onChange={(e) => setRegle({ ...regle, priorite: e.target.value })} /></Field>
              <Field label="Âge minimum"><input className="input" type="number" min="0" max="120" value={regle.ageMin} onChange={(e) => setRegle({ ...regle, ageMin: e.target.value })} /></Field>
              <Field label="Âge maximum"><input className="input" type="number" min="0" max="120" value={regle.ageMax} onChange={(e) => setRegle({ ...regle, ageMax: e.target.value })} /></Field>
              <Field label="Sexe requis"><select className="input" value={regle.sexeRequis} onChange={(e) => setRegle({ ...regle, sexeRequis: e.target.value })}><option value="">tous</option><option value="F">Féminin</option><option value="M">Masculin</option></select></Field>
              <Field label="Catégorie de triage maximale" hint="Vide = toutes">
                <select className="input" value={regle.categorieMax} onChange={(e) => setRegle({ ...regle, categorieMax: e.target.value })}>
                  <option value="">toutes</option>{REF.categories.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}
                </select></Field>
            </div>
            <datalist id="motifs">{ref.motifsRecours.map((m) => <option key={m} value={m} />)}</datalist>
            <Field label="Commentaire"><input className="input" value={regle.commentaire} onChange={(e) => setRegle({ ...regle, commentaire: e.target.value })} /></Field>
          </form>
        </Modal>
      )}

      {regleSuppr && (
        <Confirm titre="Supprimer cette règle" danger confirmer="Supprimer"
          message={`La règle « ${regleSuppr.motif} → ${regleSuppr.serviceCode} » sera supprimée.`}
          onConfirm={() => supprimerRegle(regleSuppr)} onClose={() => setRegleSuppr(null)} />
      )}

      {etabForm && (
        <Modal titre={etabForm.id ? 'Modifier l’hôpital' : 'Nouvel hôpital'} onClose={() => setEtabForm(null)}
          actions={<>
            <button className="btn btn-secondary" onClick={() => setEtabForm(null)}>Annuler</button>
            <button className="btn btn-primary" form="form-etab" type="submit" disabled={envoi || !etabForm.nom.trim()}>Enregistrer</button>
          </>}>
          <form id="form-etab" className="stack-sm" onSubmit={enregistrerEtab}>
            {[['nom', 'Nom *'], ['code', 'Code'], ['categorie', 'Catégorie'], ['ville', 'Ville'], ['region', 'Région']].map(([k, l]) => (
              <Field key={k} label={l}><input className="input" required={k === 'nom'} value={etabForm[k]} onChange={(e) => setEtabForm({ ...etabForm, [k]: e.target.value })} /></Field>
            ))}
          </form>
        </Modal>
      )}

      {etabSuppr && (
        <Confirm titre="Supprimer cet hôpital" danger confirmer="Supprimer"
          message={`« ${etabSuppr.nom} » sera supprimé. S’il a des services ou des données importées, il sera seulement désactivé.`}
          onConfirm={() => supprimerEtab(etabSuppr)} onClose={() => setEtabSuppr(null)} />
      )}

      {patientForm && (
        <Modal titre={patientForm.id ? 'Modifier le dossier' : 'Nouveau dossier patient'} large
          onClose={() => setPatientForm(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setPatientForm(null)}>Annuler</button>
              <button className="btn btn-primary" form="form-patient-admin" type="submit"
                disabled={envoi || !patientValide(patientForm)}>
                {patientForm.id ? 'Enregistrer' : 'Créer le dossier'}
              </button>
            </>
          }>
          <PatientForm id="form-patient-admin" form={patientForm} setForm={setPatientForm} onSubmit={enregistrerPatient} />
        </Modal>
      )}

      {patientSuppr && (
        <Confirm titre="Supprimer ce dossier" danger confirmer="Supprimer définitivement"
          message={`Le dossier ${patientSuppr.reference} (${patientSuppr.nom} ${patientSuppr.prenom}) et tout son historique — passages, séjours, rendez-vous, pièces jointes — seront effacés. Cette action est irréversible.`}
          onConfirm={() => supprimerPatient(patientSuppr)} onClose={() => setPatientSuppr(null)} />
      )}

      {compteNouveau && (
        <Modal titre="Nouveau compte" sousTitre="Le rôle détermine les écrans accessibles."
          onClose={() => setCompteNouveau(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setCompteNouveau(null)}>Annuler</button>
              <button className="btn btn-primary" form="form-compte" type="submit"
                disabled={envoi || compteNouveau.motDePasse.length < 8
                  || compteNouveau.motDePasse !== compteNouveau.confirme}>
                Créer le compte
              </button>
            </>
          }>
          <form id="form-compte" className="stack-sm" onSubmit={creerCompte}>
            <Field label="Nom et fonction">
              <input className="input" required minLength={2} value={compteNouveau.nom}
                onChange={(e) => setCompteNouveau({ ...compteNouveau, nom: e.target.value })} />
            </Field>
            <Field label="Adresse électronique">
              <input className="input" type="email" required value={compteNouveau.email}
                onChange={(e) => setCompteNouveau({ ...compteNouveau, email: e.target.value })} />
            </Field>
            <Field label="Rôle">
              <select className="input" value={compteNouveau.role}
                onChange={(e) => setCompteNouveau({ ...compteNouveau, role: e.target.value })}>
                {Object.keys(REF.roles).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Mot de passe" hint="Au moins 8 caractères.">
                <MotDePasse required minLength={8} value={compteNouveau.motDePasse}
                  onChange={(e) => setCompteNouveau({ ...compteNouveau, motDePasse: e.target.value })} />
              </Field>
              <Field label="Confirmation"
                erreur={compteNouveau.confirme && compteNouveau.confirme !== compteNouveau.motDePasse
                  ? 'Les deux saisies diffèrent.' : null}>
                <MotDePasse required value={compteNouveau.confirme}
                  onChange={(e) => setCompteNouveau({ ...compteNouveau, confirme: e.target.value })} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {compteSuppr && (
        <Confirm titre="Supprimer ce compte" danger confirmer="Supprimer"
          message={`Le compte ${compteSuppr.email} sera définitivement supprimé. Cette action est irréversible.`}
          onConfirm={() => supprimerCompte(compteSuppr)} onClose={() => setCompteSuppr(null)} />
      )}

      {edition && (
        <Modal titre={`Capacité — ${edition.nom}`} onClose={() => setEdition(null)}
          sousTitre="Les lits armés ne peuvent pas dépasser les lits installés, ni occupés + bloqués dépasser les lits armés."
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setEdition(null)}>Annuler</button>
              <button className="btn btn-primary" form="form-service" type="submit" disabled={envoi}>
                {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer'}
              </button>
            </>
          }>
          <form id="form-service" className="form-grid" onSubmit={enregistrerService}>
            {[['litsInstalles', 'Lits installés'], ['litsArmes', 'Lits armés (avec personnel)'],
              ['occupes', 'Occupés'], ['bloques', 'Bloqués (motif non médical)'],
              ['programmes', 'Admissions programmées']].map(([k, label]) => (
              <Field key={k} label={label}>
                <input className="input" type="number" min="0" max="2000" value={edition[k] ?? 0}
                  onChange={(e) => setEdition({ ...edition, [k]: e.target.value })} />
              </Field>
            ))}
          </form>
        </Modal>
      )}
    </>
  )
}
