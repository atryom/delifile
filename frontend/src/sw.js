/**
 * DeliFile Service Worker
 * Handles Web Share Target API — intercepts POST /share-target,
 * stores shared files/URLs in Cache API, then redirects to the SPA route.
 */

const SHARE_CACHE = 'share-target-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname === '/share-target' && req.method === 'POST') {
    event.respondWith(handleShareTarget(req));
  }
});

async function handleShareTarget(request) {
  try {
    const formData   = await request.formData();
    const files      = formData.getAll('file');
    const title      = formData.get('title') || '';
    const text       = formData.get('text')  || '';
    const sharedUrl  = formData.get('url')   || '';

    const cache = await caches.open(SHARE_CACHE);

    // Clear previous share session
    for (const key of await cache.keys()) {
      await cache.delete(key);
    }

    // Persist metadata
    const meta = { title, text, url: sharedUrl, fileCount: files.length };
    await cache.put('/_share/meta', new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json' },
    }));

    // Persist files as Blobs
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await cache.put(`/_share/file/${i}`, new Response(f, {
        headers: {
          'Content-Type': f.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(f.name || `file-${i}`),
        },
      }));
    }

    return Response.redirect('/share-target', 303);
  } catch {
    return Response.redirect('/share-target?sw_error=1', 303);
  }
}
