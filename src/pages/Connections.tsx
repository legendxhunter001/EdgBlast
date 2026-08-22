import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/lib/functionError";
import { useAccountScope } from "@/contexts/AccountScopeContext";
import ConnectMT5 from "./ConnectMT5";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function maskAccount(acc: string): string {
  return acc.length > 4 ? "••••" + acc.slice(-4) : acc;
}

export default function Connections() {
  const { connections, loading, selectedId, setSelectedId, refresh } = useAccountScope();
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setActionError(null);
    const { data, error } = await supabase.functions.invoke("sync-mt5", { body: { connection_id: id } });
    if (error || !data?.success) {
      setActionError(await functionErrorMessage(error, data, "Sync failed."));
    }
    await refresh();
    setSyncingId(null);
  };

  const handleSetPrimary = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("mt5_connections").update({ is_primary: false }).eq("user_id", user.id).eq("is_primary", true);
    await supabase.from("mt5_connections").update({ is_primary: true }).eq("id", id);
    await refresh();
  };

  const [tradingConfirmId, setTradingConfirmId] = useState<string | null>(null);
  const handleToggleTrading = async (id: string, next: boolean) => {
    if (next) {
      setTradingConfirmId(id);
      return;
    }
    await supabase.from("mt5_connections").update({ can_trade: false }).eq("id", id);
    await refresh();
  };
  const confirmEnableTrading = async () => {
    if (!tradingConfirmId) return;
    await supabase.from("mt5_connections").update({ can_trade: true }).eq("id", tradingConfirmId);
    setTradingConfirmId(null);
    await refresh();
  };

  const handleDisconnect = async (id: string) => {
    setActionError(null);
    const { data, error } = await supabase.functions.invoke("delete-mt5-account", {
      body: { connection_id: id },
    });
    if (error || !data?.success) {
      setActionError(await functionErrorMessage(error, data, "Could not remove this account."));
      return;
    }
    setConfirmDisconnectId(null);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  };

  const saveLabel = async (id: string) => {
    await supabase.from("mt5_connections").update({ label: labelDraft.trim() || null }).eq("id", id);
    setEditingLabelId(null);
    await refresh();
  };

  useEffect(() => {
    if (!showAddModal && !confirmDisconnectId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddModal(false);
        setConfirmDisconnectId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddModal, confirmDisconnectId]);

  const statusMeta: Record<string, { label: string; dotClass: string }> = {
    connected: { label: "Connected", dotClass: "connected" },
    connecting: { label: "Connecting…", dotClass: "connecting" },
    error: { label: "Needs reconnect", dotClass: "error" },
    disconnected: { label: "Disconnected", dotClass: "disconnected" },
  };

  return (
    <div className="eb-connections-page">
      <style>{`
        .eb-connections-page, .eb-connections-page *{ box-sizing:border-box; }
        .eb-connections-page{
          --eb-bg:#0A0A0C;
          --eb-bg-elev:#131316;
          --eb-teal:#14C9AE;
          --eb-blue:#3D6FE5;
          --eb-rose:#C98A93;
          --eb-text:#F3F1EC;
          --eb-text-dim:#9B9A97;
          --eb-text-dim2:#66655F;
          --eb-line:rgba(255,255,255,0.08);
          --eb-line-strong:rgba(255,255,255,0.16);
          --eb-input-bg:rgba(255,255,255,.04);
          --eb-card-shadow:none;
          --eb-teal-text:#14C9AE;
          --eb-blue-text:#3D6FE5;
          --eb-rose-text:#C98A93;
          font-family:'Inter',-apple-system,sans-serif;
          color:var(--eb-text);
          padding: 2rem;
          max-width: 960px;
          margin: 0 auto;
        }
        html.light .eb-connections-page{
          --eb-bg:#F7F6F3;
          --eb-bg-elev:#FFFFFF;
          --eb-text:#161616;
          --eb-text-dim:#5B5A56;
          --eb-text-dim2:#8B8A85;
          --eb-line:rgba(10,10,12,0.08);
          --eb-line-strong:rgba(10,10,12,0.14);
          --eb-input-bg:rgba(10,10,12,.03);
          --eb-card-shadow:0 1px 2px rgba(20,20,20,.04), 0 10px 24px rgba(20,20,20,.05);
          --eb-teal-text:#098070;
          --eb-blue-text:#2F5FD1;
          --eb-rose-text:#A85864;
        }
        .eb-mono{ font-family:'IBM Plex Mono',monospace; }

        .eb-page-header{ display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:2rem; flex-wrap:wrap; gap:1rem; }
        .eb-page-title{ font-family:'Newsreader',Georgia,serif; font-size:1.8rem; font-weight:600; margin-bottom:.4rem; }
        .eb-page-sub{ color:var(--eb-text-dim); font-size:.9rem; }

        .eb-add-btn{ display:inline-flex; align-items:center; gap:.5rem; padding:.75rem 1.3rem; border-radius:9px; font-weight:600; font-size:.88rem; border:none; cursor:pointer; background:linear-gradient(135deg,var(--eb-teal),var(--eb-blue)); color:#06110E; transition:transform .15s ease, filter .15s ease; }
        .eb-add-btn:hover{ transform:translateY(-1px); filter:brightness(1.06); }

        .eb-scope-bar{ display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; margin-bottom:1.8rem; padding:1rem 1.2rem; background:var(--eb-bg-elev); border:1px solid var(--eb-line); border-radius:12px; box-shadow:var(--eb-card-shadow); transition:background-color .2s ease, box-shadow .2s ease; }
        .eb-scope-label{ font-size:.78rem; color:var(--eb-text-dim2); text-transform:uppercase; letter-spacing:.05em; margin-right:.4rem; }
        .eb-scope-chip{ padding:.45rem .9rem; border-radius:999px; font-size:.82rem; font-weight:600; border:1px solid var(--eb-line-strong); background:transparent; color:var(--eb-text-dim); cursor:pointer; transition:all .15s ease; }
        .eb-scope-chip:hover{ border-color:var(--eb-teal); color:var(--eb-text); }
        .eb-scope-chip.active{ background:rgba(20,201,174,.14); border-color:var(--eb-teal-text); color:var(--eb-teal-text); }

        .eb-cards-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1rem; }

        .eb-account-card{
          background:var(--eb-bg-elev);
          border:1px solid var(--eb-line);
          border-radius:16px;
          padding:1.4rem;
          box-shadow:var(--eb-card-shadow);
          animation: eb-card-in .4s ease backwards;
          transition: border-color .2s ease, transform .2s ease, background-color .2s ease, box-shadow .2s ease;
        }
        .eb-account-card:hover{ border-color:var(--eb-line-strong); transform:translateY(-2px); }
        @keyframes eb-card-in{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }

        .eb-card-top{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; }
        .eb-card-label-row{ display:flex; align-items:center; gap:.5rem; }
        .eb-card-label{ font-weight:700; font-size:1rem; cursor:pointer; border-radius:4px; }
        .eb-card-label:hover, .eb-card-label:focus-visible{ text-decoration:underline; text-decoration-style:dotted; outline:none; }
        .eb-card-label-input{ background:var(--eb-input-bg); border:1px solid var(--eb-teal-text); border-radius:6px; padding:.25rem .5rem; color:var(--eb-text); font-size:1rem; font-family:inherit; }
        .eb-primary-badge{ font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:.2rem .5rem; border-radius:999px; background:rgba(61,111,229,.15); color:var(--eb-blue-text); }

        .eb-status-pill{ display:flex; align-items:center; gap:.4rem; font-size:.78rem; color:var(--eb-text-dim); }
        .eb-status-dot{ width:7px; height:7px; border-radius:50%; background:var(--eb-text-dim2); flex-shrink:0; }
        .eb-status-dot.connected{ background:var(--eb-teal); box-shadow:0 0 6px var(--eb-teal); }
        .eb-status-dot.connecting{ background:var(--eb-blue); animation:eb-blink 1s ease-in-out infinite; }
        .eb-status-dot.error{ background:var(--eb-rose); }
        .eb-status-dot.disconnected{ background:var(--eb-text-dim2); }
        @keyframes eb-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }

        .eb-card-notice{
          margin-top:.75rem; padding:.6rem .7rem; border-radius:8px;
          border:1px solid color-mix(in srgb, var(--eb-rose) 40%, transparent);
          background:color-mix(in srgb, var(--eb-rose) 12%, transparent);
          color:var(--eb-text); font-size:.78rem; line-height:1.45;
        }



        .eb-card-detail-row{ display:flex; justify-content:space-between; font-size:.82rem; padding:.5rem 0; border-bottom:1px solid var(--eb-line); color:var(--eb-text-dim); }
        .eb-card-detail-row:last-of-type{ border-bottom:none; }
        .eb-card-detail-row span:last-child{ color:var(--eb-text); font-weight:600; }

        .eb-card-actions{ display:flex; gap:.5rem; margin-top:1.1rem; flex-wrap:wrap; }
        .eb-trading-row{
          display:flex; align-items:center; justify-content:space-between; gap:.75rem;
          margin-top:.9rem; padding:.6rem .7rem; border-radius:9px;
          background:rgba(201,138,147,.06); border:1px solid rgba(201,138,147,.2);
        }
        .eb-trading-label{ font-size:.8rem; font-weight:650; }
        .eb-trading-sub{ font-size:.7rem; color:var(--eb-text-dim2); margin-top:.1rem; }
        .eb-trading-switch{
          width:40px; height:23px; border-radius:999px; border:1px solid var(--eb-line-strong);
          background:rgba(255,255,255,.05); position:relative; cursor:pointer; flex-shrink:0;
          transition:background .2s ease, border-color .2s ease;
        }
        .eb-trading-switch span{
          position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%;
          background:var(--eb-text-dim); transition:transform .2s ease, background .2s ease;
        }
        .eb-trading-switch.on{ background:rgba(201,138,147,.28); border-color:var(--eb-rose-text); }
        .eb-trading-switch.on span{ transform:translateX(17px); background:var(--eb-rose-text); }
        .eb-trading-switch:disabled{ opacity:.5; cursor:default; }
        .eb-card-btn{ flex:1; min-width:90px; padding:.55rem .8rem; border-radius:8px; font-size:.78rem; font-weight:600; border:1px solid var(--eb-line-strong); background:transparent; color:var(--eb-text); cursor:pointer; transition:all .15s ease; display:flex; align-items:center; justify-content:center; gap:.35rem; }
        .eb-card-btn:hover{ border-color:var(--eb-teal-text); color:var(--eb-teal-text); }
        .eb-card-btn.danger:hover{ border-color:var(--eb-rose-text); color:var(--eb-rose-text); }
        .eb-card-btn:disabled{ opacity:.5; cursor:default; }

        .eb-spinner-sm{ width:11px; height:11px; border-radius:50%; border:2px solid rgba(20,201,174,.25); border-top-color:var(--eb-teal); animation:eb-spin .7s linear infinite; }
        @keyframes eb-spin{ to{ transform:rotate(360deg); } }

        .eb-empty-state{ text-align:center; padding:4rem 1rem; color:var(--eb-text-dim); }

        .eb-modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:50; animation:eb-fade-in .2s ease; padding:1rem; }
        @keyframes eb-fade-in{ from{ opacity:0; } to{ opacity:1; } }
        .eb-modal-close{ position:absolute; top:1rem; right:1rem; background:none; border:none; color:var(--eb-text-dim); font-size:1.3rem; cursor:pointer; }
        .eb-modal-wrap{ position:relative; }

        .eb-confirm-box{ background:var(--eb-bg-elev); border:1px solid var(--eb-line-strong); border-radius:14px; padding:1.6rem; max-width:340px; text-align:center; box-shadow:0 20px 48px rgba(0,0,0,.28); }
        .eb-confirm-actions{ display:flex; gap:.6rem; margin-top:1.2rem; }

        @media (max-width: 640px){
          .eb-connections-page{ padding:1.2rem; }
        }
        @media (prefers-reduced-motion: reduce){
          .eb-connections-page *{ animation:none !important; transition:none !important; }
        }
      `}</style>

      <div className="eb-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
          <img src="/mt5-logo.png" alt="MetaTrader 5" width="44" height="44" style={{ objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div className="eb-page-title">MT5 Connections</div>
            <div className="eb-page-sub">Manage every MT5 account feeding this journal.</div>
          </div>
        </div>
        <button className="eb-add-btn" onClick={() => setShowAddModal(true)}>
          + Add Account
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            margin: "0 0 1rem",
            padding: ".7rem .9rem",
            borderRadius: 10,
            border: "1px solid rgba(192,138,138,.35)",
            background: "rgba(192,138,138,.10)",
            color: "#D8A0A0",
            fontSize: ".85rem",
            lineHeight: 1.5,
          }}
        >
          {actionError}
        </div>
      )}

      {connections.length > 0 && (
        <div className="eb-scope-bar">
          <span className="eb-scope-label">Viewing</span>
          <button
            className={`eb-scope-chip ${selectedId === null ? "active" : ""}`}
            onClick={() => setSelectedId(null)}
          >
            All Accounts
          </button>
          {connections.map((c) => (
            <button
              key={c.id}
              className={`eb-scope-chip ${selectedId === c.id ? "active" : ""}`}
              onClick={() => setSelectedId(c.id)}
            >
              {c.label || maskAccount(c.account_number)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="eb-empty-state">Loading your accounts…</div>
      ) : connections.length === 0 ? (
        <div className="eb-empty-state">
          <p style={{ marginBottom: "1rem" }}>No MT5 accounts connected yet.</p>
          <button className="eb-add-btn" onClick={() => setShowAddModal(true)}>
            + Connect your first account
          </button>
        </div>
      ) : (
        <div className="eb-cards-grid">
          {connections.map((c, i) => {
            const meta = statusMeta[c.status] ?? statusMeta.disconnected;
            return (
              <div className="eb-account-card" key={c.id} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="eb-card-top">
                  <div className="eb-card-label-row">
                    {editingLabelId === c.id ? (
                      <input
                        className="eb-card-label-input"
                        autoFocus
                        aria-label="Account nickname"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onBlur={() => saveLabel(c.id)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    ) : (
                      <span
                        className="eb-card-label"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setEditingLabelId(c.id);
                          setLabelDraft(c.label || "");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingLabelId(c.id);
                            setLabelDraft(c.label || "");
                          }
                        }}
                        title="Click to rename"
                        aria-label={`Rename account, currently ${c.label || maskAccount(c.account_number)}`}
                      >
                        {c.label || maskAccount(c.account_number)}
                      </span>
                    )}
                    {c.is_primary && <span className="eb-primary-badge">Primary</span>}
                  </div>
                  <div className="eb-status-pill">
                    <span className={`eb-status-dot ${meta.dotClass}`} />
                    {meta.label}
                  </div>
                </div>

                <div className="eb-mono">
                  <div className="eb-card-detail-row">
                    <span>Account</span>
                    <span>{maskAccount(c.account_number)}</span>
                  </div>
                  <div className="eb-card-detail-row">
                    <span>Server</span>
                    <span>{c.broker_server}</span>
                  </div>
                  <div className="eb-card-detail-row">
                    <span>Last synced</span>
                    <span>{timeAgo(c.last_synced_at)}</span>
                  </div>
                </div>

                {c.status === "error" && (
                  <div className="eb-card-notice">
                    This account isn't live with our data provider, so it can't sync. Remove it and add
                    it again with your investor password and exact broker server name.
                  </div>
                )}

                <div className="eb-trading-row">
                  <div>
                    <div className="eb-trading-label">Live trading</div>
                    <div className="eb-trading-sub">{c.can_trade ? "Enabled — real orders will execute" : "Off — read-only journal sync"}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.can_trade}
                    className={`eb-trading-switch ${c.can_trade ? "on" : ""}`}
                    onClick={() => handleToggleTrading(c.id, !c.can_trade)}
                    disabled={c.status !== "connected"}
                  >
                    <span />
                  </button>
                </div>

                <div className="eb-card-actions">
                  <button
                    className="eb-card-btn"
                    onClick={() => handleSync(c.id)}
                    disabled={syncingId === c.id || c.status !== "connected"}
                  >
                    {syncingId === c.id ? <span className="eb-spinner-sm" /> : "↻"} Sync
                  </button>
                  {!c.is_primary && c.status === "connected" && (
                    <button className="eb-card-btn" onClick={() => handleSetPrimary(c.id)}>
                      Set Primary
                    </button>
                  )}
                  {c.status !== "disconnected" && (
                    <button className="eb-card-btn danger" onClick={() => setConfirmDisconnectId(c.id)}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="eb-modal-backdrop" onClick={() => setShowAddModal(false)} role="presentation">
          <div
            className="eb-modal-wrap"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add MT5 account"
          >
            <button className="eb-modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">✕</button>
            <ConnectMT5
              onConnected={async () => {
                await refresh();
                setTimeout(() => setShowAddModal(false), 1200);
              }}
            />
          </div>
        </div>
      )}

      {confirmDisconnectId && (
        <div className="eb-modal-backdrop" onClick={() => setConfirmDisconnectId(null)} role="presentation">
          <div
            className="eb-confirm-box"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm disconnect"
          >
            <p style={{ fontWeight: 600, marginBottom: ".4rem" }}>Disconnect this account?</p>
            <p style={{ fontSize: ".85rem", color: "var(--eb-text-dim)" }}>
              Trade history already synced will stay in your journal, but new trades won't sync anymore.
            </p>
            <div className="eb-confirm-actions">
              <button className="eb-card-btn" onClick={() => setConfirmDisconnectId(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="eb-card-btn danger"
                onClick={() => handleDisconnect(confirmDisconnectId)}
                style={{ flex: 1 }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {tradingConfirmId && (
        <div className="eb-modal-backdrop" onClick={() => setTradingConfirmId(null)} role="presentation">
          <div
            className="eb-confirm-box"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm enable trading"
          >
            <p style={{ fontWeight: 700, marginBottom: ".4rem", color: "var(--eb-rose-text)" }}>Enable live trading?</p>
            <p style={{ fontSize: ".85rem", color: "var(--eb-text-dim)", lineHeight: 1.5 }}>
              Orders placed from Edge Blast will execute for real on this account, using real money.
              Every order still goes through your risk rules and requires a confirmation step before it's sent —
              but this switch is what allows trading to happen at all. Turn it off any time.
            </p>
            <div className="eb-confirm-actions">
              <button className="eb-card-btn" onClick={() => setTradingConfirmId(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="eb-card-btn danger"
                onClick={confirmEnableTrading}
                style={{ flex: 1 }}
              >
                Enable trading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
