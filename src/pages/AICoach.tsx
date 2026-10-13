import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';

export default function AICoach() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  // the theme goes in the address so the chat is painted in it from the very first frame (no flash)
  const frameSrc = useRef(`/ai-coach.html?m=1&t=${theme}`);
  const [frameHeight, setFrameHeight] = useState('calc(100dvh - 57px)');
  const navigate = useNavigate();

  // the chat is full screen: the floating dock would sit on top of its sidebar and composer
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => { setFrameHeight(`${Math.max(240, Math.round(vv.height) - 57)}px`); window.scrollTo(0, 0); };
    fit();
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('eb-chat-page');
    return () => document.documentElement.classList.remove('eb-chat-page');
  }, []);

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
      if (ev.data?.type === 'eb-composing') {
        document.body.classList.toggle('ac-typing', !!ev.data.on);
      }
      if (ev.data?.type === 'eb-open-trade' && typeof ev.data.id === 'string' && /^[0-9a-f-]{36}$/i.test(ev.data.id)) {
        navigate(`/trades/${ev.data.id}${ev.data.edit ? '?edit=1' : ''}`);
      }
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
      document.body.classList.remove('ac-typing');
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
      src={frameSrc.current}
      title="Coach"
      style={{ width: '100%', height: frameHeight, border: 'none', display: 'block' }}
    />
  );
}
