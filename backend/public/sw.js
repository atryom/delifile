/**
 * DeliFile Service Worker
 * Handles Web Share Target API and PWA Push Notifications.
 */

const SHARE_CACHE = 'share-target-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      })
    )
  );
});

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

// ─── PWA Push Notifications ───────────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore */ }

  const title   = data.title  ?? 'DeliFile';
  const options = {
    body:  data.body  ?? '',
    icon:  data.icon  ?? '/assets/icons/icon-192.png',
    badge: data.badge ?? '/assets/icons/icon-72.png',
    data:  { url: data.url ?? '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if open
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
