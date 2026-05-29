const DEFAULT_VAPID_PUBLIC_KEY = 'BNxF0xddanrO_fbeURidqN2lHPsfABHzsO9RNPRkAsLtMVzA9bAXNlsFgPZRH1RgXECjDoDIswbE2r4il1WXzoY';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const pushConfig = {
  publicKey: VAPID_PUBLIC_KEY,
  configured: Boolean(VAPID_PUBLIC_KEY),
};

export const getNotificationPermission = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
};

export const isPushSupported = () => (
  import.meta.env.PROD
  && typeof window !== 'undefined'
  && window.isSecureContext
  && 'Notification' in window
  && 'serviceWorker' in navigator
  && 'PushManager' in window
);

const waitForServiceWorker = async () => {
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 5000);
  });

  return Promise.race([navigator.serviceWorker.ready, timeout]);
};

export const registerPushSubscription = async ({
  supabase,
  empresaId,
  userId,
  papel = 'cliente',
}) => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!pushConfig.configured) return { ok: false, reason: 'missing-key' };
  if (!empresaId || !userId) return { ok: false, reason: 'missing-context' };

  const permission = window.Notification.permission === 'default'
    ? await window.Notification.requestPermission()
    : window.Notification.permission;

  if (permission !== 'granted') {
    return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' };
  }

  const registration = await waitForServiceWorker();
  if (!registration) return { ok: false, reason: 'service-worker-timeout' };

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
  });

  const subscriptionJson = subscription.toJSON();
  const keys = subscriptionJson.keys || {};
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      empresa_id: empresaId,
      user_id: userId,
      papel,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: window.navigator.userAgent,
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'empresa_id,user_id,endpoint' });

  if (error) throw error;
  return { ok: true, permission };
};
