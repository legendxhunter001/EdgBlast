import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ChatMsg = { role: 'user' | 'assistant'; content: string; id?: string; created_at?: string };
type Conversation = { id: string; title: string; updated_at: string };
type Goal = { id: string; goal_type: string; target_value: number; starting_value: number | null };

const DOT_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--success)', 'var(--text-tertiary)'];
const GOAL_LABELS: Record<string, string> = {
  win_rate: 'Win rate', monthly_pnl: 'Monthly P&L', account_balance: 'Account balance',
  profit_factor: 'Profit factor', avg_rr: 'Average R:R', max_drawdown_limit: 'Max drawdown limit',
};

function timeAgo(iso?: string): string {
  if (!iso) return 'just now';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
  const { user, signOut } = useAuth() as any;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<'alex' | 'candy' | 'mark'>('alex');
  const [lifeContext, setLifeContext] = useState('');
  const PERSONA_INFO = {
    alex: { name: 'Alex', tag: 'Engaging & driven', desc: 'High-energy friend and trading manager in one. Talks growth, life, and trading together, keeps you honest to your own strategy.' },
    candy: { name: 'Candy', tag: 'Warm & gentle', desc: "The one to talk to on a hard day. Comforting, patient, helps a loss feel like part of the process instead of a crisis." },
    mark: { name: 'Mark', tag: 'Dry & focused', desc: "A little funny, dead serious about results. Cracks a joke, then tells you the true thing you needed to hear." },
  } as const;
  const personaName = PERSONA_INFO[activePersona].name;
  const [goals, setGoals] = useState<Goal[]>([]);
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
    const { data } = await supabase.from('ai_chat_messages').select('id, role, content, created_at').eq('user_id', user.id).eq('conversation_id', convId).order('created_at', { ascending: true });
    setMessages((data ?? []) as ChatMsg[]);
  }, [user]);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('goals').select('id, goal_type, target_value, starting_value').eq('user_id', user.id).eq('is_active', true).limit(4);
    setGoals((data ?? []) as Goal[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const convs = await loadConversations();
      await loadGoals();
      const { data: settings } = await supabase.from('ai_coach_settings').select('active_persona, life_context').eq('user_id', user.id).maybeSingle();
      if (settings) {
        if (settings.active_persona === 'candy' || settings.active_persona === 'mark') setActivePersona(settings.active_persona);
        setLifeContext(settings.life_context ?? '');
      }
      if (convs && convs.length > 0) {
        setActiveConvId(convs[0].id);
        await loadMessages(convs[0].id);
      }
    })();
  }, [user, loadConversations, loadMessages, loadGoals]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const newChat = () => { setActiveConvId(null); setMessages([]); setMobileSidebarOpen(false); };
  const selectConversation = async (id: string) => { setActiveConvId(id); setMobileSidebarOpen(false); await loadMessages(id); };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }]);
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('ai-coach-chat', { body: { message: text, conversation_id: activeConvId } });
    setLoading(false);
    if (error || !data?.success) {
      const raw = data?.message || error?.message;
      const msg = raw && !/non-2xx status code/i.test(raw) ? raw : "We got an error on our end — we'll fix it as soon as possible. Please try again shortly.";
      setMessages((prev) => [...prev, { role: 'assistant', content: msg, created_at: new Date().toISOString() }]);
      return;
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]);
    if (!activeConvId) setActiveConvId(data.conversation_id);
    loadConversations();
  };

  const saveSettings = async () => {
    if (!user) return;
    await supabase.from('ai_coach_settings').upsert({ user_id: user.id, active_persona: activePersona, life_context: lifeContext.trim() || null }, { onConflict: 'user_id' });
    setSettingsOpen(false);
    toast.success('Coach behavior updated');
  };

  const copyMsg = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };
  const notImplemented = (label: string) => toast.info(label);
  const initials = (user?.email ?? 'EB').slice(0, 2).toUpperCase();

  return (
    <div className="eb-ai">
      <style>{`
        .eb-ai, .eb-ai *{ box-sizing:border-box; }
        .eb-ai{
          --text-2xs:10px; --text-xs:11px; --text-sm:12px; --text-base:13px; --text-md:14px; --text-lg:16px;
          --radius-xs:6px; --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
          --dur-fast:140ms; --dur-med:220ms; --ease-out:cubic-bezier(0.16,1,0.3,1);
          --bg:#121212; --surface:#181818; --surface-elevated:#1F1F1F; --border:#2A2A2A; --border-strong:#383838;
          --text-primary:#EAEAE8; --text-secondary:#9C9C98; --text-tertiary:#656562;
          --accent:#5EA8B8; --accent-2:#6FCADB; --accent-hover:#74BAC9; --success:#4FAE8C;
          --accent-active-bg: rgba(94,168,184,.10); --accent-active-border: rgba(94,168,184,.30);
          --accent-2-active-bg: rgba(111,202,219,.16); --accent-2-active-border: rgba(111,202,219,.36);
          --accent-glow: rgba(94,168,184,.14); --danger:#C0655F;
          --shadow-pill: 0 10px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.22);
          --shadow-lg: 0 20px 56px rgba(0,0,0,.38);
          background:var(--bg); color:var(--text-primary);
          height:calc(100vh - 56px); height:calc(100dvh - 56px); overflow:hidden;
          display:flex; font-family:'Inter',-apple-system,sans-serif; position:relative;
        }
        html.light .eb-ai{
          --bg:#FAFAF8; --surface:#FFFFFF; --surface-elevated:#FFFFFF; --border:#E8E7E3; --border-strong:#D3D2CC;
          --text-primary:#1C1C1A; --text-secondary:#6B6B67; --text-tertiary:#9C9C96;
          --accent:#0E7C8F; --accent-2:#0C5E8A; --accent-hover:#128FA6; --success:#2F8F6D;
          --accent-active-bg: rgba(14,124,143,.08); --accent-active-border: rgba(14,124,143,.25);
          --accent-glow: rgba(14,124,143,.08);
        }
        .eb-ai button{ font-family:inherit; cursor:pointer; background:none; border:none; color:inherit; }

        .sidebar{ width:240px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); transition:width var(--dur-med) var(--ease-out); }
        .sidebar.collapsed{ width:64px; }
        .sidebar-top{ padding:.9rem; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:.4rem; }
        .brand{ display:flex; align-items:center; gap:.5rem; overflow:hidden; }
        .brand-mark{ width:26px; height:26px; flex-shrink:0; }
        .brand-label{ font-weight:700; font-size:var(--text-md); white-space:nowrap; }
        .sidebar.collapsed .brand-label{ display:none; }
        .sidebar-collapse-btn{ width:26px; height:26px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm); color:var(--text-tertiary); }
        .sidebar-collapse-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .sidebar-collapse-btn svg{ width:16px; height:16px; }
        .sidebar-nav{ flex:1; overflow-y:auto; padding:.7rem .5rem; }
        .nav-group{ margin-bottom:1.1rem; }
        .new-chat-btn{
          width:100%; display:flex; align-items:center; gap:.5rem; padding:.55rem .7rem; border-radius:var(--radius-md);
          border:1px solid var(--accent-active-border); background:var(--accent-active-bg); color:var(--accent);
          font-size:var(--text-base); font-weight:700; white-space:nowrap; overflow:hidden; margin-bottom:.35rem;
          transition:background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        }
        .new-chat-btn:hover{ background:var(--accent-glow); transform:translateY(-1px); }
        .new-chat-btn svg{ width:16px; height:16px; flex-shrink:0; }
        .sidebar.collapsed .new-chat-btn span, .sidebar.collapsed .nav-item-label{ display:none; }
        .nav-item{
          width:100%; display:flex; align-items:center; gap:.5rem; padding:.5rem .6rem; border-radius:var(--radius-sm);
          font-size:var(--text-base); color:var(--text-secondary);
        }
        .nav-item svg{ width:16px; height:16px; flex-shrink:0; }
        .nav-item.active{ background:var(--accent-active-bg); color:var(--accent); font-weight:600; }
        .nav-group-label-row{ display:flex; align-items:center; justify-content:space-between; padding:.6rem .6rem .3rem; }
        .nav-group-label{ font-size:var(--text-xs); text-transform:uppercase; letter-spacing:.07em; color:var(--text-tertiary); font-weight:700; }
        .nav-group-add{ width:20px; height:20px; display:flex; align-items:center; justify-content:center; border-radius:6px; color:var(--text-tertiary); }
        .nav-group-add:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .nav-group-add svg{ width:13px; height:13px; }
        .sidebar.collapsed .nav-group-label-row, .sidebar.collapsed .goal-meta{ display:none; }
        .goal-item{ width:100%; display:flex; align-items:center; gap:.55rem; padding:.4rem .6rem; border-radius:var(--radius-sm); }
        .goal-item:hover{ background:var(--surface-elevated); }
        .goal-ring{ width:26px; height:26px; flex-shrink:0; }
        .goal-ring svg{ width:100%; height:100%; transform:rotate(-90deg); }
        .goal-ring-track{ fill:none; stroke:var(--border); stroke-width:3; }
        .goal-ring-fill{ fill:none; stroke:var(--accent); stroke-width:3; stroke-linecap:round; stroke-dasharray:81.7; stroke-dashoffset:calc(81.7 - (81.7 * var(--pct)) / 100); }
        .goal-meta{ text-align:left; min-width:0; }
        .goal-name{ font-size:var(--text-base); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .goal-sub{ font-size:var(--text-xs); color:var(--text-tertiary); }
        .conv-item{
          width:100%; text-align:left; display:flex; align-items:center; gap:.5rem; padding:.5rem .6rem; border-radius:10px;
          font-size:var(--text-base); color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .conv-item:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .conv-item.active{ background:var(--accent-active-bg); color:var(--accent); font-weight:600; }
        .conv-item-dot{ width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .sidebar.collapsed .conv-item span:last-child, .sidebar.collapsed .nav-group-label{ display:none; }
        .sidebar-bottom{ border-top:1px solid var(--border); padding:.6rem; position:relative; }
        .user-row{ width:100%; display:flex; align-items:center; gap:.55rem; padding:.5rem .55rem; border-radius:var(--radius-md); }
        .user-row:hover{ background:var(--surface-elevated); }
        .avatar{ width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-2)); color:var(--bg); font-size:var(--text-xs); font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .user-meta{ text-align:left; min-width:0; flex:1; }
        .user-name{ font-size:var(--text-base); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-plan{ font-size:var(--text-xs); color:var(--text-tertiary); }
        .account-gear{ color:var(--text-tertiary); flex-shrink:0; }
        .account-gear svg{ width:16px; height:16px; }
        .sidebar.collapsed .user-meta, .sidebar.collapsed .account-gear{ display:none; }
        .account-menu{ position:absolute; bottom:calc(100% + 6px); left:.6rem; right:.6rem; background:var(--surface-elevated); border:1px solid var(--border); border-radius:var(--radius-md); padding:.35rem; box-shadow:var(--shadow-lg); z-index:20; }
        .account-menu-item{ width:100%; display:flex; align-items:center; gap:.5rem; padding:.5rem .6rem; border-radius:var(--radius-sm); font-size:var(--text-base); }
        .account-menu-item:hover{ background:var(--surface); }
        .account-menu-item svg{ width:15px; height:15px; }
        .mobile-menu-fab{ display:none; }
        @media (max-width: 820px){
          .sidebar{ position:fixed; inset:0 auto 0 0; z-index:50; transform:translateX(-100%); transition:transform var(--dur-med) var(--ease-out); width:240px !important; }
          .sidebar.mobile-open{ transform:translateX(0); box-shadow:20px 0 40px rgba(0,0,0,.3); }
          .sidebar-scrim{ position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:40; }
          .mobile-menu-fab{ display:flex; position:fixed; top:1rem; left:1rem; z-index:30; width:36px; height:36px; align-items:center; justify-content:center; background:var(--surface-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-secondary); }
          .mobile-menu-fab svg{ width:18px; height:18px; }
        }

        .main{ flex:1; min-width:0; display:flex; flex-direction:column; }
        .conv-scroll{ flex:1; overflow-y:auto; padding:1.5rem 1.5rem 1rem; }
        .conv-inner{ max-width:760px; margin:0 auto; }
        .eb-ai-empty{ text-align:center; color:var(--text-secondary); font-size:var(--text-md); padding:3rem 1rem; max-width:420px; margin:0 auto; }
        .msg{ margin-bottom:24px; animation:fadeUp var(--dur-med) var(--ease-out) both; }
        @keyframes fadeUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }
        .msg.user{ display:flex; justify-content:flex-end; }
        .msg.user .msg-body{ max-width:78%; display:flex; flex-direction:column; align-items:flex-end; }
        .msg-text{ font-size:var(--text-md); line-height:1.65; }
        .msg-text p{ margin-bottom:10px; } .msg-text p:last-child{ margin-bottom:0; }
        .msg-text ul{ margin:8px 0 10px 18px; } .msg-text li{ margin-bottom:4px; }
        .msg.user .msg-text{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:16px 16px 6px 16px; padding:9px 13px; }
        .msg-code-block{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden; margin:10px 0; }
        .msg-code-head{ display:flex; align-items:center; justify-content:space-between; padding:.4rem .7rem; border-bottom:1px solid var(--border); font-size:var(--text-xs); color:var(--text-tertiary); }
        .copy-mini{ display:flex; align-items:center; gap:4px; font-size:var(--text-2xs); color:var(--text-tertiary); }
        .copy-mini svg{ width:12px; height:12px; }
        .msg-code-block pre{ padding:.7rem; font-size:var(--text-sm); overflow-x:auto; font-family:'JetBrains Mono',monospace; }
        .msg-actions{ display:flex; align-items:center; gap:2px; margin-top:6px; opacity:0; transition:opacity var(--dur-fast); }
        .msg.user .msg-actions{ justify-content:flex-end; }
        .msg:hover .msg-actions{ opacity:1; }
        .msg-timestamp{ font-size:var(--text-xs); color:var(--text-tertiary); margin-right:4px; }
        .msg.user .msg-timestamp{ order:-1; margin-right:0; margin-left:4px; }
        .msg-action-btn{ width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs); color:var(--text-tertiary); }
        .msg-action-btn:hover{ background:var(--surface-elevated); color:var(--text-primary); }
        .msg-action-btn svg{ width:13px; height:13px; }
        .gen-dots{ display:flex; gap:3px; align-items:center; }
        .gen-dots span{ width:5px; height:5px; border-radius:50%; background:var(--accent); animation:pulse 1.1s infinite ease-in-out; }
        .gen-dots span:nth-child(2){ animation-delay:.15s; } .gen-dots span:nth-child(3){ animation-delay:.3s; }
        @keyframes pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }
        .composer-wrap{ padding:10px 20px 20px; flex-shrink:0; }
        .composer-inner{ max-width:760px; margin:0 auto; }
        .composer{ border:1px solid var(--border); border-radius:26px; background:var(--surface-elevated); box-shadow:var(--shadow-pill); transition:border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out); overflow:hidden; }
        .composer:focus-within{ border-color:var(--accent); box-shadow:var(--shadow-pill), 0 0 0 3px var(--accent-glow); }
        .composer-textarea{ width:100%; resize:none; border:none; outline:none; background:transparent; color:var(--text-primary); font-family:inherit; font-size:var(--text-md); padding:14px 16px 6px; line-height:1.4; max-height:200px; }
        .composer-textarea::placeholder{ color:var(--text-tertiary); }
        .composer-toolbar{ display:flex; align-items:center; padding:4px 8px 8px 12px; gap:4px; }
        .composer-tool-btn{ display:flex; align-items:center; gap:5px; padding:.4rem .6rem; border-radius:999px; font-size:var(--text-sm); color:var(--text-secondary); }
        .composer-tool-btn:hover{ background:var(--surface); color:var(--text-primary); }
        .composer-tool-btn svg{ width:15px; height:15px; }
        .composer-spacer{ flex:1; }
        .send-btn{ width:32px; height:32px; border-radius:50%; background:var(--accent); color:var(--bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform var(--dur-fast) var(--ease-out), background var(--dur-fast); }
        .send-btn svg{ width:16px; height:16px; }
        .send-btn:disabled{ opacity:.35; }
        .send-btn:not(:disabled):hover{ transform:translateY(-1px); background:var(--accent-hover); }
        .composer-hint{ text-align:center; font-size:var(--text-2xs); color:var(--text-tertiary); margin-top:8px; }

        .settings-backdrop{ position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:1rem; }
        .settings-modal{ background:var(--surface-elevated); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1.3rem; max-width:380px; width:100%; box-shadow:var(--shadow-lg); }
        .settings-field{ margin-bottom:1rem; }
        .settings-field label{ display:block; font-size:var(--text-xs); color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.06em; font-weight:700; margin-bottom:.4rem; }
        .settings-field input, .settings-field textarea{ width:100%; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:.6rem .7rem; color:var(--text-primary); font-size:var(--text-md); font-family:inherit; outline:none; }
        .settings-field textarea{ resize:none; min-height:70px; }
      `}</style>

      {mobileSidebarOpen && <div className="sidebar-scrim" onClick={() => setMobileSidebarOpen(false)} />}

      <aside className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="2.4" fill="var(--accent)" />
                <circle cx="16" cy="5" r="1.7" fill="var(--accent-2)" />
                <circle cx="16" cy="27" r="1.7" fill="var(--accent)" />
                <circle cx="5" cy="16" r="1.7" fill="var(--accent)" />
                <circle cx="27" cy="16" r="1.7" fill="var(--accent-2)" />
                <circle cx="8.5" cy="8.5" r="1.4" fill="var(--accent-2)" opacity="0.75" />
                <circle cx="23.5" cy="23.5" r="1.4" fill="var(--accent)" opacity="0.75" />
                <circle cx="23.5" cy="8.5" r="1.4" fill="var(--accent)" opacity="0.75" />
                <circle cx="8.5" cy="23.5" r="1.4" fill="var(--accent-2)" opacity="0.75" />
                <line x1="16" y1="16" x2="16" y2="5" stroke="var(--accent-2)" strokeWidth="1" opacity="0.5" />
                <line x1="16" y1="16" x2="16" y2="27" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
                <line x1="16" y1="16" x2="5" y2="16" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
                <line x1="16" y1="16" x2="27" y2="16" stroke="var(--accent-2)" strokeWidth="1" opacity="0.5" />
              </svg>
            </div>
            <span className="brand-label">Edge Blast</span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed((v) => !v)} aria-label="Collapse sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <button className="new-chat-btn" onClick={newChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              <span>New chat</span>
            </button>
            <button className="nav-item active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
              <span className="nav-item-label">Conversations</span>
            </button>
          </div>

          {goals.length > 0 && (
            <div className="nav-group">
              <div className="nav-group-label-row">
                <span className="nav-group-label">Goals</span>
              </div>
              {goals.map((g) => {
                const start = g.starting_value ?? 0;
                const pct = g.target_value !== start ? Math.max(0, Math.min(100, 50)) : 0; // live % computed on Review page; sidebar shows a glance
                return (
                  <button key={g.id} className="goal-item" onClick={() => toast.info('Open Review to see full goal progress')}>
                    <div className="goal-ring" style={{ ['--pct' as any]: pct }}>
                      <svg viewBox="0 0 32 32"><circle className="goal-ring-track" cx="16" cy="16" r="13" /><circle className="goal-ring-fill" cx="16" cy="16" r="13" /></svg>
                    </div>
                    <div className="goal-meta">
                      <div className="goal-name">{GOAL_LABELS[g.goal_type] ?? g.goal_type}</div>
                      <div className="goal-sub">Target {g.target_value}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="nav-group">
            <div className="nav-group-label">Recent</div>
            {conversations.length === 0 ? (
              <div style={{ padding: '0 .6rem', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No conversations yet.</div>
            ) : (
              conversations.map((c, i) => (
                <button key={c.id} className={`conv-item ${c.id === activeConvId ? 'active' : ''}`} onClick={() => selectConversation(c.id)} title={c.title}>
                  <span className="conv-item-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} /><span>{c.title}</span>
                </button>
              ))
            )}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <button className="user-row" onClick={() => setAccountMenuOpen((v) => !v)}>
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{user?.email ?? 'Trader'}</div>
              <div className="user-plan">Edge Blast</div>
            </div>
            <div className="account-gear">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
            </div>
          </button>
          {accountMenuOpen && (
            <div className="account-menu">
              <button className="account-menu-item" onClick={() => { setSettingsOpen(true); setAccountMenuOpen(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
                Settings
              </button>
              <button className="account-menu-item" onClick={() => signOut?.()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <button className="mobile-menu-fab" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
        </button>

        <div className="conv-scroll">
          <div className="conv-inner">
            {messages.length === 0 ? (
              <div className="eb-ai-empty">Ask {personaName} about your performance, what's been holding you back, or how far you are from your goals.</div>
            ) : (
              messages.map((m, i) => (
                <div key={m.id ?? i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
                  <div className="msg-body">
                    <div className="msg-text">{renderText(m.content)}</div>
                    <div className="msg-actions">
                      <span className="msg-timestamp">{timeAgo(m.created_at)}</span>
                      {m.role === 'user' ? (
                        <>
                          <button className="msg-action-btn" onClick={() => notImplemented('Edit message')} aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                          <button className="msg-action-btn" onClick={() => notImplemented('Retry')} aria-label="Retry"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0020.5 15" /></svg></button>
                          <button className="msg-action-btn" onClick={() => copyMsg(m.content)} aria-label="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg></button>
                        </>
                      ) : (
                        <>
                          <button className="msg-action-btn" onClick={() => copyMsg(m.content)} aria-label="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg></button>
                          <button className="msg-action-btn" onClick={() => notImplemented('Regenerate')} aria-label="Regenerate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0020.5 15" /></svg></button>
                          <button className="msg-action-btn" onClick={() => notImplemented('Thanks for the feedback')} aria-label="Good response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z" /><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg></button>
                          <button className="msg-action-btn" onClick={() => notImplemented('Thanks for the feedback')} aria-label="Poor response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: 'scaleY(-1)' }}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z" /><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {loading && <div className="gen-dots" style={{ marginLeft: '2px' }}><span /><span /><span /></div>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer-inner">
            <div className="composer">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                placeholder={`Ask ${personaName} anything…`}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <div className="composer-toolbar">
                <button className="composer-tool-btn" onClick={() => notImplemented('Attach a file')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21.4 11.1l-9 9a5.4 5.4 0 01-7.6-7.6l9-9a3.6 3.6 0 015.1 5.1l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3" /></svg>
                  Attach
                </button>
                <button className="composer-tool-btn" onClick={() => notImplemented('Tools menu')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14.7 6.3a4 4 0 105.7 5.7L23 15l-3 3-3.1-2.6A4 4 0 1111.3 9.3L15 5.6 12 3l-3 3" /><path d="M9 15l-4.5 4.5a2.1 2.1 0 01-3-3L6 12" /></svg>
                  Tools
                </button>
                <div className="composer-spacer" />
                <button className="send-btn" onClick={send} disabled={loading || !input.trim()} aria-label="Send message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
            <div className="composer-hint">Edge Blast can make mistakes. Verify important information.</div>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: '1rem' }}>Coach behavior</div>

            <div className="settings-field">
              <label>Personality</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {(Object.keys(PERSONA_INFO) as (keyof typeof PERSONA_INFO)[]).map((key) => {
                  const p = PERSONA_INFO[key];
                  const on = activePersona === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActivePersona(key)}
                      style={{
                        textAlign: 'left', padding: '.7rem .8rem', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                        background: on ? 'var(--accent-active-bg)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: on ? 'var(--accent)' : 'var(--text-primary)' }}>{p.name}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{p.tag}</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '.2rem', lineHeight: 1.4 }}>{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="settings-field">
              <label>What should {personaName} know about you?</label>
              <textarea
                value={lifeContext}
                onChange={(e) => setLifeContext(e.target.value)}
                placeholder="Your name, what matters to you, your faith or values, anything that helps them actually know you — optional"
              />
            </div>

            <button className="new-chat-btn" style={{ justifyContent: 'center', marginBottom: 0 }} onClick={saveSettings}><span>Save</span></button>
          </div>
        </div>
      )}
    </div>
  );
}
