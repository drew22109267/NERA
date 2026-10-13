import { useId } from 'react'

// Icônes en trait, 1.6px — un seul vocabulaire graphique dans toute l'application.
const P = {
  home: 'M3 10.2 12 3l9 7.2M5.5 9.6V20h13V9.6',
  user: 'M17 20v-1.6a3.9 3.9 0 0 0-3.9-3.9h-2.2A3.9 3.9 0 0 0 7 18.4V20M12 11.5a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8',
  users: 'M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  shuffle: 'M3 7h4l3 5M3 17h4l7-10h7m0 0-3-3m3 3-3 3M14 17h7m0 0-3-3m3 3-3 3',
  bed: 'M3 6v12M3 11h12a5 5 0 0 1 5 5v2M3 18h18M7.5 9.5h.01',
  chart: 'M4 19V5M4 19h16M8 16V11M12.5 16V8M17 16v-3',
  exit: 'M9 6V4h10v16H9v-2M4 12h10m0 0-3-3m3 3-3 3',
  clipboard: 'M9 4h6v3H9zM8 5.5H6.5v15h11v-15H16',
  calendar: 'M4 8h16M7 4v3M17 4v3M5 6.5h14v14H5z',
  bell: 'M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15zM10 20.5h4',
  report: 'M6 3.5h8l4 4V20.5H6zM14 3.5V8h4M9 13h6M9 16.5h4',
  shield: 'M12 3.5 5 6v6c0 4 3 6.9 7 8.5 4-1.6 7-4.5 7-8.5V6z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.3-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.3-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  search: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12M20 20l-3.6-3.6',
  logout: 'M14 6V4H5v16h9v-2M10 12h10m0 0-3-3m3 3-3 3',
  alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
  collapse: 'M4.5 5h15v14h-15zM9.5 5v14M16.5 9.5 14 12l2.5 2.5',
  expand: 'M4.5 5h15v14h-15zM9.5 5v14M13.5 9.5 16 12l-2.5 2.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  phone: 'M6.5 4h3l1.5 3.5-2 1.5a10 10 0 0 0 5 5l1.5-2L19 13.5v3a1.5 1.5 0 0 1-1.7 1.5A13.5 13.5 0 0 1 5 6.7 1.5 1.5 0 0 1 6.5 4Z',
  mail: 'M4 6.5h16v11H4zM4 7l8 6 8-6',
  pin: 'M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21ZM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  file: 'M7 3.5h7l4 4v13H7zM14 3.5V8h4',
  heart: 'M12 20s-7.5-4.7-7.5-9.7A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 3c0 5-7.5 9.7-7.5 9.7Z',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  wifi_off: 'M2 3l19 19M8.5 14.5a5 5 0 0 1 5.8-.9M5 11a10 10 0 0 1 4-2.3M12 18.5h.01',
  check: 'M5 12.5 10 17l9-10',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 7.5l2 2',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6',
  key: 'M14.5 10.5a4 4 0 1 0-3.6 4L12 16h2v2h2v2h3.5v-3.5l-5.4-5.4a4 4 0 0 0 .4-.6Z',
  close: 'M6 6l12 12M18 6 6 18',
  ban: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16M6.4 6.4l11.2 11.2',
  eye: 'M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6',
  eye_off: 'M3 3l18 18M10.1 10.2a2.8 2.8 0 0 0 3.8 3.8M9.6 6.1A8.6 8.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a16.4 16.4 0 0 1-3.4 4M6.4 7.9A16.3 16.3 0 0 0 2.5 12S6 18.2 12 18.2c.9 0 1.8-.2 2.6-.4'
}

export function Icon({ name, size = 18, style }) {
  const d = P[name] ?? P.list
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none', ...style }} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * Avatar générique — pastille pleine et silhouette, comme dans les messageries.
 * Aucune initiale : le compte n'a pas besoin d'être déchiffré pour être reconnu.
 */
export function Avatar({ size = 34, style }) {
  const cid = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40"
      style={{ flex: 'none', display: 'block', ...style }} aria-hidden="true">
      <defs>
        <clipPath id={cid}><circle cx="20" cy="20" r="20" /></clipPath>
      </defs>
      <circle cx="20" cy="20" r="20" fill="var(--brand-soft)" />
      <g clipPath={`url(#${cid})`} fill="var(--brand)">
        <circle cx="20" cy="15.6" r="6.4" />
        <ellipse cx="20" cy="34.2" rx="11.4" ry="9.6" />
      </g>
    </svg>
  )
}

export default Icon
