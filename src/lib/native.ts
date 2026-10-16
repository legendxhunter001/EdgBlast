import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/** True inside the Android app (not in a browser). */
export const isNative = () => Capacitor.isNativePlatform();

/** Where Google, magic links and password resets send the person back to inside the app. */
export const NATIVE_REDIRECT = 'app.edgeblast.app://auth';

let started = false;

/** Android shell basics: status bar, back button, and finishing sign-in when the browser hands control back. */
export async function initNative() {
  if (!isNative() || started) return;
  started = true;
  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Browser }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/browser'),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0A0A0C' });
  } catch { /* the status bar is cosmetic */ }

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });

  void App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_REDIRECT)) return;
    try { await Browser.close(); } catch { /* already closed */ }
    const query = new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '');
    const hash = new URLSearchParams(url.split('#')[1] ?? '');
    const code = query.get('code');
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if (code) await supabase.auth.exchangeCodeForSession(code);
    else if (access && refresh) await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    window.location.replace(hash.get('type') === 'recovery' ? '/reset-password' : '/');
  });

  try { await SplashScreen.hide(); } catch { /* nothing to hide */ }
}

/**
 * Phone alerts while the app is running: every new notification row also appears as a system notification.
 * (Alerts with the app fully closed need Firebase push, which is a separate setup.)
 */
export async function startNativeAlerts(userId: string): Promise<() => void> {
  if (!isNative()) return () => {};
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') await LocalNotifications.requestPermissions();
  } catch { /* the person can still read alerts inside the app */ }

  const channel = supabase
    .channel(`native-alerts-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, async (payload) => {
      const n = payload.new as { title?: string; body?: string; link?: string };
      try {
        await LocalNotifications.schedule({
          notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title: n.title ?? 'Edge Blast', body: n.body ?? '', extra: { url: n.link ?? '/notifications' } }],
        });
      } catch { /* permission not granted */ }
    })
    .subscribe();

  const tap = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const url = e.notification.extra?.url;
    if (typeof url === 'string' && url.startsWith('/')) window.location.assign(url);
  });

  return () => {
    void supabase.removeChannel(channel);
    void tap.remove();
  };
}
