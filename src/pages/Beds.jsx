import { useState } from 'react'
import { useApi, useTri } from '../api/hooks.js'
import { PageHead, Panel, StatCard, Bar, Etat, Th, Empty, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { Donut } from '../components/Charts.jsx'
import { SEV_PAR_NIVEAU, LIBELLE_TENSION, niveauTension } from '../lib/referentiels.js'

export default function Beds() {
  const [pole, setPole] = useState('')
  const { tri, basculer, trier } = useTri({ cle: 'ordre', sens: 'asc' })

  const services = useApi('/api/services', { hospitalisationSeule: true }, { intervalMs: 45000 })
  const bord = useApi('/api/tableau-bord', null, { intervalMs: 45000 })

  const tous = services.data ?? []
  const poles = [...new Set(tous.map((s) => s.pole))].sort()
  const filtres = pole ? tous.filter((s) => s.pole === pole) : tous
  const items = trier(filtres, {
    ordre: (s) => s.id,
    service: (s) => s.nom,
    armes: (s) => s.litsArmes,
    occupes: (s) => s.occupes,
    libres: (s) => s.libres,
    taux: (s) => s.tauxOccupation
  })

  const tbl = useTableau(items, ['nom', 'code', 'pole'])

  const d = bord.data
  const taux = d?.tauxOccupation ?? 0
  const rea = tous.find((s) => s.code === 'REA')
  const tauxRea = rea && rea.litsArmes ? rea.occupes / rea.litsArmes : 0

  // Charge par pôle : remplace la maquette statique par le calcul réel.
  const parPole = poles.map((p) => {
    const list = tous.filter((s) => s.pole === p)
    const armes = list.reduce((a, s) => a + s.litsArmes, 0)
    const occ = list.reduce((a, s) => a + s.occupes, 0)
    const bloq = list.reduce((a, s) => a + s.bloques, 0)
    return { pole: p, armes, occ, bloq, taux: armes ? occ / armes : 0, services: list.length }
  }).sort((a, b) => b.taux - a.taux)

  return (
    <>
      <PageHead kicker="Module lits">
        Lits installés, lits armés (avec personnel), occupés, bloqués, libres. Le niveau de tension
        combine la couleur, une trame et un libellé, pour rester lisible sans distinguer les teintes.
      </PageHead>

      <Etat loading={bord.loading} error={bord.error} onRetry={bord.recharger}>
        {d && (
          <div className="grid g4 section">
            <StatCard title="Lits occupés" value={d?.litsOccupes} sub={`/${d?.litsArmes}`}
              pct={`${Math.round(taux * 100)}%`}
              delta={`${d?.litsLibres} libres`} deltaDir={taux > 0.9 ? 'down' : 'up'} deltaNote="capacité armée">
              <div style={{ marginTop: 12, maxWidth: 190 }}>
                <Bar value={taux * 100} sev={SEV_PAR_NIVEAU[niveauTension(taux)]} />
              </div>
            </StatCard>
            <StatCard title="Lits bloqués" value={d?.litsBloques}
              deltaNote="motif non médical — levier de capacité le plus rentable"
              delta={d?.litsArmes ? `${Math.round((d?.litsBloques / d?.litsArmes) * 100)} % du parc` : null}
              deltaDir="down" />
            <StatCard title="Réanimation" value={rea?.occupes ?? 0} sub={`/${rea?.litsArmes ?? 0}`}
              deltaNote={rea ? `${rea.libres} lit(s) libre(s)` : 'service non paramétré'}
              visual={<Donut value={tauxRea * 100} size={86} stroke={11}
                color={tauxRea > 0.9 ? 'var(--sev-1)' : 'var(--viz-1)'} />} />
            <StatCard title="Patients en attente de lit" value={d?.enAttente}
              delta={d?.delaisDepasses ? `${d?.delaisDepasses} délai(s) dépassé(s)` : 'délais respectés'}
              deltaDir={d?.delaisDepasses ? 'down' : 'up'}
              deltaNote={`${d?.sejoursEnCours} hospitalisation(s) en cours`} />
          </div>
        )}
      </Etat>

      <div className="grid g-side section">
        <Panel kicker="Par pôle" title="Charge des pôles cliniques">
          <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
            vide={!parPole.length} videTitre="Aucun service paramétré"
            videTexte="Renseignez les capacités depuis l’écran Administration.">
            <div className="stack-sm">
              {parPole.map((p) => (
                <div className="meter-row" key={p.pole}>
                  <span>{p.pole}<span className="sub">{p.services} service(s)</span></span>
                  <Bar value={p.taux * 100} sev={SEV_PAR_NIVEAU[niveauTension(p.taux)]} />
                  <span className="num">
                    {Math.round(p.taux * 100)} %
                    <span className={`tag tag-${SEV_PAR_NIVEAU[niveauTension(p.taux)]}`}>
                      {LIBELLE_TENSION[niveauTension(p.taux)]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Etat>
        </Panel>

        <Panel kicker="Lecture" title="Répartition du parc">
          {d ? (
            <div className="stack-sm">
              {[['Occupés', d?.litsOccupes, 'var(--sev-2)'],
                ['Bloqués (motif non médical)', d?.litsBloques, 'var(--sev-1)'],
                ['Libres et armés', d?.litsLibres, 'var(--sev-4)']].map(([k, v, c]) => (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span>{k}</span><strong>{v} lit(s)</strong>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${d?.litsArmes ? (v / d?.litsArmes) * 100 : 0}%`, background: c }} />
                  </div>
                </div>
              ))}
              <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                Base de calcul : {d?.litsArmes} lits armés. Un lit installé mais non armé, faute de
                personnel, n’entre pas dans la capacité exploitable.
              </p>
            </div>
          ) : <Empty titre="Données indisponibles" />}
        </Panel>
      </div>

      <Panel kicker="Par service" title="Tension détaillée"
        actions={
          <select className="input" style={{ width: 'auto', minHeight: 36 }}
            value={pole} onChange={(e) => setPole(e.target.value)}>
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p}>{p}</option>)}
          </select>
        }>
        <RechercheTableau valeur={tbl.q} onChange={tbl.setQ}
          placeholder="Rechercher un service, un code, un pôle…" total={tbl.total} libelle="service" />
        <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
          vide={!tbl.total} videTitre="Aucun service" videTexte="Ajustez le filtre ou la recherche.">
          <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <Th cle="service" tri={tri} onTri={basculer}>Service</Th>
                  <th>Pôle</th>
                  <th className="num">Installés</th>
                  <Th cle="armes" tri={tri} onTri={basculer} className="num">Armés</Th>
                  <Th cle="occupes" tri={tri} onTri={basculer} className="num">Occupés</Th>
                  <Th cle="libres" tri={tri} onTri={basculer} className="num">Libres</Th>
                  <th className="num">Bloqués</th>
                  <Th cle="taux" tri={tri} onTri={basculer}>Occupation</Th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {tbl.visibles.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.nom}<span className="sub">{s.code}</span></td>
                    <td>{s.pole}</td>
                    <td className="num">{s.litsInstalles}</td>
                    <td className="num">{s.litsArmes}</td>
                    <td className="num">{s.occupes}</td>
                    <td className="num">{s.libres}</td>
                    <td className="num">{s.bloques || '—'}</td>
                    <td style={{ minWidth: 160 }}>
                      <Bar value={s.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[s.niveau]} />
                      <span className="sub">{Math.round(s.tauxOccupation * 100)} %</span>
                    </td>
                    <td>
                      <span className={`tag tag-${SEV_PAR_NIVEAU[s.niveau]}`}>{LIBELLE_TENSION[s.niveau]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={tbl.page} pages={tbl.pages} total={tbl.total}
            pageSize={tbl.parPage} onPage={tbl.setPage} />
          </>
        </Etat>
      </Panel>
    </>
  )
}
