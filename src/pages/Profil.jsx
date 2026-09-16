import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { Modal, Confirm } from '../components/Modal.jsx'
import { Avatar, Icon } from '../components/Icon.jsx'
import { PageHead, Panel, Field, Etat, Alert } from '../components/ui.jsx'
import { ROLES, ROLE_LABEL, dateHeureFr } from '../lib/referentiels.js'

function Ligne({ label, children }) {
  return (
    <div className="profil-ligne">
      <span className="lbl">{label}</span>
      <span className="val">{children}</span>
    </div>
  )
}

export default function Profil() {
  const { id } = useParams()
  const { user, roleLabel } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  // Sans identifiant dans l'adresse, on regarde son propre compte.
  const soi = !id || String(id) === String(user.id)
  const fiche = useApi(soi ? '/api/auth/moi' : `/api/auth/utilisateurs/${id}`, null, { skip: false })
  const u = fiche.data

  const estAdmin = user.role === 'admin'
  const [edition, setEdition] = useState(null)
  const [mdp, setMdp] = useState(null)
  const [suppr, setSuppr] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  const patch = async (corps, message) => {
    setEnvoi(true)
    try {
      await api.patch(`/api/auth/utilisateurs/${u.id}`, corps)
      toast.succes(message, u.email)
      fiche.recharger()
      setEdition(null); setMdp(null)
    } catch (e) { toast.erreur('Opération refusée', e.message) } finally { setEnvoi(false) }
  }

  const supprimer = async () => {
    try {
      await api.del(`/api/auth/utilisateurs/${u.id}`)
      toast.succes('Compte supprimé', u.email)
      nav('/admin', { replace: true })
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  return (
    <>
      <PageHead kicker={soi ? 'Mon compte' : 'Administration · compte'}
        title={soi ? 'Mon profil' : (u?.nom ?? 'Compte')}
        actions={!soi && estAdmin
          ? <Link to="/admin" className="btn btn-secondary"><Icon name="exit" /> Retour aux comptes</Link>
          : null}>
        {soi
          ? 'Vos informations de connexion et le rôle qui détermine les écrans auxquels vous avez accès.'
          : 'Fiche du compte, son rôle et son activité de connexion.'}
      </PageHead>

      <Etat loading={fiche.loading} error={fiche.error} onRetry={fiche.recharger}
        vide={!u} videTitre="Compte introuvable">
        <div className="grid g-side">
          <Panel kicker="Identité" title="Informations du compte"
            actions={estAdmin && u && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setEdition({ ...u })}>
                  <Icon name="edit" /> Modifier
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setMdp({ motDePasse: '', confirme: '' })}>
                  <Icon name="key" /> Mot de passe
                </button>
              </>
            )}>
            <div className="profil-tete">
              <Avatar size={72} />
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>{u?.nom}</h3>
                <p className="text-muted" style={{ margin: '2px 0 8px', fontSize: 14 }}>{u?.email}</p>
                <div className="row" style={{ gap: 6 }}>
                  <span className="tag tag-brand">{ROLE_LABEL[u?.role] ?? u?.role}</span>
                  <span className={`tag ${u?.actif ? 'tag-sev-4' : 'tag-neutral'}`}>
                    {u?.actif ? 'Compte actif' : 'Compte désactivé'}
                  </span>
                </div>
              </div>
            </div>

            <div className="profil-liste">
              <Ligne label="Identifiant">#{u?.id}</Ligne>
              <Ligne label="Adresse électronique">{u?.email}</Ligne>
              <Ligne label="Rôle">{ROLE_LABEL[u?.role] ?? u?.role}</Ligne>
              <Ligne label="Compte créé le">{dateHeureFr(u?.creeLe)}</Ligne>
              <Ligne label="Dernière connexion">
                {u?.derniereConnexion ? dateHeureFr(u.derniereConnexion) : <span className="text-muted">jamais</span>}
              </Ligne>
              <Ligne label="Dossier patient rattaché">
                {u?.patientId
                  ? <Link to={`/patients/${u.patientId}`}>Consulter le dossier</Link>
                  : <span className="text-muted">aucun</span>}
              </Ligne>
            </div>
          </Panel>

          <div className="stack">
            <Panel kicker="Accès" title="Ce que ce rôle permet">
              <p className="text-muted" style={{ fontSize: 13.5, marginTop: 0 }}>
                Le rôle détermine les écrans visibles dans le menu. Seul un administrateur peut le modifier.
              </p>
              <div className="profil-liste">
                <Ligne label="Rôle attribué">{ROLE_LABEL[u?.role] ?? '—'}</Ligne>
                <Ligne label="Service de rattachement">
                  {u?.serviceId ? `#${u.serviceId}` : <span className="text-muted">non rattaché</span>}
                </Ligne>
              </div>
            </Panel>

            {estAdmin && u && !soi && (
              <Panel kicker="Administration" title="Actions sur ce compte">
                <div className="stack-sm">
                  <button className="btn btn-secondary btn-block" disabled={envoi}
                    onClick={() => patch({ actif: !u.actif }, u.actif ? 'Compte désactivé' : 'Compte réactivé')}>
                    <Icon name="ban" /> {u.actif ? 'Désactiver le compte' : 'Réactiver le compte'}
                  </button>
                  <button className="btn btn-danger btn-block" onClick={() => setSuppr(true)}>
                    <Icon name="trash" /> Supprimer définitivement
                  </button>
                  <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                    La suppression est irréversible. Le dossier patient éventuellement rattaché est conservé.
                  </p>
                </div>
              </Panel>
            )}

            {soi && (
              <Alert level="info" title="Modifier vos informations">
                Adressez-vous à un administrateur de l’établissement : nom, adresse, rôle et mot de passe
                sont gérés depuis l’écran Administration.
              </Alert>
            )}
          </div>
        </div>
      </Etat>

      {edition && (
        <Modal titre="Modifier le compte" sousTitre={edition.email} onClose={() => setEdition(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setEdition(null)}>Annuler</button>
              <button className="btn btn-primary" disabled={envoi}
                onClick={() => patch({ nom: edition.nom, email: edition.email, role: edition.role }, 'Compte modifié')}>
                Enregistrer
              </button>
            </>
          }>
          <div className="stack-sm">
            <Field label="Nom et fonction">
              <input className="input" value={edition.nom}
                onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
            </Field>
            <Field label="Adresse électronique">
              <input className="input" type="email" value={edition.email}
                onChange={(e) => setEdition({ ...edition, email: e.target.value })} />
            </Field>
            <Field label="Rôle" hint="Détermine les écrans accessibles.">
              <select className="input" value={edition.role}
                onChange={(e) => setEdition({ ...edition, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {mdp && (
        <Modal titre="Définir un nouveau mot de passe" sousTitre={u?.email} onClose={() => setMdp(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setMdp(null)}>Annuler</button>
              <button className="btn btn-primary" disabled={envoi || mdp.motDePasse.length < 8 || mdp.motDePasse !== mdp.confirme}
                onClick={() => patch({ motDePasse: mdp.motDePasse }, 'Mot de passe remplacé')}>
                Enregistrer
              </button>
            </>
          }>
          <div className="stack-sm">
            <Field label="Nouveau mot de passe" hint="Au moins 8 caractères.">
              <input className="input" type="password" value={mdp.motDePasse}
                onChange={(e) => setMdp({ ...mdp, motDePasse: e.target.value })} />
            </Field>
            <Field label="Confirmation"
              erreur={mdp.confirme && mdp.confirme !== mdp.motDePasse ? 'Les deux saisies diffèrent.' : null}>
              <input className="input" type="password" value={mdp.confirme}
                onChange={(e) => setMdp({ ...mdp, confirme: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}

      {suppr && (
        <Confirm titre="Supprimer ce compte" danger confirmer="Supprimer"
          message={`Le compte ${u?.email} sera définitivement supprimé. Cette action est irréversible.`}
          onConfirm={supprimer} onClose={() => setSuppr(false)} />
      )}
    </>
  )
}
