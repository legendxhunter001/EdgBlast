import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, Plug, Compass, Wrench,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarState } from '@/hooks/useSidebar';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Sheet, SheetContent } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type Item = { to: string; label: string; icon: any };
type Entry = Item | { divider: string };

const items: Entry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reviews', label: 'Reviews', icon: NotebookPen },
  { divider: 'Journey' },
  { to: '/journey', label: 'Journey', icon: Compass },
  { divider: 'Connections' },
  { to: '/connections', label: 'Connections', icon: Plug },
  { divider: 'Trading Tools' },
  { to: '/trading-tools', label: 'Trading Tools', icon: Wrench },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const NavItems = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
  const { pathname } = useLocation();
  return (
    <nav className={cn('flex-1 py-4 space-y-1', collapsed ? 'px-2' : 'px-3')}>
      {items.map((entry) => {
        if ('divider' in entry) {
          return collapsed ? (
            <div key={entry.divider} className="my-2 mx-auto h-px w-6 bg-sidebar-border" />
          ) : (
            <div
              key={entry.divider}
              className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50"
            >
              {entry.divider}
            </div>
          );
        }
        const { to, label, icon: Icon } = entry;
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
        const link = (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              'group flex items-center rounded-lg text-sm font-medium press relative overflow-hidden transition-all duration-300',
              collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-card'
                : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60'
            )}
          >
            {active && !collapsed && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
            )}
            <Icon className={cn('size-4 shrink-0 transition-all duration-300 group-hover:scale-110',
              active ? 'text-primary' : 'text-sidebar-foreground/70')} />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && active && <span className="size-1.5 rounded-full bg-primary" />}
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
    <div className="flex flex-col h-full bg-sidebar">
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
        'hidden md:flex shrink-0 border-r border-sidebar-border h-screen sticky top-0 transition-[width] duration-300 ease-out',
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
