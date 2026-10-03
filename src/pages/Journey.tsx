import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Image as ImageIcon, Images, X, Search, Loader2, Upload,
  Check, Trash2, FolderInput, ZoomOut, ZoomIn, Folder, FolderPlus, ChevronLeft, ChevronRight,
} from "lucide-react";

type Entry = {
  id: string;
  title: string;
  content: string;
  is_shared: boolean;
  share_token: string | null;
  updated_at: string;
  raw_import_data?: Record<string, string> | null;
};

type JournalImage = { id: string; storage_path: string; url: string; album: string | null };
type GalleryImage = JournalImage & { entryId: string; entryTitle: string };

const GALLERY_ENTRY_TITLE = "Photos";
const MIN_TILE = 70;
const MAX_TILE = 260;

const ALBUMS: { key: string; label: string }[] = [
  { key: "mt5", label: "MT5" },
  { key: "charts", label: "Charts" },
  { key: "entry", label: "Entry" },
  { key: "exit", label: "Exit" },
  { key: "post_trade_analysis", label: "Post-Trade Analysis" },
  { key: "general", label: "General" },
];

function albumKeyOf(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function prettifyAlbum(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function touchDist(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

const ImportedDataBlock = ({ raw }: { raw: Record<string, string> | null | undefined }) => {
  const [open, setOpen] = useState(false);
  if (!raw || typeof raw !== 'object') return null;
  const entries = Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '.9rem' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '.76rem', cursor: 'pointer', padding: 0 }}
      >
        From your CSV import — all original columns ({entries.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: '.7rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem' }}>
          {entries.map(([key, value]) => (
            <div key={key} style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--dim)', fontWeight: 700 }}>{key}</div>
              <div style={{ fontSize: '.82rem', marginTop: '.2rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [uploadAlbum, setUploadAlbum] = useState("entry");
  const [viewer, setViewer] = useState<{ items: { url: string; title?: string; sub?: string }[]; index: number } | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const viewerTrack = useRef<HTMLDivElement>(null);
  const viewerThumbs = useRef<HTMLDivElement>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const openViewer = (items: { url: string; title?: string; sub?: string }[], index: number) => {
    setChromeHidden(false); setZoomed(false); setViewer({ items, index });
  };
  const closeViewer = () => setViewer(null);
  const goTo = (i: number) => {
    const el = viewerTrack.current;
    if (!el || !viewer) return;
    const n = Math.max(0, Math.min(viewer.items.length - 1, i));
    setZoomed(false);
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onViewerScroll = () => {
    const el = viewerTrack.current;
    if (!el || !viewer) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== viewer.index) { setViewer((v) => (v ? { ...v, index: i } : v)); setZoomed(false); }
  };
  const onSlideTap = () => {
    if (tapTimer.current) {            // second tap within the window = zoom toggle
      window.clearTimeout(tapTimer.current); tapTimer.current = undefined; setZoomed((z) => !z); return;
    }
    tapTimer.current = window.setTimeout(() => { tapTimer.current = undefined; setChromeHidden((h) => !h); }, 240);
  };
  // jump to the tapped photo when the viewer opens
  const viewerOpen = viewer !== null;
  useLayoutEffect(() => {
    const el = viewerTrack.current;
    if (el && viewer) el.scrollTo({ left: viewer.index * el.clientWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen]);
  // keep the active thumbnail centered in the filmstrip
  useEffect(() => {
    const c = viewerThumbs.current;
    if (!c || !viewer) return;
    const t = c.children[viewer.index] as HTMLElement | undefined;
    if (t) c.scrollTo({ left: t.offsetLeft - (c.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
  }, [viewer?.index, viewerOpen]);
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") goTo((viewer?.index ?? 0) - 1);
      if (e.key === "ArrowRight") goTo((viewer?.index ?? 0) + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, viewer?.index]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [tilePx, setTilePx] = useState(140);
  const [activeAlbum, setActiveAlbum] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [galleryView, setGalleryView] = useState<"photos" | "folders">("photos");
  const [customAlbums, setCustomAlbums] = useState<string[]>([]);
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const albumsStorageKey = user ? `eb_albums_${user.id}` : null;
  useEffect(() => {
    if (!albumsStorageKey) return;
    try { setCustomAlbums(JSON.parse(localStorage.getItem(albumsStorageKey) || "[]")); } catch { setCustomAlbums([]); }
  }, [albumsStorageKey]);
  const saveCustomAlbums = (next: string[]) => {
    setCustomAlbums(next);
    if (albumsStorageKey) { try { localStorage.setItem(albumsStorageKey, JSON.stringify(next)); } catch { /* storage unavailable */ } }
  };
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const pinchDist = useRef<number | null>(null);
  const pinchStartTile = useRef(140);

  const active = entries.find((e) => e.id === activeId) ?? null;

  const load = useCallback(async (selectId?: string) => {
    const { data, error: err } = await supabase
      .from("journal_entries")
      .select("id, title, content, is_shared, share_token, updated_at, raw_import_data")
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
    const { data } = await supabase.from("journal_images").select("id, storage_path, album").eq("entry_id", entryId);
    if (!data) { setImages([]); return; }
    const withUrls = await Promise.all(
      data.map(async (img) => {
        const { data: signed } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
        return { id: img.id, storage_path: img.storage_path, url: signed?.signedUrl ?? "", album: img.album };
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
      .select("id, title, content, is_shared, share_token, updated_at, raw_import_data")
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
    const { error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: activeId, storage_path: path, album: uploadAlbum });
    setUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    loadImages(activeId);
  };

  const handleMultiEntryUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      await handleUpload(file);
    }
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
    setSelectMode(false);
    setSelectedIds(new Set());
    const { data } = await supabase
      .from("journal_images")
      .select("id, storage_path, album, entry_id, journal_entries(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!data) { setGalleryImages([]); setGalleryLoading(false); return; }
    const withUrls = await Promise.all(
      data.map(async (img: any) => {
        const { data: signed } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
        return {
          id: img.id, storage_path: img.storage_path, url: signed?.signedUrl ?? "", album: img.album,
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
      .select("id, title, content, is_shared, share_token, updated_at, raw_import_data")
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
    const album = activeAlbum === "all" ? "general" : activeAlbum;
    const { error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: entryId, storage_path: path, album });
    setGalleryUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    openGallery();
    if (activeId === entryId) loadImages(entryId);
  };

  const handleMultiUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      await handleGalleryUpload(file);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const toDelete = galleryImages.filter((img) => selectedIds.has(img.id));
    if (toDelete.length === 0) return;
    await Promise.all(toDelete.map((img) => supabase.storage.from("journal-images").remove([img.storage_path])));
    await supabase.from("journal_images").delete().in("id", Array.from(selectedIds));
    setGalleryImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
    toast.success(`${toDelete.length} photo${toDelete.length === 1 ? "" : "s"} deleted`);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const moveSelectedToAlbum = async (album: string) => {
    await supabase.from("journal_images").update({ album }).in("id", Array.from(selectedIds));
    setGalleryImages((prev) => prev.map((img) => (selectedIds.has(img.id) ? { ...img, album } : img)));
    toast.success(`Moved to ${labelFor(album)}`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setMoveMenuOpen(false);
  };

  const onGalleryTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchDist.current = touchDist(e.touches);
      pinchStartTile.current = tilePx;
    }
  };
  const onGalleryTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist.current) {
      e.preventDefault();
      const scale = touchDist(e.touches) / pinchDist.current;
      setTilePx(Math.min(MAX_TILE, Math.max(MIN_TILE, Math.round(pinchStartTile.current * scale))));
    }
  };
  const onGalleryTouchEnd = () => { pinchDist.current = null; };

  const shareUrl = active?.is_shared && active.share_token ? `${window.location.origin}/journal/${active.share_token}` : null;
  const words = wordCount(content);
  const filteredEntries = entries.filter((e) =>
    !search.trim() || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
  );
  const allAlbums: { key: string; label: string }[] = [...ALBUMS];
  customAlbums.forEach((label) => { const k = albumKeyOf(label); if (k && !allAlbums.some((a) => a.key === k)) allAlbums.push({ key: k, label }); });
  galleryImages.forEach((img) => { const k = img.album ?? "general"; if (!allAlbums.some((a) => a.key === k)) allAlbums.push({ key: k, label: prettifyAlbum(k) }); });
  const labelFor = (key: string | null) => allAlbums.find((a) => a.key === (key ?? "general"))?.label ?? "General";
  const createAlbum = () => {
    const label = newAlbumName.trim();
    const k = albumKeyOf(label);
    if (!label || !k) return;
    if (allAlbums.some((a) => a.key === k)) { toast.error("That album already exists"); return; }
    saveCustomAlbums([...customAlbums, label]);
    setNewAlbumName(""); setNewAlbumOpen(false);
    toast.success(`Album "${label}" created`);
  };
  const deleteAlbum = (label: string) => saveCustomAlbums(customAlbums.filter((l) => l !== label));
  const visibleGalleryImages = activeAlbum === "all" ? galleryImages : galleryImages.filter((img) => (img.album ?? "general") === activeAlbum);

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
          transition:background .18s cubic-bezier(0.22,1,0.36,1), border-color .18s cubic-bezier(0.22,1,0.36,1);
        }
        .eb-journey .btn:hover{ background:var(--accent-soft); border-color:var(--accent); }
        .eb-journey .btn.primary{ background:var(--text); border-color:var(--text); color:var(--bg); }
        .eb-journey .btn.primary:hover{ opacity:.88; }
        .eb-journey .btn.danger{ color:#D8A0A0; border-color:rgba(192,138,138,.35); }
        .eb-journey .btn.danger:hover{ background:rgba(192,138,138,.14); border-color:rgba(192,138,138,.4); }
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
          border-radius:12px; padding:.7rem .8rem; display:block; transition:background .18s cubic-bezier(0.22,1,0.36,1);
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
        .eb-journey .gallery-head-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:.4rem; }
        .eb-journey .album-select{
          background:transparent; border:1px solid var(--line); border-radius:8px; padding:.3rem .5rem;
          font-size:.72rem; color:var(--dim); outline:none;
        }
        .eb-journey .gallery-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:.5rem; }
        .eb-journey .gallery-item{ position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; border:1px solid var(--line); cursor:pointer; }
        .eb-journey .gallery-item img{ width:100%; height:100%; object-fit:cover; }
        .eb-journey .gallery-remove{
          position:absolute; top:3px; right:3px; background:rgba(0,0,0,.6); border:none; border-radius:6px;
          color:#fff; padding:2px; display:flex; opacity:0; transition:opacity .15s cubic-bezier(0.22,1,0.36,1);
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
        .eb-journey .gallery-fullscreen{ position:fixed; inset:0; z-index:220; background:var(--bg); display:flex; flex-direction:column; }
        .eb-journey .gallery-fs-head{
          display:flex; align-items:center; gap:.6rem; padding:1rem 1.25rem; border-bottom:1px solid var(--line);
          flex-wrap:wrap; flex-shrink:0; padding-top:calc(1rem + env(safe-area-inset-top));
        }
        .eb-journey .gallery-fs-title{ font-family:'Newsreader',serif; font-size:1.2rem; font-weight:600; }
        .eb-journey .gallery-fs-count{ font-size:.75rem; color:var(--dim); font-family:'IBM Plex Mono',monospace; }
        .eb-journey .zoom-row{ display:flex; align-items:center; gap:.4rem; color:var(--dim); }
        .eb-journey .zoom-row input[type="range"]{ width:90px; accent-color:var(--accent); }
        .eb-journey .album-tabs{ display:flex; gap:.4rem; overflow-x:auto; padding:.7rem 1.25rem 0; flex-shrink:0; }
        .eb-journey .album-tab{
          flex-shrink:0; border:1px solid var(--line); background:transparent; border-radius:999px;
          padding:.35rem .8rem; font-size:.75rem; color:var(--dim); white-space:nowrap;
        }
        .eb-journey .album-tab.on{ background:var(--text); border-color:var(--text); color:var(--bg); font-weight:600; }
        .eb-journey .gallery-fs-body{ flex:1; overflow-y:auto; padding:1.25rem; touch-action:pan-y; }
        .eb-journey .gallery-fs-grid{ display:grid; gap:.5rem; }
        .eb-journey .gallery-fs-item{ position:relative; border-radius:10px; overflow:hidden; border:1px solid var(--line); cursor:pointer; }
        .eb-journey .gallery-fs-item img{ width:100%; aspect-ratio:1; object-fit:cover; display:block; }
        .eb-journey .gallery-fs-caption{
          position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,.75), transparent);
          padding:.5rem .5rem .35rem; font-size:.64rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          opacity:0; transition:opacity .15s cubic-bezier(0.22,1,0.36,1); border:none; width:100%; text-align:left;
        }
        .eb-journey .gallery-fs-item:hover .gallery-fs-caption{ opacity:1; }
        .eb-journey .select-check{
          position:absolute; top:6px; left:6px; width:22px; height:22px; border-radius:50%;
          border:2px solid rgba(255,255,255,.8); background:rgba(0,0,0,.3);
          display:flex; align-items:center; justify-content:center; z-index:2;
        }
        .eb-journey .select-check.on{ background:var(--accent); border-color:var(--accent); }
        .eb-journey .gallery-fs-item.selected img{ opacity:.6; }
        .eb-journey .select-bar{
          display:flex; align-items:center; gap:.5rem; padding:.7rem 1.25rem; border-top:1px solid var(--line);
          flex-shrink:0; flex-wrap:wrap;
        }
        .eb-journey .move-menu{ position:relative; }
        .eb-journey .move-menu-list{
          position:absolute; bottom:calc(100% + 6px); left:0; background:var(--elev); border:1px solid var(--line);
          border-radius:10px; padding:.35rem; min-width:170px; box-shadow:0 12px 28px rgba(0,0,0,.3); z-index:10;
        }
        .eb-journey .move-menu-item{
          display:block; width:100%; text-align:left; padding:.5rem .6rem; border-radius:7px; border:none;
          background:transparent; font-size:.8rem; color:var(--text);
        }
        .eb-journey .move-menu-item:hover{ background:var(--accent-soft); }
        @media (max-width:880px){ .eb-journey .layout{ grid-template-columns:1fr; } .eb-journey .list{ max-height:240px; } }

        /* ---- Folders (albums) ---- */
        .eb-journey .view-seg{ display:inline-flex; margin:.7rem 1.25rem 0; background:var(--elev); border:1px solid var(--line); border-radius:12px; padding:3px; gap:2px; align-self:flex-start; }
        .eb-journey .view-seg button{ border:0; background:transparent; color:var(--dim); font:600 .82rem inherit; padding:.42rem .9rem; border-radius:9px; display:inline-flex; align-items:center; gap:.4rem; cursor:pointer; }
        .eb-journey .view-seg button.on{ background:var(--text); color:var(--bg); }
        .eb-journey .folder-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; }
        .eb-journey .folder-card{ position:relative; border:1px solid var(--line); background:var(--elev); border-radius:22px; padding:12px; text-align:left; cursor:pointer; color:var(--text); box-shadow:0 1px 2px rgba(20,24,40,.08), 0 14px 28px -16px rgba(20,24,40,.35); transition:transform .25s cubic-bezier(.2,.8,.2,1); outline:none; }
        .eb-journey .folder-card:active{ transform:scale(.97); }
        .eb-journey .folder-card:focus-visible{ box-shadow:0 0 0 3px var(--accent-soft); }
        .eb-journey .folder-art{ position:relative; height:104px; border-radius:16px; overflow:hidden; background:linear-gradient(145deg,var(--f1,#6A55F1),var(--f2,#9B7BFF)); display:flex; align-items:center; justify-content:center; }
        .eb-journey .folder-art::before{ content:''; position:absolute; inset:-25%; background:radial-gradient(circle at 25% 15%, rgba(255,255,255,.42), transparent 55%); filter:blur(14px); }
        .eb-journey .folder-card[data-hue="0"]{ --f1:#6A55F1; --f2:#9B7BFF; }
        .eb-journey .folder-card[data-hue="1"]{ --f1:#2FBF5B; --f2:#34D6B0; }
        .eb-journey .folder-card[data-hue="2"]{ --f1:#FF9F0A; --f2:#FF6B35; }
        .eb-journey .folder-card[data-hue="3"]{ --f1:#FF3B30; --f2:#FF6B8B; }
        .eb-journey .folder-card[data-hue="4"]{ --f1:#0A84FF; --f2:#5AC8FA; }
        .eb-journey .folder-card[data-hue="5"]{ --f1:#BF5AF2; --f2:#FF6BD6; }
        .eb-journey .folder-thumb{ position:absolute; width:56%; height:72%; object-fit:cover; border-radius:10px; border:2px solid rgba(255,255,255,.92); box-shadow:0 8px 16px -6px rgba(0,0,0,.45); }
        .eb-journey .folder-thumb.t0{ left:9%; top:14%; transform:rotate(-7deg); }
        .eb-journey .folder-thumb.t1{ left:29%; top:9%; transform:rotate(1deg); }
        .eb-journey .folder-thumb.t2{ right:7%; top:16%; transform:rotate(8deg); }
        .eb-journey .folder-glyph{ position:absolute; left:8px; bottom:8px; width:28px; height:28px; border-radius:9px; background:rgba(255,255,255,.28); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:grid; place-items:center; color:#fff; z-index:2; }
        .eb-journey .folder-meta{ padding:10px 4px 2px; display:flex; flex-direction:column; }
        .eb-journey .folder-meta b{ font-size:.95rem; font-weight:700; letter-spacing:-.01em; }
        .eb-journey .folder-meta span{ font-size:.78rem; color:var(--dim); }
        .eb-journey .folder-new .folder-art{ background:transparent; border:2px dashed var(--line); color:var(--dim); }
        .eb-journey .folder-new .folder-art::before{ display:none; }
        .eb-journey .folder-del{ position:absolute; top:18px; right:18px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,.5); color:#fff; display:grid; place-items:center; z-index:3; }
        .eb-journey .album-modal{ position:absolute; inset:0; z-index:60; background:rgba(0,0,0,.45); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:flex-end; justify-content:center; }
        .eb-journey .album-sheet{ width:100%; max-width:460px; background:var(--elev); border-radius:28px 28px 0 0; padding:12px 18px calc(22px + env(safe-area-inset-bottom,0px)); border:1px solid var(--line); animation:sheetUp .3s cubic-bezier(.2,.8,.2,1); }
        .eb-journey .sheet-grab{ width:38px; height:5px; border-radius:9px; background:var(--line); margin:0 auto 14px; }
        .eb-journey .album-sheet h3{ margin:0 0 12px; font-size:1.15rem; font-weight:700; letter-spacing:-.02em; }
        .eb-journey .album-sheet input{ width:100%; background:transparent; color:var(--text); border:1px solid var(--line); border-radius:14px; padding:.8rem .9rem; font-size:16px; outline:none; }
        .eb-journey .album-sheet input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
        .eb-journey .album-sheet-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:14px; }
        .eb-journey .btn.primary{ background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
        .eb-journey .btn.primary:disabled{ opacity:.45; }
        @keyframes sheetUp{ from{ transform:translateY(40px); opacity:0; } }
        @media (min-width:768px){ .eb-journey .album-modal{ align-items:center; } .eb-journey .album-sheet{ border-radius:24px; } }

        /* ---- iOS phone layer: same palette as the rest of Edge Blast ---- */
        @media (max-width:767px){
          html .eb-journey, html.light .eb-journey{
            --bg:hsl(var(--background)); --elev:hsl(var(--card)); --accent:hsl(var(--primary)); --accent-soft:hsl(var(--primary) / .15);
            --text:hsl(var(--foreground)); --dim:hsl(var(--muted-foreground)); --line:hsl(var(--border));
            font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',system-ui,sans-serif;
            padding:1rem .95rem 2rem;
          }
          .eb-journey .gallery-fs-head, .eb-journey .gallery-fs-body, .eb-journey .album-tabs{ padding-left:1rem; padding-right:1rem; }
          .eb-journey .view-seg{ margin:.7rem 1rem 0; align-self:stretch; }
          .eb-journey .view-seg button{ flex:1; justify-content:center; min-height:36px; }
          .eb-journey .album-tab{ border-radius:999px; min-height:34px; }
          .eb-journey .folder-grid{ grid-template-columns:1fr 1fr; gap:12px; }
          .eb-journey .gallery-fs-title{ font-size:1.5rem; font-weight:800; letter-spacing:-.03em; }
        }
      
        /* ---- iOS Photos-style viewer: swipe left/right, filmstrip, tap to hide chrome, double-tap zoom ---- */
        .eb-journey .photo-viewer{ position:fixed; inset:0; z-index:300; background:#000; color:#fff; display:flex; flex-direction:column; animation:pvIn .28s cubic-bezier(.2,.8,.2,1); }
        @keyframes pvIn{ from{ opacity:0; transform:scale(.98); } }
        .eb-journey .pv-top{ position:absolute; top:0; left:0; right:0; z-index:5; display:flex; align-items:center; gap:10px; padding:calc(10px + env(safe-area-inset-top,0px)) 14px 12px; background:linear-gradient(to bottom, rgba(0,0,0,.65), transparent); transition:opacity .25s, transform .25s; }
        .eb-journey .pv-done{ border:0; background:rgba(255,255,255,.18); color:#fff; font:600 .95rem inherit; padding:.45rem .95rem; border-radius:999px; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); cursor:pointer; min-height:36px; }
        .eb-journey .pv-title{ flex:1; text-align:center; display:flex; flex-direction:column; min-width:0; }
        .eb-journey .pv-title b{ font-size:.95rem; font-weight:700; }
        .eb-journey .pv-title span{ font-size:.74rem; color:rgba(255,255,255,.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .eb-journey .pv-spacer{ width:64px; }
        .eb-journey .pv-track{ flex:1; display:flex; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; overscroll-behavior-x:contain; }
        .eb-journey .pv-track::-webkit-scrollbar{ display:none; }
        .eb-journey .pv-slide{ flex:0 0 100%; width:100%; height:100%; scroll-snap-align:center; scroll-snap-stop:always; display:flex; align-items:center; justify-content:center; padding:0; overflow:hidden; }
        .eb-journey .pv-slide img{ max-width:100%; max-height:100%; object-fit:contain; user-select:none; -webkit-user-select:none; transition:transform .3s cubic-bezier(.2,.8,.2,1); }
        .eb-journey .pv-slide.zoomed{ overflow:auto; align-items:flex-start; justify-content:flex-start; touch-action:pan-x pan-y; }
        .eb-journey .pv-slide.zoomed img{ max-width:none; max-height:none; width:230%; height:auto; }
        .eb-journey .pv-nav{ position:absolute; top:50%; transform:translateY(-50%); z-index:5; width:42px; height:42px; border-radius:50%; border:0; background:rgba(255,255,255,.16); color:#fff; display:none; place-items:center; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); cursor:pointer; transition:opacity .25s; }
        .eb-journey .pv-nav.prev{ left:14px; } .eb-journey .pv-nav.next{ right:14px; }
        .eb-journey .pv-nav:disabled{ opacity:.25; cursor:default; }
        @media (min-width:768px){ .eb-journey .pv-nav{ display:grid; } }
        .eb-journey .pv-strip{ display:flex; gap:6px; overflow-x:auto; padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px)); background:linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,.35)); scrollbar-width:none; align-items:center; transition:opacity .25s, transform .25s; -webkit-overflow-scrolling:touch; }
        .eb-journey .pv-strip::-webkit-scrollbar{ display:none; }
        .eb-journey .pv-thumb{ flex:0 0 auto; width:38px; height:52px; border:0; padding:0; border-radius:7px; overflow:hidden; opacity:.55; cursor:pointer; background:#222; transition:width .3s cubic-bezier(.2,.8,.2,1), opacity .25s, box-shadow .25s; }
        .eb-journey .pv-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
        .eb-journey .pv-thumb.on{ width:56px; opacity:1; box-shadow:0 0 0 2px #fff; }
        .eb-journey .photo-viewer.chrome-off .pv-top{ opacity:0; transform:translateY(-12px); pointer-events:none; }
        .eb-journey .photo-viewer.chrome-off .pv-strip{ opacity:0; transform:translateY(12px); pointer-events:none; }
        .eb-journey .photo-viewer.chrome-off .pv-nav{ opacity:0; pointer-events:none; }
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
                  <div className="gallery-head-row">
                    <span className="meta">Photos</span>
                    <select className="album-select" value={uploadAlbum} onChange={(e) => setUploadAlbum(e.target.value)} title="New photos go to this album">
                      {allAlbums.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="gallery-grid">
                    {images.map((img, idx) => (
                      <div key={img.id} className="gallery-item" onClick={() => openViewer(images.map((x) => ({ url: x.url, title: active?.title || "Entry", sub: labelFor(x.album) })), idx)}>
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
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.length) handleMultiEntryUpload(e.target.files); e.target.value = ""; }}
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
                <ImportedDataBlock raw={active.raw_import_data} />
              </div>
            )}
          </div>
        </div>
      </div>

      {viewer && (
        <div className={`photo-viewer ${chromeHidden ? "chrome-off" : ""}`} role="dialog" aria-modal="true" aria-label="Photo viewer">
          <div className="pv-top">
            <button className="pv-done" onClick={closeViewer}>Done</button>
            <div className="pv-title">
              <b>{viewer.index + 1} of {viewer.items.length}</b>
              <span>{viewer.items[viewer.index]?.sub ? `${viewer.items[viewer.index]?.sub} · ` : ""}{viewer.items[viewer.index]?.title ?? ""}</span>
            </div>
            <span className="pv-spacer" />
          </div>

          <div className="pv-track" ref={viewerTrack} onScroll={onViewerScroll}>
            {viewer.items.map((it, i) => (
              <div key={`${it.url}-${i}`} className={`pv-slide ${zoomed && i === viewer.index ? "zoomed" : ""}`} onClick={onSlideTap}>
                <img src={it.url} alt="" draggable={false} />
              </div>
            ))}
          </div>

          {viewer.items.length > 1 && (
            <>
              <button className="pv-nav prev" onClick={() => goTo(viewer.index - 1)} disabled={viewer.index === 0} aria-label="Previous photo"><ChevronLeft size={22} /></button>
              <button className="pv-nav next" onClick={() => goTo(viewer.index + 1)} disabled={viewer.index === viewer.items.length - 1} aria-label="Next photo"><ChevronRight size={22} /></button>
            </>
          )}

          <div className="pv-strip" ref={viewerThumbs}>
            {viewer.items.map((it, i) => (
              <button key={`${it.url}-t${i}`} className={`pv-thumb ${i === viewer.index ? "on" : ""}`} onClick={() => goTo(i)} aria-label={`Photo ${i + 1}`}>
                <img src={it.url} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}

      {galleryOpen && (
        <div className="gallery-fullscreen">
          <div className="gallery-fs-head">
            <span className="gallery-fs-title">{galleryView === "folders" ? "Albums" : "All Photos"}</span>
            <span className="gallery-fs-count">{visibleGalleryImages.length}</span>
            <span className="spacer" />
            <div className="zoom-row">
              <ZoomOut size={14} />
              <input
                type="range" min={MIN_TILE} max={MAX_TILE} value={tilePx}
                onChange={(e) => setTilePx(Number(e.target.value))}
                aria-label="Thumbnail size"
              />
              <ZoomIn size={14} />
            </div>
            <button
              className="btn"
              onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            <button className="btn icon-btn" onClick={() => galleryFileInputRef.current?.click()} disabled={galleryUploading} title="Add photos">
              {galleryUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </button>
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.length) handleMultiUpload(e.target.files); e.target.value = ""; }}
            />
            <button className="btn icon-btn" onClick={() => setGalleryOpen(false)} aria-label="Close gallery">
              <X size={16} />
            </button>
          </div>

          <div className="view-seg" role="tablist" aria-label="Gallery view">
            <button role="tab" aria-selected={galleryView === "photos"} className={galleryView === "photos" ? "on" : ""} onClick={() => setGalleryView("photos")}><Images size={14} /> Photos</button>
            <button role="tab" aria-selected={galleryView === "folders"} className={galleryView === "folders" ? "on" : ""} onClick={() => setGalleryView("folders")}><Folder size={14} /> Folders</button>
          </div>

          <div className="album-tabs" style={galleryView === "folders" ? { display: "none" } : undefined}>
            <button className={`album-tab ${activeAlbum === "all" ? "on" : ""}`} onClick={() => setActiveAlbum("all")}>All Photos</button>
            {allAlbums.map((a) => (
              <button key={a.key} className={`album-tab ${activeAlbum === a.key ? "on" : ""}`} onClick={() => setActiveAlbum(a.key)}>
                {a.label}
              </button>
            ))}
          </div>

          <div
            className="gallery-fs-body"
            style={galleryView === "folders" ? { display: "none" } : undefined}
            onTouchStart={onGalleryTouchStart}
            onTouchMove={onGalleryTouchMove}
            onTouchEnd={onGalleryTouchEnd}
          >
            {galleryLoading ? (
              <div className="empty">Loading your photo history…</div>
            ) : visibleGalleryImages.length === 0 ? (
              <div className="empty">No photos in this album yet.</div>
            ) : (
              <div className="gallery-fs-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tilePx}px, 1fr))` }}>
                {visibleGalleryImages.map((img, idx) => {
                  const isSelected = selectedIds.has(img.id);
                  return (
                    <div
                      key={img.id}
                      className={`gallery-fs-item ${isSelected ? "selected" : ""}`}
                      onClick={() => (selectMode ? toggleSelect(img.id) : openViewer(visibleGalleryImages.map((x) => ({ url: x.url, title: x.entryTitle, sub: labelFor(x.album) })), idx))}
                    >
                      {selectMode && (
                        <div className={`select-check ${isSelected ? "on" : ""}`}>
                          {isSelected && <Check size={13} color="#fff" />}
                        </div>
                      )}
                      <img src={img.url} alt="" loading="lazy" />
                      {!selectMode && (
                        <button
                          className="gallery-fs-caption"
                          onClick={(e) => { e.stopPropagation(); jumpToEntryFromGallery(img.entryId); }}
                          title="Go to entry"
                        >
                          {img.entryTitle}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {galleryView === "folders" && (
            <div className="gallery-fs-body">
              <div className="folder-grid">
                {allAlbums.map((a, i) => {
                  const imgs = galleryImages.filter((img) => (img.album ?? "general") === a.key);
                  const isCustom = customAlbums.some((l) => albumKeyOf(l) === a.key);
                  return (
                    <div
                      key={a.key} role="button" tabIndex={0} className="folder-card" data-hue={i % 6}
                      onClick={() => { setActiveAlbum(a.key); setGalleryView("photos"); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { setActiveAlbum(a.key); setGalleryView("photos"); } }}
                    >
                      <div className="folder-art">
                        {imgs.slice(0, 3).map((im, n) => <img key={im.id} src={im.url} alt="" className={`folder-thumb t${n}`} loading="lazy" />)}
                        <span className="folder-glyph"><Folder size={16} /></span>
                      </div>
                      <div className="folder-meta"><b>{a.label}</b><span>{imgs.length} photo{imgs.length === 1 ? "" : "s"}</span></div>
                      {isCustom && imgs.length === 0 && (
                        <span className="folder-del" role="button" aria-label="Delete album" onClick={(e) => { e.stopPropagation(); deleteAlbum(customAlbums.find((l) => albumKeyOf(l) === a.key) ?? a.label); }}><X size={12} /></span>
                      )}
                    </div>
                  );
                })}
                <div role="button" tabIndex={0} className="folder-card folder-new" onClick={() => setNewAlbumOpen(true)} onKeyDown={(e) => { if (e.key === "Enter") setNewAlbumOpen(true); }}>
                  <div className="folder-art"><FolderPlus size={28} /></div>
                  <div className="folder-meta"><b>New album</b><span>Create a folder</span></div>
                </div>
              </div>
            </div>
          )}

          {selectMode && selectedIds.size > 0 && (
            <div className="select-bar">
              <span className="meta">{selectedIds.size} selected</span>
              <span className="spacer" />
              <div className="move-menu">
                {moveMenuOpen && (
                  <div className="move-menu-list">
                    {allAlbums.map((a) => (
                      <button key={a.key} className="move-menu-item" onClick={() => moveSelectedToAlbum(a.key)}>{a.label}</button>
                    ))}
                  </div>
                )}
                <button className="btn" onClick={() => setMoveMenuOpen((v) => !v)}>
                  <FolderInput size={13} style={{ marginRight: 5, display: "inline" }} /> Move to album
                </button>
              </div>
              <button className="btn danger" onClick={deleteSelected}>
                <Trash2 size={13} style={{ marginRight: 5, display: "inline" }} /> Delete
              </button>
            </div>
          )}
          {newAlbumOpen && (
            <div className="album-modal" onClick={() => setNewAlbumOpen(false)}>
              <div className="album-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-grab" />
                <h3>New album</h3>
                <input
                  autoFocus value={newAlbumName} maxLength={30} placeholder="Album name, e.g. A+ setups"
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createAlbum(); }}
                />
                <div className="album-sheet-actions">
                  <button className="btn" onClick={() => setNewAlbumOpen(false)}>Cancel</button>
                  <button className="btn primary" disabled={!newAlbumName.trim()} onClick={createAlbum}>Create</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
