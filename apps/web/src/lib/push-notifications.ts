// Client-side Web Push Notification Manager
import { authFetch } from './auth-client';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Converts a base64 VAPID string to a Uint8Array suitable for PushManager.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser supports Web Push and Notification APIs.
 */
export function checkPushSupport(): { supported: boolean; permission: PushPermissionState } {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'unsupported' };
  }

  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  if (!supported) {
    return { supported: false, permission: 'unsupported' };
  }

  return {
    supported: true,
    permission: Notification.permission as PushPermissionState,
  };
}

/**
 * Registers the root Service Worker (/sw.js) if not already registered.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err: any) {
    console.error('[WebPush] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Retrieves the current active PushSubscription from the ServiceWorker registration.
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[WebPush] Error getting push subscription:', err);
    return null;
  }
}

/**
 * Subscribes to browser push notifications:
 * 1. Explicitly requests Notification.requestPermission()
 * 2. Fetches VAPID public key from backend API
 * 3. Registers Service Worker and subscribes via PushManager
 * 4. Sends keys and endpoint to backend POST /notifications/browser/subscribe
 * 5. Returns success only after backend confirms persistence
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  subscriptionId?: string;
  error?: string;
}> {
  const { supported } = checkPushSupport();
  if (!supported) {
    return { success: false, error: 'Web Push notifications are not supported in this browser.' };
  }

  // 1. Request explicit browser permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      success: false,
      error: permission === 'denied'
        ? 'Notification permission was denied. Please enable notifications in your browser site settings.'
        : 'Notification permission was dismissed.',
    };
  }

  // 2. Fetch VAPID public key from backend
  let vapidPublicKey = '';
  try {
    const keyRes = await authFetch<{ publicKey: string }>('/notifications/browser/public-key');
    vapidPublicKey = keyRes.publicKey;
  } catch (err: any) {
    return { success: false, error: `Failed to retrieve VAPID configuration: ${err.message}` };
  }

  if (!vapidPublicKey) {
    return { success: false, error: 'VAPID public key was empty.' };
  }

  // 3. Register Service Worker and subscribe through PushManager
  try {
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Service worker registration failed.' };
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Unsubscribe any stale previous subscription if needed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe().catch(() => {});
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any,
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dhKey = subJson.keys?.p256dh;
    const authKey = subJson.keys?.auth;

    if (!endpoint || !p256dhKey || !authKey) {
      return { success: false, error: 'Browser generated incomplete push subscription keys.' };
    }

    // 4. Send subscription to authenticated backend
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const browserName = userAgent.includes('Chrome')
      ? 'Chrome'
      : userAgent.includes('Firefox')
      ? 'Firefox'
      : userAgent.includes('Safari')
      ? 'Safari'
      : userAgent.includes('Edge')
      ? 'Edge'
      : 'Standard Browser';

    const saveRes = await authFetch<{ success: boolean; subscriptionId: string }>(
      '/notifications/browser/subscribe',
      {
        method: 'POST',
        body: JSON.stringify({
          endpoint,
          p256dhKey,
          authKey,
          browser: `${browserName} Push`,
        }),
      },
    );

    if (!saveRes?.success || !saveRes.subscriptionId) {
      return { success: false, error: 'Backend failed to save push subscription.' };
    }

    return {
      success: true,
      subscriptionId: saveRes.subscriptionId,
    };
  } catch (err: any) {
    console.error('[WebPush] Subscribe error:', err);
    return {
      success: false,
      error: err.message || 'Failed to complete push subscription.',
    };
  }
}

/**
 * Unsubscribes from browser push notifications:
 * 1. Unsubscribes locally from PushManager
 * 2. Notifies backend to remove subscription record
 */
export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const sub = await getCurrentSubscription();
    const endpoint = sub?.endpoint;

    if (sub) {
      await sub.unsubscribe();
    }

    // Notify backend
    await authFetch('/notifications/browser/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }).catch((err) => {
      console.warn('[WebPush] Backend unsubscribe notification failed:', err);
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unsubscribe.' };
  }
}

/**
 * Triggers a real test notification delivery via the backend.
 */
export async function sendTestPushNotification(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await authFetch('/notifications/browser/test', { method: 'POST' });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to dispatch test notification.' };
  }
}
