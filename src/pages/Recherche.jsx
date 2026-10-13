import { useEffect, useMemo, useState } from 'react'
import { api, getToken } from '../api/client.js'
import { useApi } from '../api/hooks.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { Confirm } from '../components/Modal.jsx'
import { Icon } from '../components/Icon.jsx'
import { PageHead, Panel, Field, Kpi, Etat, Alert, Empty, Pager, useTableau } from '../components/ui.jsx'
import { dateFr, dateHeureFr } from '../lib/referentiels.js'

const ONGLETS = [['hopitaux', 'Comparaison des hôpitaux'], ['indicateurs', 'Indicateurs hospitaliers'],
  ['harmonisation', 'Harmonisation'], ['import', 'Import d’un registre'], ['lots', 'Imports & export']]
const LIB_REG = { hospitalisation: 'Registre d’hospitalisation', consultation: 'Registre de consultation' }
const TAG_USAGE = { 'prédicteur': 'tag-brand', cible: 'tag-sev-4', 'post-sortie': 'tag-error' }
const LIB_USAGE = { 'post-sortie': 'post-sortie · exclue des prédicteurs' }

const nomHop = (h) => h?.nom || h?.code || (h ? `Hôpital ${h.id}` : '—')
const periode = (c) => (c?.premiere ? `${dateFr(c.premiere)} → ${dateFr(c.derniere)}` : '—')

function Usage({ usage }) {
  return <span className={`tag ${TAG_USAGE[usage] ?? 'tag-neutral'}`}>{LIB_USAGE[usage] ?? usage}</span>
}

/**
 * Dataset de recherche multi-hôpitaux. Les deux conditions du protocole :
 *  1. mêmes variables dans les deux hôpitaux — déclaration des colonnes de chaque
 *     registre, correspondance des valeurs, variables communes ;
 *  2. choix de l'hôpital de développement — comparaison du volume, de la période
 *     et de la complétude réellement importés.
 */
export default function Recherche() {
  const { user } = useAuth()
  const ecriture = ['admin', 'data'].includes(user?.role)
  const [onglet, setOnglet] = useState('hopitaux')
  const etabs = useApi('/api/etablissements')
  const dict = useApi('/api/recherche/dictionnaire')
  const actifs = (etabs.data ?? []).filter((e) => e.actif)

  return (
    <>
      <PageHead />
      <div className="seg" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {ONGLETS.filter(([k]) => ecriture || ['hopitaux', 'indicateurs', 'lots'].includes(k)).map(([k, l]) => (
          <label className="seg-opt" key={k}>
            <input type="radio" name="rech" checked={onglet === k} onChange={() => setOnglet(k)} />
            {l}
          </label>
        ))}
      </div>

      <Etat loading={etabs.loading || dict.loading} error={etabs.error ?? dict.error}
        onRetry={() => { etabs.recharger(); dict.recharger() }}
        vide={!actifs.length} videTitre="Aucun hôpital"
        videTexte="Ajoutez les hôpitaux de l’étude dans Administration › Hôpitaux.">
        <>
          {onglet === 'hopitaux' && <Comparaison dict={dict.data} ecriture={ecriture} rechargerEtabs={etabs.recharger} />}
          {onglet === 'indicateurs' && <Indicateurs hopitaux={actifs} />}
          {onglet === 'harmonisation' && <Harmonisation dict={dict.data} hopitaux={actifs} />}
          {onglet === 'import' && <Import hopitaux={actifs} versHarmonisation={() => setOnglet('harmonisation')} />}
          {onglet === 'lots' && <Lots ecriture={ecriture} />}
        </>
      </Etat>
    </>
  )
}

// ── 1. Comparaison des hôpitaux et rôles ─────────────────────────────────

function Comparaison({ dict, ecriture, rechargerEtabs }) {
  const toast = useToast()
  const comp = useApi('/api/recherche/comparaison')
  const d = comp.data
  const hopitaux = d?.hopitaux ?? []

  const changerRole = async (h, role) => {
    try {
      await api.put(`/api/etablissements/${h.id}/role`, { role })
      toast.succes('Rôle enregistré', `${nomHop(h)} → ${role || 'aucun'}`)
      comp.recharger(); rechargerEtabs()
    } catch (e) { toast.erreur('Rôle refusé', e.message) }
  }

  // Complétude moyenne sur les variables communes : calculée sur les lignes importées.
  const completudeCommune = (h, registre) => {
    const codes = new Set((d?.communes?.[registre] ?? []).map((v) => v.code))
    const vals = h[registre].variables.filter((v) => codes.has(v.code) && v.completude !== null).map((v) => v.completude)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  return (
    <Etat loading={comp.loading} error={comp.error} onRetry={comp.recharger}>
      <div className="stack">
        {d && !d.roleAttribue && (
          <Alert level="info" title="Choisir l’hôpital de développement">
            L’hôpital de développement (A) sert à construire le modèle ; l’hôpital de validation externe (B)
            reste entièrement séparé et sert à vérifier que le modèle fonctionne ailleurs. Choisissez pour A
            l’hôpital qui a le plus de données et les registres les plus complets, au vu du tableau ci-dessous.
          </Alert>
        )}

        <Panel kicker="Condition 2" title="Volume, période et complétude par hôpital">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Hôpital</th><th>Rôle dans l’étude</th>
                  <th className="num">Séjours</th><th>Période (hospitalisation)</th><th>Mois manquants</th>
                  <th className="num">Consultations</th><th>Période (consultation)</th>
                  <th className="num">Complétude des variables communes</th></tr>
              </thead>
              <tbody>
                {hopitaux.map((h) => {
                  const ch = completudeCommune(h, 'hospitalisation')
                  const cc = completudeCommune(h, 'consultation')
                  const manquants = h.hospitalisation.couverture.moisManquants
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{nomHop(h)}<span className="sub">{h.code || '—'}</span></td>
                      <td>
                        {ecriture
                          ? <select className="input" style={{ minHeight: 34, width: 'auto' }} value={h.roleRecherche}
                              onChange={(e) => changerRole(h, e.target.value)}>
                              <option value="">aucun</option>
                              {(dict?.roles ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          : (h.roleRecherche || <span className="text-muted">aucun</span>)}
                      </td>
                      <td className="num">{h.hospitalisation.lignes}</td>
                      <td>{periode(h.hospitalisation.couverture)}<span className="sub">{h.hospitalisation.couverture.mois} mois couverts</span></td>
                      <td>{manquants.length
                        ? <span className="tag tag-error" title={manquants.join(', ')}>{manquants.length} mois</span>
                        : h.hospitalisation.lignes ? <span className="tag tag-sev-4">aucun</span> : <span className="text-muted">—</span>}</td>
                      <td className="num">{h.consultation.lignes}</td>
                      <td>{periode(h.consultation.couverture)}<span className="sub">{h.consultation.couverture.mois} mois couverts</span></td>
                      <td className="num">
                        {ch === null && cc === null ? <span className="text-muted">—</span>
                          : <>{ch !== null ? `${ch} %` : '—'}<span className="sub">hosp. · cons. {cc !== null ? `${cc} %` : '—'}</span></>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
            Un mois manquant entre la première et la dernière date fausse l’occupation reconstruite :
            vérifiez si un cahier du registre n’a pas été saisi. Chiffres calculés sur les lignes importées.
          </p>
        </Panel>

        {['hospitalisation', 'consultation'].map((reg) => (
          <Panel key={reg} kicker="Condition 1" title={`Variables communes — ${LIB_REG[reg]}`}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Variable</th><th>Usage</th>
                    {hopitaux.map((h) => <th key={h.id} className="num">{nomHop(h)}</th>)}
                    <th>Commune</th></tr>
                </thead>
                <tbody>
                  {(dict?.variables ?? []).filter((v) => v.registre === reg).map((v) => {
                    const commune = (d?.communes?.[reg] ?? []).some((c) => c.code === v.code)
                    return (
                      <tr key={v.code}>
                        <td style={{ fontWeight: 600 }}>{v.libelle}<span className="sub">{v.code}</span></td>
                        <td><Usage usage={v.usage} /></td>
                        {hopitaux.map((h) => {
                          const x = h[reg].variables.find((y) => y.code === v.code)
                          return (
                            <td key={h.id} className="num">
                              {!x?.declaree ? <span className="text-muted">non enregistrée</span>
                                : x.completude === null ? 'déclarée' : `${x.completude} %`}
                            </td>
                          )
                        })}
                        <td>{commune ? <span className="tag tag-sev-4">oui</span> : <span className="text-muted">non</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
              Le modèle porté d’un hôpital à l’autre ne peut utiliser que les variables communes. Les
              variables « post-sortie » ne sont connues qu’après la sortie : elles ne servent jamais de prédicteurs.
            </p>
          </Panel>
        ))}
      </div>
    </Etat>
  )
}

// ── 2. Harmonisation : colonnes et correspondances ───────────────────────

function Harmonisation({ dict, hopitaux }) {
  const toast = useToast()
  const [hopId, setHopId] = useState(String(hopitaux[0]?.id ?? ''))
  const [registre, setRegistre] = useState('hospitalisation')
  const [form, setForm] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [choix, setChoix] = useState({})
  const [manuel, setManuel] = useState({ variableCode: '', valeurBrute: '', valeurNormalisee: '' })

  const colonnes = useApi(hopId ? `/api/recherche/etablissements/${hopId}/colonnes` : null, { registre }, { skip: !hopId })
  const corr = useApi(hopId ? `/api/recherche/etablissements/${hopId}/correspondances` : null, null, { skip: !hopId })
  const nonHarm = useApi(hopId ? `/api/recherche/etablissements/${hopId}/non-harmonisees` : null, null, { skip: !hopId })
  const services = useApi('/api/services', { etablissementId: hopId }, { skip: !hopId })

  useEffect(() => {
    if (colonnes.data) setForm(Object.fromEntries(colonnes.data.map((c) => [c.variableCode,
      { nomColonne: c.nomColonne ?? '', valeurFixe: c.valeurFixe ?? '', note: c.note ?? '' }])))
  }, [colonnes.data])

  const variables = (dict?.variables ?? []).filter((v) => v.registre === registre)
  const libelle = (code) => dict?.variables.find((v) => v.code === code)?.libelle ?? code
  const valeursDe = (code) => {
    if (code === 'service') return (services.data ?? []).map((s) => s.code)
    return dict?.variables.find((v) => v.code === code)?.valeurs ?? []
  }
  const categorielles = [...new Map((dict?.variables ?? []).filter((v) => v.categorielle || v.type === 'service' || v.type === 'unite_age')
    .map((v) => [v.code, v])).values()]

  const enregistrerColonnes = async () => {
    setEnvoi(true)
    try {
      await api.put(`/api/recherche/etablissements/${hopId}/colonnes`, {
        registre,
        colonnes: variables.map((v) => ({
          variableCode: v.code,
          nomColonne: form[v.code]?.nomColonne || null,
          valeurFixe: form[v.code]?.valeurFixe || null,
          note: form[v.code]?.note || null
        }))
      })
      toast.succes('Colonnes enregistrées', LIB_REG[registre])
      colonnes.recharger()
    } catch (e) { toast.erreur('Enregistrement refusé', e.message) } finally { setEnvoi(false) }
  }

  const associer = async (variableCode, valeurBrute, valeurNormalisee) => {
    try {
      const r = await api.put(`/api/recherche/etablissements/${hopId}/correspondances`, { variableCode, valeurBrute, valeurNormalisee })
      toast.succes('Correspondance enregistrée', `« ${valeurBrute} » → ${valeurNormalisee} · ${r.lignesMisesAJour} ligne(s) mise(s) à jour`)
      corr.recharger(); nonHarm.recharger()
      return true
    } catch (e) { toast.erreur('Correspondance refusée', e.message); return false }
  }

  const supprimer = async (c) => {
    try {
      await api.del(`/api/recherche/correspondances/${c.id}`)
      toast.succes('Correspondance supprimée', `« ${c.valeurBrute} »`)
      corr.recharger(); nonHarm.recharger()
    } catch (e) { toast.erreur('Suppression refusée', e.message) }
  }

  const tblNon = useTableau(nonHarm.data ?? [], [(x) => libelle(x.variable), 'valeurBrute'], 10)
  const tblCorr = useTableau(corr.data ?? [], [(x) => libelle(x.variableCode), 'valeurBrute', 'valeurNormalisee'], 10)
  const listeVide = (code) => valeursDe(code).length === 0

  return (
    <div className="stack">
      <div className="toolbar">
        <Field label="Hôpital">
          <select className="input" value={hopId} onChange={(e) => setHopId(e.target.value)}>
            {hopitaux.map((h) => <option key={h.id} value={h.id}>{nomHop(h)}</option>)}
          </select>
        </Field>
        <Field label="Registre">
          <select className="input" value={registre} onChange={(e) => setRegistre(e.target.value)}>
            {(dict?.registres ?? []).map((r) => <option key={r} value={r}>{LIB_REG[r]}</option>)}
          </select>
        </Field>
      </div>

      <Panel kicker="Déclaration du registre" title="Quelle colonne porte quelle variable"
        actions={<button className="btn btn-primary btn-sm" onClick={enregistrerColonnes} disabled={envoi || colonnes.loading}>
          {envoi ? <><span className="spinner" /> Enregistrement…</> : 'Enregistrer'}</button>}>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Recopiez l’intitulé exact de la colonne dans le fichier de cet hôpital. Laissez vide si l’hôpital
          n’enregistre pas la variable. Les colonnes nom, prénom et téléphone ne sont jamais importées.
        </p>
        <Etat loading={colonnes.loading} error={colonnes.error} onRetry={colonnes.recharger}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Variable harmonisée</th><th>Usage</th><th style={{ minWidth: 220 }}>Colonne dans le registre</th></tr></thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.code}>
                    <td style={{ fontWeight: 600 }}>{v.libelle}{v.requise && ' *'}
                      {v.aide && <span className="sub">{v.aide}</span>}</td>
                    <td><Usage usage={v.usage} /></td>
                    <td>
                      <input className="input" placeholder="non enregistrée" value={form[v.code]?.nomColonne ?? ''}
                        onChange={(e) => setForm({ ...form, [v.code]: { ...form[v.code], nomColonne: e.target.value } })} />
                      {v.code === 'age_unite' && (
                        <select className="input" style={{ marginTop: 6 }} value={form[v.code]?.valeurFixe ?? ''}
                          onChange={(e) => setForm({ ...form, [v.code]: { ...form[v.code], valeurFixe: e.target.value } })}>
                          <option value="">Unité non déclarée (lue dans l’âge si écrite)</option>
                          {(dict?.unitesAge ?? []).map((u) => <option key={u} value={u}>Âges toujours en {u} dans ce registre</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Etat>
      </Panel>

      <div className="grid g-side">
        <Panel kicker="À traiter" title="Valeurs importées sans correspondance">
          <Etat loading={nonHarm.loading} error={nonHarm.error} onRetry={nonHarm.recharger}
            vide={!nonHarm.data?.length} videTitre="Rien à harmoniser"
            videTexte="Toutes les valeurs importées de cet hôpital ont une valeur harmonisée.">
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Variable</th><th>Valeur du registre</th><th className="num">Lignes</th><th style={{ minWidth: 200 }}>Valeur harmonisée</th></tr></thead>
                  <tbody>
                    {tblNon.visibles.map((x) => {
                      const k = `${x.variable}|${x.valeurBrute}`
                      return (
                        <tr key={k}>
                          <td>{libelle(x.variable)}</td>
                          <td style={{ fontWeight: 600 }}>{x.valeurBrute}</td>
                          <td className="num">{x.occurrences}</td>
                          <td>
                            {listeVide(x.variable)
                              ? <span className="text-muted" style={{ fontSize: 12.5 }}>
                                  {x.variable === 'service' ? 'Créez d’abord les services de cet hôpital.' : 'Liste vide : renseignez-la dans Administration › Listes.'}
                                </span>
                              : <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                                  <select className="input" style={{ minHeight: 34 }} value={choix[k] ?? ''}
                                    onChange={(e) => setChoix({ ...choix, [k]: e.target.value })}>
                                    <option value="">—</option>
                                    {valeursDe(x.variable).map((val) => <option key={val} value={val}>{val}</option>)}
                                  </select>
                                  <button className="btn btn-secondary btn-sm" disabled={!choix[k]}
                                    onClick={() => associer(x.variable, x.valeurBrute, choix[k])}>Associer</button>
                                </div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={tblNon.page} pages={tblNon.pages} total={tblNon.total} pageSize={tblNon.parPage} onPage={tblNon.setPage} />
            </>
          </Etat>
        </Panel>

        <Panel kicker="Avant import" title="Ajouter une correspondance">
          <form className="stack-sm" onSubmit={async (e) => {
            e.preventDefault()
            if (await associer(manuel.variableCode, manuel.valeurBrute.trim(), manuel.valeurNormalisee))
              setManuel({ ...manuel, valeurBrute: '', valeurNormalisee: '' })
          }}>
            <Field label="Variable">
              <select className="input" required value={manuel.variableCode}
                onChange={(e) => setManuel({ variableCode: e.target.value, valeurBrute: '', valeurNormalisee: '' })}>
                <option value="">—</option>
                {categorielles.map((v) => <option key={v.code} value={v.code}>{v.libelle}</option>)}
              </select>
            </Field>
            <Field label="Valeur telle qu’écrite dans le registre" hint="Ex. « défere », « APG », « masculin »">
              <input className="input" required value={manuel.valeurBrute}
                onChange={(e) => setManuel({ ...manuel, valeurBrute: e.target.value })} />
            </Field>
            <Field label="Valeur harmonisée">
              <select className="input" required value={manuel.valeurNormalisee} disabled={!manuel.variableCode}
                onChange={(e) => setManuel({ ...manuel, valeurNormalisee: e.target.value })}>
                <option value="">—</option>
                {(manuel.variableCode ? valeursDe(manuel.variableCode) : []).map((val) => <option key={val} value={val}>{val}</option>)}
              </select>
            </Field>
            <button className="btn btn-primary" type="submit"
              disabled={!manuel.variableCode || !manuel.valeurBrute.trim() || !manuel.valeurNormalisee}>Enregistrer</button>
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
              Chaque hôpital a ses propres correspondances. Les lignes déjà importées sont mises à jour aussitôt.
            </p>
          </form>
        </Panel>
      </div>

      <Panel kicker="Hôpital sélectionné" title="Correspondances enregistrées">
        <Etat loading={corr.loading} error={corr.error} onRetry={corr.recharger}
          vide={!corr.data?.length} videTitre="Aucune correspondance">
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Variable</th><th>Valeur du registre</th><th>Valeur harmonisée</th><th /></tr></thead>
                <tbody>
                  {tblCorr.visibles.map((c) => (
                    <tr key={c.id}>
                      <td>{libelle(c.variableCode)}</td>
                      <td style={{ fontWeight: 600 }}>{c.valeurBrute}</td>
                      <td><span className="tag tag-brand">{c.valeurNormalisee}</span></td>
                      <td><button className="icon-btn danger" title="Supprimer" onClick={() => supprimer(c)}><Icon name="trash" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={tblCorr.page} pages={tblCorr.pages} total={tblCorr.total} pageSize={tblCorr.parPage} onPage={tblCorr.setPage} />
          </>
        </Etat>
      </Panel>
    </div>
  )
}

// ── 3. Import d'un registre ─────────────────────────────────────────────

function Import({ hopitaux, versHarmonisation }) {
  const toast = useToast()
  const [hopId, setHopId] = useState(String(hopitaux[0]?.id ?? ''))
  const [registre, setRegistre] = useState('hospitalisation')
  const [serviceId, setServiceId] = useState('')
  const [fichier, setFichier] = useState(null)
  const [rapport, setRapport] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const services = useApi('/api/services', { etablissementId: hopId }, { skip: !hopId })

  // Tout changement de paramètre invalide l'aperçu : on n'importe que ce qui a été vérifié.
  useEffect(() => { setRapport(null) }, [hopId, registre, serviceId, fichier])

  const envoyer = async (apercu) => {
    if (!fichier) return
    setEnvoi(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      fd.append('etablissementId', hopId)
      fd.append('registre', registre)
      if (serviceId) fd.append('serviceId', serviceId)
      fd.append('apercu', apercu ? 'true' : 'false')
      const r = await api.upload('/api/recherche/import', fd)
      setRapport(r)
      if (!apercu) toast.succes('Import terminé', `${r.lignesImportees} ligne(s) ajoutée(s) au dataset`)
    } catch (e) { toast.erreur(apercu ? 'Vérification impossible' : 'Import refusé', e.message) } finally { setEnvoi(false) }
  }

  const tblErr = useTableau(rapport?.erreurs ?? [], ['message'], 8)
  const tblAv = useTableau(rapport?.avertissements ?? [], ['message'], 8)
  const importe = rapport && !rapport.apercu

  return (
    <div className="stack">
      <div className="grid g-side">
        <Panel kicker="Fichier" title="Registre à importer">
          <div className="stack-sm">
            <div className="form-grid">
              <Field label="Hôpital">
                <select className="input" value={hopId} onChange={(e) => { setHopId(e.target.value); setServiceId('') }}>
                  {hopitaux.map((h) => <option key={h.id} value={h.id}>{nomHop(h)}</option>)}
                </select>
              </Field>
              <Field label="Registre">
                <select className="input" value={registre} onChange={(e) => setRegistre(e.target.value)}>
                  {Object.entries(LIB_REG).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Service du fichier" hint="Si le registre n’a pas de colonne « service »">
                <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">lu dans la colonne « service »</option>
                  {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.nom}</option>)}
                </select>
              </Field>
              <Field label="Fichier CSV" hint="Excel : Enregistrer sous › CSV (séparateur : point-virgule)">
                <input className="input" type="file" accept=".csv,.txt" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
              </Field>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary" disabled={!fichier || envoi} onClick={() => envoyer(true)}>
                {envoi ? <><span className="spinner" /> Lecture…</> : 'Vérifier le fichier'}
              </button>
              <button className="btn btn-primary" disabled={!rapport?.apercu || !rapport.lignesImportees || envoi}
                onClick={() => envoyer(false)}>
                {rapport?.apercu ? `Importer ${rapport.lignesImportees} ligne(s)` : 'Importer'}
              </button>
            </div>
          </div>
        </Panel>
        <Panel kicker="Règles" title="Ce que l’import vérifie">
          <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0, color: 'var(--muted)' }}>
            <li>Chaque colonne déclarée pour cet hôpital doit être présente dans le fichier.</li>
            <li>Une date illisible, une sortie avant l’entrée ou une date future rejettent la ligne.</li>
            <li>Une constante hors plage physiologique est laissée vide et signalée.</li>
            <li>Une valeur sans correspondance est gardée telle quelle, sa valeur harmonisée reste vide.</li>
            <li>Un séjour déjà importé (même identifiant, service et date) n’est pas dupliqué.</li>
            <li>Nom, prénom et téléphone ne sont jamais lus.</li>
          </ul>
        </Panel>
      </div>

      {rapport && (
        <Panel kicker={importe ? `Import n° ${rapport.lotId}` : 'Aperçu — rien n’est encore enregistré'}
          title={`${rapport.nomFichier} · ${LIB_REG[rapport.registre]}`}>
          <div className="stack">
            <div className="grid g4">
              <Kpi label="Lignes lues" value={rapport.lignesLues} />
              <Kpi label={importe ? 'Lignes importées' : 'Lignes importables'} value={rapport.lignesImportees}
                note={[rapport.premiereDate && `${dateFr(rapport.premiereDate)} → ${dateFr(rapport.derniereDate)}`,
                  rapport.sortiesCalculees > 0 && `${rapport.sortiesCalculees} sortie(s) calculée(s) avec le nombre de jours`]
                  .filter(Boolean).join(' · ') || undefined} />
              <Kpi label="Lignes rejetées" value={rapport.lignesRejetees} />
              <Kpi label="Doublons ignorés" value={rapport.doublons} />
            </div>

            {rapport.colonnesIdentifiantesIgnorees.length > 0 && (
              <Alert level="info" title="Colonnes identifiantes non importées">
                {rapport.colonnesIdentifiantesIgnorees.join(', ')} : ces colonnes ne sont jamais lues.
              </Alert>
            )}
            {rapport.colonnesIgnorees.length > 0 && (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                Colonnes présentes mais non déclarées (ignorées) : {rapport.colonnesIgnorees.join(', ')}.
              </p>
            )}
            {rapport.nonHarmonisees.length > 0 && (
              <Alert level="warn" title={`${rapport.nonHarmonisees.length} valeur(s) sans correspondance`}>
                {rapport.nonHarmonisees.slice(0, 12).map((v) => `${v.variable} : « ${v.valeurBrute} » (${v.occurrences})`).join(' · ')}
                {rapport.nonHarmonisees.length > 12 && ' …'}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={versHarmonisation}>Les associer dans Harmonisation</button>
                </div>
              </Alert>
            )}

            <div className="grid g2">
              <div>
                <div className="card-kicker">Erreurs ({rapport.erreurs.length})</div>
                {rapport.erreurs.length ? (
                  <>
                    <table className="table"><tbody>
                      {tblErr.visibles.map((m, i) => <tr key={i}><td className="num" style={{ width: 70 }}>l. {m.ligne}</td><td>{m.message}</td></tr>)}
                    </tbody></table>
                    <Pager page={tblErr.page} pages={tblErr.pages} total={tblErr.total} pageSize={tblErr.parPage} onPage={tblErr.setPage} />
                  </>
                ) : <Empty titre="Aucune erreur" />}
              </div>
              <div>
                <div className="card-kicker">Avertissements ({rapport.avertissements.length})</div>
                {rapport.avertissements.length ? (
                  <>
                    <table className="table"><tbody>
                      {tblAv.visibles.map((m, i) => <tr key={i}><td className="num" style={{ width: 70 }}>l. {m.ligne}</td><td>{m.message}</td></tr>)}
                    </tbody></table>
                    <Pager page={tblAv.page} pages={tblAv.pages} total={tblAv.total} pageSize={tblAv.parPage} onPage={tblAv.setPage} />
                  </>
                ) : <Empty titre="Aucun avertissement" />}
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Indicateurs hospitaliers (TOM, DMS, rotation…) ───────────────────────

const COLONNES_IND = [
  ['admissions', 'Admissions'], ['sorties', 'Sorties'], ['journeesHospitalisation', 'Journées d’hosp.'],
  ['tom', 'TOM %'], ['tomBas', 'TOM bas %'], ['tomHaut', 'TOM haut %'], ['occupationMax', 'Occup. max'], ['joursSureffectif', 'Jours en sureffectif'],
  ['dms', 'DMS (nuits)'], ['rotationLits', 'Rotation'], ['intervalleRotation', 'Intervalle de rotation (j)'],
  ['deces', 'Décès'], ['mortalite', 'Mortalité %']
]
// Comptes pondérés (sorties non écrites : espérance) : affichés à l'unité, exportés exacts.
const ENTIERS = new Set(['sorties', 'deces', 'journeesHospitalisation', 'occupationMax'])
const LIB_STATUT = { observee: 'sortie écrite', calculee: 'sortie calculée', censuree: 'encore hospitalisé', inconnue: 'durée inconnue (exclu)' }

/** Occupation à minuit, jour par jour (attendue, avec sa fourchette), et la capacité en lits. */
function CourbeOccupation({ serie, lits, height = 240 }) {
  if (!serie?.length) return null
  const W = 900, H = height, ml = 38, mr = 12, mt = 14, mb = 26
  const max = Math.max(lits ?? 0, ...serie.map((p) => p.haut ?? p.presents)) * 1.12 || 1
  const x = (i) => ml + (i / Math.max(1, serie.length - 1)) * (W - ml - mr)
  const y = (v) => mt + (1 - v / max) * (H - mt - mb)
  const chemin = serie.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.presents).toFixed(1)}`).join(' ')
  // Bande : du haut (tout en nuits) au bas (tout inclusif), parcourue aller puis retour.
  const bande = serie.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.haut).toFixed(1)}`).join(' ')
    + serie.map((p, i) => i).reverse().map((i) => `L${x(i).toFixed(1)},${y(serie[i].bas).toFixed(1)}`).join(' ') + 'Z'
  const mois = serie.map((p, i) => ({ i, d: p.jour })).filter(({ d }) => d.endsWith('-01'))
  const pas = Math.max(1, Math.ceil(mois.length / 10))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Occupation journalière">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={ml} x2={W - mr} y1={y(max * f)} y2={y(max * f)} stroke="#eaecef" strokeDasharray="4 5" />
          <text x={ml - 7} y={y(max * f) + 4} textAnchor="end" fontSize="10.5" fill="#9ca2ab">{Math.round(max * f)}</text>
        </g>
      ))}
      {lits && <>
        <line x1={ml} x2={W - mr} y1={y(lits)} y2={y(lits)} stroke="var(--sev-1)" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={W - mr} y={y(lits) - 5} textAnchor="end" fontSize="11" fill="var(--sev-1-ink)" fontWeight="600">{lits} lits</text>
      </>}
      <path d={bande} fill="var(--brand)" fillOpacity="0.16" stroke="none" />
      <path d={chemin} fill="none" stroke="var(--brand)" strokeWidth="1.4" />
      {mois.filter((_, k) => k % pas === 0).map(({ i, d }) => (
        <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca2ab">{d.slice(5, 7)}/{d.slice(2, 4)}</text>
      ))}
    </svg>
  )
}

function Indicateurs({ hopitaux }) {
  const toast = useToast()
  const [hopId, setHopId] = useState(String(hopitaux[0]?.id ?? ''))
  const [serviceId, setServiceId] = useState('')
  const [par, setPar] = useState('mois')
  const services = useApi('/api/services', { etablissementId: hopId, hospitalisationSeule: true }, { skip: !hopId })
  const svc = serviceId || String(services.data?.[0]?.id ?? '')
  const ind = useApi('/api/recherche/indicateurs', { etablissementId: hopId, serviceId: svc, par }, { skip: !hopId || !svc })
  const d = ind.data
  const total = d?.lignes?.find((l) => l.periode === 'Total')
  const val = (v, suffixe = '') => (v === null || v === undefined ? '—' : `${v}${suffixe}`)
  const tagConvention = d?.convention?.partInclusive === null || d?.convention?.partInclusive === undefined ? 'tag-neutral' : 'tag-brand'

  const exporter = () => {
    const nom = services.data?.find((s) => String(s.id) === svc)?.code ?? 'service'
    const lignes = [['Période', 'Jours', ...COLONNES_IND.map(([, l]) => l)].join(';'),
      ...d.lignes.map((l) => [l.periode, l.jours, ...COLONNES_IND.map(([k]) => l[k] ?? '')].join(';'))]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `indicateurs-${nom.toLowerCase()}-par-${par}.csv`; a.click(); URL.revokeObjectURL(a.href)
    toast.succes('Indicateurs exportés')
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <Field label="Hôpital">
          <select className="input" value={hopId} onChange={(e) => { setHopId(e.target.value); setServiceId('') }}>
            {hopitaux.map((h) => <option key={h.id} value={h.id}>{nomHop(h)}</option>)}
          </select>
        </Field>
        <Field label="Service">
          <select className="input" value={svc} onChange={(e) => setServiceId(e.target.value)}>
            {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.nom}</option>)}
          </select>
        </Field>
        <div className="seg" style={{ alignSelf: 'flex-end' }}>
          {[['mois', 'Par mois'], ['annee', 'Par année']].map(([k, l]) => (
            <label className="seg-opt" key={k}><input type="radio" name="parInd" checked={par === k} onChange={() => setPar(k)} />{l}</label>
          ))}
        </div>
        {d?.lignes?.length > 0 && <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }} onClick={exporter}>Exporter (CSV)</button>}
      </div>

      <Etat loading={ind.loading || services.loading} error={ind.error ?? services.error} onRetry={ind.recharger}
        vide={!services.loading && !services.data?.length} videTitre="Aucun service avec des lits dans cet hôpital">
        {d && (
          <div className="stack">
            <Alert level="info" title={`Période de test final masquée à partir du ${dateFr(d.verrou)}`}>
              Ces mois sont réservés à la validation finale des modèles : ils ne sont comptés dans aucun indicateur.
            </Alert>
            {d.message && <Alert level="warn">{d.message}</Alert>}

            {total && (
              <div className="grid g4">
                <Kpi label="Taux d’occupation moyen" value={val(total.tom)} unit="%"
                  note={d.lits ? `entre ${val(total.tomBas)} et ${val(total.tomHaut)} % · ${d.lits} ${d.sourceLits}` : 'lits non renseignés'} />
                <Kpi label="Durée moyenne de séjour" value={val(total.dms)} unit="nuits" note={`${Math.round(total.sorties)} sorties`} />
                <Kpi label="Jours en sureffectif" value={total.joursSureffectif} note={`occupation maximale : ${Math.round(total.occupationMax)}`} />
                <Kpi label="Mortalité hospitalière" value={val(total.mortalite)} unit="%" note={`${Math.round(total.deces)} décès`} />
              </div>
            )}

            <Panel kicker="Données utilisées" title="Ce que contient le calcul">
              <div className="row" style={{ gap: 8 }}>
                {d.debut && <span className="tag tag-brand">Période exploitable : {dateFr(d.debut)} → {dateFr(d.fin)}</span>}
                {d.premierMoisComplet && <span className="tag tag-neutral">Durées notées à partir de {d.premierMoisComplet}{d.rodageJours ? ` · rodage ${d.rodageJours} j` : ''}</span>}
                {Object.entries(d.statuts).map(([k, n]) => <span key={k} className="tag tag-neutral">{n} {LIB_STATUT[k]}</span>)}
              </div>
              <p style={{ fontSize: 13.5, margin: 'var(--space-3) 0 0' }}>
                <span className={`tag ${tagConvention}`} style={{ marginRight: 8 }}>Convention des jours</span>
                {d.convention.conclusion}
                {d.convention.lignes > 0 && <span className="text-muted"> ({d.convention.lignes} lignes avec sortie écrite et nombre de jours :
                  {' '}{d.convention.inclusives} inclusives, {d.convention.nuits} en nuits{d.convention.autresEcarts ? `, ${d.convention.autresEcarts} incohérentes` : ''})</span>}
              </p>
            </Panel>

            {d.serie?.length > 0 && (
              <Panel kicker="Recensement de minuit" title="Patients présents chaque jour">
                <CourbeOccupation serie={d.serie} lits={d.lits} />
                <p className="text-muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  Courbe : occupation attendue. Bande claire : fourchette entre « tout inclusif » (bas) et « tout en nuits » (haut),
                  due aux sorties non écrites. Au-dessus de la ligne rouge : plus de patients que de lits (lits ajoutés, deux enfants par lit…).
                </p>
              </Panel>
            )}

            {d.lignes?.length > 0 && (
              <Panel kicker={par === 'mois' ? 'Par mois' : 'Par année'} title="Indicateurs hospitaliers">
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Période</th><th className="num">Jours</th>{COLONNES_IND.map(([k, l]) => <th key={k} className="num">{l}</th>)}</tr></thead>
                    <tbody>
                      {d.lignes.map((l) => (
                        <tr key={l.periode} style={l.periode === 'Total' ? { fontWeight: 700, background: 'var(--surface-2)' } : undefined}>
                          <td>{l.periode}</td><td className="num">{l.jours}</td>
                          {COLONNES_IND.map(([k]) => (
                            <td key={k} className="num" style={k === 'tom' && l.tom > 100 ? { color: 'var(--sev-1-ink)', fontWeight: 700 } : undefined}>{ENTIERS.has(k) ? Math.round(l[k]) : val(l[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details style={{ marginTop: 'var(--space-3)', fontSize: 13 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Définitions</summary>
                  <ul className="text-muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
                    <li><b>Journées d’hospitalisation</b> : somme des patients présents à minuit (un patient compte de son entrée à la veille de sa sortie).</li>
                    <li><b>TOM</b> = journées ÷ (lits × jours) × 100. Au-delà de 100 % : sureffectif.</li>
                    <li><b>Sorties non écrites</b> : selon le médecin, « 3 jours » veut dire 3 nuits ou 2 nuits (jour d’entrée et jour de sortie comptés).
                      La part de lignes inclusives est mesurée sur les sorties écrites ; la nuit incertaine compte pour la part restante (<b>TOM</b> attendu).
                      <b>TOM bas</b> : toutes les lignes inclusives · <b>TOM haut</b> : toutes en nuits. Le vrai TOM est entre les deux.</li>
                    <li><b>DMS</b> = durée moyenne, en nuits, des séjours terminés dans la période.</li>
                    <li><b>Rotation</b> = sorties ÷ lits · <b>Intervalle de rotation</b> = (lits × jours − journées) ÷ sorties : jours où un lit reste vide entre deux patients.</li>
                    <li><b>Mortalité</b> = décès ÷ sorties × 100. Mêmes définitions que la chaîne d’analyse du mémoire.</li>
                  </ul>
                </details>
              </Panel>
            )}
          </div>
        )}
      </Etat>
    </div>
  )
}

// ── 4. Imports passés et export du dataset ──────────────────────────────

function Lots({ ecriture }) {
  const toast = useToast()
  const lots = useApi('/api/recherche/lots')
  const [suppr, setSuppr] = useState(null)
  const [communes, setCommunes] = useState(true)
  const tbl = useTableau(lots.data ?? [], ['nomFichier', 'etablissement', 'registre'], 8)

  const supprimer = async (l) => {
    try {
      await api.del(`/api/recherche/lots/${l.id}`)
      toast.succes('Import annulé', `${l.lignesImportees} ligne(s) retirée(s) du dataset`)
      lots.recharger()
    } catch (e) { toast.erreur('Annulation refusée', e.message) }
  }

  const exporter = async (registre) => {
    try {
      const t = getToken()
      const res = await fetch(api.fichierUrl(`/api/recherche/export.csv?registre=${registre}&communesSeulement=${communes}`),
        { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      if (!res.ok) throw new Error(`Export refusé (${res.status})`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `dataset-${registre}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.succes('Export téléchargé', LIB_REG[registre])
    } catch (e) { toast.erreur('Export impossible', e.message) }
  }

  const total = useMemo(() => (lots.data ?? []).reduce((a, l) => a + l.lignesImportees, 0), [lots.data])

  return (
    <div className="stack">
      <Panel kicker="Traçabilité" title={`Imports réalisés · ${total} ligne(s) au total`}>
        <Etat loading={lots.loading} error={lots.error} onRetry={lots.recharger}
          vide={!lots.data?.length} videTitre="Aucun import"
          videTexte="Les registres importés apparaissent ici, avec leur rapport.">
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Hôpital</th><th>Registre</th><th>Fichier</th>
                  <th className="num">Importées</th><th className="num">Rejetées</th><th className="num">Doublons</th><th /></tr></thead>
                <tbody>
                  {tbl.visibles.map((l) => (
                    <tr key={l.id}>
                      <td>{dateHeureFr(l.importeLe)}<span className="sub">{l.importePar ?? '—'}</span></td>
                      <td>{l.etablissement || '—'}</td>
                      <td>{LIB_REG[l.registre] ?? l.registre}</td>
                      <td style={{ fontWeight: 600 }}>{l.nomFichier}</td>
                      <td className="num">{l.lignesImportees}<span className="sub">sur {l.lignesLues}</span></td>
                      <td className="num">{l.lignesRejetees}</td>
                      <td className="num">{l.doublons}</td>
                      <td>{ecriture && <button className="icon-btn danger" title="Annuler cet import" onClick={() => setSuppr(l)}><Icon name="trash" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={tbl.page} pages={tbl.pages} total={tbl.total} pageSize={tbl.parPage} onPage={tbl.setPage} />
          </>
        </Etat>
      </Panel>

      {ecriture && (
        <Panel kicker="Entraînement" title="Exporter le dataset harmonisé">
          <div className="stack-sm">
            <label className="check">
              <input type="checkbox" checked={communes} onChange={(e) => setCommunes(e.target.checked)} />
              Variables communes à tous les hôpitaux participants seulement
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => exporter('hospitalisation')}>{LIB_REG.hospitalisation} (CSV)</button>
              <button className="btn btn-secondary" onClick={() => exporter('consultation')}>{LIB_REG.consultation} (CSV)</button>
            </div>
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
              Chaque ligne porte son hôpital et son rôle (développement ou validation externe) : les données
              de validation externe ne doivent jamais servir à l’entraînement.
            </p>
          </div>
        </Panel>
      )}

      {suppr && (
        <Confirm titre="Annuler cet import" danger confirmer="Retirer les lignes"
          message={`Les ${suppr.lignesImportees} ligne(s) importée(s) depuis « ${suppr.nomFichier} » seront retirées du dataset.`}
          onConfirm={() => supprimer(suppr)} onClose={() => setSuppr(null)} />
      )}
    </div>
  )
}
