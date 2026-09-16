import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useApi } from '../api/hooks.js'
import { PageHead, Panel, StatCard, CatBadge, Bar, Etat, Alert, Empty } from '../components/ui.jsx'
import { AreaChart, Donut, Sparkline } from '../components/Charts.jsx'
import { minutes, ilYa, niveauTension, SEV_PAR_NIVEAU, LIBELLE_TENSION } from '../lib/referentiels.js'

export default function Dashboard() {
  const { user, roleLabel } = useAuth()
  const [vue, setVue] = useState('2 h')

  const bord = useApi('/api/tableau-bord', null, { intervalMs: 30000 })
  const file = useApi('/api/passages', { statut: 'En attente', pageSize: 6 }, { intervalMs: 30000 })
  const notifs = useApi('/api/notifications', { pageSize: 5 })

  const d = bord.data
  const taux = d?.tauxOccupation ?? 0
  const critiques = (d?.risques ?? []).filter((r) => r.niveau === 'crit')

  return (
    <>
      <PageHead kicker={roleLabel(user.role)} title={`Bonjour, ${user.nom.split('—').pop().trim()}`}>
        Vue d’ensemble de l’établissement à l’instant, rafraîchie automatiquement. Le modèle
        recommande et alerte ; la décision finale appartient toujours au soignant.
      </PageHead>

      <Etat loading={bord.loading} error={bord.error} onRetry={bord.recharger}>
        {d && (
          <>
            {(critiques.length > 0 || d?.delaisDepasses > 0) && (
              <div className="stack-sm section">
                {d?.delaisDepasses > 0 && (
                  <Alert level="crit" title="Réévaluation requise">
                    {d?.delaisDepasses} patient(s) au-delà du délai maximal de leur catégorie.{' '}
                    <Link to="/file">Ouvrir la file d’attente</Link>
                  </Alert>
                )}
                {critiques.length > 0 && (
                  <Alert level="warn" title="Services saturés">
                    {critiques.map((r) => r.nom).join(' · ')} — au-delà de 90 % de la capacité armée.{' '}
                    <Link to="/lits">Voir l’occupation</Link>
                  </Alert>
                )}
              </div>
            )}

            <div className="grid g4 section">
              <StatCard title="Lits occupés" value={d?.litsOccupes} sub={`/${d?.litsArmes}`}
                pct={`${Math.round(taux * 100)}%`}
                delta={`${d?.litsLibres} libres`} deltaDir={taux > 0.9 ? 'down' : 'up'}
                deltaNote={`${d?.litsBloques} bloqués (motif non médical)`}>
                <div style={{ marginTop: 12, maxWidth: 190 }}>
                  <Bar value={taux * 100} sev={SEV_PAR_NIVEAU[niveauTension(taux)]} />
                </div>
              </StatCard>

              <StatCard title="Attente moyenne aux urgences"
                value={minutes(d?.attenteMoyenneMinutes)}
                delta={d?.delaisDepasses ? `${d?.delaisDepasses} dépassement(s)` : 'délais respectés'}
                deltaDir={d?.delaisDepasses ? 'down' : 'up'}
                deltaNote={`${d?.enAttente} patient(s) en file · ${d?.aTrier} à trier`} />

              <StatCard title="Passages aujourd’hui" value={d?.passagesAujourdhui}
                delta={`${d?.patientsTotal} dossiers`} deltaNote="depuis l’ouverture du registre"
                visual={<Sparkline data={d?.fluxHoraire?.length ? d?.fluxHoraire : [0, 0, 0, 0]} color="var(--sev-4)" />} />

              <StatCard title="Hospitalisations en cours" value={d?.sejoursEnCours}
                delta={`${d?.demandesNonSatisfaites} refus enregistrés`} deltaDir="down"
                deltaNote={`${d?.rendezVousAVenir} rendez-vous à venir`}
                visual={<Donut value={taux * 100} size={86} stroke={11}
                  color={taux > 0.9 ? 'var(--sev-1)' : 'var(--viz-1)'} label="lits" />} />
            </div>

            <div className="grid g-side section">
              <Panel kicker="Module triage" title="Flux des arrivées"
                actions={
                  <div className="seg">
                    {['2 h', 'Détail'].map((v) => (
                      <label className="seg-opt" key={v}>
                        <input type="radio" name="vue" checked={vue === v} onChange={() => setVue(v)} />
                        {v}
                      </label>
                    ))}
                  </div>
                }>
                {d?.fluxHoraire?.some((x) => x > 0) ? (
                  <>
                    <AreaChart data={d?.fluxHoraire} labels={d?.labelsHoraire} id="flux" height={320}
                      color="var(--brand)" />
                    <p className="text-muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                      Arrivées enregistrées par tranche de deux heures sur les seize dernières heures.
                    </p>
                  </>
                ) : (
                  <Empty titre="Aucune arrivée sur les seize dernières heures">
                    Le graphique se remplit dès le premier enregistrement d’admission.
                  </Empty>
                )}
              </Panel>

              <Panel kicker="Module lits" title="Risque de saturation"
                actions={<Link className="btn btn-ghost btn-sm" to="/prevision">Prévision</Link>}>
                {d?.risques?.length ? (
                  <div className="stack-sm">
                    {[...d.risques].sort((a, b) => b.tauxOccupation - a.tauxOccupation).slice(0, 6).map((r) => (
                      <div key={r.serviceId} style={{
                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 46px',
                        gap: 'var(--space-3)', alignItems: 'center', padding: '9px 0',
                        borderBottom: '1px solid var(--line)'
                      }}>
                        <span style={{ minWidth: 0, fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.nom}
                          <span className="sub">{LIBELLE_TENSION[r.niveau]}</span>
                        </span>
                        <Bar value={r.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[r.niveau]} />
                        <strong style={{ textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(r.tauxOccupation * 100)}%
                        </strong>
                      </div>
                    ))}
                    {d.risques.length > 6 && (
                      <Link className="btn btn-ghost btn-sm" to="/lits">Voir les {d.risques.length} services</Link>
                    )}
                  </div>
                ) : <Empty titre="Aucun service paramétré" />}
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                  Taux d’occupation de la capacité armée, du service le plus tendu au moins tendu.
                </p>
              </Panel>
            </div>
          </>
        )}
      </Etat>

      <div className="grid g-side">
        <Panel kicker="File d’attente priorisée" title="Patients en attente"
          actions={<Link className="btn btn-ghost" to="/file">Tout voir</Link>}>
          <Etat loading={file.loading} error={file.error} onRetry={file.recharger}
            vide={!file.data?.items?.length}
            videTitre="Aucun patient en attente"
            videTexte="La file se remplit depuis l’écran « Nouvelle admission ».">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Patient</th><th>Catégorie</th><th>Attente</th><th>Service visé</th><th /></tr>
                </thead>
                <tbody>
                  {file.data?.items?.map((p) => (
                    <tr key={p.id}>
                      <td>{p.patientNom}<span className="sub">{p.motif}</span></td>
                      <td><CatBadge cat={p.categorie} /></td>
                      <td style={{ color: p.delaiDepasse ? 'var(--sev-1)' : undefined, fontWeight: p.delaiDepasse ? 700 : 500 }}>
                        {minutes(p.attenteMinutes)}
                      </td>
                      <td>{p.serviceViseNom ?? <span className="text-muted">non défini</span>}</td>
                      <td>
                        <Link className="btn btn-ghost" to={p.categorie ? `/decision/${p.id}` : `/triage/${p.id}`}>
                          {p.categorie ? 'Décider' : 'Trier'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Etat>
        </Panel>

        <Panel kicker="Notifications" title="Dernières alertes"
          actions={<Link className="btn btn-ghost" to="/notifications">Journal</Link>}>
          <Etat loading={notifs.loading} error={notifs.error} onRetry={notifs.recharger}
            vide={!notifs.data?.items?.length}
            videTitre="Aucune notification" videTexte="Les alertes de capacité et de réévaluation apparaîtront ici.">
            <div className="stack-sm">
              {notifs.data?.items?.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className={`tag ${n.niveau === 'crit' ? 'tag-sev-1' : n.niveau === 'warn' ? 'tag-sev-3' : 'tag-blue'}`}>
                    {n.type}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                    {n.texte}
                    <span className="text-muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
                      {ilYa(n.date)} · {n.canal}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Etat>
        </Panel>
      </div>
    </>
  )
}
