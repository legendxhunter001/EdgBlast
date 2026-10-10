import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NavSheet } from './NavSheet';
import { Search, Plus, Menu, MoreVertical, Settings, Sun, Moon, Monitor, HelpCircle, Download, User, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from './ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { toast } from 'sonner';
import { Logo } from './Logo';

const titleFor = (path: string) => {
  if (path === '/') return 'Dashboard';
  if (path.startsWith('/trades/new')) return 'New trade';
  if (path.startsWith('/trades/')) return 'Trade detail';
  if (path.startsWith('/trades')) return 'Trades';
  if (path.startsWith('/calendar')) return 'Calendar';
  if (path.startsWith('/analytics')) return 'Analytics';
  if (path.startsWith('/reviews')) return 'Reviews';
  if (path.startsWith('/ai-coach')) return 'Coach';
  if (path.startsWith('/journey')) return 'Journey';
  if (path.startsWith('/connections')) return 'Connections';
  if (path.startsWith('/mt5')) return 'MT5';
  if (path.startsWith('/trading-tools')) return 'Trading Tools';
  if (path.startsWith('/settings')) return 'Settings';
  return '';
};

export const TopBar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const { data: trades } = useTrades();
  const [navOpen, setNavOpen] = useState(false);

  const handleExport = () => {
    if (!trades?.length) return toast.error('No trades to export');
    const headers = ['date','asset','direction','entry','exit','size','pnl','pnl_pct','rr','strategy','emotion','confidence','notes'];
    const rows = trades.map(t => [
      t.entry_at ?? '', t.asset, t.direction, t.entry_price ?? '', t.exit_price ?? '',
      t.position_size ?? '', t.pnl ?? '', t.pnl_percent ?? '', t.risk_reward ?? '',
      t.strategy_id ?? '', t.emotional_state ?? '', t.confidence_rating ?? '',
      (t.notes ?? '').replace(/[\n,]/g, ' '),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trades-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <>
    {navOpen && <NavSheet onClose={() => setNavOpen(false)} />}
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60 eb-toolbar">
      <div className="flex items-center justify-between px-3 md:px-6 h-14">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" className="md:hidden size-9 -ml-1 rounded-full grid place-items-center active:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu className="size-[22px]" /></button>
          <div className="font-display text-base md:text-lg font-semibold truncate eb-title">{titleFor(pathname)}</div>
        </div>

        <div className="flex items-center gap-2">
        <button type="button" className="eb-spot hidden md:flex" onClick={() => window.dispatchEvent(new Event('eb:palette'))} aria-label="Search or jump to">
          <Search className="size-3.5" /><span>Search or jump to…</span><kbd>⌘K</kbd>
        </button>
        <Button asChild size="sm" className="hidden md:inline-flex h-8 rounded-md px-3 text-[13px]">
          <Link to="/trades/new"><Plus className="size-3.5 mr-1" />New trade</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label="Menu">
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="size-4 mr-2" /> Settings
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {mode === 'dark' ? <Moon className="size-4 mr-2" /> : mode === 'light' ? <Sun className="size-4 mr-2" /> : <Monitor className="size-4 mr-2" />}
                Theme mode
                <span className="ml-auto text-xs text-muted-foreground capitalize mr-1">{mode}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
                    <DropdownMenuRadioItem value="light"><Sun className="size-4 mr-2" />Light</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark"><Moon className="size-4 mr-2" />Dark</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system"><Monitor className="size-4 mr-2" />System</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem onClick={() => toast.info('Help center coming soon')}>
              <HelpCircle className="size-4 mr-2" /> Help & guide
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleExport}>
              <Download className="size-4 mr-2" /> Export data
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="size-4 mr-2" /> Profile
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-bear focus:text-bear">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
    </>
  );
};
