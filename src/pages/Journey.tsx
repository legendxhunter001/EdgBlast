import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Image as ImageIcon, Images, X, Search, Loader2, Upload,
  Check, Trash2, FolderInput, ZoomOut, ZoomIn,
} from "lucide-react";

type Entry = {
  id: string;
  title: string;
  content: string;
  is_shared: boolean;
  share_token: string | null;
  updated_at: string;
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

function albumLabel(key: string | null): string {
  return ALBUMS.find((a) => a.key === (key ?? "general"))?.label ?? "General";
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
  const [lightbox, setLightbox] = useState<string | null>(null);
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
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const pinchDist = useRef<number | null>(null);
  const pinchStartTile = useRef(140);

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
    const { error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: activeId, storage_path: path, album: uploadAlbum });
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
    toast.success(`Moved to ${albumLabel(album)}`);
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
          transition:background .18s ease, border-color .18s ease;
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
          opacity:0; transition:opacity .15s ease; border:none; width:100%; text-align:left;
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
                      {ALBUMS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </div>
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

          <div className="album-tabs">
            <button className={`album-tab ${activeAlbum === "all" ? "on" : ""}`} onClick={() => setActiveAlbum("all")}>All Photos</button>
            {ALBUMS.map((a) => (
              <button key={a.key} className={`album-tab ${activeAlbum === a.key ? "on" : ""}`} onClick={() => setActiveAlbum(a.key)}>
                {a.label}
              </button>
            ))}
          </div>

          <div
            className="gallery-fs-body"
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
                {visibleGalleryImages.map((img) => {
                  const isSelected = selectedIds.has(img.id);
                  return (
                    <div
                      key={img.id}
                      className={`gallery-fs-item ${isSelected ? "selected" : ""}`}
                      onClick={() => (selectMode ? toggleSelect(img.id) : setLightbox(img.url))}
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

          {selectMode && selectedIds.size > 0 && (
            <div className="select-bar">
              <span className="meta">{selectedIds.size} selected</span>
              <span className="spacer" />
              <div className="move-menu">
                {moveMenuOpen && (
                  <div className="move-menu-list">
                    {ALBUMS.map((a) => (
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
        </div>
      )}
    </div>
  );
}
