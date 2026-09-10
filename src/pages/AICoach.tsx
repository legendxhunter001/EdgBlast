import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AICoach() {
  const frameRef = useRef<HTMLIFrameElement>(null);

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
      frame.contentWindow.postMessage({ type: 'edgeblast-auth', token, personaName }, '*');
    };

    const frame = frameRef.current;
    frame?.addEventListener('load', sendAuth);
    // Auth can finish loading after the iframe already fired 'load', or the
    // token can refresh mid-session — resend whenever the session changes.
    const { data: sub } = supabase.auth.onAuthStateChange(() => sendAuth());

    return () => {
      cancelled = true;
      frame?.removeEventListener('load', sendAuth);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      src="/ai-coach.html"
      title="AI Coach"
      style={{ width: '100%', height: 'calc(100vh - 56px)', border: 'none', display: 'block' }}
    />
  );
}
