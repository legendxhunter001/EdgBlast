import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, ThumbsUp, ThumbsDown, ArrowUp, Sparkles, Plus, Settings, X, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type ChatMsg = { role: 'user' | 'assistant'; content: string; id?: string };
type Conversation = { id: string; title: string; updated_at: string };

function renderText(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n').filter(Boolean);
    const isList = lines.every((l) => /^[-*]\s/.test(l.trim())) && lines.length > 0;
    const inline = (s: string) =>
      s.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : <span key={j}>{part}</span>
      );
    if (isList) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s/, ''))}</li>)}</ul>;
    return <p key={i}>{inline(block)}</p>;
  });
}

export default function AICoach() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [personaName, setPersonaName] = useState('Alex');
  const [personaDescription, setPersonaDescription] = useState('Professional trading manager');
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase.from('ai_conversations').select('id, title, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
    setConversations((data ?? []) as Conversation[]);
    return (data ?? []) as Conversation[];
  }, [user]);

  const loadMessages = useCallback(async (convId: string) => {
    if (!user) return;
    const { data } = await supabase.from('ai_chat_messages').select('id, role, content').eq('user_id', user.id).eq('conversation_id', convId).order('created_at', { ascending: true });
    setMessages((data ?? []) as ChatMsg[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const convs = await loadConversations();
      const { data: settings } = await supabase.from('ai_coach_settings').select('persona_name, persona_description').eq('user_id', user.id).maybeSingle();
      if (settings) { setPersonaName(settings.persona_name); setPersonaDescription(settings.persona_description); }
      if (convs && convs.length > 0) {
        setActiveConvId(convs[0].id);
        await loadMessages(convs[0].id);
      }
      setLoadingHistory(false);
    })();
  }, [user, loadConversations, loadMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const newChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    setSidebarOpen(false);
    await loadMessages(id);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('ai-coach-chat', { body: { message: text, conversation_id: activeConvId } });
    setLoading(false);
    if (error || !data?.success) {
      const raw = data?.message || error?.message;
      const msg = raw && !/non-2xx status code/i.test(raw) ? raw : "We got an error on our end — we'll fix it as soon as possible. Please try again shortly.";
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
      return;
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    if (!activeConvId) setActiveConvId(data.conversation_id);
    loadConversations();
  };

  const saveSettings = async () => {
    if (!user) return;
    await supabase.from('ai_coach_settings').upsert({ user_id: user.id, persona_name: personaName, persona_description: personaDescription }, { onConflict: 'user_id' });
    setSettingsOpen(false);
    toast.success('Coach behavior updated');
  };

  const copyMsg = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  return (
    <div className="eb-ai">
      <style>{`
        .eb-ai, .eb-ai *{ box-sizing:border-box; }
        .eb-ai{
          --font-mono:'JetBrains Mono','SF Mono',monospace;
          --text-2xs:10px; --text-xs:11px; --text-sm:12px; --text-base:13px; --text-md:14px; --text-lg:16px;
          --sp-1:4px; --sp-1-5:6px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px;
          --radius-xs:6px; --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-full:999px;
          --dur-instant:100ms; --dur-fast:140ms; --dur-med:220ms; --dur-slow:360ms;
          --ease:cubic-bezier(0.32,0.72,0,1); --ease-out:cubic-bezier(0.16,1,0.3,1); --ease-spring:cubic-bezier(0.34,1.56,0.64,1);

          --bg:#0A0A0C; --surface:#131316; --surface-elevated:#1A1A1E; --border:rgba(255,255,255,.08); --border-strong:rgba(255,255,255,.14);
          --text-primary:#F3F1EC; --text-secondary:#9B9A97; --text-tertiary:#66655F;
          --accent:#14C9AE; --accent-2:#3D6FE5; --accent-hover:#1EDDC0;
          --accent-active-bg: rgba(20,201,174,.10); --accent-active-border: rgba(20,201,174,.30);
          --accent-2-active-bg: rgba(61,111,229,.14); --accent-2-active-border: rgba(61,111,229,.32);
          --accent-glow: rgba(20,201,174,.14);
          --danger:#C0655F; --danger-bg: rgba(192,101,95,.11);
          --code-bg:#0F0F12;
          --shadow-pill: 0 10px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.22);
          --shadow-lg: 0 20px 56px rgba(0,0,0,.38);

          background:var(--bg); color:var(--text-primary); min-height:100%;
          display:flex; font-family:'Inter',-apple-system,sans-serif; position:relative;
        }
        html.light .eb-ai{
          --bg:#FAFAF8; --surface:#FFFFFF; --surface-elevated:#FFFFFF; --border:rgba(0,0,0,.08); --border-strong:rgba(0,0,0,.14);
          --text-primary:#1C1C1A; --text-secondary:#6B6B67; --text-tertiary:#9C9C96;
          --accent:#0E9A85; --accent-2:#2F5FD1; --accent-hover:#0BAF97;
          --accent-active-bg: rgba(14,154,133,.08); --accent-active-border: rgba(14,154,133,.25);
          --accent-2-active-bg: rgba(47,95,209,.10); --accent-2-active-border: rgba(47,95,209,.28);
          --accent-glow: rgba(14,154,133,.10); --code-bg:#F3F2EE;
        }

        .conv-sidebar{ width:230px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); transition:width var(--dur-med) var(--ease); }
        .conv-sidebar.collapsed{ width:64px; }
        .conv-sidebar-head{ padding:.9rem; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:.4rem; }
        .collapse-btn{ width:26px; height:26px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm); color:var(--text-tertiary); transition:background var(--dur-fast), color var(--dur-fast); }
        .collapse-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .new-chat-btn{
          flex:1; display:flex; align-items:center; gap:.5rem; padding:.55rem .7rem; border-radius:var(--radius-md);
          border:1px solid var(--accent-active-border); background:var(--accent-active-bg); color:var(--accent);
          font-size:var(--text-base); font-weight:700; white-space:nowrap; overflow:hidden;
          transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        }
        .new-chat-btn:hover{ background:var(--accent-glow); border-color:var(--accent); transform:translateY(-1px); }
        .new-chat-btn:active{ transform:translateY(0) scale(.98); }
        .conv-sidebar.collapsed .new-chat-btn span{ display:none; }
        .conv-sidebar.collapsed .conv-sidebar-head{ justify-content:center; }
        .conv-group-label{ font-size:var(--text-xs); text-transform:uppercase; letter-spacing:.07em; color:var(--text-tertiary); font-weight:700; padding:.9rem .9rem .4rem; white-space:nowrap; transition:opacity var(--dur-fast); }
        .conv-sidebar.collapsed .conv-group-label{ opacity:0; height:0; margin:0; padding:0; overflow:hidden; }
        .conv-list{ flex:1; overflow-y:auto; padding:0 .5rem; }
        .conv-item{
          width:100%; text-align:left; display:flex; align-items:center; gap:.5rem; padding:.5rem .6rem; border-radius:10px;
          font-size:var(--text-base); color:var(--text-secondary); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          position:relative; transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
        }
        .conv-item:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .conv-item.active{ background:var(--accent-2-active-bg); color:var(--accent-2); font-weight:600; }
        .conv-item.active::before{ content:''; position:absolute; left:-8px; top:50%; transform:translateY(-50%); width:3px; height:14px; background:var(--accent-2); border-radius:0 3px 3px 0; }
        .conv-item svg{ flex-shrink:0; opacity:.8; }
        .conv-sidebar.collapsed .conv-item span{ display:none; }
        .conv-sidebar.collapsed .conv-item{ justify-content:center; padding:9px; }
        .conv-sidebar-foot{ padding:.6rem; border-top:1px solid var(--border); }
        .settings-btn{ width:100%; display:flex; align-items:center; gap:.5rem; padding:.55rem .6rem; border-radius:10px; font-size:var(--text-base); color:var(--text-secondary); white-space:nowrap; overflow:hidden; }
        .settings-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .conv-sidebar.collapsed .settings-btn span{ display:none; }
        .conv-sidebar.collapsed .settings-btn{ justify-content:center; }

        .eb-ai-main{ flex:1; min-width:0; display:flex; flex-direction:column; }
        .eb-ai-head{ padding:1.1rem 1.5rem; border-bottom:1px solid var(--border); flex-shrink:0; display:flex; align-items:center; gap:.6rem; }
        .eb-ai-head-icon{ width:30px; height:30px; border-radius:var(--radius-sm); flex-shrink:0; background:linear-gradient(135deg,var(--accent),var(--accent-2)); display:flex; align-items:center; justify-content:center; }
        .eb-ai-title{ font-weight:700; font-size:var(--text-lg); }
        .eb-ai-sub{ font-size:var(--text-sm); color:var(--text-tertiary); }
        .mobile-sidebar-toggle{ display:none; margin-right:.2rem; color:var(--text-secondary); }
        @media (max-width: 820px){
          .conv-sidebar{ position:fixed; inset:0 auto 0 0; z-index:50; transform:translateX(-100%); transition:transform var(--dur-med) var(--ease-out); }
          .conv-sidebar.open{ transform:translateX(0); box-shadow:20px 0 40px rgba(0,0,0,.3); }
          .mobile-sidebar-toggle{ display:flex; }
          .sidebar-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:40; }
        }

        .eb-ai-scroll{ flex:1; overflow-y:auto; padding:1.5rem 1.5rem 1rem; }
        .eb-ai-inner{ max-width:760px; margin:0 auto; }
        .eb-ai-empty{ text-align:center; color:var(--text-secondary); font-size:var(--text-md); padding:3rem 1rem; max-width:420px; margin:0 auto; }
        .msg{ display:flex; align-items:flex-start; gap:12px; margin-bottom:24px; animation:fadeUp var(--dur-med) var(--ease-out) both; }
        @keyframes fadeUp{ from{opacity:0; transform:translateY(10px) scale(.985);} to{opacity:1; transform:translateY(0) scale(1);} }
        .msg.user{ justify-content:flex-end; }
        .msg.user .msg-avatar{ order:2; }
        .msg-avatar{ width:26px; height:26px; border-radius:7px; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:2px; }
        .msg.user .msg-avatar{ background:var(--surface-elevated); border:1px solid var(--border); color:var(--text-secondary); font-size:var(--text-2xs); font-weight:700; }
        .msg.ai .msg-avatar{ background:linear-gradient(135deg,var(--accent),var(--accent-2)); }
        .msg.ai .msg-avatar svg{ width:14px; height:14px; color:var(--bg); }
        .msg-body{ flex:1; min-width:0; padding-top:2px; }
        .msg.user .msg-body{ flex:0 1 auto; max-width:72%; display:flex; flex-direction:column; align-items:flex-end; }
        .msg-role{ font-size:var(--text-sm); font-weight:700; margin-bottom:4px; }
        .msg.user .msg-role{ text-align:right; }
        .msg-model-tag{ font-weight:500; color:var(--text-tertiary); font-size:var(--text-2xs); margin-left:4px; }
        .msg-text{ font-size:var(--text-md); line-height:1.65; }
        .msg-text p{ margin-bottom:10px; } .msg-text p:last-child{ margin-bottom:0; }
        .msg-text ul{ margin:8px 0 10px 18px; } .msg-text li{ margin-bottom:4px; }
        .msg.user .msg-text{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:16px 16px 6px 16px; padding:8px 12px; }
        .msg-actions{ display:flex; align-items:center; gap:2px; margin-top:8px; opacity:0; transition:opacity var(--dur-fast); }
        .msg:hover .msg-actions{ opacity:1; }
        .msg-action-btn{ width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs); color:var(--text-tertiary); transition:background var(--dur-fast),color var(--dur-fast); }
        .msg-action-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .msg-action-btn svg{ width:14px; height:14px; }
        .gen-dots{ display:flex; gap:3px; align-items:center; padding-left:38px; }
        .gen-dots span{ width:5px; height:5px; border-radius:50%; background:var(--accent); animation:pulse 1.1s infinite ease-in-out; }
        .gen-dots span:nth-child(2){ animation-delay:.15s; } .gen-dots span:nth-child(3){ animation-delay:.3s; }
        @keyframes pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }
        .composer-wrap{ padding:10px 20px 20px; flex-shrink:0; }
        .composer-inner{ max-width:760px; margin:0 auto; }
        .composer{ border:1px solid var(--border); border-radius:26px; background:var(--surface-elevated); box-shadow:var(--shadow-pill); transition:border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out); overflow:hidden; }
        .composer:focus-within{ border-color:var(--accent); box-shadow:var(--shadow-pill), 0 0 0 3px var(--accent-glow); }
        .composer-textarea{ width:100%; resize:none; border:none; outline:none; background:transparent; color:var(--text-primary); font-family:inherit; font-size:var(--text-md); padding:14px 16px 6px; line-height:1.4; max-height:160px; }
        .composer-textarea::placeholder{ color:var(--text-tertiary); }
        .composer-toolbar{ display:flex; align-items:center; padding:4px 8px 8px 16px; gap:8px; }
        .composer-spacer{ flex:1; }
        .composer-model-tag{ display:flex; align-items:center; gap:6px; font-size:var(--text-sm); color:var(--text-secondary); }
        .composer-model-dot{ width:7px; height:7px; border-radius:50%; background:#4285F4; }
        .send-btn{ width:32px; height:32px; border-radius:50%; background:var(--accent); color:var(--bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out), background var(--dur-fast); }
        .send-btn:disabled{ opacity:.35; }
        .send-btn:not(:disabled):hover{ transform:translateY(-1px); background:var(--accent-hover); }
        .send-btn:active:not(:disabled){ transform:scale(.9); }
        .composer-hint{ text-align:center; font-size:var(--text-2xs); color:var(--text-tertiary); margin-top:8px; }

        .settings-backdrop{ position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:1rem; }
        .settings-modal{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1.3rem; max-width:380px; width:100%; box-shadow:var(--shadow-lg); }
        .settings-field{ margin-bottom:1rem; }
        .settings-field label{ display:block; font-size:var(--text-xs); color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.06em; font-weight:700; margin-bottom:.4rem; }
        .settings-field input, .settings-field textarea{
          width:100%; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:.6rem .7rem;
          color:var(--text-primary); font-size:var(--text-md); font-family:inherit; outline:none;
        }
        .settings-field textarea{ resize:none; min-height:70px; }
        .settings-field input:focus, .settings-field textarea:focus{ border-color:var(--accent); }
      `}</style>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className={`conv-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="conv-sidebar-head">
          <button className="new-chat-btn" onClick={newChat}><Plus size={14} /> <span>New chat</span></button>
          <button className="collapse-btn" onClick={() => setSidebarCollapsed((v) => !v)} aria-label="Toggle sidebar">
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
        <div className="conv-group-label">Recent</div>
        <div className="conv-list">
          {conversations.length === 0 ? (
            <div style={{ padding: '0 .6rem', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <button key={c.id} className={`conv-item ${c.id === activeConvId ? 'active' : ''}`} onClick={() => selectConversation(c.id)} title={c.title}>
                <MessageSquare size={13} /> <span>{c.title}</span>
              </button>
            ))
          )}
        </div>
        <div className="conv-sidebar-foot">
          <button className="settings-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> <span>Coach behavior</span>
          </button>
        </div>
      </div>

      <div className="eb-ai-main">
        <div className="eb-ai-head">
          <button className="mobile-sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Show conversations">
            <MessageSquare size={18} />
          </button>
          <div className="eb-ai-head-icon"><Sparkles size={15} color="var(--bg)" /></div>
          <div>
            <div className="eb-ai-title">{personaName}</div>
            <div className="eb-ai-sub">{personaDescription} · grounded in your real trades · trading topics only</div>
          </div>
        </div>

        <div className="eb-ai-scroll">
          <div className="eb-ai-inner">
            {loadingHistory ? (
              <div className="eb-ai-empty">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="eb-ai-empty">
                Ask {personaName} about your performance, what's been holding you back, your risk patterns, or how far you are from your goals.
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
                      {m.role === 'user' ? 'You' : <>{personaName} <span className="msg-model-tag">· Gemini</span></>}
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
            {loading && <div className="gen-dots"><span /><span /><span /></div>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer-inner">
            <div className="composer">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                placeholder={`Ask ${personaName}…`}
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

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Coach behavior</div>
              <button onClick={() => setSettingsOpen(false)} style={{ color: 'var(--text-tertiary)' }}><X size={16} /></button>
            </div>
            <div className="settings-field">
              <label>Name</label>
              <input value={personaName} onChange={(e) => setPersonaName(e.target.value)} placeholder="Alex" />
            </div>
            <div className="settings-field">
              <label>Behavior</label>
              <textarea value={personaDescription} onChange={(e) => setPersonaDescription(e.target.value)} placeholder="Professional trading manager" />
            </div>
            <button className="new-chat-btn" style={{ justifyContent: 'center' }} onClick={saveSettings}><span>Save</span></button>
          </div>
        </div>
      )}
    </div>
  );
}
