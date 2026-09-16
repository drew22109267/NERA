import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useToast } from '../components/Toast.jsx'
import { PageHead, Panel, StatCard, Kpi, Bar, Etat, Field, Empty } from '../components/ui.jsx'
import { AreaChart } from '../components/Charts.jsx'
import { CATEGORIES, SEV_PAR_NIVEAU, LIBELLE_TENSION, catLabel } from '../lib/referentiels.js'

const PERIODES = [7, 30, 90, 365]
const SEV_CAT = { 1: 'sev-1', 2: 'sev-2', 3: 'sev-3', 4: 'sev-4' }

export default function Reports() {
  const toast = useToast()
  const [jours, setJours] = useState(30)
  const ind = useApi('/api/rapports/indicateurs', { jours })
  const services = useApi('/api/services', { hospitalisationSeule: true })

  const d = ind.data
  const maxCat = Math.max(1, ...(d?.parCategorie ?? []).map((c) => c.nombre))

  const telecharger = async (chemin, nom) => {
    try {
      const t = localStorage.getItem('htl.token')
      const res = await fetch(api.fichierUrl(chemin), { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      if (!res.ok) throw new Error(`Export refusé (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nom
      a.click()
      URL.revokeObjectURL(url)
      toast.succes('Export téléchargé', nom)
    } catch (e) { toast.erreur('Export impossible', e.message) }
  }

  return (
    <>
      <PageHead kicker="Tableaux de bord & rapports"
        actions={
          <>
            <button className="btn btn-secondary"
              onClick={() => telecharger('/api/rapports/occupation.csv', `occupation-${new Date().toISOString().slice(0, 10)}.csv`)}>
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>Imprimer</button>
          </>
        }>
        Indicateurs calculés sur les données réellement saisies, pour la période choisie. La
        concordance entre décision humaine et recommandation du modèle est suivie en continu.
      </PageHead>

      <div className="toolbar">
        <Field label="Période">
          <select className="input" value={jours} onChange={(e) => setJours(Number(e.target.value))}>
            {PERIODES.map((p) => <option key={p} value={p}>{p} derniers jours</option>)}
          </select>
        </Field>
        <button className="btn btn-secondary" onClick={ind.recharger}>Rafraîchir</button>
      </div>

      <Etat loading={ind.loading} error={ind.error} onRetry={ind.recharger}>
        {d && (
          <>
            <div className="grid g4 section">
              <StatCard title="Passages enregistrés" value={d?.passages}
                deltaNote={`${d?.tries} trié(s) sur la période`} />
              <StatCard title="Taux d’occupation moyen" value={d?.tauxOccupationMoyen} sub=" %"
                delta={`${d?.litsBloques} lits bloqués`} deltaDir="down" deltaNote="capacité armée" />
              <StatCard title="Corrections humaines du score" value={d?.tauxCorrection} sub=" %"
                deltaNote={`${d?.corrections} correction(s) sur ${d?.tries} triage(s)`} />
              <StatCard title="Divergences décision / modèle" value={d?.divergences}
                deltaNote="matériau d’audit d’équité" />
            </div>

            <div className="grid g-side section">
              <Panel kicker="Direction" title={`Indicateurs des ${jours} derniers jours`}>
                <div className="table-wrap">
                  <table className="table">
                    <tbody>
                      <tr><td>Nombre de passages</td><td className="num">{d?.passages}</td></tr>
                      <tr><td>Passages triés</td><td className="num">{d?.tries}</td></tr>
                      <tr><td>Délai moyen entre arrivée et triage</td>
                        <td className="num">{d?.attenteMoyenneMinutes != null ? `${d?.attenteMoyenneMinutes} min` : 'non calculable'}</td></tr>
                      <tr><td>Hospitalisations en cours</td><td className="num">{d?.sejoursEnCours}</td></tr>
                      <tr><td>Durée moyenne de séjour</td>
                        <td className="num">{d?.dureeMoyenneSejour != null ? `${d?.dureeMoyenneSejour} j` : 'aucune sortie enregistrée'}</td></tr>
                      <tr><td>Rendez-vous honorés</td><td className="num">{d?.rendezVousHonores} / {d?.rendezVousTotal}</td></tr>
                      <tr><td>Rendez-vous manqués</td><td className="num">{d?.rendezVousManques}</td></tr>
                      <tr><td>Demandes non satisfaites</td><td className="num">{d?.demandesNonSatisfaites}</td></tr>
                      <tr><td>Lits bloqués pour motif non médical</td><td className="num">{d?.litsBloques}</td></tr>
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="stack">
                <Panel kicker="Gravité" title="Répartition par catégorie de triage">
                  {!d?.parCategorie?.some((c) => c.nombre > 0)
                    ? <Empty titre="Aucun triage sur la période">Le graphique se remplit après le premier triage.</Empty>
                    : (
                      <div className="stack-sm">
                        {d?.parCategorie.map((c) => (
                          <div className="meter-row" key={c.categorie}>
                            <span>{c.categorie} · {catLabel(c.categorie)}</span>
                            <Bar value={(c.nombre / maxCat) * 100} sev={SEV_CAT[c.categorie]} />
                            <span className="num">{c.nombre}</span>
                          </div>
                        ))}
                        <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                          Une part anormalement élevée de catégories 1 et 2 peut signaler un sur-triage
                          à examiner avec l’équipe.
                        </p>
                      </div>
                    )}
                </Panel>

                <Panel kicker="Concordance" title="Modèle et décision humaine">
                  <div className="grid g2" style={{ gap: 12 }}>
                    <Kpi label="Accord" value={d?.tries ? `${Math.max(0, 100 - d?.tauxCorrection).toFixed(1)}` : '—'} unit="%"
                      note="catégorie du modèle retenue telle quelle" />
                    <Kpi label="Correction" value={d?.tauxCorrection} unit="%"
                      note="catégorie modifiée par le soignant" />
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Bar value={d?.tauxCorrection} sev={d?.tauxCorrection > 30 ? 'sev-2' : 'sev-4'} />
                  </div>
                  <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                    Un taux de correction durablement élevé est un signal d’alerte sur le modèle, pas sur
                    les soignants : il déclenche une revue avant tout réentraînement.
                  </p>
                </Panel>
              </div>
            </div>
          </>
        )}
      </Etat>

      <Panel kicker="Capacité" title="Occupation par service" style={{ marginBottom: 'var(--space-4)' }}>
        <Etat loading={services.loading} error={services.error} onRetry={services.recharger}
          vide={!services.data?.length} videTitre="Aucun service paramétré">
          <div className="stack-sm">
            {(services.data ?? []).slice().sort((a, b) => b.tauxOccupation - a.tauxOccupation).map((s) => (
              <div className="meter-row" key={s.id}>
                <span>{s.nom}</span>
                <Bar value={s.tauxOccupation * 100} sev={SEV_PAR_NIVEAU[s.niveau]} />
                <span className="num">
                  {Math.round(s.tauxOccupation * 100)} %
                  <span className={`tag tag-${SEV_PAR_NIVEAU[s.niveau]}`}>{LIBELLE_TENSION[s.niveau]}</span>
                </span>
              </div>
            ))}
          </div>
        </Etat>
      </Panel>

      <Panel kicker="Interopérabilité" title="Export et sauvegarde">
        <p style={{ maxWidth: '70ch' }}>
          Les tableaux d’occupation sont exportables en CSV pour analyse externe. L’export complet
          fournit une sauvegarde JSON de la base, à réaliser avant toute réinitialisation. Une
          interface en lecture seule vers un système national de santé numérique reste à ouvrir.
        </p>
        <div className="row">
          <button className="btn btn-secondary"
            onClick={() => telecharger('/api/rapports/occupation.csv', `occupation-${new Date().toISOString().slice(0, 10)}.csv`)}>
            Occupation (CSV)
          </button>
          <button className="btn btn-secondary"
            onClick={() => telecharger('/api/rapports/export-complet', `sauvegarde-${new Date().toISOString().slice(0, 10)}.json`)}>
            Sauvegarde complète (JSON)
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>Imprimer la vue</button>
        </div>
      </Panel>
    </>
  )
}
