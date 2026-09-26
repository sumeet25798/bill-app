const CACHE_NAME = 'billing-app-v1'
const APP_SHELL = ['/index.html', '/manifest.webmanifest', '/billing-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch('/index.html', { cache: 'reload' })
    const html = await response.clone().text()
    const assetUrls = [...html.matchAll(/(?:src|href)=["'](\/[^"]+)["']/g)]
      .map((match) => match[1])
    const urls = [...new Set([...APP_SHELL, ...assetUrls])]

    await cache.put('/index.html', response)
    await Promise.all(urls.map(async (url) => {
      try {
        const asset = await fetch(url, { cache: 'reload' })
        if (asset.ok) await cache.put(url, asset)
      } catch {
        // Keep installation available if an optional shell asset is missing.
      }
    }))

    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith('billing-app-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/index.html', response.clone())
        }
        return response
      } catch {
        return (await caches.match(request)) || (await caches.match('/index.html'))
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })())
})