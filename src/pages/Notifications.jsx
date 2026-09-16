import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, Field, Etat, Pager, PAR_PAGE, RechercheTableau } from '../components/ui.jsx'
import { Icon } from '../components/Icon.jsx'
import { ilYa } from '../lib/referentiels.js'

const CANAUX = [
  ['SMS', 'Canal principal patient — rappels de rendez-vous, catégorie de triage, temps d’attente estimé.'],
  ['USSD', 'Prise et confirmation de rendez-vous sans smartphone, pré-triage à distance.'],
  ['Application', 'Notifications internes au personnel, sur poste fixe et tablette.'],
  ['Affichage salle d’attente', 'Alimenté par la file d’attente, sans aucune donnée nominative.']
]
const TYPES = ['Rappel RDV', 'Alerte capacité', 'Réévaluation', 'Information', 'Rapport']
const DESTINATAIRES = ['Patient', 'Infirmier de triage', 'Médecin', 'Gestionnaire de lits', 'Direction', 'Data manager']

export default function Notifications() {
  const { user } = useAuth()
  const toast = useToast()
  const estPatient = user.role === 'patient'
  const [dest, setDest] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [msg, setMsg] = useState({ destinataire: 'Patient', type: 'Rappel RDV', texte: '', canal: 'SMS' })
  const [envoi, setEnvoi] = useState(false)

  const liste = useApi('/api/notifications', { destinataire: dest, recherche: q, page, pageSize: PAR_PAGE }, { intervalMs: 45000 })
  const destinataires = useApi('/api/notifications/destinataires', null, { skip: estPatient })

  const envoyer = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    try {
      await api.post('/api/notifications', msg)
      toast.succes('Message enregistré',
        msg.canal === 'SMS'
          ? 'La passerelle SMS n’est pas branchée : le message est journalisé et visible dans l’application.'
          : 'Notification remise au destinataire.')
      setMsg({ ...msg, texte: '' })
      setPage(1)
      liste.recharger()
    } catch (e2) { toast.erreur('Envoi refusé', e2.message) } finally { setEnvoi(false) }
  }

  const marquerLue = async (n) => {
    try { await api.post(`/api/notifications/${n.id}/lue`); liste.recharger() } catch { /* sans effet bloquant */ }
  }

  const items = liste.data?.items ?? []
  const dernierSms = items.find((n) => n.canal === 'SMS')

  return (
    <>
      <PageHead kicker={estPatient ? 'Mes messages' : 'Module notifications & alertes'}>
        {estPatient
          ? 'Rappels de rendez-vous et informations envoyés par l’hôpital.'
          : 'Toute alerte est horodatée et conservée. Les envois patients passent par la passerelle SMS locale.'}
      </PageHead>

      <div className="grid g-side">
        <div className="stack">
          {!estPatient && (
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <Field label="Destinataire">
                <select className="input" value={dest} onChange={(e) => { setDest(e.target.value); setPage(1) }}>
                  <option value="">Tous</option>
                  {(destinataires.data ?? []).map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <button className="btn btn-secondary" onClick={liste.recharger}>Rafraîchir</button>
            </div>
          )}

          <Panel>
            <RechercheTableau valeur={q} onChange={(v) => { setQ(v); setPage(1) }}
              placeholder="Rechercher un message, un type, un destinataire…"
              total={liste.data?.total} libelle="notification" />
            <Etat loading={liste.loading} error={liste.error} onRetry={liste.recharger}
              vide={!items.length} videTitre="Aucune notification"
              videTexte="Les alertes de capacité, de réévaluation et les rappels apparaîtront ici.">
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Type</th>{!estPatient && <th>Destinataire</th>}<th>Message</th><th>Canal</th><th>Émis</th></tr>
                    </thead>
                    <tbody>
                      {items.map((n) => (
                        <tr key={n.id} onClick={() => !n.lue && marquerLue(n)}
                          style={{ cursor: n.lue ? 'default' : 'pointer', opacity: n.lue ? 0.72 : 1 }}>
                          <td>
                            <span className={`tag ${n.niveau === 'crit' ? 'tag-sev-1'
                              : n.niveau === 'warn' ? 'tag-sev-3' : 'tag-blue'}`}>
                              {n.niveau === 'crit' && <span aria-hidden="true">⚠</span>}{n.type}
                            </span>
                          </td>
                          {!estPatient && <td>{n.destinataire}</td>}
                          <td>{n.texte}</td>
                          <td><span className="tag tag-neutral">{n.canal}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{ilYa(n.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={liste.data?.page} pages={liste.data?.pages} total={liste.data?.total}
                  pageSize={liste.data?.pageSize} onPage={setPage} />
              </>
            </Etat>
          </Panel>
        </div>

        <div className="stack">
          {/* Aperçu du rendu réel côté patient : un SMS sur un téléphone simple. */}
          <Panel kicker="Aperçu" title="Ce que reçoit le patient">
            <div style={{
              maxWidth: 260, margin: '0 auto', border: '8px solid #1c1f24', borderRadius: 26,
              background: '#eef0f2', padding: 12, boxShadow: 'var(--sh-md)'
            }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
                <span>Hôpital</span>
                <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{
                background: '#fff', borderRadius: '14px 14px 14px 4px', padding: '10px 12px',
                fontSize: 12.5, lineHeight: 1.45, boxShadow: 'var(--sh-sm)'
              }}>
                {dernierSms?.texte ?? 'Aucun message SMS enregistré pour le moment. Les rappels de rendez-vous apparaîtront ici.'}
              </div>
              <p className="text-muted" style={{ fontSize: 10.5, textAlign: 'center', margin: '10px 0 0' }}>
                160 caractères maximum · réponse ANNULER ou REPORTER
              </p>
            </div>
          </Panel>

          <Panel kicker="Canaux" title="Acheminement">
            <div className="stack-sm">
              {CANAUX.map(([nom, desc]) => (
                <div key={nom} style={{ display: 'flex', gap: 10 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center',
                    background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--muted)'
                  }}><Icon name={nom === 'SMS' || nom === 'USSD' ? 'phone' : nom === 'Application' ? 'bell' : 'list'} /></span>
                  <span>
                    <strong style={{ fontSize: 13.5 }}>{nom}</strong>
                    <span className="text-muted" style={{ display: 'block', fontSize: 12.5 }}>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              La passerelle SMS n’est pas encore connectée : les messages sont enregistrés en base et
              affichés ici, sans envoi réel vers l’opérateur.
            </p>
          </Panel>

          {!estPatient && (
            <Panel kicker="Envoi manuel" title="Nouveau message">
              <form className="stack-sm" onSubmit={envoyer}>
                <Field label="Destinataire">
                  <select className="input" value={msg.destinataire}
                    onChange={(e) => setMsg({ ...msg, destinataire: e.target.value })}>
                    {DESTINATAIRES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Type">
                  <select className="input" value={msg.type} onChange={(e) => setMsg({ ...msg, type: e.target.value })}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Canal">
                  <select className="input" value={msg.canal} onChange={(e) => setMsg({ ...msg, canal: e.target.value })}>
                    <option>SMS</option><option>USSD</option><option>Application</option>
                  </select>
                </Field>
                <Field label="Message" hint={`${msg.texte.length} / 160 caractères`}>
                  <textarea className="input" maxLength={160} value={msg.texte}
                    onChange={(e) => setMsg({ ...msg, texte: e.target.value })} />
                </Field>
                <button className="btn btn-primary btn-block" type="submit" disabled={envoi || !msg.texte.trim()}>
                  {envoi ? <><span className="spinner" /> Envoi…</> : 'Envoyer'}
                </button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
