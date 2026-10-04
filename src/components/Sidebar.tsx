import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { prefetch } from '@/lib/routes';
import {
  LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, Plug, Compass, Wrench, LineChart, Sparkles,
  ChevronRight, CandlestickChart, Calculator, Newspaper,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarState } from '@/hooks/useSidebar';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Sheet, SheetContent } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type Child = { key: string; to: string; label: string; icon: any };
type Item = { to: string; label: string; icon: any; children?: Child[] };
type Entry = Item | { divider: string };

const items: Entry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reviews', label: 'Reviews', icon: NotebookPen },
  { to: '/ai-coach', label: 'AI Coach', icon: Sparkles },
  { divider: 'Journey' },
  { to: '/journey', label: 'Journey', icon: Compass },
  { divider: 'Connections' },
  { to: '/connections', label: 'Connections', icon: Plug },
  { divider: 'Trading Tools' },
  { to: '/mt5', label: 'MT5', icon: LineChart },
  { to: '/trading-tools', label: 'Trading Tools', icon: Wrench, children: [
    { key: 'chart', to: '/trading-tools?tool=chart', label: 'Chart', icon: CandlestickChart },
    { key: 'calculator', to: '/trading-tools?tool=calculator', label: 'Calculator', icon: Calculator },
    { key: 'news', to: '/trading-tools?tool=news', label: 'News', icon: Newspaper },
  ] },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const rowClass = (active: boolean, collapsed: boolean) => cn(
  'group flex items-center rounded-[10px] text-[13px] font-medium press relative transition-colors duration-150 w-full',
  collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-2.5 h-9',
  active ? 'bg-primary/15 text-primary' : 'text-sidebar-foreground hover:bg-foreground/[0.06]'
);

const NavItems = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [toolsOpen, setToolsOpen] = useState(true);
  const tool = new URLSearchParams(search).get('tool') ?? 'chart';

  return (
    <nav className={cn('flex-1 py-2 space-y-0.5 overflow-y-auto', collapsed ? 'px-2' : 'px-2.5')}>
      {items.map((entry) => {
        if ('divider' in entry) {
          return collapsed ? (
            <div key={entry.divider} className="my-2 mx-auto h-px w-6 bg-sidebar-border" />
          ) : (
            <div key={entry.divider} className="px-2.5 pt-4 pb-1 text-[11px] font-semibold text-sidebar-foreground/50">
              {entry.divider}
            </div>
          );
        }
        const { to, label, icon: Icon, children } = entry;
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);

        if (children) {
          const open = toolsOpen && !collapsed;
          if (collapsed) {
            return (
              <Tooltip key={to} delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink to={children[0].to} onClick={onNavigate} onMouseEnter={() => prefetch(to)} className={rowClass(active, true)}>
                    <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-sidebar-foreground/70')} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
              </Tooltip>
            );
          }
          return (
            <div key={to}>
              <button
                type="button"
                className={rowClass(active && !open, false)}
                aria-expanded={open}
                onMouseEnter={() => prefetch(to)}
                onClick={() => {
                  if (!active) { navigate(children[0].to); setToolsOpen(true); onNavigate?.(); }
                  else setToolsOpen((o) => !o);
                }}
              >
                <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-sidebar-foreground/70')} />
                <span className="flex-1 truncate text-left">{label}</span>
                <ChevronRight className={cn('size-3.5 text-sidebar-foreground/50 transition-transform duration-200', open && 'rotate-90')} />
              </button>
              <div className={cn('eb-branch grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden">
                  <div className="ml-[19px] pl-2.5 border-l border-sidebar-border/80 py-0.5 space-y-0.5">
                    {children.map((c) => {
                      const childActive = active && tool === c.key;
                      return (
                        <NavLink
                          key={c.key} to={c.to} onClick={onNavigate} tabIndex={open ? 0 : -1}
                          onMouseEnter={() => prefetch(c.to)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg h-8 px-2 text-[12.5px] font-medium press transition-colors duration-150',
                            childActive ? 'bg-primary/15 text-primary' : 'text-sidebar-foreground hover:bg-foreground/[0.06]'
                          )}
                        >
                          <c.icon className={cn('size-3.5 shrink-0', childActive ? 'text-primary' : 'text-sidebar-foreground/60')} />
                          {c.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const link = (
          <NavLink key={to} to={to} onClick={onNavigate} onMouseEnter={() => prefetch(to)} onFocus={() => prefetch(to)} className={rowClass(active, collapsed)}>
            <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-sidebar-foreground/70')} />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
          </NavLink>
        );
        if (collapsed) {
          return (
            <Tooltip key={to} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );
};

const SidebarInner = ({ collapsed, onNavigate, showCollapseBtn = true }: {
  collapsed: boolean;
  onNavigate?: () => void;
  showCollapseBtn?: boolean;
}) => {
  const { user, signOut } = useAuth();
  const { toggleCollapsed } = useSidebarState();

  return (
    <div className="flex flex-col h-full bg-sidebar eb-mac-sidebar">
      <div className={cn(
        'flex items-center border-b border-sidebar-border py-4',
        collapsed ? 'px-2 flex-col gap-3' : 'px-4 gap-3'
      )}>
        {!collapsed ? (
          <>
            <Logo size={32} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-base leading-none text-sidebar-accent-foreground">Edge Blast</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 mt-1">Trading Journal</div>
            </div>
            <ThemeToggle />
          </>
        ) : (
          <Logo size={28} />
        )}
        {showCollapseBtn && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('size-8 rounded-md text-sidebar-foreground/70 hover:text-sidebar-accent-foreground', collapsed ? '' : '')}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        )}
      </div>

      <NavItems collapsed={collapsed} onNavigate={onNavigate} />

      <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-sidebar-foreground/60">Signed in as</div>
            <div className="text-sm text-sidebar-accent-foreground truncate">{user?.email}</div>
          </div>
        )}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={signOut} className="size-10 mx-auto text-sidebar-foreground hover:text-sidebar-accent-foreground">
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground">
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        )}
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const { collapsed } = useSidebarState();
  return (
    <aside
      className={cn(
        'hidden md:flex shrink-0 border-r border-sidebar-border h-screen sticky top-0 transition-[width] duration-300 ease-out eb-dock-aside',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <SidebarInner collapsed={collapsed} />
    </aside>
  );
};

export const MobileSidebar = () => {
  const { mobileOpen, setMobileOpen } = useSidebarState();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="p-0 w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar [&>button]:hidden">
        <SidebarInner collapsed={false} onNavigate={() => setMobileOpen(false)} showCollapseBtn={false} />
      </SheetContent>
    </Sheet>
  );
};
