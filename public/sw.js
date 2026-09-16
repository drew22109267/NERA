/*
 * Service worker minimal — usage tablette en zone de triage.
 * Met en cache la coquille de l'application pour qu'elle s'ouvre hors réseau.
 * Les appels API ne sont JAMAIS servis depuis le cache : une donnée clinique
 * périmée est plus dangereuse qu'une absence de donnée. Hors ligne, l'interface
 * affiche explicitement que la donnée est indisponible.
 */
const CACHE = 'nera-coquille-v4'
const COQUILLE = ['/', '/index.html', '/manifest.webmanifest',
  '/favicon.svg', '/favicon.png', '/favicon-32.png',
  '/icone-192.png', '/apple-touch-icon.png', '/logo-na.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return          // jamais de donnée clinique en cache
  if (url.origin !== self.location.origin) return

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copie = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {})
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r ?? caches.match('/index.html')))
  )
})
