import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, ArrowUp, Sparkles } from 'lucide-react';

type ChatMsg = { role: 'user' | 'assistant'; content: string; id?: string };

// Lightweight markdown-ish renderer: bold, bullet lists, paragraphs. No heavy
// dependency needed for what a coaching reply actually uses.
function renderText(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n').filter(Boolean);
    const isList = lines.every((l) => /^[-*]\s/.test(l.trim())) && lines.length > 0;
    const inline = (s: string) =>
      s.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <b key={j}>{part.slice(2, -2)}</b>
          : <span key={j}>{part}</span>
      );
    if (isList) {
      return (
        <ul key={i}>
          {lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s/, ''))}</li>)}
        </ul>
      );
    }
    return <p key={i}>{inline(block)}</p>;
  });
}

export default function AICoach() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('ai_chat_messages').select('id, role, content').eq('user_id', user.id).order('created_at', { ascending: true }).limit(60);
      setMessages((data ?? []) as ChatMsg[]);
      setLoadingHistory(false);
    })();
  }, [user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('ai-coach-chat', { body: { message: text } });
    setLoading(false);
    if (error || !data?.success) {
      const raw = data?.message || error?.message;
      const msg = raw && !/non-2xx status code/i.test(raw) ? raw : "We got an error on our end — we'll fix it as soon as possible. Please try again shortly.";
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
      return;
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
  };

  const copyMsg = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <div className="eb-ai">
      <style>{`
        .eb-ai, .eb-ai *{ box-sizing:border-box; }
        .eb-ai{
          --bg:#0A0A0C; --surface:#131316; --surface-elevated:#1A1A1E; --border:rgba(255,255,255,.08);
          --text-primary:#F3F1EC; --text-secondary:#9B9A97; --text-tertiary:#66655F;
          --accent:#14C9AE; --accent-2:#3D6FE5; --code-bg:#0F0F12;
          --shadow-pill: 0 10px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.22);
          --dur-fast: 140ms; --dur-med: 220ms; --ease-out: cubic-bezier(0.16,1,0.3,1);
          background:var(--bg); color:var(--text-primary); min-height:100%;
          display:flex; flex-direction:column; font-family:'Inter',-apple-system,sans-serif;
        }
        html.light .eb-ai{
          --bg:#FAFAF8; --surface:#FFFFFF; --surface-elevated:#FFFFFF; --border:rgba(0,0,0,.08);
          --text-primary:#1C1C1A; --text-secondary:#6B6B67; --text-tertiary:#9C9C96;
          --accent:#0E9A85; --accent-2:#2F5FD1; --code-bg:#F3F2EE;
        }
        .eb-ai-head{
          padding:1.1rem 1.5rem; border-bottom:1px solid var(--border); flex-shrink:0;
          display:flex; align-items:center; gap:.6rem;
        }
        .eb-ai-head-icon{
          width:30px; height:30px; border-radius:9px; flex-shrink:0;
          background:linear-gradient(135deg,var(--accent),var(--accent-2));
          display:flex; align-items:center; justify-content:center;
        }
        .eb-ai-title{ font-weight:700; font-size:.95rem; }
        .eb-ai-sub{ font-size:.72rem; color:var(--text-tertiary); }
        .eb-ai-scroll{ flex:1; overflow-y:auto; padding:1.5rem 1.5rem 1rem; }
        .eb-ai-inner{ max-width:760px; margin:0 auto; }
        .eb-ai-empty{ text-align:center; color:var(--text-secondary); font-size:.88rem; padding:3rem 1rem; max-width:420px; margin:0 auto; }
        .msg{ display:flex; align-items:flex-start; gap:12px; margin-bottom:24px; animation:fadeUp var(--dur-med) var(--ease-out) both; }
        @keyframes fadeUp{ from{opacity:0; transform:translateY(10px) scale(.985);} to{opacity:1; transform:translateY(0) scale(1);} }
        .msg.user{ justify-content:flex-end; }
        .msg.user .msg-avatar{ order:2; }
        .msg-avatar{ width:26px; height:26px; border-radius:7px; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:2px; }
        .msg.user .msg-avatar{ background:var(--surface-elevated); border:1px solid var(--border); color:var(--text-secondary); font-size:11px; font-weight:700; }
        .msg.ai .msg-avatar{ background:linear-gradient(135deg,var(--accent),var(--accent-2)); transition:transform var(--dur-fast) var(--ease-out); }
        .msg.ai .msg-avatar svg{ width:14px; height:14px; color:var(--bg); }
        .msg-body{ flex:1; min-width:0; padding-top:2px; }
        .msg.user .msg-body{ flex:0 1 auto; max-width:72%; display:flex; flex-direction:column; align-items:flex-end; }
        .msg-role{ font-size:12.5px; font-weight:700; margin-bottom:4px; }
        .msg.user .msg-role{ text-align:right; }
        .msg-model-tag{ font-weight:500; color:var(--text-tertiary); font-size:11.5px; margin-left:4px; }
        .msg-text{ font-size:14px; line-height:1.65; }
        .msg-text p{ margin-bottom:10px; } .msg-text p:last-child{ margin-bottom:0; }
        .msg-text ul{ margin:8px 0 10px 18px; } .msg-text li{ margin-bottom:4px; }
        .msg.user .msg-text{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:16px 16px 6px 16px; padding:8px 12px; }
        .msg-actions{ display:flex; align-items:center; gap:2px; margin-top:8px; opacity:0; transition:opacity 140ms; }
        .msg:hover .msg-actions{ opacity:1; }
        .msg-action-btn{ width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:8px; color:var(--text-tertiary); transition:background 140ms,color 140ms; }
        .msg-action-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .msg-action-btn svg{ width:14px; height:14px; }
        .gen-dots{ display:flex; gap:3px; align-items:center; padding-left:38px; }
        .gen-dots span{ width:5px; height:5px; border-radius:50%; background:var(--accent); animation:pulse 1.1s infinite ease-in-out; }
        .gen-dots span:nth-child(2){ animation-delay:.15s; } .gen-dots span:nth-child(3){ animation-delay:.3s; }
        @keyframes pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }
        .composer-wrap{ padding:10px 20px 20px; flex-shrink:0; }
        .composer-inner{ max-width:760px; margin:0 auto; }
        .composer{
          border:1px solid var(--border); border-radius:26px; background:var(--surface-elevated);
          box-shadow:var(--shadow-pill); transition:border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), transform var(--dur-fast) var(--ease-out);
          overflow:hidden;
        }
        .composer:focus-within{ border-color:var(--accent); box-shadow:var(--shadow-pill), 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
        .composer-textarea{
          width:100%; resize:none; border:none; outline:none; background:transparent; color:var(--text-primary);
          font-family:inherit; font-size:14px; padding:14px 16px 6px; line-height:1.4; max-height:160px;
        }
        .composer-textarea::placeholder{ color:var(--text-tertiary); }
        .composer-toolbar{ display:flex; align-items:center; padding:4px 8px 8px 16px; gap:8px; }
        .composer-spacer{ flex:1; }
        .composer-model-tag{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary); }
        .composer-model-dot{ width:7px; height:7px; border-radius:50%; background:#4285F4; }
        .send-btn{
          width:32px; height:32px; border-radius:50%; background:var(--accent); color:var(--bg);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out), background var(--dur-fast);
        }
        .send-btn:disabled{ opacity:.35; }
        .send-btn:not(:disabled):hover{ transform:translateY(-1px); background:var(--accent-2); }
        .send-btn:active:not(:disabled){ transform:scale(.9); }
        .composer-hint{ text-align:center; font-size:11px; color:var(--text-tertiary); margin-top:8px; }
      `}</style>

      <div className="eb-ai-head">
        <div className="eb-ai-head-icon"><Sparkles size={15} color="var(--bg)" /></div>
        <div>
          <div className="eb-ai-title">AI Trading Manager</div>
          <div className="eb-ai-sub">Grounded in your real trades and goals · trading topics only</div>
        </div>
      </div>

      <div className="eb-ai-scroll">
        <div className="eb-ai-inner">
          {loadingHistory ? (
            <div className="eb-ai-empty">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="eb-ai-empty">
              Ask about your performance, what's been holding you back, your risk patterns, or how far you are from your goals.
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={m.id ?? i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className="msg-avatar">
                  {m.role === 'user' ? 'YOU' : (
                    <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="12" cy="4" r="1.3" /><circle cx="12" cy="20" r="1.3" /><circle cx="4" cy="12" r="1.3" /><circle cx="20" cy="12" r="1.3" /></svg>
                  )}
                </div>
                <div className="msg-body">
                  <div className="msg-role">
                    {m.role === 'user' ? 'You' : <>Edge Blast <span className="msg-model-tag">· Gemini</span></>}
                  </div>
                  <div className="msg-text">{renderText(m.content)}</div>
                  {m.role === 'assistant' && (
                    <div className="msg-actions">
                      <button className="msg-action-btn" onClick={() => copyMsg(m.content)} aria-label="Copy"><Copy size={14} /></button>
                      <button className="msg-action-btn" aria-label="Good response"><ThumbsUp size={14} /></button>
                      <button className="msg-action-btn" aria-label="Poor response"><ThumbsDown size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="gen-dots"><span /><span /><span /></div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <div className="composer-inner">
          <div className="composer">
            <textarea
              ref={textareaRef}
              className="composer-textarea"
              placeholder="Ask your trading manager…"
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <div className="composer-toolbar">
              <div className="composer-model-tag"><span className="composer-model-dot" /> Gemini</div>
              <div className="composer-spacer" />
              <button className="send-btn" onClick={send} disabled={loading || !input.trim()} aria-label="Send message">
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
          <div className="composer-hint">The AI coach can make mistakes. Verify important information.</div>
        </div>
      </div>
    </div>
  );
}
