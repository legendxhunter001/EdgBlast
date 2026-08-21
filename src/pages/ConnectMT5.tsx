import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/lib/functionError";
import { BROKERS, OTHER_BROKER } from "@/data/brokers";

type FormState = "idle" | "connecting" | "syncing" | "success" | "error";

interface ConnectMT5Props {
  onConnected?: (connectionId: string) => void;
  compact?: boolean;
}

export default function ConnectMT5({ onConnected, compact = false }: ConnectMT5Props) {
  const [state, setState] = useState<FormState>("idle");
  const [accountNumber, setAccountNumber] = useState("");
  const [brokerQuery, setBrokerQuery] = useState("");
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [brokerServer, setBrokerServer] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [investorPassword, setInvestorPassword] = useState("");
  const [label, setLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [syncedCount, setSyncedCount] = useState<number | null>(null);

  const resetForm = () => {
    setAccountNumber("");
    setBrokerQuery("");
    setSelectedBroker(null);
    setBrokerServer("");
    setServerQuery("");
    setInvestorPassword("");
    setLabel("");
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || !brokerServer || !investorPassword) {
      setErrorMsg("All three fields are required.");
      setState("error");
      return;
    }

    setState("connecting");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("connect-mt5", {
        body: {
          accountNumber,
          brokerServer,
          investorPassword,
          label: label.trim() || undefined,
        },
      });

      if (error || !data?.success) {
        throw new Error(
          await functionErrorMessage(error, data, "Connection failed. Check your credentials and try again."),
        );
      }

      const connectionId: string = data.connection_id;

      setState("syncing");
      const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-mt5", {
        body: { connection_id: connectionId },
      });

      if (syncError || !syncData?.success) {
        setSyncedCount(null);
      } else {
        setSyncedCount(syncData.synced ?? 0);
      }

      setInvestorPassword("");
      setState("success");
      onConnected?.(connectionId);

      if (!compact) {
        setTimeout(() => {
          resetForm();
          setState("idle");
          setSyncedCount(null);
        }, 2500);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't verify those credentials. Double check and try again.");
      setState("error");
    }
  };

  return (
    <div className="eb-connect">
      <style>{`
        .eb-connect, .eb-connect *{ box-sizing:border-box; }
        .eb-connect{
          --eb-bg-elev:#131316;
          --eb-teal:#14C9AE;
          --eb-blue:#3D6FE5;
          --eb-rose:#C98A93;
          --eb-text:#F3F1EC;
          --eb-text-dim:#9B9A97;
          --eb-text-dim2:#66655F;
          --eb-line:rgba(255,255,255,0.08);
          --eb-line-strong:rgba(255,255,255,0.16);
          --eb-input-bg:rgba(255,255,255,.03);
          --eb-card-shadow:none;
          --eb-teal-text:#14C9AE;
          --eb-blue-text:#3D6FE5;
          --eb-rose-text:#C98A93;
          font-family:'Inter',-apple-system,sans-serif;
          color:var(--eb-text);
          max-width:${compact ? "100%" : "420px"};
        }
        html.light .eb-connect{
          --eb-bg-elev:#FFFFFF;
          --eb-text:#161616;
          --eb-text-dim:#5B5A56;
          --eb-text-dim2:#8B8A85;
          --eb-line:rgba(10,10,12,0.08);
          --eb-line-strong:rgba(10,10,12,0.14);
          --eb-input-bg:rgba(10,10,12,.025);
          --eb-card-shadow:0 1px 2px rgba(20,20,20,.04), 0 10px 28px rgba(20,20,20,.06);
          --eb-teal-text:#098070;
          --eb-blue-text:#2F5FD1;
          --eb-rose-text:#A85864;
        }
        .eb-connect .eb-mono{ font-family:'IBM Plex Mono',monospace; }

        .eb-connect-card{
          background:var(--eb-bg-elev);
          border:1px solid var(--eb-line);
          border-radius:18px;
          padding:${compact ? "1.4rem" : "1.8rem"};
          box-shadow:var(--eb-card-shadow);
          transition:background-color .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .eb-connect-header{ display:flex; align-items:center; gap:.9rem; margin-bottom:1.6rem; padding-bottom:1.4rem; border-bottom:1px solid var(--eb-line); }
        .eb-connect-title{ font-weight:700; font-size:1.05rem; margin-bottom:.3rem; }
        .eb-connect-status{ display:flex; align-items:center; gap:.45rem; font-size:.8rem; color:var(--eb-text-dim); }
        .eb-status-dot{ width:7px; height:7px; border-radius:50%; background:var(--eb-text-dim2); flex-shrink:0; }
        .eb-connect-status.success .eb-status-dot{ background:var(--eb-teal); box-shadow:0 0 6px var(--eb-teal); }
        .eb-connect-status.connecting .eb-status-dot,
        .eb-connect-status.syncing .eb-status-dot{ background:var(--eb-blue); animation:eb-blink 1s ease-in-out infinite; }
        .eb-connect-status.error .eb-status-dot{ background:var(--eb-rose); }
        @keyframes eb-blink{ 0%,100%{opacity:1;} 50%{opacity:.3;} }

        .eb-connect-form{ display:flex; flex-direction:column; gap:1.1rem; }
        .eb-field{ display:flex; flex-direction:column; gap:.5rem; font-size:.82rem; color:var(--eb-text-dim); }
        .eb-field input{
          background:var(--eb-input-bg);
          border:1px solid var(--eb-line-strong);
          border-radius:9px;
          padding:.75rem .9rem;
          color:var(--eb-text);
          font-size:.95rem;
          font-family:'Inter',sans-serif;
          outline:none;
          transition:border-color .15s ease;
          width:100%;
        }
        .eb-field input:focus{ border-color:var(--eb-teal-text); }
        .eb-field input:disabled{ opacity:.5; }
        .eb-field input::placeholder{ color:var(--eb-text-dim2); }
        .eb-field-optional{ color:var(--eb-text-dim2); font-weight:400; font-size:.72rem; margin-left:.35rem; }

        .eb-combo{ position:relative; }
        .eb-combo-list{
          position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:20;
          background:var(--eb-bg-elev); border:1px solid var(--eb-line-strong); border-radius:9px;
          max-height:220px; overflow-y:auto; box-shadow:0 12px 32px rgba(0,0,0,0.35);
        }
        .eb-combo-item{
          display:block; width:100%; text-align:left; padding:.6rem .8rem; font-size:.88rem;
          background:transparent; border:none; color:var(--eb-text); cursor:pointer; font-family:inherit;
        }
        .eb-combo-item:hover{ background:rgba(20,201,174,.10); }
        .eb-combo-item-custom{ color:var(--eb-teal-text); border-top:1px solid var(--eb-line); font-size:.8rem; }

        .eb-security-note{ font-size:.78rem; color:var(--eb-text-dim2); line-height:1.5; }
        .eb-error-text{ font-size:.82rem; color:var(--eb-rose-text); }
        .eb-success-text{ font-size:.82rem; color:var(--eb-teal-text); }

        .eb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:.5rem; padding:.85rem 1.5rem; border-radius:9px; font-weight:600; font-size:.92rem; border:1px solid transparent; cursor:pointer; transition:transform .15s ease, filter .15s ease; }
        .eb-btn-full{ width:100%; }
        .eb-btn-filled{ background:linear-gradient(135deg,var(--eb-teal),var(--eb-blue)); color:#06110E; }
        .eb-btn-filled:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); }
        .eb-btn-filled:disabled{ opacity:.75; cursor:default; }

        .eb-spinner{ width:14px; height:14px; border-radius:50%; border:2px solid rgba(6,17,14,.35); border-top-color:#06110E; animation:eb-spin .7s linear infinite; flex-shrink:0; }
        @keyframes eb-spin{ to{ transform:rotate(360deg); } }

        .eb-success-box{ display:flex; flex-direction:column; align-items:center; text-align:center; gap:.6rem; padding:1.5rem 0; }
        .eb-success-icon{ width:44px; height:44px; border-radius:50%; background:rgba(20,201,174,.12); display:flex; align-items:center; justify-content:center; color:var(--eb-teal-text); font-size:1.4rem; animation:eb-pop .35s ease; }
        @keyframes eb-pop{ 0%{ transform:scale(.6); opacity:0; } 100%{ transform:scale(1); opacity:1; } }

        .eb-sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

        @media (prefers-reduced-motion: reduce){
          .eb-connect *{ animation:none !important; transition:none !important; }
        }
      `}</style>

      <span className="eb-sr-only" aria-live="polite">
        {state === "connecting" && "Verifying credentials"}
        {state === "syncing" && "Pulling your trade history"}
        {state === "success" && "Account connected and synced"}
        {state === "error" && `Connection failed. ${errorMsg}`}
      </span>

      <div className="eb-connect-card">
        {!compact && (
          <div className="eb-connect-header">
            <img src="/mt5-logo.png" alt="MetaTrader 5" width="38" height="38" style={{ objectFit: 'contain' }} />
            <div>
              <div className="eb-connect-title">Connect an MT5 Account</div>
              <div className={`eb-connect-status ${state}`}>
                <span className="eb-status-dot" />
                {state === "connecting" && "Verifying credentials…"}
                {state === "syncing" && "Pulling your trade history…"}
                {state === "success" && "Connected & synced"}
                {state === "error" && "Connection failed"}
                {state === "idle" && "Not connected yet"}
              </div>
            </div>
          </div>
        )}

        {state === "success" ? (
          <div className="eb-success-box">
            <div className="eb-success-icon">✓</div>
            <div style={{ fontWeight: 600 }}>
              {accountNumber ? `Account ••••${accountNumber.slice(-4)} connected` : "Account connected"}
            </div>
            <div className="eb-success-text eb-mono">
              {syncedCount !== null ? `${syncedCount} trade${syncedCount === 1 ? "" : "s"} synced` : "Sync will retry from the Connections page"}
            </div>
          </div>
        ) : (
          <form className="eb-connect-form" onSubmit={handleConnect}>
            <label className="eb-field">
              <span>
                Nickname <span className="eb-field-optional">(optional)</span>
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. FTMO Challenge, Personal Account"
                disabled={state === "connecting" || state === "syncing"}
              />
            </label>
            <label className="eb-field">
              <span>Account Number</span>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 51234789"
                disabled={state === "connecting" || state === "syncing"}
                required
              />
            </label>
            <label className="eb-field">
              <span>Broker</span>
              <div className="eb-combo">
                <input
                  type="text"
                  value={selectedBroker ?? brokerQuery}
                  onChange={(e) => {
                    setSelectedBroker(null);
                    setBrokerQuery(e.target.value);
                    setBrokerServer("");
                    setServerQuery("");
                    setBrokerDropdownOpen(true);
                  }}
                  onFocus={() => setBrokerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setBrokerDropdownOpen(false), 150)}
                  placeholder="Search for your broker…"
                  disabled={state === "connecting" || state === "syncing"}
                  required
                />
                {brokerDropdownOpen && (
                  <div className="eb-combo-list">
                    {[...BROKERS.filter((b) => b.name.toLowerCase().includes(brokerQuery.toLowerCase())), { name: OTHER_BROKER, servers: [] }]
                      .slice(0, 8)
                      .map((b) => (
                        <button
                          type="button"
                          key={b.name}
                          className="eb-combo-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedBroker(b.name);
                            setBrokerQuery("");
                            setBrokerServer("");
                            setServerQuery("");
                            setBrokerDropdownOpen(false);
                          }}
                        >
                          {b.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </label>

            {selectedBroker === OTHER_BROKER ? (
              <label className="eb-field">
                <span>Broker Server</span>
                <input
                  type="text"
                  value={brokerServer}
                  onChange={(e) => setBrokerServer(e.target.value)}
                  placeholder="e.g. YourBroker-Live01"
                  disabled={state === "connecting" || state === "syncing"}
                  required
                />
              </label>
            ) : selectedBroker ? (
              <label className="eb-field">
                <span>Server</span>
                <div className="eb-combo">
                  <input
                    type="text"
                    value={brokerServer || serverQuery}
                    onChange={(e) => {
                      setBrokerServer("");
                      setServerQuery(e.target.value);
                      setServerDropdownOpen(true);
                    }}
                    onFocus={() => setServerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setServerDropdownOpen(false), 150)}
                    placeholder="Search for your server…"
                    disabled={state === "connecting" || state === "syncing"}
                    required
                  />
                  {serverDropdownOpen && (
                    <div className="eb-combo-list">
                      {(BROKERS.find((b) => b.name === selectedBroker)?.servers ?? [])
                        .filter((s) => s.toLowerCase().includes(serverQuery.toLowerCase()))
                        .map((s) => (
                          <button
                            type="button"
                            key={s}
                            className="eb-combo-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setBrokerServer(s);
                              setServerQuery("");
                              setServerDropdownOpen(false);
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="eb-combo-item eb-combo-item-custom"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setBrokerServer(serverQuery);
                          setServerDropdownOpen(false);
                        }}
                      >
                        Use "{serverQuery || '…'}" as typed
                      </button>
                    </div>
                  )}
                </div>
              </label>
            ) : null}
            <label className="eb-field">
              <span>Investor Password</span>
              <input
                type="password"
                value={investorPassword}
                onChange={(e) => setInvestorPassword(e.target.value)}
                placeholder="Read-only password"
                disabled={state === "connecting" || state === "syncing"}
                autoComplete="off"
                required
              />
            </label>

            <p className="eb-security-note">
              🔒 Use your MT5 <strong>investor password</strong>, never your trader password. It's
              sent directly to our sync provider to open a read-only connection and is never
              stored in our database.
            </p>

            {state === "error" && errorMsg && <p className="eb-error-text">{errorMsg}</p>}

            <button
              type="submit"
              className="eb-btn eb-btn-filled eb-btn-full"
              disabled={state === "connecting" || state === "syncing"}
            >
              {state === "connecting" && (
                <>
                  <span className="eb-spinner" /> Connecting…
                </>
              )}
              {state === "syncing" && (
                <>
                  <span className="eb-spinner" /> Syncing trades…
                </>
              )}
              {(state === "idle" || state === "error") && "Connect Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
