import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Image as ImageIcon, Images, X, Search, Loader2, Upload,
  Check, Trash2, FolderInput, ZoomOut, ZoomIn, Folder, FolderPlus, ChevronLeft, ChevronRight, BookOpen, Palette, LayoutGrid, FileText, FilePlus, ImagePlus, Heading1, Heading2, Bold, Italic, List, ListOrdered, ListChecks, Quote, Minus, Code, Clock,
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


// ---- tiny, safe markdown renderer for Read mode: headings, bold/italic/code, lists, checklists, quotes, code, dividers
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g).filter(Boolean).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={k}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>;
    return <span key={k}>{part}</span>;
  });
}
function renderMarkdown(src: string, onToggle: (lineIndex: number) => void, imgOf: (prefix: string) => { url: string; index: number } | null, onOpenImg: (index: number) => void): React.ReactNode[] {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    if (line.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
      i++; out.push(<pre key={`c${i}`}><code>{buf.join("\n")}</code></pre>); continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length; const Tag = (`h${lvl}`) as "h1" | "h2" | "h3";
      out.push(<Tag key={`h${i}`}>{renderInline(h[2], `h${i}`)}</Tag>); i++; continue;
    }
    const im = /^!\[[^\]]*\]\(eb:([0-9a-f]+)\)\s*$/.exec(line.trim());
    if (im) {
      const hit = imgOf(im[1]);
      out.push(hit
        ? <figure key={`i${i}`} className="doc-img"><img src={hit.url} alt="" loading="lazy" onClick={(ev) => { ev.stopPropagation(); onOpenImg(hit.index); }} /></figure>
        : <p key={`i${i}`} className="muted">[image no longer available]</p>);
      i++; continue;
    }
    if (/^---+$/.test(line.trim())) { out.push(<hr key={`r${i}`} />); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(<blockquote key={`q${i}`}>{renderInline(buf.join(" "), `q${i}`)}</blockquote>); continue;
    }
    if (/^[-*]\s+\[( |x)\]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s+\[( |x)\]\s/.test(lines[i])) {
        const idx = i; const done = /\[x\]/.test(lines[i]); const txt = lines[i].replace(/^[-*]\s+\[( |x)\]\s/, "");
        items.push(
          <li key={`t${idx}`} className={done ? "done" : ""}>
            <button type="button" className="todo-box" aria-pressed={done} onClick={(ev) => { ev.stopPropagation(); onToggle(idx); }}>{done ? "✓" : ""}</button>
            <span>{renderInline(txt, `t${idx}`)}</span>
          </li>
        ); i++;
      }
      out.push(<ul key={`tl${i}`} className="todo">{items}</ul>); continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]) && !/^[-*]\s+\[( |x)\]\s/.test(lines[i])) { items.push(<li key={`u${i}`}>{renderInline(lines[i].replace(/^[-*]\s+/, ""), `u${i}`)}</li>); i++; }
      out.push(<ul key={`ul${i}`}>{items}</ul>); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(<li key={`o${i}`}>{renderInline(lines[i].replace(/^\d+\.\s+/, ""), `o${i}`)}</li>); i++; }
      out.push(<ol key={`ol${i}`}>{items}</ol>); continue;
    }
    out.push(<p key={`p${i}`}>{renderInline(line, `p${i}`)}</p>); i++;
  }
  return out;
}


// ---- Book model: an entry is a stack of PAGES, each page is a list of text BLOCKS (paragraph, list, heading...)
const PAGE_RE = /\n*§§page§§\n*/;
const PAGE_MARK = "\n\n§§page§§\n\n";
function splitBlocks(text: string): string[] {
  if (!text.trim()) return [""];
  const out: string[] = []; let cur: string[] = []; let fence = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) fence = !fence;
    if (!fence && line.trim() === "" ) { if (cur.length) { out.push(cur.join("\n")); cur = []; } }
    else cur.push(line);
  }
  if (cur.length) out.push(cur.join("\n"));
  return out.length ? out : [""];
}
const parseDoc = (text: string): string[][] => text.split(PAGE_RE).map(splitBlocks);
const serializeDoc = (doc: string[][]): string => doc.map((blocks) => blocks.filter((b, i) => b.trim() !== "" || (blocks.length === 1 && i === 0)).join("\n\n")).join(PAGE_MARK);

const ImportedDataBlock = ({ raw }: { raw: Record<string, string> | null | undefined }) => {
  const [open, setOpen] = useState(false);
  if (!raw || typeof raw !== 'object') return null;
  const entries = Object.entries(raw).filter(([k, v]) => k !== 'eb_folder' && v !== null && v !== undefined && String(v).trim() !== '');
  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '.9rem' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '.76rem', cursor: 'pointer', padding: 0 }}
      >
        From your CSV import, all original columns ({entries.length}) {open ? '▲' : '▼'}
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
  const [tilePx, setTilePx] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? Math.floor((window.innerWidth - 6) / 3) - 1 : 140));
  const [activeAlbum, setActiveAlbum] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [galleryView, setGalleryView] = useState<"library" | "albums">("library");
  const [customAlbums, setCustomAlbums] = useState<string[]>([]);
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const ALBUM_COLORS = ["#6A55F1", "#2FBF5B", "#FF9F0A", "#FF3B30", "#0A84FF", "#BF5AF2", "#FF6B8B", "#30B0C7"];
  const [albumColors, setAlbumColors] = useState<Record<string, string>>({});
  const [colorSheet, setColorSheet] = useState<string | null>(null);
  const [newAlbumColor, setNewAlbumColor] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(60);
  const galleryBodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const colorsStorageKey = user ? `eb_album_colors_${user.id}` : null;
  useEffect(() => {
    if (!colorsStorageKey) return;
    try { setAlbumColors(JSON.parse(localStorage.getItem(colorsStorageKey) || "{}")); } catch { setAlbumColors({}); }
  }, [colorsStorageKey]);
  const setAlbumColor = (key: string, color: string) => {
    const next = { ...albumColors };
    if (color) next[key] = color; else delete next[key];
    setAlbumColors(next);
    if (colorsStorageKey) { try { localStorage.setItem(colorsStorageKey, JSON.stringify(next)); } catch { /* storage unavailable */ } }
  };

  // Journey folders: notebooks that group entries (stored on the entry, so they sync everywhere)
  const [mobilePage, setMobilePage] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const TEXT_SIZES = [0.9, 1, 1.06, 1.2, 1.38, 1.6];
  const [textSize, setTextSize] = useState<number>(() => { try { const v = Number(localStorage.getItem("eb_text_size")); return Number.isInteger(v) && v >= 0 && v < 6 ? v : 2; } catch { return 2; } });
  const changeTextSize = (d: number) => setTextSize((v) => { const n = Math.max(0, Math.min(TEXT_SIZES.length - 1, v + d)); try { localStorage.setItem("eb_text_size", String(n)); } catch { /* ignore */ } return n; });
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [doc, setDoc] = useState<string[][]>([[""]]);
  const [editing, setEditing] = useState<{ p: number; b: number } | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const bookRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<{ name: string; color: string }[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [folderSheet, setFolderSheet] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#6A55F1");
  const [assignAfter, setAssignAfter] = useState(false);
  const foldersStorageKey = user ? `eb_folders_${user.id}` : null;
  useEffect(() => {
    if (!foldersStorageKey) return;
    try { setFolders(JSON.parse(localStorage.getItem(foldersStorageKey) || "[]")); } catch { setFolders([]); }
  }, [foldersStorageKey]);
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
    const { data: signedList } = await supabase.storage.from("journal-images").createSignedUrls(data.map((i) => i.storage_path), 3600);
    const urlBy = new Map((signedList ?? []).map((x) => [x.path, x.signedUrl]));
    setImages(data.map((img) => ({ id: img.id, storage_path: img.storage_path, url: urlBy.get(img.storage_path) ?? "", album: img.album })));
  }, []);

  useEffect(() => { if (activeId) loadImages(activeId); else setImages([]); }, [activeId, loadImages]);

  const selectEntry = (e: Entry) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirty.current = false;
    setSaveState("idle");
    setActiveId(e.id);
    setTitle(e.title);
    setContent(e.content);
    setMobilePage(true);
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
      .insert({ user_id: user.id, title: "Untitled Entry", content: "", ...(activeFolder !== "all" ? { raw_import_data: { eb_folder: activeFolder } } : {}) })
      .select("id, title, content, is_shared, share_token, updated_at, raw_import_data")
      .single();
    if (err || !data) { setError(err?.message ?? "Could not create entry."); return; }
    dirty.current = false;
    setEntries((prev) => [data as Entry, ...prev]);
    selectEntry(data as Entry);
  };

  const deleteEntry = async (id: string) => {
    setError(null);
    setMobilePage(false);
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

  const handleUpload = async (file: File): Promise<string | null> => {
    if (!user || !activeId) return null;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are supported."); return null; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB."); return null; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${activeId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("journal-images").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploading(false); return null; }
    const { data: ins, error: insErr } = await supabase.from("journal_images").insert({ user_id: user.id, entry_id: activeId, storage_path: path, album: uploadAlbum }).select("id").single();
    setUploading(false);
    if (insErr || !ins) { toast.error(insErr?.message ?? "Upload failed"); return null; }
    loadImages(activeId);
    return ins.id as string;
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
    const { data: signedList } = await supabase.storage.from("journal-images").createSignedUrls(data.map((i: any) => i.storage_path), 3600);
    const urlBy = new Map((signedList ?? []).map((x) => [x.path, x.signedUrl]));
    setGalleryImages(data.map((img: any) => ({
      id: img.id, storage_path: img.storage_path, url: urlBy.get(img.storage_path) ?? "", album: img.album,
      entryId: img.entry_id, entryTitle: img.journal_entries?.title || "Untitled Entry",
    })));
    setVisibleCount(60);
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
  const entryFolderOf = (e: Entry) => (e.raw_import_data?.eb_folder as string | undefined) || null;
  const allFolders: { name: string; color: string }[] = [...folders];
  entries.forEach((e) => { const f = entryFolderOf(e); if (f && !allFolders.some((x) => x.name === f)) allFolders.push({ name: f, color: ALBUM_COLORS[allFolders.length % ALBUM_COLORS.length] }); });
  const folderCount = (name: string) => entries.filter((e) => entryFolderOf(e) === name).length;
  const saveFolders = (next: { name: string; color: string }[]) => {
    setFolders(next);
    if (foldersStorageKey) { try { localStorage.setItem(foldersStorageKey, JSON.stringify(next)); } catch { /* storage unavailable */ } }
  };
  const setEntryFolder = (entryId: string, name: string | null) => {
    const entry = entries.find((x) => x.id === entryId);
    if (!entry) return;
    const next: Record<string, string> = { ...(entry.raw_import_data ?? {}) };
    if (name) next.eb_folder = name; else delete next.eb_folder;
    persist(entryId, { raw_import_data: Object.keys(next).length ? next : null });
  };
  const createFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    if (allFolders.some((f) => f.name.toLowerCase() === name.toLowerCase())) { toast.error("That folder already exists"); return; }
    saveFolders([...folders, { name, color: folderColor }]);
    if (assignAfter && activeId) setEntryFolder(activeId, name);
    setActiveFolder(name); setFolderName(""); setFolderSheet(false); setAssignAfter(false);
    toast.success(`Folder "${name}" created`);
  };
  const filteredEntries = entries.filter((e) =>
    (activeFolder === "all" || entryFolderOf(e) === activeFolder) &&
    (!search.trim() || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase()))
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
    if (newAlbumColor) setAlbumColor(k, newAlbumColor);
    setNewAlbumName(""); setNewAlbumColor(""); setNewAlbumOpen(false);
    toast.success(`Album "${label}" created`);
  };
  const deleteAlbum = (label: string) => saveCustomAlbums(customAlbums.filter((l) => l !== label));
  const visibleGalleryImages = activeAlbum === "all" ? galleryImages : galleryImages.filter((img) => (img.album ?? "general") === activeAlbum);

  // photo open = pure photo: hide the app's top bar and navigation dock underneath
  useEffect(() => {
    if (!viewerOpen) return;
    document.body.classList.add("pv-open");
    return () => document.body.classList.remove("pv-open");
  }, [viewerOpen]);

  // render photos in chunks as you scroll, so a big library opens instantly
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !galleryOpen) return;
    const io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) setVisibleCount((c) => c + 60); }, { root: galleryBodyRef.current, rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [galleryOpen, galleryView, activeAlbum, visibleCount, galleryImages.length]);
  useEffect(() => { setVisibleCount(60); galleryBodyRef.current?.scrollTo({ top: 0 }); }, [activeAlbum, galleryView]);

  // ---- the book: pages of live-rendered blocks. Tap a block to edit it; it shows as formatted text otherwise.
  useEffect(() => {
    setDoc(parseDoc(content)); setEditing(null); setPageIdx(0);
    bookRef.current?.scrollTo({ left: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const commitDoc = (next: string[][]) => {
    setDoc(next);
    const c = serializeDoc(next);
    setContent(c); queueSave({ content: c });
  };
  const cloneDoc = () => doc.map((pg) => [...pg]);
  const setBlockText = (p: number, b: number, text: string) => { const n = cloneDoc(); n[p][b] = text; commitDoc(n); };
  const startEdit = (p: number, b: number) => { if (readMode) return; setEditing({ p, b }); setPageIdx(p); };
  const goPage = (i: number) => {
    const el = bookRef.current; if (!el) return;
    const n = Math.max(0, Math.min(doc.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onBookScroll = () => {
    const el = bookRef.current; if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== pageIdx) { setPageIdx(i); if (editing && editing.p !== i) setEditing(null); }
  };
  const addPage = () => {
    const n = [...cloneDoc(), [""]];
    commitDoc(n);
    const idx = n.length - 1;
    setTimeout(() => { goPage(idx); setEditing({ p: idx, b: 0 }); }, 60);
  };
  const deletePage = (i: number) => {
    if (doc.length < 2) return;
    if (!window.confirm(`Delete page ${i + 1}? This can't be undone.`)) return;
    const n = cloneDoc(); n.splice(i, 1);
    commitDoc(n); setEditing(null);
    setTimeout(() => goPage(Math.min(i, n.length - 1)), 30);
  };
  const addBlock = (p: number) => {
    const n = cloneDoc();
    if (n[p][n[p].length - 1]?.trim() !== "") n[p].push("");
    commitDoc(n); setEditing({ p, b: n[p].length - 1 });
  };
  const toggleCheckAt = (p: number, b: number, lineIndex: number) => {
    const lines = doc[p][b].split("\n");
    lines[lineIndex] = /\[x\]/.test(lines[lineIndex]) ? lines[lineIndex].replace("[x]", "[ ]") : lines[lineIndex].replace("[ ]", "[x]");
    setBlockText(p, b, lines.join("\n"));
  };
  const onBlockBlur = (p: number, b: number) => {
    const text = doc[p]?.[b];
    setEditing(null);
    if (text === undefined) return;
    const n = cloneDoc();
    if (/\n\s*\n/.test(text)) { n[p].splice(b, 1, ...splitBlocks(text)); commitDoc(n); }                // pasted a gap: becomes separate blocks
    else if (text.trim() === "" && b === n[p].length - 1 && n[p].length > 1) { n[p].pop(); commitDoc(n); } // drop a trailing empty block
  };
  const onBlockKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, p: number, b: number) => {
    const el = e.currentTarget;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    if (e.key === "Escape") { el.blur(); return; }
    if (e.key === "Enter" && !e.shiftKey && atEnd) {
      const lastLine = el.value.split("\n").pop() ?? "";
      const li = /^(\s*)(- \[[ x]\] |[-*] |\d+\. )(.*)$/.exec(lastLine);
      if (li && li[3].trim() === "") {                                  // empty list item: leave the list
        e.preventDefault();
        const lines = el.value.split("\n"); lines.pop();
        const n = cloneDoc(); n[p][b] = lines.join("\n"); n[p].splice(b + 1, 0, "");
        commitDoc(n); setEditing({ p, b: b + 1 }); return;
      }
      if (li) {                                                          // keep the list going
        e.preventDefault();
        const next = /^\d+\./.test(li[2]) ? `${parseInt(li[2], 10) + 1}. ` : li[2].startsWith("- [") ? "- [ ] " : li[2];
        setBlockText(p, b, `${el.value}\n${li[1]}${next}`); return;
      }
      if (/\n$/.test(el.value)) {                                       // Enter on an empty line: new paragraph
        e.preventDefault();
        const n = cloneDoc(); n[p][b] = el.value.replace(/\n+$/, ""); n[p].splice(b + 1, 0, "");
        commitDoc(n); setEditing({ p, b: b + 1 }); return;
      }
    }
    if (e.key === "Backspace" && el.value === "" && b > 0) {
      e.preventDefault();
      const n = cloneDoc(); n[p].splice(b, 1); commitDoc(n); setEditing({ p, b: b - 1 });
    }
  };

  // ---- Notion-style formatting on the block being edited
  const applyFormat = (kind: "h1" | "h2" | "bold" | "italic" | "code" | "bullet" | "number" | "todo" | "quote" | "divider") => {
    const el = bodyRef.current;
    if (!el || !editing) {                                               // nothing open: open the last paragraph of this page
      const last = Math.max(0, (doc[pageIdx]?.length ?? 1) - 1);
      setEditing({ p: pageIdx, b: last }); return;
    }
    const { p, b: bi } = editing;
    const a = el.selectionStart, b = el.selectionEnd, text = el.value;
    const put = (next: string, s1: number, s2?: number) => {
      setBlockText(p, bi, next);
      requestAnimationFrame(() => { const e2 = bodyRef.current; if (e2) { e2.focus(); e2.setSelectionRange(s1, s2 ?? s1); } });
    };
    if (kind === "bold" || kind === "italic" || kind === "code") {
      const m = kind === "bold" ? "**" : kind === "italic" ? "*" : "`";
      const sel = text.slice(a, b) || "text";
      put(text.slice(0, a) + m + sel + m + text.slice(b), a + m.length, a + m.length + sel.length); return;
    }
    if (kind === "divider") { put(text + (text && !text.endsWith("\n") ? "\n" : "") + "---", text.length + 4); return; }
    const prefix = { h1: "# ", h2: "## ", bullet: "- ", number: "1. ", todo: "- [ ] ", quote: "> " }[kind];
    const ls = text.lastIndexOf("\n", a - 1) + 1;
    let le = text.indexOf("\n", b); if (le === -1) le = text.length;
    const lines = text.slice(ls, le).split("\n");
    const strip = (l: string) => l.replace(/^(#{1,3}\s+|[-*]\s+\[( |x)\]\s+|[-*]\s+|\d+\.\s+|>\s?)/, "");
    const allHave = lines.every((l) => l.startsWith(prefix));
    const nextLines = lines.map((l) => (allHave ? l.slice(prefix.length) : prefix + strip(l))).join("\n");
    put(text.slice(0, ls) + nextLines + text.slice(le), ls + nextLines.length);
  };

  // ---- pictures: inside the page (at the caret / end of the page) and under it (the grid below)
  const tokenFor = (id: string) => `![img](eb:${id.slice(0, 8)})`;
  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (el && editing && !readMode) {
      const a = el.selectionStart, b = el.selectionEnd, v = el.value;
      const glue = (a > 0 && v[a - 1] !== "\n" ? "\n" : "") + text + "\n";
      setBlockText(editing.p, editing.b, v.slice(0, a) + glue + v.slice(b));
    } else {
      const n = cloneDoc(); const pg = n[pageIdx] ?? n[0]; const pi = n[pageIdx] ? pageIdx : 0;
      if (pg[pg.length - 1]?.trim() === "") pg[pg.length - 1] = text; else pg.push(text);
      n[pi] = pg; commitDoc(n);
    }
  };
  const handleInlineUpload = async (files: FileList) => {
    const toks: string[] = [];
    for (const f of Array.from(files)) { const id = await handleUpload(f); if (id) toks.push(tokenFor(id)); }
    if (toks.length) insertAtCursor(toks.join("\n"));
  };
  const imgOf = (prefix: string) => {
    const index = images.findIndex((x) => x.id.startsWith(prefix));
    return index >= 0 ? { url: images[index].url, index } : null;
  };
  const openInlineImage = (index: number) => openViewer(images.map((x) => ({ url: x.url, title: active?.title || "Note", sub: labelFor(x.album) })), index);

  // the active block grows with the writing (no inner scrollbar)
  useEffect(() => {
    const el = bodyRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  }, [doc, editing, textSize]);

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

        /* ---- Professional gallery app: Library / Albums, bottom bar, edge-to-edge grid ---- */
        .eb-journey .gallery-fs-body{ scroll-behavior:smooth; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; padding-bottom:calc(104px + env(safe-area-inset-bottom,0px)); scrollbar-width:none; }
        .eb-journey .gallery-fs-body::-webkit-scrollbar{ display:none; }
        .eb-journey .gallery-fs-item{ content-visibility:auto; contain-intrinsic-size:120px 120px; background:var(--elev); }
        .eb-journey .gallery-fs-item img{ background:var(--elev); }
        .eb-journey .gal-tabbar{ position:absolute; left:50%; transform:translateX(-50%); bottom:calc(14px + env(safe-area-inset-bottom,0px)); z-index:30; display:flex; gap:4px; padding:5px; border-radius:999px; background:color-mix(in srgb, var(--elev) 78%, transparent); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); border:.5px solid var(--line); box-shadow:0 18px 38px -12px rgba(0,0,0,.35); }
        .eb-journey .gal-tab{ display:flex; flex-direction:column; align-items:center; gap:2px; min-width:96px; padding:7px 16px; border-radius:999px; border:0; background:transparent; color:var(--dim); font:600 11px inherit; cursor:pointer; transition:background .25s, color .25s, transform .2s; }
        .eb-journey .gal-tab:active{ transform:scale(.95); }
        .eb-journey .gal-tab.on{ background:var(--accent-soft); color:var(--accent); }
        .eb-journey .albums-body{ padding:1rem 1.25rem calc(104px + env(safe-area-inset-bottom,0px)); }
        .eb-journey .album-paint{ position:absolute; top:8px; right:8px; width:28px; height:28px; border-radius:50%; border:0; background:rgba(255,255,255,.28); color:#fff; display:grid; place-items:center; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); cursor:pointer; z-index:3; }
        .eb-journey .folder-art:empty::after{ content:''; }
        .eb-journey .swatches{ display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
        .eb-journey .swatches .sw{ width:34px; height:34px; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:0 6px 12px -6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.4); transition:transform .2s; padding:0; }
        .eb-journey .swatches .sw.on{ border-color:var(--text); transform:scale(1.12); }
        .eb-journey .swatches .sw.auto{ width:auto; padding:0 14px; border-radius:999px; background:var(--elev); color:var(--text); border:1px solid var(--line); font:600 .8rem inherit; box-shadow:none; }
        .eb-journey .swatches .sw.auto.on{ border-color:var(--accent); color:var(--accent); transform:none; }
        .eb-journey .album-modal.fixed-modal{ position:fixed; z-index:260; }

        /* ---- Journey folders: notebooks for entries ---- */
        .eb-journey .fchips{ display:flex; gap:6px; overflow-x:auto; padding:.65rem 0 .1rem; scrollbar-width:none; }
        .eb-journey .fchips::-webkit-scrollbar{ display:none; }
        .eb-journey .fchip{ --fc:var(--accent); flex:none; display:inline-flex; align-items:center; gap:.35rem; border:1px solid var(--line); background:var(--elev); color:var(--text); font:600 .78rem inherit; padding:.38rem .75rem; border-radius:999px; cursor:pointer; transition:transform .2s, background .2s, border-color .2s; }
        .eb-journey .fchip svg{ color:var(--fc); }
        .eb-journey .fchip em{ font-style:normal; color:var(--dim); font-weight:500; }
        .eb-journey .fchip:active{ transform:scale(.96); }
        .eb-journey .fchip.on{ background:color-mix(in srgb, var(--fc) 16%, var(--elev)); border-color:color-mix(in srgb, var(--fc) 55%, transparent); }
        .eb-journey .fchip.add{ border-style:dashed; color:var(--dim); }
        .eb-journey .folder-row{ display:inline-flex; align-items:center; gap:.5rem; color:var(--dim); margin-bottom:.8rem; background:var(--elev); border:1px solid var(--line); border-radius:12px; padding:.35rem .7rem; }
        .eb-journey .folder-row select{ background:transparent; border:0; color:var(--text); font:600 .85rem inherit; outline:none; max-width:200px; }

        @media (max-width:767px){
          .eb-journey .gallery-fs-head{ padding-top:calc(.8rem + env(safe-area-inset-top,0px)); padding-bottom:.4rem; }
          .eb-journey .zoom-row{ display:none; }
          .eb-journey .gallery-fs-body:not(.albums-body){ padding:2px 0 calc(104px + env(safe-area-inset-bottom,0px)); }
          .eb-journey .gallery-fs-grid{ gap:2px; }
          .eb-journey .gallery-fs-item{ border:0; border-radius:0; }
          .eb-journey .gallery-fs-caption{ display:none; }
          .eb-journey .albums-body{ padding:.8rem 1rem calc(104px + env(safe-area-inset-bottom,0px)); }
          .eb-journey .gal-tab{ min-width:104px; }
        }

        /* ======== NOTION-STYLE JOURNEY ======== */
        @media (min-width:768px){
          html .eb-journey, html.light .eb-journey{ --bg:hsl(var(--background)); --elev:hsl(var(--card)); --text:hsl(var(--foreground)); --dim:hsl(var(--muted-foreground)); --line:hsl(var(--border)); --accent:hsl(var(--primary)); --accent-soft:hsl(var(--primary) / .14); }
          .eb-journey .layout{ border-radius:16px; background:transparent; box-shadow:0 1px 2px rgba(20,24,40,.05), 0 12px 28px -16px rgba(20,24,40,.2); }
          .eb-journey .list-col{ background:hsl(var(--card) / .6); backdrop-filter:blur(20px) saturate(160%); -webkit-backdrop-filter:blur(20px) saturate(160%); }
          .eb-journey .page-col{ background:hsl(var(--card)); }
        }
        .eb-journey{ font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif; }
        .eb-journey .inner{ max-width:1240px; }
        .eb-journey h1{ font-family:inherit; font-size:1.7rem; font-weight:800; letter-spacing:-.03em; }
        .eb-journey .layout{ grid-template-columns:290px minmax(0,1fr); gap:0; margin-top:1.4rem; border:1px solid var(--line); border-radius:18px; overflow:hidden; background:var(--bg); min-height:70vh; }
        .eb-journey .col{ border:0; border-radius:0; background:transparent; }
        .eb-journey .list-col{ background:var(--elev); border-right:1px solid var(--line); display:flex; flex-direction:column; }
        .eb-journey .list-head{ border-bottom:0; padding:1rem 1rem .5rem; }
        .eb-journey .list{ max-height:none; flex:1; padding:.35rem .5rem 1rem; }
        .eb-journey .item{ border:0; border-radius:8px; padding:.5rem .6rem; }
        .eb-journey .item .t{ display:flex; align-items:center; gap:.5rem; font-weight:600; font-size:.9rem; }
        .eb-journey .item .t svg{ flex:none; color:var(--dim); }
        .eb-journey .item.active{ background:var(--accent-soft); }
        .eb-journey .item.active .t svg{ color:var(--accent); }
        .eb-journey .item .m{ margin-left:calc(14px + .5rem); font-family:inherit; }
        .eb-journey .page-col{ min-width:0; }
        .eb-journey .editor{ max-width:780px; margin:0 auto; padding:1.6rem 2.6rem 3rem; min-height:70vh; }
        .eb-journey .page-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:1.2rem; }
        .eb-journey .back-btn{ display:none; border:0; background:transparent; color:var(--accent); font:600 1rem inherit; align-items:center; gap:.1rem; cursor:pointer; padding:.3rem .2rem; }
        .eb-journey .seg-mini{ display:inline-flex; background:var(--elev); border:1px solid var(--line); border-radius:10px; padding:2px; margin-left:auto; }
        .eb-journey .seg-mini button{ border:0; background:transparent; color:var(--dim); font:600 .78rem inherit; padding:.32rem .8rem; border-radius:8px; cursor:pointer; }
        .eb-journey .seg-mini button.on{ background:var(--bg); color:var(--text); box-shadow:0 1px 3px rgba(0,0,0,.18); }
        .eb-journey .title-input{ font-family:inherit; font-size:2.5rem; font-weight:800; letter-spacing:-.035em; line-height:1.15; }
        .eb-journey .title-input::placeholder{ color:var(--dim); opacity:.55; }
        .eb-journey .props{ display:flex; flex-wrap:wrap; align-items:center; gap:.4rem .9rem; margin:1rem 0 .4rem; padding-bottom:1rem; border-bottom:1px solid var(--line); color:var(--dim); font-size:.84rem; }
        .eb-journey .prop{ display:inline-flex; align-items:center; gap:.35rem; }
        .eb-journey .prop-v{ color:var(--text); }
        .eb-journey .props .folder-row{ margin:0; padding:.15rem .55rem; border-radius:8px; background:transparent; border:1px solid transparent; }
        .eb-journey .props .folder-row:hover{ background:var(--elev); border-color:var(--line); }
        .eb-journey .fmt-bar{ position:sticky; top:calc(3.5rem + env(safe-area-inset-top,0px)); z-index:6; display:flex; gap:2px; align-items:center; overflow-x:auto; padding:.4rem .35rem; margin:.5rem 0 .2rem; background:color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid var(--line); border-radius:12px; scrollbar-width:none; }
        .eb-journey .fmt-bar::-webkit-scrollbar{ display:none; }
        .eb-journey .fmt-bar button{ flex:none; width:34px; height:34px; border:0; border-radius:8px; background:transparent; color:var(--dim); display:grid; place-items:center; cursor:pointer; transition:background .15s, color .15s, transform .15s; }
        .eb-journey .fmt-bar button:hover{ background:var(--elev); color:var(--text); }
        .eb-journey .fmt-bar button:active{ transform:scale(.92); }
        .eb-journey .fmt-bar .sep{ width:1px; height:18px; background:var(--line); margin:0 4px; flex:none; }
        .eb-journey .body-input{ margin-top:.8rem; padding:0; border-left:0; background-image:none; font-size:1.06rem; line-height:1.75; min-height:46vh; overflow:hidden; }
        .eb-journey .body-input::placeholder{ color:var(--dim); opacity:.6; }
        .eb-journey .doc-read{ margin-top:.8rem; font-size:1.06rem; line-height:1.75; min-height:46vh; }
        .eb-journey .doc-read h1{ font-size:1.9rem; margin:1.4rem 0 .5rem; }
        .eb-journey .doc-read h2{ font-size:1.45rem; font-weight:750; letter-spacing:-.02em; margin:1.2rem 0 .4rem; }
        .eb-journey .doc-read h3{ font-size:1.15rem; font-weight:700; margin:1rem 0 .3rem; }
        .eb-journey .doc-read p{ margin:.35rem 0; }
        .eb-journey .doc-read ul,.eb-journey .doc-read ol{ margin:.35rem 0 .35rem 1.3rem; }
        .eb-journey .doc-read li{ margin:.2rem 0; }
        .eb-journey .doc-read blockquote{ margin:.7rem 0; padding:.2rem 1rem; border-left:3px solid var(--text); color:var(--text); opacity:.85; }
        .eb-journey .doc-read code{ background:var(--elev); border:1px solid var(--line); border-radius:6px; padding:.08rem .35rem; font-size:.9em; font-family:'IBM Plex Mono',monospace; }
        .eb-journey .doc-read pre{ background:var(--elev); border:1px solid var(--line); border-radius:12px; padding:.9rem 1rem; overflow-x:auto; }
        .eb-journey .doc-read pre code{ border:0; padding:0; background:transparent; }
        .eb-journey .doc-read hr{ border:0; border-top:1px solid var(--line); margin:1.2rem 0; }
        .eb-journey .doc-read .muted{ color:var(--dim); }
        .eb-journey .doc-read ul.todo{ list-style:none; margin-left:0; padding:0; }
        .eb-journey .doc-read ul.todo li{ display:flex; gap:.6rem; align-items:flex-start; }
        .eb-journey .doc-read ul.todo li.done span{ color:var(--dim); text-decoration:line-through; }
        .eb-journey .todo-box{ flex:none; width:20px; height:20px; margin-top:.28rem; border-radius:6px; border:1.5px solid var(--dim); background:transparent; color:#fff; font-size:.8rem; line-height:1; display:grid; place-items:center; cursor:pointer; padding:0; }
        .eb-journey li.done .todo-box{ background:var(--accent); border-color:var(--accent); }
        .eb-journey .gallery{ margin-top:2rem; padding-top:1rem; border-top:1px solid var(--line); }
        .eb-journey .bar{ margin-top:1.2rem; }

        /* phone: iOS Notes style — list first, tap into a full page, back chevron */
        @media (max-width:767px){
          .eb-journey{ padding-bottom:calc(120px + env(safe-area-inset-bottom,0px)); }
          .eb-journey .sub{ display:none; }
          .eb-journey h1{ font-size:34px; letter-spacing:-.04em; }
          .eb-journey .layout{ display:block; border:0; border-radius:0; background:transparent; margin-top:.6rem; min-height:0; }
          .eb-journey .list-col{ display:block; background:transparent; border-right:0; }
          .eb-journey .page-col{ display:none; }
          .eb-journey .layout.show-page .list-col{ display:none; }
          .eb-journey .layout.show-page .page-col{ display:block; }
          .eb-journey .list-head{ padding:.4rem 0 .5rem; }
          .eb-journey .list{ background:hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius:20px; padding:.25rem .5rem; box-shadow:var(--ios-sh, none); }
          .eb-journey .item{ border-radius:12px; padding:.8rem .6rem; border-bottom:.5px solid hsl(var(--border)); }
          .eb-journey .item:last-child{ border-bottom:0; }
          .eb-journey .item.active{ background:transparent; }
          .eb-journey .item .t{ font-size:1rem; }
          .eb-journey .editor{ padding:.2rem 0 1rem; min-height:0; max-width:none; }
          .eb-journey .back-btn{ display:inline-flex; }
          .eb-journey .title-input{ font-size:2rem; }
          .eb-journey .body-input,.eb-journey .doc-read{ font-size:1.05rem; }
        }

        /* ---- text size, inline pictures, folder pages ---- */
        .eb-journey .body-input,.eb-journey .doc-read{ font-size:var(--ts,1.06rem) !important; }
        .eb-journey .title-input{ font-size:calc(var(--ts,1.06rem) * 2.1); }
        .eb-journey .ts-btn{ width:auto !important; padding:0 .6rem; font-weight:800; font-size:.95rem; display:inline-flex !important; align-items:baseline; justify-content:center; gap:1px; }
        .eb-journey .ts-btn.big{ font-size:1.2rem; }
        .eb-journey .ts-btn small{ font-size:.65em; font-weight:700; }
        .eb-journey .ts-btn:disabled{ opacity:.3; cursor:default; }
        .eb-journey .fmt-bar.ts-only{ justify-content:flex-end; }
        .eb-journey .doc-img{ margin:.9rem 0; }
        .eb-journey .doc-img img{ width:100%; max-height:70vh; object-fit:contain; border-radius:14px; border:1px solid var(--line); background:var(--elev); cursor:zoom-in; display:block; }
        .eb-journey .inline-strip{ margin-top:1rem; padding:.7rem .8rem; border:1px dashed var(--line); border-radius:14px; }
        .eb-journey .inline-strip > div{ display:flex; gap:8px; overflow-x:auto; margin-top:.5rem; scrollbar-width:none; }
        .eb-journey .inline-chip{ position:relative; flex:none; width:64px; height:64px; border-radius:10px; overflow:hidden; }
        .eb-journey .inline-chip img{ width:100%; height:100%; object-fit:cover; display:block; }
        .eb-journey .inline-chip button{ position:absolute; top:3px; right:3px; width:20px; height:20px; border-radius:50%; border:0; background:rgba(0,0,0,.6); color:#fff; display:grid; place-items:center; cursor:pointer; }
        .eb-journey .gallery-insert{ position:absolute; top:6px; left:6px; width:24px; height:24px; border-radius:50%; border:0; background:rgba(0,0,0,.6); color:#fff; display:grid; place-items:center; cursor:pointer; z-index:2; }
        .eb-journey .folder-banner{ --fc:var(--accent); display:flex; align-items:center; gap:.5rem; margin:.7rem 0 .2rem; padding:.65rem .8rem; border-radius:14px; background:color-mix(in srgb, var(--fc) 13%, var(--elev)); border:1px solid color-mix(in srgb, var(--fc) 35%, transparent); }
        .eb-journey .folder-banner svg{ color:var(--fc); }
        .eb-journey .folder-banner b{ font-weight:700; }
        .eb-journey .folder-banner span{ margin-left:auto; color:var(--dim); font-size:.8rem; }

        /* ---- gallery sits ABOVE the navigation dock on phones, scrolls to its last photo ---- */
        @media (max-width:767px){
          .eb-journey .gallery-fullscreen{ bottom:calc(92px + env(safe-area-inset-bottom,0px)); border-bottom:.5px solid var(--line); }
          .eb-journey .gal-tabbar{ bottom:10px; }
          .eb-journey .gallery-fs-body:not(.albums-body){ padding-bottom:84px; }
          .eb-journey .albums-body{ padding-bottom:84px; }
        }

        .eb-journey.pv-portal{ padding:0 !important; margin:0 !important; min-height:0 !important; background:transparent !important; width:0; height:0; overflow:visible; }

        /* ---- THE BOOK: swipeable pages, live-rendered text, tap a block to edit ---- */
        .eb-journey .book{ display:flex; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; scroll-behavior:smooth; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; margin-top:.9rem; scrollbar-width:none; align-items:flex-start; border-radius:18px; }
        .eb-journey .book::-webkit-scrollbar{ display:none; }
        .eb-journey .sheet{ flex:0 0 100%; width:100%; scroll-snap-align:center; scroll-snap-stop:always; min-height:52vh; padding:1.4rem 1.5rem 1rem; border:1px solid var(--line); border-radius:18px; background:var(--elev); box-shadow:0 1px 2px rgba(20,24,40,.05), 0 14px 30px -18px rgba(20,24,40,.22); display:flex; flex-direction:column; }
        .eb-journey .sheet + .sheet{ margin-left:14px; }
        .eb-journey .sheet-body{ flex:1; }
        .eb-journey .sheet-foot{ margin-top:1.2rem; text-align:center; font-size:.72rem; letter-spacing:.08em; color:var(--dim); }
        .eb-journey .blk{ margin:0 -.5rem; padding:.2rem .5rem; border-radius:10px; cursor:text; transition:background .15s; }
        .eb-journey .blk:hover{ background:var(--accent-soft); }
        .eb-journey .blk:active{ background:color-mix(in srgb, var(--accent) 22%, transparent); }
        .eb-journey .blk.ro{ cursor:default; } .eb-journey .blk.ro:hover,.eb-journey .blk.ro:active{ background:transparent; }
        .eb-journey .blk.doc-read{ min-height:0; margin-top:0; }
        .eb-journey .blk-empty{ color:var(--dim); opacity:.7; margin:.35rem 0; }
        .eb-journey .blk-edit{ display:block; width:calc(100% + 1rem); margin:0 -.5rem; padding:.2rem .5rem; border:0; outline:none; resize:none; overflow:hidden; background:var(--accent-soft); border-radius:10px; box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent); color:var(--text); font:inherit; font-size:var(--ts,1.06rem); line-height:1.75; caret-color:var(--accent); }
        .eb-journey .blk-add{ margin-top:.6rem; border:0; background:transparent; color:var(--dim); font:600 .8rem inherit; cursor:pointer; padding:.4rem .2rem; opacity:.7; }
        .eb-journey .blk-add:hover{ opacity:1; color:var(--accent); }
        .eb-journey .book-nav{ display:flex; align-items:center; gap:.5rem; margin-top:.8rem; }
        .eb-journey .book-nav > button{ width:34px; height:34px; border-radius:50%; border:1px solid var(--line); background:var(--elev); color:var(--text); display:grid; place-items:center; cursor:pointer; transition:transform .15s; }
        .eb-journey .book-nav > button:active{ transform:scale(.92); }
        .eb-journey .book-nav > button:disabled{ opacity:.3; cursor:default; }
        .eb-journey .book-nav .dots{ display:flex; gap:7px; align-items:center; padding:0 .3rem; overflow-x:auto; max-width:50vw; scrollbar-width:none; }
        .eb-journey .book-nav .dots button{ width:8px; height:8px; padding:0; border:0; border-radius:50%; background:var(--line); cursor:pointer; flex:none; transition:width .25s cubic-bezier(.2,.8,.2,1), background .2s; }
        .eb-journey .book-nav .dots button.on{ width:22px; border-radius:6px; background:var(--accent); }
        .eb-journey .book-nav .sp{ flex:1; }
        .eb-journey .book-nav .add-page,.eb-journey .book-nav .del-page{ display:inline-flex; align-items:center; gap:.4rem; height:34px; padding:0 .8rem; border-radius:999px; border:1px solid var(--line); background:var(--elev); color:var(--accent); font:600 .8rem inherit; cursor:pointer; width:auto; }
        .eb-journey .book-nav .del-page{ color:var(--dim); padding:0 .65rem; }
        @media (max-width:767px){
          .eb-journey .sheet{ padding:1.1rem 1rem .8rem; min-height:56vh; }
          .eb-journey .book-nav .dots{ max-width:34vw; }
        }
`}</style>

      <div className="inner">
        <h1>Journey</h1>
        <p className="sub">
          Your trading notebook, plans, post-mortems, chart screenshots, and the running story behind the numbers.
          Everything saves automatically as you type.
        </p>

        {error && <div className="err">{error}</div>}

        <div className={`layout ${mobilePage ? "show-page" : ""}`}>
          <div className="col list-col">
            <div className="list-head">
              <div className="list-head-top">
                <span>Notes</span>
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
              <div className="fchips" role="tablist" aria-label="Journal folders">
                <button className={`fchip ${activeFolder === "all" ? "on" : ""}`} onClick={() => setActiveFolder("all")}>All <em>{entries.length}</em></button>
                {allFolders.map((f) => (
                  <button key={f.name} className={`fchip ${activeFolder === f.name ? "on" : ""}`} style={{ "--fc": f.color } as React.CSSProperties} onClick={() => setActiveFolder(f.name)}>
                    <BookOpen size={12} /> {f.name} <em>{folderCount(f.name)}</em>
                  </button>
                ))}
                <button className="fchip add" onClick={() => { setAssignAfter(false); setFolderSheet(true); }}><FolderPlus size={12} /> Folder</button>
              </div>
              {activeFolder !== "all" && (
                <div className="folder-banner" style={{ "--fc": allFolders.find((f) => f.name === activeFolder)?.color ?? "#6A55F1" } as React.CSSProperties}>
                  <BookOpen size={16} /><b>{activeFolder}</b><span>{folderCount(activeFolder)} note{folderCount(activeFolder) === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
            <div className="list">
              {loading ? (
                <div className="empty">Loading…</div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty">{search ? "No notes match your search." : "No notes yet. Start your first one."}</div>
              ) : (
                filteredEntries.map((e) => (
                  <button key={e.id} className={`item ${e.id === activeId ? "active" : ""}`} onClick={() => selectEntry(e)}>
                    <div className="t"><FileText size={14} />{e.title || "Untitled Entry"}</div>
                    <div className="m">{timeAgo(e.updated_at)}{e.is_shared ? " · shared" : ""}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="col page-col">
            {!active ? (
              <div className="empty">Select an entry, or create a new one to begin writing.</div>
            ) : (
              <div className="editor" style={{ "--ts": `${TEXT_SIZES[textSize]}rem` } as React.CSSProperties}>
                <div className="page-top">
                  <button className="back-btn" onClick={() => setMobilePage(false)}><ChevronLeft size={18} /> Journey</button>
                  <div className="seg-mini" role="tablist" aria-label="Mode">
                    <button role="tab" aria-selected={!readMode} className={!readMode ? "on" : ""} onClick={() => setReadMode(false)}>Edit</button>
                    <button role="tab" aria-selected={readMode} className={readMode ? "on" : ""} onClick={() => setReadMode(true)}>Read</button>
                  </div>
                </div>

                <input
                  className="title-input"
                  value={title}
                  aria-label="Entry title"
                  placeholder="Untitled"
                  onChange={(ev) => { setTitle(ev.target.value); queueSave({ title: ev.target.value || "Untitled Entry" }); }}
                />

                <div className="props">
                  <span className="prop"><BookOpen size={13} /> Folder</span>
                  <label className="folder-row">
                    <select
                      value={entryFolderOf(active) ?? ""}
                      onChange={(ev) => {
                        if (ev.target.value === "__new__") { setAssignAfter(true); setFolderSheet(true); return; }
                        setEntryFolder(active.id, ev.target.value || null);
                      }}
                      aria-label="Entry folder"
                    >
                      <option value="">Empty</option>
                      {allFolders.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                      <option value="__new__">+ New folder…</option>
                    </select>
                  </label>
                  <span className="prop"><Clock size={13} /> Updated</span>
                  <span className="prop-v">{timeAgo(active.updated_at)}</span>
                </div>

                {!readMode ? (
                  <div className="fmt-bar" role="toolbar" aria-label="Formatting" onMouseDown={(ev) => ev.preventDefault()}>
                    <button onClick={() => applyFormat("h1")} aria-label="Heading 1"><Heading1 size={16} /></button>
                    <button onClick={() => applyFormat("h2")} aria-label="Heading 2"><Heading2 size={16} /></button>
                    <span className="sep" />
                    <button onClick={() => applyFormat("bold")} aria-label="Bold"><Bold size={16} /></button>
                    <button onClick={() => applyFormat("italic")} aria-label="Italic"><Italic size={16} /></button>
                    <button onClick={() => applyFormat("code")} aria-label="Code"><Code size={16} /></button>
                    <span className="sep" />
                    <button onClick={() => applyFormat("bullet")} aria-label="Bullet list"><List size={16} /></button>
                    <button onClick={() => applyFormat("number")} aria-label="Numbered list"><ListOrdered size={16} /></button>
                    <button onClick={() => applyFormat("todo")} aria-label="Checklist"><ListChecks size={16} /></button>
                    <button onClick={() => applyFormat("quote")} aria-label="Quote"><Quote size={16} /></button>
                    <button onClick={() => applyFormat("divider")} aria-label="Divider"><Minus size={16} /></button>
                    <span className="sep" />
                    <button onClick={() => inlineInputRef.current?.click()} aria-label="Add picture to this page"><ImagePlus size={16} /></button>
                    <span className="sep" />
                    <button className="ts-btn" onClick={() => changeTextSize(-1)} disabled={textSize === 0} aria-label="Smaller text">A<small>−</small></button>
                    <button className="ts-btn big" onClick={() => changeTextSize(1)} disabled={textSize === TEXT_SIZES.length - 1} aria-label="Larger text">A<small>+</small></button>
                  </div>
                ) : (
                  <div className="fmt-bar ts-only" role="toolbar" aria-label="Text size">
                    <button className="ts-btn" onClick={() => changeTextSize(-1)} disabled={textSize === 0} aria-label="Smaller text">A<small>−</small></button>
                    <button className="ts-btn big" onClick={() => changeTextSize(1)} disabled={textSize === TEXT_SIZES.length - 1} aria-label="Larger text">A<small>+</small></button>
                  </div>
                )}

                <div className="book" ref={bookRef} onScroll={onBookScroll}>
                  {doc.map((blocks, p) => (
                    <section key={p} className="sheet" aria-label={`Page ${p + 1} of ${doc.length}`}>
                      <div className="sheet-body">
                        {blocks.map((txt, bi) => {
                          const isEditing = !readMode && editing?.p === p && editing.b === bi;
                          return isEditing ? (
                            <textarea
                              key={`${p}-${bi}`} ref={bodyRef} className="blk-edit" rows={1} autoFocus value={txt}
                              aria-label={`Page ${p + 1} text`}
                              placeholder={bi === 0 && blocks.length === 1 ? "Start writing…" : "Write…"}
                              onFocus={(ev) => { const l = ev.target.value.length; ev.target.setSelectionRange(l, l); }}
                              onChange={(ev) => setBlockText(p, bi, ev.target.value)}
                              onBlur={() => onBlockBlur(p, bi)}
                              onKeyDown={(ev) => onBlockKey(ev, p, bi)}
                            />
                          ) : (
                            <div key={`${p}-${bi}`} className={`blk doc-read ${readMode ? "ro" : ""}`} onClick={() => startEdit(p, bi)}>
                              {txt.trim() ? renderMarkdown(txt, (li) => toggleCheckAt(p, bi, li), imgOf, openInlineImage) : <p className="blk-empty">{readMode ? "" : "Tap to start writing…"}</p>}
                            </div>
                          );
                        })}
                        {!readMode && (
                          <button className="blk-add" onClick={() => addBlock(p)} aria-label="Add a paragraph">+ Add a paragraph</button>
                        )}
                      </div>
                      <div className="sheet-foot">{p + 1} / {doc.length}</div>
                    </section>
                  ))}
                </div>

                <div className="book-nav">
                  <button onClick={() => goPage(pageIdx - 1)} disabled={pageIdx === 0} aria-label="Previous page"><ChevronLeft size={18} /></button>
                  <div className="dots" role="tablist" aria-label="Pages">
                    {doc.map((_, i) => <button key={i} role="tab" aria-selected={i === pageIdx} className={i === pageIdx ? "on" : ""} onClick={() => goPage(i)} aria-label={`Page ${i + 1}`} />)}
                  </div>
                  <button onClick={() => goPage(pageIdx + 1)} disabled={pageIdx >= doc.length - 1} aria-label="Next page"><ChevronRight size={18} /></button>
                  <span className="sp" />
                  {!readMode && <button className="add-page" onClick={addPage}><FilePlus size={15} /> Add page</button>}
                  {!readMode && doc.length > 1 && <button className="del-page" onClick={() => deletePage(pageIdx)} aria-label="Delete this page"><Trash2 size={15} /></button>}
                </div>

                <input ref={inlineInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files?.length) handleInlineUpload(e.target.files); e.target.value = ""; }} />

                <div className="gallery">
                  <div className="gallery-head-row">
                    <span className="meta">Pictures under this note</span>
                    <select className="album-select" value={uploadAlbum} onChange={(e) => setUploadAlbum(e.target.value)} title="New photos go to this album">
                      {allAlbums.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="gallery-grid">
                    {images.map((img, idx) => (
                      <div key={img.id} className="gallery-item" onClick={() => openViewer(images.map((x) => ({ url: x.url, title: active?.title || "Entry", sub: labelFor(x.album) })), idx)}>
                        <img src={img.url} alt="" loading="lazy" />
                        <button className="gallery-insert" onClick={(e) => { e.stopPropagation(); insertAtCursor(tokenFor(img.id)); toast.success("Added to the page"); }} aria-label="Insert into page" title="Insert into page">
                          <FileText size={11} />
                        </button>
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

      {folderSheet && (
        <div className="album-modal fixed-modal" onClick={() => setFolderSheet(false)}>
          <div className="album-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <h3>New folder</h3>
            <input
              autoFocus value={folderName} maxLength={40} placeholder="Folder name, e.g. Ideas, Weekly reviews"
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
            />
            <div className="swatches" aria-label="Folder color">
              {ALBUM_COLORS.map((c) => <button key={c} className={`sw ${folderColor === c ? "on" : ""}`} style={{ background: c }} onClick={() => setFolderColor(c)} aria-label={c} />)}
            </div>
            <div className="album-sheet-actions">
              <button className="btn" onClick={() => setFolderSheet(false)}>Cancel</button>
              <button className="btn primary" disabled={!folderName.trim()} onClick={createFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {viewer && createPortal(
        <div className="eb-journey pv-portal">
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
        </div>,
        document.body
      )}

      {galleryOpen && (
        <div className="gallery-fullscreen">
          <div className="gallery-fs-head">
            <span className="gallery-fs-title">{galleryView === "albums" ? "Albums" : activeAlbum === "all" ? "Library" : labelFor(activeAlbum)}</span>
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

          <div className="album-tabs" style={galleryView === "albums" ? { display: "none" } : undefined}>
            <button className={`album-tab ${activeAlbum === "all" ? "on" : ""}`} onClick={() => setActiveAlbum("all")}>All Photos</button>
            {allAlbums.map((a) => (
              <button key={a.key} className={`album-tab ${activeAlbum === a.key ? "on" : ""}`} onClick={() => setActiveAlbum(a.key)}>
                {a.label}
              </button>
            ))}
          </div>

          <div
            className="gallery-fs-body"
            ref={galleryBodyRef}
            style={galleryView === "albums" ? { display: "none" } : undefined}
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
                {visibleGalleryImages.slice(0, visibleCount).map((img, idx) => {
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
                      <img src={img.url} alt="" loading="lazy" decoding="async" />
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
                {visibleCount < visibleGalleryImages.length && <div ref={sentinelRef} style={{ gridColumn: "1 / -1", height: 1 }} />}
              </div>
            )}
          </div>

          {galleryView === "albums" && (
            <div className="gallery-fs-body albums-body">
              <div className="folder-grid">
                {allAlbums.map((a, i) => {
                  const imgs = galleryImages.filter((img) => (img.album ?? "general") === a.key);
                  const isCustom = customAlbums.some((l) => albumKeyOf(l) === a.key);
                  const chosen = albumColors[a.key];
                  return (
                    <div
                      key={a.key} role="button" tabIndex={0} className="folder-card" data-hue={i % 6}
                      style={chosen ? ({ "--f1": chosen, "--f2": `color-mix(in srgb, ${chosen} 62%, #fff)` } as React.CSSProperties) : undefined}
                      onClick={() => { setActiveAlbum(a.key); setGalleryView("library"); setVisibleCount(60); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { setActiveAlbum(a.key); setGalleryView("library"); setVisibleCount(60); } }}
                    >
                      <div className="folder-art">
                        {imgs.slice(0, 3).map((im, n) => <img key={im.id} src={im.url} alt="" className={`folder-thumb t${n}`} loading="lazy" decoding="async" />)}
                        <button className="album-paint" aria-label="Album color" onClick={(e) => { e.stopPropagation(); setColorSheet(a.key); }}><Palette size={13} /></button>
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
                  <div className="folder-meta"><b>New album</b><span>Pick a name and color</span></div>
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
          {!(selectMode && selectedIds.size > 0) && (
            <nav className="gal-tabbar" aria-label="Gallery sections">
              <button className={`gal-tab ${galleryView === "library" ? "on" : ""}`} onClick={() => { setGalleryView("library"); setActiveAlbum("all"); }}><ImageIcon size={20} />Library</button>
              <button className={`gal-tab ${galleryView === "albums" ? "on" : ""}`} onClick={() => setGalleryView("albums")}><LayoutGrid size={20} />Albums</button>
            </nav>
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
                <div className="swatches" aria-label="Album color">
                  <button className={`sw auto ${newAlbumColor === "" ? "on" : ""}`} onClick={() => setNewAlbumColor("")}>Auto</button>
                  {ALBUM_COLORS.map((c) => <button key={c} className={`sw ${newAlbumColor === c ? "on" : ""}`} style={{ background: c }} onClick={() => setNewAlbumColor(c)} aria-label={c} />)}
                </div>
                <div className="album-sheet-actions">
                  <button className="btn" onClick={() => setNewAlbumOpen(false)}>Cancel</button>
                  <button className="btn primary" disabled={!newAlbumName.trim()} onClick={createAlbum}>Create</button>
                </div>
              </div>
            </div>
          )}

          {colorSheet && (
            <div className="album-modal" onClick={() => setColorSheet(null)}>
              <div className="album-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-grab" />
                <h3>Album color</h3>
                <div className="swatches">
                  <button className={`sw auto ${!albumColors[colorSheet] ? "on" : ""}`} onClick={() => { setAlbumColor(colorSheet, ""); setColorSheet(null); }}>Auto</button>
                  {ALBUM_COLORS.map((c) => <button key={c} className={`sw ${albumColors[colorSheet] === c ? "on" : ""}`} style={{ background: c }} onClick={() => { setAlbumColor(colorSheet, c); setColorSheet(null); }} aria-label={c} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
