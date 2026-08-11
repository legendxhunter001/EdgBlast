import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, LayoutGrid, List, Filter, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { formatCurrency, pnlClass } from '@/lib/format';
import { DirectionBadge } from './Dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ImportCsvDialog from '@/components/ImportCsvDialog';

const Trades = () => {
  const { data: trades, isLoading } = useTrades();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'long' | 'short'>('all');
  const [sort, setSort] = useState<'date' | 'pnl' | 'asset'>('date');
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = trades ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t => t.asset.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q));
    if (filter === 'wins') list = list.filter(t => (t.pnl ?? 0) > 0);
    if (filter === 'losses') list = list.filter(t => (t.pnl ?? 0) < 0);
    if (filter === 'long') list = list.filter(t => t.direction === 'long');
    if (filter === 'short') list = list.filter(t => t.direction === 'short');

    list = [...list].sort((a, b) => {
      if (sort === 'pnl') return Number(b.pnl ?? 0) - Number(a.pnl ?? 0);
      if (sort === 'asset') return a.asset.localeCompare(b.asset);
      return (b.entry_at || b.created_at).localeCompare(a.entry_at || a.created_at);
    });
    return list;
  }, [trades, search, filter, sort]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">{(trades ?? []).length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
            <FileUp className="size-4" /> Import CSV
          </Button>
          <Link to="/trades/new" className="px-4 py-2 rounded-lg bg-gradient-bull text-primary-foreground text-sm font-medium shadow-glow-bull">+ New trade</Link>
        </div>
      </header>

      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset or notes…" className="pl-9 bg-secondary/40 border-border" />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[140px] bg-secondary/40"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trades</SelectItem>
            <SelectItem value="wins">Wins</SelectItem>
            <SelectItem value="losses">Losses</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v: any) => setSort(v)}>
          <SelectTrigger className="w-[140px] bg-secondary/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest</SelectItem>
            <SelectItem value="pnl">Highest P&L</SelectItem>
            <SelectItem value="asset">Asset A–Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md bg-secondary/40 p-0.5">
          <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('table')}><List className="size-4" /></Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')}><LayoutGrid className="size-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">No trades match your filters.</div>
      ) : view === 'table' ? (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="font-medium">Side</th>
                  <th className="font-medium">Date</th>
                  <th className="font-medium text-right">Entry</th>
                  <th className="font-medium text-right">Exit</th>
                  <th className="font-medium text-right">P&L</th>
                  <th className="font-medium text-right pr-4">R:R</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t border-border/40 hover:bg-secondary/30 transition">
                    <td className="px-4 py-3"><Link to={`/trades/${t.id}`} className="font-medium hover:text-primary">{t.asset}</Link></td>
                    <td><DirectionBadge dir={t.direction} /></td>
                    <td className="text-muted-foreground text-xs">{t.entry_at ? format(parseISO(t.entry_at), 'MMM d, yyyy') : '—'}</td>
                    <td className="text-right font-mono text-xs">{t.entry_price ?? '—'}</td>
                    <td className="text-right font-mono text-xs">{t.exit_price ?? '—'}</td>
                    <td className={`text-right font-mono ${pnlClass(t.pnl)}`}>{formatCurrency(t.pnl, { sign: true })}</td>
                    <td className="text-right pr-4 font-mono text-xs text-muted-foreground">{t.risk_reward ? `${Number(t.risk_reward).toFixed(2)}R` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Link key={t.id} to={`/trades/${t.id}`} className="glass rounded-xl p-4 hover:border-primary/40 transition group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display font-semibold text-lg group-hover:text-primary transition">{t.asset}</div>
                  <div className="text-xs text-muted-foreground">{t.entry_at ? format(parseISO(t.entry_at), 'MMM d, yyyy') : '—'}</div>
                </div>
                <DirectionBadge dir={t.direction} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L</div>
                  <div className={`font-mono text-xl font-semibold ${pnlClass(t.pnl)}`}>{formatCurrency(t.pnl, { sign: true })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">R:R</div>
                  <div className="font-mono text-sm">{t.risk_reward ? `${Number(t.risk_reward).toFixed(2)}R` : '—'}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Trades;
