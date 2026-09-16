import { useState } from 'react'
import { useApi } from '../api/hooks.js'
import { PageHead, Panel, StatCard, Bar, Etat, Pager, Field, Alert, Empty, PAR_PAGE, RechercheTableau } from '../components/ui.jsx'
import { dateHeureFr } from '../lib/referentiels.js'

const TYPES_AUDIT = ['Tous', 'consultation', 'creation', 'modification', 'suppression', 'connexion']
const LIBELLE_TYPE = {
  consultation: 'Consultation', creation: 'Création', modification: 'Modification',
  suppression: 'Suppression', connexion: 'Connexion'
}

export default function Quality() {
  const [pagePred, setPagePred] = useState(1)
  const [pageAudit, setPageAudit] = useState(1)
  const [type, setType] = useState('Tous')
  const [qPred, setQPred] = useState('')
  const [qAudit, setQAudit] = useState('')

  const q = useApi('/api/qualite')
  const preds = useApi('/api/qualite/predictions', { recherche: qPred, page: pagePred, pageSize: PAR_PAGE })
  const audit = useApi('/api/qualite/audit', { type, recherche: qAudit, page: pageAudit, pageSize: PAR_PAGE })
  const parametres = useApi('/api/parametres')

  const d = q.data
  const modele = parametres.data?.find((p) => p.cle === 'modele.triage')?.valeur

  return (
    <>
      <PageHead kicker="Qualité, audit & explicabilité">
        Chaque prédiction est journalisée avec son entrée, sa sortie, son explication et la décision
        humaine finale. Tous les chiffres de cette page sont calculés sur les données réellement
        saisies dans cette base.
      </PageHead>

      <Etat loading={q.loading} error={q.error} onRetry={q.recharger}>
        {d && (
          <>
            <div className="grid g4 section">
              <StatCard title="Prédictions journalisées" value={d?.predictionsTotal}
                deltaNote="depuis l’ouverture de la base" />
              <StatCard title="Taux de correction humaine" value={d?.tauxCorrection} sub=" %"
                delta={`${d?.ecarts} écart(s)`} deltaDir={d?.tauxCorrection > 30 ? 'down' : 'up'}
                deltaNote="catégorie modifiée par le soignant" />
              <StatCard title="Modèle de triage actif" value={modele ?? '—'}
                deltaNote="implémentation par règles, apprentissage non branché" />
              <StatCard title="Champs suivis en complétude" value={d?.completude?.length ?? 0}
                deltaNote="calculés sur les fiches de triage réelles" />
            </div>

            <div className="section">
              <Alert level="info" title="Garde-fou méthodologique">{d?.avertissement}</Alert>
            </div>

            <div className="grid g-side section">
              <Panel kicker="Complétude" title="Taux de remplissage par champ">
                {!d?.completude?.length
                  ? (
                    <Empty titre="Aucune fiche de triage enregistrée">
                      La complétude se calcule dès le premier triage. Aucune valeur illustrative n’est
                      affichée à la place.
                    </Empty>
                  )
                  : (
                    <div className="stack-sm">
                      {d?.completude.map((c) => (
                        <div className="meter-row" key={c.champ}>
                          <span>{c.champ}</span>
                          <Bar value={c.taux} sev={c.taux < 50 ? 'sev-1' : c.taux < 75 ? 'sev-3' : 'sev-4'} />
                          <span className="num">{c.taux} %<span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>
                            {c.renseignes}/{c.total}</span></span>
                        </div>
                      ))}
                      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                        Un champ peu renseigné réduit la confiance du modèle : il n’est jamais imputé
                        silencieusement.
                      </p>
                    </div>
                  )}
              </Panel>

              <Panel kicker="Audit d’équité" title="Comportement par sous-groupe">
                {!d?.equite?.length
                  ? <Empty titre="Effectifs insuffisants">L’audit d’équité nécessite des passages triés.</Empty>
                  : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr><th>Sous-groupe</th><th className="num">Effectif</th><th className="num">Correction</th><th className="num">Catégorie moy.</th></tr>
                        </thead>
                        <tbody>
                          {d?.equite.map((e) => (
                            <tr key={e.groupe}>
                              <td>{e.groupe}</td>
                              <td className="num">{e.effectif}</td>
                              <td className="num" style={{ color: e.tauxCorrection > 40 ? 'var(--sev-1)' : undefined, fontWeight: e.tauxCorrection > 40 ? 700 : 500 }}>
                                {e.tauxCorrection} %
                              </td>
                              <td className="num">{e.categorieMoyenne}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                  Un écart persistant de taux de correction entre sous-groupes déclenche une revue
                  avant tout réentraînement.
                </p>
              </Panel>
            </div>
          </>
        )}
      </Etat>

      <Panel kicker="Journal des modèles" title="Prédictions et décisions" style={{ marginBottom: 'var(--space-4)' }}>
        <RechercheTableau valeur={qPred} onChange={(v) => { setQPred(v); setPagePred(1) }}
          placeholder="Rechercher un modèle…" total={preds.data?.total} libelle="prédiction" />
        <Etat loading={preds.loading} error={preds.error} onRetry={preds.recharger}
          vide={!preds.data?.items?.length} videTitre="Aucune prédiction enregistrée"
          videTexte="Réalisez un triage pour alimenter le journal des modèles.">
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Horodatage</th><th>Passage</th><th>Modèle</th><th className="num">Score</th>
                    <th className="num">Sortie</th><th className="num">Décision humaine</th><th className="num">Confiance</th></tr>
                </thead>
                <tbody>
                  {preds.data?.items?.map((p) => (
                    <tr key={p.id}>
                      <td>{dateHeureFr(p.date)}</td>
                      <td>{p.passageId ?? '—'}</td>
                      <td>{p.modele}<span className="sub">{p.typeModele}</span></td>
                      <td className="num">{p.score}</td>
                      <td className="num">{p.sortie}</td>
                      <td className="num">
                        {p.decisionHumaine ?? '—'}
                        {p.ecart && <span className="tag tag-error" style={{ marginLeft: 6 }}>écart</span>}
                      </td>
                      <td className="num">{Math.round(p.confiance * 100)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={preds.data?.page} pages={preds.data?.pages} total={preds.data?.total}
              pageSize={preds.data?.pageSize} onPage={setPagePred} />
          </>
        </Etat>
      </Panel>

      <Panel kicker="Confidentialité" title="Journal d’accès aux dossiers"
        actions={
          <Field label="Type d’accès">
            <select className="input" style={{ minHeight: 36 }} value={type}
              onChange={(e) => { setType(e.target.value); setPageAudit(1) }}>
              {TYPES_AUDIT.map((t) => <option key={t} value={t}>{LIBELLE_TYPE[t] ?? t}</option>)}
            </select>
          </Field>
        }>
        <RechercheTableau valeur={qAudit} onChange={(v) => { setQAudit(v); setPageAudit(1) }}
          placeholder="Rechercher un utilisateur, une action, une cible…"
          total={audit.data?.total} libelle="entrée" />
        <Etat loading={audit.loading} error={audit.error} onRetry={audit.recharger}
          vide={!audit.data?.items?.length} videTitre="Aucun accès journalisé">
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Horodatage</th><th>Utilisateur</th><th>Rôle</th><th>Type</th><th>Action</th><th>Cible</th></tr>
                </thead>
                <tbody>
                  {audit.data?.items?.map((a) => (
                    <tr key={a.id}>
                      <td>{dateHeureFr(a.date)}</td>
                      <td>{a.utilisateur}</td>
                      <td>{a.role}</td>
                      <td><span className="tag tag-neutral">{LIBELLE_TYPE[a.type] ?? a.type}</span></td>
                      <td>{a.action}{a.detail && <span className="sub">{a.detail}</span>}</td>
                      <td>{a.cible ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={audit.data?.page} pages={audit.data?.pages} total={audit.data?.total}
              pageSize={audit.data?.pageSize} onPage={setPageAudit} />
          </>
        </Etat>
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          Les simples consultations de dossier sont journalisées au même titre que les modifications :
          c’est la condition d’un contrôle réel de la confidentialité.
        </p>
      </Panel>

      <Panel kicker="Résilience" title="Mode dégradé" style={{ marginTop: 'var(--space-4)' }}>
        <p style={{ maxWidth: '70ch' }}>
          En cas de rupture de régime — épidémie, afflux massif — ou de panne du service de modèles,
          l’application affiche un avertissement explicite et revient à une règle simple plutôt que
          de produire une prédiction fausse énoncée avec assurance. Lorsque l’API est injoignable,
          chaque écran indique que la donnée est indisponible au lieu d’afficher un chiffre inventé.
        </p>
        <div className="row">
          <span className="tag tag-brand">Modèle de triage : {modele ?? 'non renseigné'}</span>
          <span className="tag tag-neutral">Repli : protocole local MEWS</span>
          <span className="tag tag-neutral">Apprentissage automatique : non branché</span>
        </div>
      </Panel>
    </>
  )
}
