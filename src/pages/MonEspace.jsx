import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useApi } from '../api/hooks.js'
import { PageHead, Panel, CatBadge, Etat, Empty, Kpi, Alert, Bar, StatCard, Pager, RechercheTableau, useTableau } from '../components/ui.jsx'
import { AreaChart, BarChart, Donut, Gauge, LineChart, Sparkline } from '../components/Charts.jsx'
import { Icon } from '../components/Icon.jsx'
import { REF, catDelai, catLabel, dateFr, dateHeureFr, ilYa, minutes, SEV_PAR_NIVEAU } from '../lib/referentiels.js'

const fcfa = (m) => `${Math.round(m || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`
const derniereMesure = (serie, cle) => {
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i][cle] !== null && serie[i][cle] !== undefined) return serie[i][cle]
  return null
}

const COULEUR_NIVEAU = { crit: 'var(--sev-1)', warn: 'var(--sev-3)', ok: 'var(--sev-4)' }

/**
 * Espace patient : les statistiques de santé, de recours aux soins et de
 * dépenses d'UN seul patient — le sien. Le tableau de bord, lui, décrit
 * l'établissement et n'est pas accessible depuis cet espace.
 */
export default function MonEspace() {
  const { user } = useAuth()
  const id = user.patientId
  const [mesure, setMesure] = useState('pas')

  const dossier = useApi(id ? `/api/patients/${id}` : null, null, { skip: !id })
  const passages = useApi('/api/passages', { pageSize: 100 }, { intervalMs: 30000, skip: !id })
  const rdv = useApi('/api/rendezvous', null, { skip: !id })
  const messages = useApi('/api/notifications', { pageSize: 5 }, { skip: !id })
  // Toute la synthèse (constantes, risques, dépenses, recours) est calculée par l'API.
  const synthese = useApi(id ? `/api/patients/${id}/synthese` : null, null, { intervalMs: 60000, skip: !id })

  const tous = (passages.data?.items ?? [])
    .filter((p) => String(p.patientId) === String(id))
    .slice().sort((a, b) => new Date(b.arrivee) - new Date(a.arrivee))
  const listeRdv = (rdv.data ?? []).filter((r) => !id || String(r.patientId ?? id) === String(id))

  const tblPassages = useTableau(tous, ['motif', 'statut', 'reference'])
  const sy = synthese.data
  const mois = sy?.mois ?? []
  const serie = sy?.serie ?? []
  // Valeurs neutres tant que la synthèse n'est pas arrivée : Etat évalue ses
  // enfants avant d'afficher le chargement, ils ne doivent jamais planter.
  const sante = sy?.sante ?? { disponible: false, horizon: '30 jours', raison: '' }
  const santeOk = !!sante.disponible
  const chroniques = sy?.chroniques ?? []
  const cout = sy?.cout ?? { configure: false, total: 0, parPoste: [], serieMensuelle: [], parPassage: {} }
  const soins = sy?.soins ?? {
    passages12Mois: 0, passagesTotal: 0, serieMensuelle: [], attenteMoyenne: null, attenteSerie: [],
    motifFrequent: null, categories: [], nonTries: 0,
    rdv: { honores: 0, manques: 0, annules: 0, aVenir: 0, total: 0, assiduite: null }
  }

  const enCours = tous.find((p) => ['À trier', 'En attente', 'En cours'].includes(p.statut))
  const prochain = listeRdv
    .filter((r) => r.statut !== 'Annulé' && new Date(r.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]

  const MESURES = REF.mesures.map((x) => ({ ...x, normal: x.normalMin != null ? { min: x.normalMin, max: x.normalMax } : null }))
  const m = MESURES.find((x) => x.cle === mesure) ?? MESURES[0] ?? { cle: 'pas', label: '', unite: '' }
  const labelsSerie = serie.map((s) => new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))
  const valeursMesure = serie.map((s) => s[m.cle] ?? null)
  const aDesMesures = valeursMesure.some((v) => v != null)

  if (!id) {
    return (
      <>
        <PageHead kicker="Espace patient" title="Aucun dossier rattaché" />
        <Alert level="warn" title="Compte non rattaché">
          Votre compte n’est relié à aucun dossier patient. Présentez-vous à l’accueil de
          l’établissement avec une pièce d’identité pour effectuer le rattachement.
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHead kicker="Espace patient"
        title={dossier.data ? `Bonjour, ${dossier.data?.prenom || dossier.data?.nom}` : 'Mon espace'}
        actions={<Link className="btn btn-primary" to="/rendez-vous">Demander un rendez-vous</Link>}>
        Vos statistiques de santé, votre recours aux soins et vos dépenses estimées, calculés
        uniquement sur votre dossier. Aucune information sur les autres patients ni sur
        l’activité de l’hôpital n’est accessible ici.
      </PageHead>

      {enCours && (
        <Panel ton={enCours.categorie === 1 ? 'urgent' : enCours.categorie === 2 ? 'attention' : undefined}
          kicker="Prise en charge en cours" title="Où en est votre passage"
          style={{ marginBottom: 'var(--space-4)' }}>
          <div className="grid g4" style={{ gap: 'var(--space-4)' }}>
            <div className="kpi">
              <span className="label">Niveau de priorité</span>
              <span style={{ marginTop: 4 }}><CatBadge cat={enCours.categorie} /></span>
              {enCours.categorie && (
                <span className="note">
                  {catDelai(enCours.categorie) === 0
                    ? 'Prise en charge immédiate'
                    : `Objectif : vu sous ${catDelai(enCours.categorie)} minutes`}
                </span>
              )}
            </div>
            <Kpi label="Depuis votre arrivée" value={minutes(enCours.attenteMinutes)} note={dateHeureFr(enCours.arrivee)} />
            <Kpi label="Statut" value={enCours.statut} note={`Passage ${enCours.reference}`} />
            <Kpi label="Service prévu" value={enCours.serviceViseNom ?? 'à déterminer'} note={enCours.motif} />
          </div>
          {enCours.categorie && (
            <p className="text-muted" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
              Votre niveau de priorité « {catLabel(enCours.categorie)} » est établi par l’équipe
              soignante d’après vos constantes. Les patients dont l’état est plus grave passent avant,
              même s’ils sont arrivés après vous.
            </p>
          )}
        </Panel>
      )}

      <Etat loading={passages.loading || dossier.loading || (synthese.loading && !sy)}
        error={passages.error ?? dossier.error ?? synthese.error}
        onRetry={() => { passages.recharger(); synthese.recharger() }}
        vide={!sy} videTitre="Synthèse indisponible">
        <>
          {/* ── Quatre indicateurs de tête ───────────────────────────── */}
          <div className="grid g4 section">
            <StatCard title="Passages sur 12 mois" value={soins.passages12Mois}
              delta={`${soins.passagesTotal} au total`} deltaDir="up"
              deltaNote={soins.motifFrequent ? `Motif le plus fréquent : ${soins.motifFrequent}` : 'Aucun motif enregistré'}
              visual={soins.passagesTotal ? <Sparkline data={soins.serieMensuelle} color="var(--viz-1)" /> : null} />

            <StatCard title="Attente moyenne aux urgences"
              value={soins.attenteMoyenne == null ? '—' : minutes(soins.attenteMoyenne)}
              delta={soins.rdv.assiduite == null ? 'aucun rendez-vous' : `${soins.rdv.assiduite} % de rendez-vous honorés`}
              deltaDir={soins.rdv.assiduite != null && soins.rdv.assiduite >= 80 ? 'up' : 'down'}
              deltaNote="Moyenne de vos propres passages"
              visual={soins.attenteSerie.length ? <Sparkline data={soins.attenteSerie} color="var(--viz-2)" /> : null} />

            {cout.configure ? (
              <StatCard title="Dépenses estimées" value={fcfa(cout.total).replace(' FCFA', '')} sub=" FCFA"
                delta={`${fcfa(cout.resteACharge)} à votre charge`}
                deltaDir={cout.partCouverte != null && cout.partCouverte >= 0.7 ? 'up' : 'down'}
                deltaNote={cout.partCouverte == null
                  ? `Couverture non paramétrée · ${cout.modePaiement}`
                  : `Prise en charge ${Math.round(cout.partCouverte * 100)} % · ${cout.modePaiement}`}>
                {cout.partCouverte != null && (
                  <div style={{ marginTop: 12, maxWidth: 190 }}>
                    <Bar value={(1 - cout.partCouverte) * 100} sev={cout.partCouverte >= 0.7 ? 'sev-4' : 'sev-3'} />
                  </div>
                )}
              </StatCard>
            ) : (
              <StatCard title="Suivi programmé" value={soins.rdv.aVenir} sub=" à venir"
                delta={`${soins.rdv.honores} honoré(s)`}
                deltaDir={soins.rdv.manques ? 'down' : 'up'}
                deltaNote={soins.rdv.manques ? `${soins.rdv.manques} rendez-vous manqué(s)` : 'aucun rendez-vous manqué'} />
            )}

            {santeOk
              ? <StatCard title={`Risque de réadmission (${sante.horizon})`} value={sante.score} sub="/100"
                  delta={sante.libelle} deltaDir={sante.niveau === 'ok' ? 'up' : 'down'}
                  deltaNote={`Confiance ${Math.round(sante.confiance * 100)} %`}
                  visual={<Donut value={sante.score} size={86} stroke={11} color={COULEUR_NIVEAU[sante.niveau]} label="risque" />} />
              : <StatCard title={`Risque de réadmission (${sante.horizon})`} value="—"
                  deltaNote="Aucun modèle de réadmission branché" />}
          </div>

          {/* ── Constantes & risque de réadmission ───────────────────── */}
          <div className="grid g-side section">
            <Panel kicker="Mes mesures" title="Évolution de mes constantes"
              actions={
                <select className="input" style={{ minHeight: 36, width: 'auto' }}
                  value={mesure} onChange={(e) => setMesure(e.target.value)} aria-label="Mesure affichée">
                  {MESURES.map((x) => <option key={x.cle} value={x.cle}>{x.label}</option>)}
                </select>
              }>
              {aDesMesures ? (
                <>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      {m.label}{m.normal ? ` · cible ${m.normal.min}–${m.normal.max}${m.unite}` : ''}
                    </span>
                    <strong style={{ fontSize: 20, letterSpacing: '-0.03em' }}>
                      {derniereMesure(serie, m.cle)}{m.unite}
                    </strong>
                  </div>
                  <LineChart
                    series={[{ name: m.label, data: valeursMesure, color: m.couleur }]}
                    labels={labelsSerie} height={240}
                    bandes={m.normal ? [{ min: m.normal.min, max: m.normal.max, color: 'var(--sev-4-soft)' }] : []} />
                  <p className="text-muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                    Relevés lors de vos {serie.length} derniers triages. La bande verte marque
                    l’intervalle de référence ; une mesure absente n’est pas remplacée.
                  </p>
                </>
              ) : (
                <Empty titre={`Aucune mesure de ${m.label.toLowerCase()}`}>
                  Cette courbe se remplit à chaque passage où la constante est relevée.
                </Empty>
              )}
            </Panel>

            <Panel kicker="Prévention" title={`Risque de réadmission à ${sante.horizon}`}>
              {!santeOk ? (
                <Empty titre="Pas de score">{sante.raison || 'Aucun modèle de réadmission n’est branché.'}</Empty>
              ) : (<>
              <div style={{ display: 'grid', placeItems: 'center', marginBottom: 6 }}>
                <Gauge value={sante.score} size={186} color={COULEUR_NIVEAU[sante.niveau]}
                  label={sante.libelle} sousTitre={`Confiance ${Math.round(sante.confiance * 100)} %`} />
              </div>
              <div className="stack-sm">
                {sante.contributions.filter((c) => c.points > 0).slice(0, 6).map((c) => (
                  <div key={c.label}>
                    <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{c.label}</span>
                      <strong>+{c.points}</strong>
                    </div>
                    <Bar value={c.points} max={30} sev={c.points >= 18 ? 'sev-1' : c.points >= 10 ? 'sev-3' : 'sev-4'} />
                  </div>
                ))}
              </div>
              {sante.manquants.length > 0 && (
                <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                  Mesures manquantes : {sante.manquants.join(', ')}. Elles abaissent la confiance du score.
                </p>
              )}
              </>)}
            </Panel>
          </div>

          {/* ── Maladies chroniques ──────────────────────────────────── */}
          <div className="grid g-side section">
            <Panel kicker="Suivi au long cours" title="Risques liés à mes maladies chroniques">
              {chroniques.length ? (
                <div className="stack-sm">
                  {chroniques.map((r) => (
                    <div className="meter-row" key={r.nom}>
                      <span style={{ fontWeight: 600 }}>
                        {r.nom}
                        <span className="sub">{r.detail}</span>
                      </span>
                      <span className="num">
                        {r.niveau
                          ? <span className={`tag tag-${SEV_PAR_NIVEAU[r.niveau]}`}>
                              {r.niveau === 'crit' ? 'Au-delà du seuil d’alerte' : r.niveau === 'warn' ? 'Au-delà du seuil' : 'Dans la cible'}
                            </span>
                          : <span className="tag tag-neutral">Non mesuré</span>}
                      </span>
                      <span className="text-muted" style={{ gridColumn: '1 / -1', order: 4, fontSize: 12 }}>
                        {r.declare ? 'Antécédent déclaré' : 'Piste de dépistage'} · {r.suivi}
                        {r.repere && <> · Repère : {r.repere}</>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty titre="Aucune maladie chronique déclarée">
                  Déclarez vos antécédents à l’accueil : le suivi et les scores de risque
                  s’appuient dessus.
                </Empty>
              )}
              <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Niveaux obtenus en comparant votre dernière mesure aux seuils cliniques publiés indiqués.
                Ils ne remplacent pas un diagnostic : parlez-en à votre médecin.
              </p>
            </Panel>

            <Panel kicker="Dépenses" title="Mes dépenses estimées par mois"
              actions={<span className="tag tag-neutral">estimation</span>}>
              {!cout.configure ? (
                <Empty titre="Tarifs non paramétrés">
                  Les dépenses ne sont pas estimées tant que la grille tarifaire de
                  l’établissement n’a pas été saisie dans Administration (clés
                  <code> tarif.* </code> et <code> couverture.* </code> des paramètres).
                </Empty>
              ) : cout.total > 0 ? (
                <>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="kpi">
                      <span className="label">Sur 12 mois</span>
                      <span className="value" style={{ fontSize: 26 }}>{fcfa(cout.total12Mois)}</span>
                    </div>
                    <div className="kpi" style={{ textAlign: 'right' }}>
                      <span className="label">Moyenne par passage</span>
                      <span className="value" style={{ fontSize: 20 }}>{fcfa(cout.moyenneParPassage)}</span>
                    </div>
                  </div>
                  <BarChart data={cout.serieMensuelle} labels={mois.map((x) => x.label)} height={190}
                    color="var(--viz-3)" format={(v) => `${Math.round(v / 1000)}k`} />
                  <div className="stack-sm" style={{ marginTop: 14 }}>
                    {cout.parPoste.map((p) => (
                      <div key={p.nom}>
                        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                          <span>{p.nom}</span>
                          <strong>{fcfa(p.montant)}</strong>
                        </div>
                        <Bar value={p.montant} max={cout.total} />
                      </div>
                    ))}
                  </div>
                  <div className="alert info" style={{ marginTop: 14 }}>
                    <span className="ico" aria-hidden="true">i</span>
                    <div>
                      <strong>Reste à charge estimé — </strong>
                      {fcfa(cout.resteACharge)} sur {fcfa(cout.total)}, d’après le mode de paiement
                      « {cout.modePaiement} » enregistré dans votre dossier. Le montant facturé par
                      l’établissement fait seul foi.
                    </div>
                  </div>
                </>
              ) : (
                <Empty titre="Aucune dépense estimable">
                  Les montants apparaissent dès votre premier passage enregistré.
                </Empty>
              )}
            </Panel>
          </div>

          {/* ── Recours aux soins ────────────────────────────────────── */}
          <div className="grid g3 section">
            <Panel kicker="Recours aux soins" title="Mes passages par mois">
              {soins.serieMensuelle.some((v) => v > 0) ? (
                <BarChart data={soins.serieMensuelle} labels={mois.map((x) => x.label)} height={200} color="var(--viz-1)" />
              ) : <Empty titre="Aucun passage sur 12 mois" />}
            </Panel>

            <Panel kicker="Gravité" title="Niveaux de priorité reçus">
              {soins.categories.some((c) => c.n > 0) || soins.nonTries > 0 ? (
                <div className="stack-sm">
                  {soins.categories.map((c) => (
                    <div key={c.cat}>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                        <CatBadge cat={c.cat} />
                        <strong>{c.n}</strong>
                      </div>
                      <Bar value={c.n} max={Math.max(1, ...soins.categories.map((x) => x.n))} sev={`sev-${c.cat}`} />
                    </div>
                  ))}
                  {soins.nonTries > 0 && (
                    <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                      {soins.nonTries} passage(s) sans triage enregistré.
                    </p>
                  )}
                </div>
              ) : <Empty titre="Aucun triage enregistré" />}
            </Panel>

            <Panel kicker="Programmation" title="Assiduité aux rendez-vous">
              {soins.rdv.total ? (
                <>
                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <Donut value={soins.rdv.assiduite ?? 0} size={130} stroke={15}
                      color={(soins.rdv.assiduite ?? 0) >= 80 ? 'var(--sev-4)' : 'var(--sev-3)'} label="honorés" />
                  </div>
                  <div className="stack-sm" style={{ marginTop: 12, fontSize: 13.5 }}>
                    {[['Honorés', soins.rdv.honores, 'tag-sev-4'],
                      ['Manqués', soins.rdv.manques, 'tag-sev-1'],
                      ['Annulés', soins.rdv.annules, 'tag-neutral'],
                      ['À venir', soins.rdv.aVenir, 'tag-blue']].map(([k, v, t]) => (
                      <div className="row" key={k} style={{ justifyContent: 'space-between' }}>
                        <span className={`tag ${t}`}>{k}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                    Honorer vos rendez-vous est le levier le plus direct pour faire baisser votre
                    risque de réadmission.
                  </p>
                </>
              ) : <Empty titre="Aucun rendez-vous enregistré" />}
            </Panel>
          </div>

          {/* ── Temps d'attente vécus ────────────────────────────────── */}
          {soins.attenteSerie.length > 1 && (
            <div className="section">
              <Panel kicker="Parcours" title="Temps d’attente de mes derniers passages">
                <AreaChart data={soins.attenteSerie} id="attente" height={200} color="var(--viz-2)" unit=" min"
                  labels={tous.slice(0, 8).reverse().map((x) => new Date(x.arrivee).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))} />
                <p className="text-muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                  Minutes entre votre arrivée et votre prise en charge, passage par passage.
                </p>
              </Panel>
            </div>
          )}
        </>
      </Etat>

      {/* ── Rendez-vous, historique, messages, dossier ─────────────── */}
      <div className="grid g-side">
        <div className="stack">
          <Panel title="Mes rendez-vous" actions={<Link className="btn btn-ghost" to="/rendez-vous">Gérer</Link>}>
            <Etat loading={rdv.loading} error={rdv.error} onRetry={rdv.recharger}
              vide={!listeRdv.length} videTitre="Aucun rendez-vous"
              videTexte="Demandez un créneau depuis le bouton en haut de page.">
              <div>
                {listeRdv.map((r, i) => (
                  <div className={`timeline-item${i === 0 ? ' now' : ''}`} key={r.id}>
                    <span className="mark"><i /><span /></span>
                    <span className="body">
                      <strong>{r.motif}</strong>
                      <span>{dateFr(r.date)} à {r.heure} — {r.serviceNom}</span><br />
                      <span className={`tag ${r.statut === 'Manqué' ? 'tag-error'
                        : r.statut === 'Demandé' ? 'tag-blue'
                          : r.statut === 'Honoré' ? 'tag-sev-4' : 'tag-neutral'}`}>{r.statut}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Etat>
          </Panel>

          <Panel title="Historique de mes passages">
            <RechercheTableau valeur={tblPassages.q} onChange={tblPassages.setQ}
              placeholder="Rechercher un motif, un statut…" total={tblPassages.total} libelle="passage" />
            <Etat loading={passages.loading} error={passages.error} onRetry={passages.recharger}
              vide={!tblPassages.total} videTitre="Aucun passage enregistré">
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Motif</th><th>Priorité</th><th>Attente</th><th>Statut</th>{cout.configure && <th className="num">Coût estimé</th>}</tr></thead>
                    <tbody>
                      {tblPassages.visibles.map((p) => (
                        <tr key={p.id}>
                          <td>{dateHeureFr(p.arrivee)}<span className="sub">{ilYa(p.arrivee)}</span></td>
                          <td>{p.motif}</td>
                          <td><CatBadge cat={p.categorie} /></td>
                          <td>{p.attenteMinutes === null || p.attenteMinutes === undefined ? '—' : minutes(p.attenteMinutes)}</td>
                          <td>{p.statut}</td>
                          {cout.configure && (
                            <td className="num">
                              {fcfa(cout.parPassage?.[String(p.id)] ?? 0)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={tblPassages.page} pages={tblPassages.pages} total={tblPassages.total}
                  pageSize={tblPassages.parPage} onPage={tblPassages.setPage} />
              </>
            </Etat>
          </Panel>
        </div>

        <div className="stack">
          {prochain && (
            <Panel kicker="Prochain rendez-vous" title={prochain.motif}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{dateFr(prochain.date)}</div>
              <div className="text-muted" style={{ fontSize: 14 }}>{prochain.heure} · {prochain.serviceNom}</div>
              <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
                Un rappel par SMS vous sera envoyé deux jours avant. Répondez ANNULER ou REPORTER pour
                libérer le créneau.
              </p>
            </Panel>
          )}

          <Panel title="Mes dernières constantes">
            {serie.length ? (
              <div className="stack-sm">
                {MESURES.map((x) => {
                  const v = derniereMesure(serie, x.cle)
                  const hors = v != null && x.normal && (v < x.normal.min || v > x.normal.max)
                  return (
                    <div className="row" key={x.cle} style={{ justifyContent: 'space-between' }}>
                      <span className="text-muted" style={{ fontSize: 13 }}>{x.label}</span>
                      <strong style={{ color: hors ? 'var(--sev-1-ink)' : undefined }}>
                        {v == null ? 'non mesuré' : `${v}${x.unite}`}
                      </strong>
                    </div>
                  )
                })}
                <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
                  Relevé du {dateHeureFr(serie[serie.length - 1].date)} · passage {serie[serie.length - 1].reference}.
                </p>
              </div>
            ) : <Empty titre="Aucune constante relevée" />}
          </Panel>

          <Panel title="Mes messages">
            <Etat loading={messages.loading} error={messages.error} onRetry={messages.recharger}
              vide={!messages.data?.items?.length} videTitre="Aucun message">
              <div className="stack-sm">
                {(messages.data?.items ?? []).map((n) => (
                  <div key={n.id} style={{ display: 'flex', gap: 10 }}>
                    <span className="tag tag-blue">{n.type}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                      {n.texte}
                      <span className="text-muted" style={{ display: 'block', fontSize: 11.5 }}>{ilYa(n.date)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Etat>
          </Panel>

          <Panel title="Mon dossier">
            <Etat loading={dossier.loading} error={dossier.error} onRetry={dossier.recharger}>
              {dossier.data && (
                <>
                  <div className="stack-sm" style={{ fontSize: 13.5 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="text-muted">Dossier</span><strong>{dossier.data?.reference}</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="text-muted">Antécédents déclarés</span>
                      <strong>{dossier.data?.antecedents?.length ? dossier.data?.antecedents?.join(', ') : 'aucun'}</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="text-muted">Mode de paiement</span>
                      <strong>{dossier.data?.modePaiement ?? '—'}</strong>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="text-muted">Consentement</span>
                      <strong>{dossier.data?.consentement ? 'accordé' : 'non recueilli'}</strong>
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 14 }}>
                    <Link className="btn btn-secondary btn-sm" to={`/patients/${id}`}>
                      <Icon name="file" /> Consulter et rectifier
                    </Link>
                  </div>
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                    Vous pouvez consulter votre dossier, demander une rectification ou l’effacement de
                    vos données nominatives. Chaque consultation par un soignant est journalisée.
                  </p>
                </>
              )}
            </Etat>
          </Panel>
        </div>
      </div>
    </>
  )
}
