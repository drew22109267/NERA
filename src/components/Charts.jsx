// Graphiques SVG, sans dépendance. Les séries utilisent la palette --viz-*,
// jamais l'échelle de gravité : un graphique n'exprime pas une urgence.

const smooth = (pts) => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  return d
}

export function Donut({ value, size = 120, stroke = 14, color = 'var(--viz-1)', track = '#eef1f5', label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(v)} %`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: size / 4.6, fontWeight: 700, letterSpacing: '-0.03em' }}>{Math.round(v)}%</div>
          {label && <div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{label}</div>}
        </div>
      </div>
    </div>
  )
}

export function AreaChart({ data, labels = [], height = 220, color = 'var(--brand)', id = 'area', yTicks = 5, unit = '' }) {
  if (!data?.length) return null
  const W = 640, H = height, ml = 36, mr = 12, mt = 14, mb = 28
  const max = Math.max(1, ...data) * 1.2
  const x = (i) => ml + (i / Math.max(1, data.length - 1)) * (W - ml - mr)
  const y = (v) => mt + (1 - v / max) * (H - mt - mb)
  const pts = data.map((v, i) => [x(i), y(v)])
  const line = smooth(pts)
  const area = `${line} L${x(data.length - 1)},${H - mb} L${ml},${H - mb} Z`
  const ticks = Array.from({ length: yTicks }, (_, i) => (max / (yTicks - 1)) * i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Série temporelle">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eaecef" strokeDasharray="4 5" />
          <text x={ml - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#9ca2ab">{Math.round(t)}{unit}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${id}-g)`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="3" fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca2ab">{l}</text>
      ))}
    </svg>
  )
}

/** Colonnes verticales — volumes par période (passages, dépenses). */
export function BarChart({ data, labels = [], height = 220, color = 'var(--viz-1)', unit = '', yTicks = 4, format }) {
  if (!data?.length) return null
  const W = 640, H = height, ml = 40, mr = 10, mt = 14, mb = 26
  const max = Math.max(1, ...data) * 1.15
  const bw = (W - ml - mr) / data.length
  const barW = Math.min(34, bw * 0.55)
  const y = (v) => mt + (1 - v / max) * (H - mt - mb)
  const ticks = Array.from({ length: yTicks }, (_, i) => (max / (yTicks - 1)) * i)
  const fmt = format ?? ((v) => `${Math.round(v)}${unit}`)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Volumes par période">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eaecef" strokeDasharray="4 5" />
          <text x={ml - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#9ca2ab">{fmt(t)}</text>
        </g>
      ))}
      {data.map((v, i) => {
        const x = ml + i * bw + (bw - barW) / 2
        const h = Math.max(v > 0 ? 3 : 0, (H - mt - mb) * (v / max))
        return (
          <g key={i}>
            <rect x={x} y={H - mb - h} width={barW} height={h} rx={Math.min(6, barW / 2)} fill={color} />
            {labels[i] !== undefined && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca2ab">{labels[i]}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Plusieurs séries sur un même axe — évolution des constantes d'un patient. */
export function LineChart({ series = [], labels = [], height = 240, yTicks = 5, unit = '', bandes = [] }) {
  const valeurs = series.flatMap((s) => (s.data ?? []).filter((v) => v !== null && v !== undefined))
  if (!valeurs.length) return null
  const W = 640, H = height, ml = 42, mr = 12, mt = 16, mb = 28
  const brut = [...valeurs, ...bandes.flatMap((b) => [b.min, b.max])].filter((v) => Number.isFinite(v))
  const lo = Math.min(...brut), hi = Math.max(...brut)
  const marge = (hi - lo || Math.abs(hi) || 1) * 0.18
  const min = lo - marge, max = hi + marge
  const n = Math.max(1, (series[0]?.data?.length ?? 1) - 1)
  const x = (i) => ml + (i / n) * (W - ml - mr)
  const y = (v) => mt + (1 - (v - min) / (max - min)) * (H - mt - mb)
  const ticks = Array.from({ length: yTicks }, (_, i) => min + ((max - min) / (yTicks - 1)) * i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Évolution des mesures">
      {bandes.map((b, i) => (
        <rect key={`b${i}`} x={ml} y={y(b.max)} width={W - ml - mr} height={Math.max(1, y(b.min) - y(b.max))}
          fill={b.color ?? 'var(--sev-4-soft)'} />
      ))}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eaecef" strokeDasharray="4 5" />
          <text x={ml - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#9ca2ab">
            {Math.round(t * 10) / 10}{unit}
          </text>
        </g>
      ))}
      {series.map((s, si) => {
        const pts = (s.data ?? [])
          .map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)]))
          .filter(Boolean)
        if (!pts.length) return null
        return (
          <g key={si}>
            <path d={smooth(pts)} fill="none" stroke={s.color ?? 'var(--viz-1)'} strokeWidth="2.6" strokeLinecap="round" />
            {pts.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r="3.2" fill="#fff" stroke={s.color ?? 'var(--viz-1)'} strokeWidth="2" />
            ))}
          </g>
        )
      })}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca2ab">{l}</text>
      ))}
    </svg>
  )
}

/** Jauge en demi-cercle — un risque exprimé sur 100, avec son libellé. */
export function Gauge({ value, size = 190, color = 'var(--viz-1)', track = '#eef1f5', label, sousTitre }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const w = size, stroke = size / 8.5
  const r = (w - stroke) / 2
  const h = w / 2 + stroke / 2
  const cx = w / 2, cy = w / 2
  const arc = (frac) => {
    const a = Math.PI * (1 - frac)
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`
  }
  const d = (frac) => `M${arc(0)} A${r},${r} 0 0 1 ${arc(frac)}`
  return (
    <div style={{ width: w, flex: 'none', textAlign: 'center' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${Math.round(v)} sur 100`}>
        <path d={d(1)} fill="none" stroke={track} strokeWidth={stroke} strokeLinecap="round" />
        <path d={d(Math.max(0.001, v / 100))} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      <div style={{ marginTop: -size / 5.4 }}>
        <div style={{ fontSize: size / 4.4, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1 }}>
          {Math.round(v)}<small style={{ fontSize: size / 11, color: 'var(--muted-2)' }}>/100</small>
        </div>
        {label && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{label}</div>}
        {sousTitre && <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{sousTitre}</div>}
      </div>
    </div>
  )
}

export function Sparkline({ data, width = 120, height = 40, color = 'var(--sev-4)' }) {
  if (!data?.length) return null
  const max = Math.max(...data), min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * width,
    height - 3 - ((v - min) / span) * (height - 8)
  ])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }} aria-hidden="true">
      <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
