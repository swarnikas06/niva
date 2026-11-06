// NIVA Service Worker — Web Push Notifications & Background Sync
// Scope: / (root)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Handle incoming push events from backend WebPush dispatch
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event received with no data payload');
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'NIVA Notification',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'NIVA Reminder';
  const options = {
    body: payload.body || 'You have an update from NIVA.',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.notificationId || `niva-${Date.now()}`,
    data: {
      url: payload.actionUrl || '/',
      notificationId: payload.notificationId,
      timestamp: payload.timestamp || Date.now(),
    },
    requireInteraction: payload.requireInteraction ?? false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Open NIVA',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Handle user click on the notification or its action buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// 3. Handle push subscription changes / rotations by the browser
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((newSubscription) => {
        // Broadcast to clients to sync with backend
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: newSubscription.toJSON(),
            });
          });
        });
      }),
  );
});
