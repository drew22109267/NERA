import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { Modal } from '../components/Modal.jsx'
import { Link } from 'react-router-dom'
import { PageHead, Panel, Field, Etat, Alert, Empty, Bar, Pager, PAR_PAGE, RechercheTableau, useTableau } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { Confirm } from '../components/Modal.jsx'
import PatientForm, { PATIENT_VIDE, patientValide, depuisPatient } from '../components/PatientForm.jsx'
import { dateFr } from '../lib/referentiels.js'
import { ROLES, ROLE_LABEL, dateHeureFr, SEV_PAR_NIVEAU } from '../lib/referentiels.js'

const ONGLETS = [['services', 'Services & capacités'], ['seuils', 'Seuils & coûts'],
  ['comptes', 'Comptes'], ['patients', 'Patients'], ['modeles', 'Modèles']]

export default function Admin() {
  const toast = useToast()
  const [onglet, setOnglet] = useState('services')
  const [edition, setEdition] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [compteNouveau, setCompteNouveau] = useState(null)
  const [compteSuppr, setCompteSuppr] = useState(null)
  const [qPat, setQPat] = useState('')
  const [pagePat, setPagePat] = useState(1)
  const [patientForm, setPatientForm] = useState(null)   // { id?, ...champs }
  const [patientSuppr, setPatientSuppr] = useState(null)

  const services = useApi('/api/services')
  const parametres = useApi('/api/parametres')
  const comptes = useApi('/api/auth/utilisateurs')
  const etab = useApi('/api/parametres/etablissement')
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
      toast.succes('Rôle modifié', `${u.nom} → ${ROLE_LABEL[role]}`)
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
    ['nom', 'email', (u) => ROLE_LABEL[u.role] ?? u.role])
  const tblServices = useTableau(services.data ?? [], ['nom', 'code', 'pole'])

  const poles = [...new Set(tblServices.visibles.map((s) => s.pole))]

  return (
    <>
      <PageHead kicker="Administration & paramétrage"
        actions={<button className="btn btn-secondary" onClick={() => window.open(`${api.base}/swagger`, '_blank')}>
          Documentation de l’API
        </button>}>
        {etab.data
          ? `${etab.data?.nom} — ${etab.data?.categorie}, ${etab.data?.ville} (${etab.data?.region}).`
          : 'Services, seuils d’alerte, rapport de coûts, comptes et versions de modèle.'}
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
        <Panel kicker="Paramétrage" title="Capacités par service">
          <RechercheTableau valeur={tblServices.q} onChange={tblServices.setQ}
            placeholder="Rechercher un service, un code, un pôle…"
            total={tblServices.total} libelle="service" />
          <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
            vide={!services.data?.length} videTitre="Aucun service"
            videTexte="Le référentiel de services est amorcé au premier démarrage de l’API.">
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
                              <button className="btn btn-ghost" onClick={() => setEdition({ ...s })}>Modifier</button>
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
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
              Aucun modèle d’apprentissage n’est déployé. Trois fonctions du backend portent une
              implémentation par règles et exposent exactement la signature qu’aura l’appel au
              microservice de modèles :
            </p>
            <ul style={{ fontSize: 13, paddingLeft: 18, color: 'var(--muted)' }}>
              <li><code>TriageScoreService.Evaluer</code> — score et explication de triage</li>
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
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Mot de passe" hint="Au moins 8 caractères.">
                <input className="input" type="password" required minLength={8} value={compteNouveau.motDePasse}
                  onChange={(e) => setCompteNouveau({ ...compteNouveau, motDePasse: e.target.value })} />
              </Field>
              <Field label="Confirmation"
                erreur={compteNouveau.confirme && compteNouveau.confirme !== compteNouveau.motDePasse
                  ? 'Les deux saisies diffèrent.' : null}>
                <input className="input" type="password" required value={compteNouveau.confirme}
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
