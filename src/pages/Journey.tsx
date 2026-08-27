import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Image as ImageIcon, Images, X, Search, Loader2, Upload } from "lucide-react";

type Entry = {
  id: string;
  title: string;
  content: string;
  is_shared: boolean;
  share_token: string | null;
  updated_at: string;
};

type JournalImage = { id: string; storage_path: string; url: string };
type GalleryImage = JournalImage & { entryId: string; entryTitle: string };

const GALLERY_ENTRY_TITLE = "Photos";
const TILE_SIZES = { sm: 90, md: 140, lg: 200 };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function Journey() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [images, setImages] = useState<JournalImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [tileSize, setTileSize] = useState<"sm" | "md" | "lg">("md");
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const active = entries.find((e) => e.id === activeId) ?? null;

  const load = useCallback(async (selectId?: string) => {
    const { data, error: err } = await supabase
      .from("journal_entries")
      .select("id, title, content, is_shared, share_token, updated_at")
      .order("updated_at", { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data ?? []) as Entry[];
    setEntries(list);
    setLoading(false);
    const next = selectId ?? activeId ?? list[0]?.id ?? null;
    const chosen = list.find((e) => e.id === next) ?? list[0] ?? null;
    if (chosen) {
      setActiveId(chosen.id);
      if (!dirty.current) { setTitle(chosen.title); setContent(chosen.content); }
    } else {
      setActiveId(null);
    }
  }, [activeId]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const loadImages = useCallback(async (entryId: string) => {
    const { data } = await supabase.from("journal_images").select("id, storage_path").eq("entry_id", entryId);
    if (!data) { setImages([]); return; }
    const withUrls = await Promise.all(
      data.map(async (img) => {
        const { data: signed } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
        return { id: img.id, storage_path: img.storage_path, url: signed?.signedUrl ?? "" };
      })
    );
    setImages(withUrls);
  }, []);

  useEffect(() => { if (activeId) loadImages(activeId); else setImages([]); }, [activeId, loadImages]);

  const selectEntry = (e: Entry) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirty.current = false;
    setSaveState("idle");
    setActiveId(e.id);
    setTitle(e.title);
    setContent(e.content);
  };

  const persist = useCallback(async (id: string, patch: Partial<Entry>) => {
    setSaveState("saving");
    const { error: err } = await supabase.from("journal_entries").update(patch).eq("id", id);
    if (err) { setError(err.message); setSaveState("idle"); return; }
    dirty.current = false;
    setSaveState("saved");
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } as Entry : e)));
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
  }, []);

  const queueSave = (patch: Partial<Entry>) => {
    if (!activeId) return;
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const id = activeId;
    saveTimer.current = setTimeout(() => persist(id, patch), 800);
  };

  const createEntry = async () => {
    setError(null);
    if (!user) return;
    const { data, error: err } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, title: "Untitled Entry", content: "" })
      .select("id, title, content, is_shared, share_token, updated_at")
      .single();
    if (err || !data) { setError(err?.message ?? "Could not create entry."); return; }
    dirty.current = false;
    setEntries((prev) => [data as Entry, ...prev]);
    selectEntry(data as Entry);
  };

  const deleteEntry = async (id: string) => {
    setError(null);
    const { error: err } = await supabase.from("journal_entries").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    dirty.current = false;
    const rest = entries.filter((e) => e.id !== id);
    setEntries(rest);
    if (activeId === id) {
      const next = rest[0] ?? null;
      setActiveId(next?.id ?? null);
      setTitle(next?.title ?? "");
      setContent(next?.content ?? "");
    }
  };

  const toggleShare = async () => { if (active) await persist(active.id, { is_shared: !active.is_shared }); };

  const handleUpload = async (file: File) => {
    if (!user || !activeId) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are supported."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${activeId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("journal-images").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: activeId, storage_path: path });
    setUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    loadImages(activeId);
  };

  const removeImage = async (img: JournalImage) => {
    await supabase.storage.from("journal-images").remove([img.storage_path]);
    await supabase.from("journal_images").delete().eq("id", img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    setGalleryImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  const openGallery = async () => {
    if (!user) return;
    setGalleryOpen(true);
    setGalleryLoading(true);
    const { data } = await supabase
      .from("journal_images")
      .select("id, storage_path, entry_id, journal_entries(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!data) { setGalleryImages([]); setGalleryLoading(false); return; }
    const withUrls = await Promise.all(
      data.map(async (img: any) => {
        const { data: signed } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
        return {
          id: img.id, storage_path: img.storage_path, url: signed?.signedUrl ?? "",
          entryId: img.entry_id, entryTitle: img.journal_entries?.title || "Untitled Entry",
        };
      })
    );
    setGalleryImages(withUrls);
    setGalleryLoading(false);
  };

  const jumpToEntryFromGallery = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (entry) selectEntry(entry);
    setGalleryOpen(false);
  };

  // Uploading straight from the full gallery has no "current entry" context,
  // so photos land in a dedicated catch-all "Photos" entry (auto-created once).
  const getOrCreatePhotosEntry = async (): Promise<string | null> => {
    if (!user) return null;
    const existing = entries.find((e) => e.title === GALLERY_ENTRY_TITLE);
    if (existing) return existing.id;
    const { data, error: err } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, title: GALLERY_ENTRY_TITLE, content: "" })
      .select("id, title, content, is_shared, share_token, updated_at")
      .single();
    if (err || !data) { toast.error(err?.message ?? "Could not create a place for these photos."); return null; }
    setEntries((prev) => [data as Entry, ...prev]);
    return data.id;
  };

  const handleGalleryUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are supported."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB."); return; }
    setGalleryUploading(true);
    const entryId = await getOrCreatePhotosEntry();
    if (!entryId) { setGalleryUploading(false); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${entryId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("journal-images").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error(upErr.message); setGalleryUploading(false); return; }
    const { error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: entryId, storage_path: path });
    setGalleryUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    openGallery();
    if (activeId === entryId) loadImages(entryId);
  };

  const shareUrl = active?.is_shared && active.share_token ? `${window.location.origin}/journal/${active.share_token}` : null;
  const words = wordCount(content);
  const filteredEntries = entries.filter((e) =>
    !search.trim() || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="eb-journey">
      <style>{`
        .eb-journey, .eb-journey *{ box-sizing:border-box; }
        .eb-journey{
          --bg:#0A0A0C; --elev:#131316; --accent:#A89A7E; --accent-soft:rgba(168,154,126,.14);
          --text:#F3F1EC; --dim:#9B9A97; --line:rgba(255,255,255,.08);
          min-height:100%; background:var(--bg); color:var(--text);
          font-family:'Inter',-apple-system,sans-serif;
          padding:2rem 1.5rem 3rem;
        }
        html.light .eb-journey{
          --bg:#FAFAF8; --elev:#FFFFFF; --accent:#8A7A5C; --accent-soft:rgba(138,122,92,.10);
          --text:#242320; --dim:#7A776E; --line:rgba(0,0,0,.08);
        }
        .eb-journey .inner{ max-width:1180px; margin:0 auto; }
        .eb-journey h1{ font-family:'Newsreader',serif; font-size:2rem; font-weight:600; letter-spacing:-.01em; }
        .eb-journey .sub{ color:var(--dim); margin-top:.4rem; max-width:60ch; line-height:1.6; font-size:.9rem; }
        .eb-journey .layout{ display:grid; grid-template-columns:300px 1fr; gap:1.25rem; margin-top:1.75rem; }
        .eb-journey .col{ border:1px solid var(--line); border-radius:16px; background:var(--elev); }
        .eb-journey .list-head{ padding:.9rem 1rem; border-bottom:1px solid var(--line); }
        .eb-journey .list-head-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem; }
        .eb-journey .list-head span{ font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); font-weight:700; }
        .eb-journey button{ font-family:inherit; cursor:pointer; }
        .eb-journey .btn{
          border:1px solid var(--line); background:transparent; color:var(--text);
          border-radius:10px; padding:.45rem .8rem; font-size:.8rem; font-weight:600;
          transition:background .18s ease, border-color .18s ease;
        }
        .eb-journey .btn:hover{ background:var(--accent-soft); border-color:var(--accent); }
        .eb-journey .btn.primary{ background:var(--text); border-color:var(--text); color:var(--bg); }
        .eb-journey .btn.primary:hover{ opacity:.88; }
        .eb-journey .btn.danger:hover{ background:rgba(192,138,138,.14); border-color:rgba(192,138,138,.4); color:#D8A0A0; }
        .eb-journey .btn.icon-btn{ padding:.45rem; display:flex; align-items:center; justify-content:center; }
        .eb-journey .search-wrap{ position:relative; }
        .eb-journey .search-wrap svg{ position:absolute; left:.6rem; top:50%; transform:translateY(-50%); color:var(--dim); }
        .eb-journey .search-input{
          width:100%; background:rgba(127,127,127,.06); border:1px solid var(--line); border-radius:9px;
          padding:.5rem .6rem .5rem 2rem; color:var(--text); font-size:.82rem; outline:none;
        }
        .eb-journey .search-input:focus{ border-color:var(--accent); }
        .eb-journey .list{ max-height:56vh; overflow:auto; padding:.5rem; }
        .eb-journey .item{
          width:100%; text-align:left; border:1px solid transparent; background:transparent; color:inherit;
          border-radius:12px; padding:.7rem .8rem; display:block; transition:background .18s ease;
        }
        .eb-journey .item:hover{ background:rgba(127,127,127,.08); }
        .eb-journey .item.active{ background:var(--accent-soft); border-color:var(--line); }
        .eb-journey .item .t{ font-weight:600; font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .eb-journey .item .m{ font-size:.72rem; color:var(--dim); margin-top:.25rem; font-family:'IBM Plex Mono',monospace; }
        .eb-journey .editor{ padding:1.25rem; display:flex; flex-direction:column; min-height:56vh; }
        .eb-journey .title-input{
          width:100%; background:transparent; border:none; outline:none; color:var(--text);
          font-family:'Newsreader',serif; font-size:1.5rem; font-weight:600;
        }
        .eb-journey .body-input{
          flex:1; width:100%; margin-top:1rem; background:transparent; border:none; outline:none;
          color:var(--text); font-size:.95rem; line-height:1.85rem; resize:none; min-height:32vh;
          background-image:repeating-linear-gradient(to bottom, transparent, transparent calc(1.85rem - 1px), var(--line) calc(1.85rem - 1px), var(--line) 1.85rem);
          background-attachment:local;
          padding-left:1rem; border-left:2px solid var(--line);
        }
        .eb-journey .gallery{ margin-top:1rem; }
        .eb-journey .gallery-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:.5rem; margin-top:.5rem; }
        .eb-journey .gallery-item{ position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; border:1px solid var(--line); cursor:pointer; }
        .eb-journey .gallery-item img{ width:100%; height:100%; object-fit:cover; }
        .eb-journey .gallery-remove{
          position:absolute; top:3px; right:3px; background:rgba(0,0,0,.6); border:none; border-radius:6px;
          color:#fff; padding:2px; display:flex; opacity:0; transition:opacity .15s ease;
        }
        .eb-journey .gallery-item:hover .gallery-remove{ opacity:1; }
        .eb-journey .add-photo{
          aspect-ratio:1; border-radius:10px; border:1.5px dashed var(--line); background:transparent;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.3rem;
          color:var(--dim); font-size:.65rem;
        }
        .eb-journey .add-photo:hover{ border-color:var(--accent); color:var(--accent); }
        .eb-journey .bar{ display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; padding-top:.9rem; margin-top:.9rem; border-top:1px solid var(--line); }
        .eb-journey .meta{ font-size:.74rem; color:var(--dim); font-family:'IBM Plex Mono',monospace; }
        .eb-journey .spacer{ flex:1; }
        .eb-journey .share-url{ font-size:.72rem; color:var(--accent); font-family:'IBM Plex Mono',monospace; word-break:break-all; }
        .eb-journey .empty{ padding:3rem 1.5rem; text-align:center; color:var(--dim); font-size:.9rem; }
        .eb-journey .err{ margin-top:1rem; padding:.7rem .9rem; border-radius:10px; border:1px solid rgba(192,138,138,.35); background:rgba(192,138,138,.10); color:#D8A0A0; font-size:.85rem; }
        .eb-journey .lightbox{ position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.88); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .eb-journey .lightbox img{ max-width:92vw; max-height:88vh; border-radius:8px; }
        .eb-journey .lightbox-close{ position:absolute; top:1rem; right:1rem; background:rgba(255,255,255,.1); border:none; border-radius:999px; padding:.5rem; color:#fff; }

        /* Full-screen gallery */
        .eb-journey .gallery-fullscreen{
          position:fixed; inset:0; z-index:220; background:var(--bg); display:flex; flex-direction:column;
        }
        .eb-journey .gallery-fs-head{
          display:flex; align-items:center; gap:.75rem; padding:1rem 1.25rem; border-bottom:1px solid var(--line);
          flex-wrap:wrap; flex-shrink:0; padding-top:calc(1rem + env(safe-area-inset-top));
        }
        .eb-journey .gallery-fs-title{ font-family:'Newsreader',serif; font-size:1.2rem; font-weight:600; }
        .eb-journey .gallery-fs-count{ font-size:.75rem; color:var(--dim); font-family:'IBM Plex Mono',monospace; }
        .eb-journey .size-toggle{ display:flex; gap:.25rem; padding:.2rem; border:1px solid var(--line); border-radius:9px; }
        .eb-journey .size-toggle button{
          width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:var(--dim);
          display:flex; align-items:center; justify-content:center;
        }
        .eb-journey .size-toggle button.on{ background:var(--accent-soft); color:var(--accent); }
        .eb-journey .gallery-fs-body{ flex:1; overflow-y:auto; padding:1.25rem; }
        .eb-journey .gallery-fs-grid{ display:grid; gap:.6rem; }
        .eb-journey .gallery-fs-item{ position:relative; border-radius:10px; overflow:hidden; border:1px solid var(--line); cursor:pointer; }
        .eb-journey .gallery-fs-item img{ width:100%; aspect-ratio:1; object-fit:cover; display:block; }
        .eb-journey .gallery-fs-caption{
          position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,.75), transparent);
          padding:.5rem .5rem .35rem; font-size:.66rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          opacity:0; transition:opacity .15s ease;
        }
        .eb-journey .gallery-fs-item:hover .gallery-fs-caption{ opacity:1; }
        @media (max-width:880px){ .eb-journey .layout{ grid-template-columns:1fr; } .eb-journey .list{ max-height:240px; } }
      `}</style>

      <div className="inner">
        <h1>Journey</h1>
        <p className="sub">
          Your trading notebook — plans, post-mortems, chart screenshots, and the running story behind the numbers.
          Everything saves automatically as you type.
        </p>

        {error && <div className="err">{error}</div>}

        <div className="layout">
          <div className="col">
            <div className="list-head">
              <div className="list-head-top">
                <span>Entries</span>
                <div style={{ display: "flex", gap: ".4rem" }}>
                  <button className="btn icon-btn" onClick={openGallery} title="View all photos" aria-label="View all photos">
                    <Images size={14} />
                  </button>
                  <button className="btn primary" onClick={createEntry}>+ New</button>
                </div>
              </div>
              <div className="search-wrap">
                <Search size={13} />
                <input className="search-input" placeholder="Search entries…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="list">
              {loading ? (
                <div className="empty">Loading…</div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty">{search ? "No entries match your search." : "No entries yet. Start your first one."}</div>
              ) : (
                filteredEntries.map((e) => (
                  <button key={e.id} className={`item ${e.id === activeId ? "active" : ""}`} onClick={() => selectEntry(e)}>
                    <div className="t">{e.title || "Untitled Entry"}</div>
                    <div className="m">{timeAgo(e.updated_at)}{e.is_shared ? " · shared" : ""}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="col">
            {!active ? (
              <div className="empty">Select an entry, or create a new one to begin writing.</div>
            ) : (
              <div className="editor">
                <input
                  className="title-input"
                  value={title}
                  aria-label="Entry title"
                  placeholder="Untitled Entry"
                  onChange={(ev) => { setTitle(ev.target.value); queueSave({ title: ev.target.value || "Untitled Entry" }); }}
                />

                <textarea
                  className="body-input"
                  value={content}
                  aria-label="Entry content"
                  placeholder="What happened today? What did you see, feel, and decide?"
                  onChange={(ev) => { setContent(ev.target.value); queueSave({ content: ev.target.value }); }}
                />

                <div className="gallery">
                  <div className="gallery-grid">
                    {images.map((img) => (
                      <div key={img.id} className="gallery-item" onClick={() => setLightbox(img.url)}>
                        <img src={img.url} alt="" loading="lazy" />
                        <button className="gallery-remove" onClick={(e) => { e.stopPropagation(); removeImage(img); }} aria-label="Remove image">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <button className="add-photo" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                      {uploading ? "Uploading…" : "Add photo"}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }}
                  />
                </div>

                <div className="bar">
                  <span className="meta">
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : `${words} words`}
                  </span>
                  <span className="meta">Updated {timeAgo(active.updated_at)}</span>
                  <span className="spacer" />
                  <button className="btn" onClick={toggleShare}>{active.is_shared ? "Make private" : "Share entry"}</button>
                  <button className="btn danger" onClick={() => deleteEntry(active.id)}>Delete</button>
                </div>
                {shareUrl && <div className="share-url" style={{ marginTop: ".6rem" }}>{shareUrl}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close">
            <X size={18} />
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {galleryOpen && (
        <div className="gallery-fullscreen">
          <div className="gallery-fs-head">
            <span className="gallery-fs-title">All Photos</span>
            <span className="gallery-fs-count">{galleryImages.length}</span>
            <span className="spacer" />
            <div className="size-toggle">
              {(["sm", "md", "lg"] as const).map((s) => (
                <button key={s} className={tileSize === s ? "on" : ""} onClick={() => setTileSize(s)} title={`${s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"} thumbnails`}>
                  <div style={{ width: s === "sm" ? 8 : s === "md" ? 11 : 14, height: s === "sm" ? 8 : s === "md" ? 11 : 14, border: "1.5px solid currentColor", borderRadius: 2 }} />
                </button>
              ))}
            </div>
            <button className="btn icon-btn" onClick={() => galleryFileInputRef.current?.click()} disabled={galleryUploading} title="Add photo">
              {galleryUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </button>
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleGalleryUpload(e.target.files[0]); e.target.value = ""; }}
            />
            <button className="btn icon-btn" onClick={() => setGalleryOpen(false)} aria-label="Close gallery">
              <X size={16} />
            </button>
          </div>
          <div className="gallery-fs-body">
            {galleryLoading ? (
              <div className="empty">Loading your photo history…</div>
            ) : galleryImages.length === 0 ? (
              <div className="empty">No photos yet — add one here, or from any entry, and it'll show up in this gallery.</div>
            ) : (
              <div className="gallery-fs-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_SIZES[tileSize]}px, 1fr))` }}>
                {galleryImages.map((img) => (
                  <div key={img.id} className="gallery-fs-item" onClick={() => setLightbox(img.url)}>
                    <img src={img.url} alt="" loading="lazy" />
                    <button
                      className="gallery-fs-caption"
                      onClick={(e) => { e.stopPropagation(); jumpToEntryFromGallery(img.entryId); }}
                      style={{ border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                      title="Go to entry"
                    >
                      {img.entryTitle}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
