import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';

export default function AICoach() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const sendAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const frame = frameRef.current;
      if (!token || !frame?.contentWindow || cancelled) return;
      let personaName = 'your coach';
      const userId = data.session?.user.id;
      if (userId) {
        const { data: settings } = await supabase.from('ai_coach_settings').select('active_persona').eq('user_id', userId).maybeSingle();
        if (settings?.active_persona) personaName = settings.active_persona.charAt(0).toUpperCase() + settings.active_persona.slice(1);
      }
      frame.contentWindow.postMessage({ type: 'edgeblast-auth', token, personaName, email: data.session?.user.email ?? '' }, '*');
    };

    const sendTheme = () => {
      frameRef.current?.contentWindow?.postMessage({ type: 'edgeblast-theme', theme }, '*');
    };

    const frame = frameRef.current;
    const onLoad = () => { sendAuth(); sendTheme(); };
    frame?.addEventListener('load', onLoad);
    // Auth can finish loading after the iframe already fired 'load', or the
    // token can refresh mid-session — resend whenever the session changes.
    const { data: sub } = supabase.auth.onAuthStateChange(() => sendAuth());

    const onMessage = async (ev: MessageEvent) => {
      if (ev.data?.type === 'edgeblast-signout') {
        await supabase.auth.signOut();
        navigate('/');
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      cancelled = true;
      frame?.removeEventListener('load', onLoad);
      sub.subscription.unsubscribe();
      window.removeEventListener('message', onMessage);
    };
  }, [navigate]);

  // Re-send whenever the main app's theme changes, so a page already open
  // updates live too — the iframe itself decides whether to apply it.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'edgeblast-theme', theme }, '*');
  }, [theme]);

  return (
    <iframe
      ref={frameRef}
      src="/ai-coach.html"
      title="AI Coach"
      style={{ width: '100%', height: 'calc(100vh - 56px)', border: 'none', display: 'block' }}
    />
  );
}
