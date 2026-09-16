// Prévision d'occupation : médiane lissée, bande d'incertitude, ligne de capacité.
const smooth = (pts) => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  return d
}

export default function ForecastChart({ points, capacite, height = 270 }) {
  if (!points?.length) return null
  const W = 680, H = height, ml = 38, mr = 14, mt = 16, mb = 28
  const maxY = Math.max(capacite * 1.2, ...points.map((p) => p.haut)) * 1.05 || 1
  const x = (j) => ml + ((j - 1) / Math.max(1, points.length - 1)) * (W - ml - mr)
  const y = (v) => mt + (1 - v / maxY) * (H - mt - mb)

  const median = smooth(points.map((p) => [x(p.jour), y(p.median)]))
  const haut = points.map((p) => [x(p.jour), y(p.haut)])
  const bas = points.slice().reverse().map((p) => [x(p.jour), y(p.bas)])
  const band = `${smooth(haut)} L${bas[0][0]},${bas[0][1]} ${smooth(bas).slice(1)} Z`
  const pas = Math.max(1, Math.ceil(points.length / 6))
  const ticks = points.filter((p) => p.jour === 1 || p.jour % pas === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Prévision d’occupation">
      <defs>
        <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--viz-3)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--viz-3)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={ml} x2={W - mr} y1={y(maxY * f)} y2={y(maxY * f)} stroke="#eaecef" strokeDasharray="4 5" />
          <text x={ml - 8} y={y(maxY * f) + 4} textAnchor="end" fontSize="10.5" fill="#9ca2ab">{Math.round(maxY * f)}</text>
        </g>
      ))}
      <path d={band} fill="url(#fc-band)" />
      <path d={median} fill="none" stroke="var(--viz-3)" strokeWidth="2.8" strokeLinecap="round" />
      <line x1={ml} x2={W - mr} y1={y(capacite)} y2={y(capacite)} stroke="var(--sev-1)" strokeWidth="1.8" strokeDasharray="6 5" />
      <text x={W - mr} y={y(capacite) - 7} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--sev-1)">
        Capacité armée {capacite}
      </text>
      {ticks.map((p) => (
        <text key={p.jour} x={x(p.jour)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca2ab">J+{p.jour}</text>
      ))}
    </svg>
  )
}
