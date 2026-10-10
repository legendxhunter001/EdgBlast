import { Link } from 'react-router-dom';
import {
  LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen, MessageCircle, Compass,
  LineChart, Wrench, Plug, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { IosSheet } from '@/components/IosSheet';
import { useAuth } from '@/hooks/useAuth';

const GROUPS = [
  { title: 'Main', items: [
    { to: '/', label: 'Home', icon: LayoutDashboard }, { to: '/trades', label: 'Trades', icon: ListOrdered },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays }, { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/reviews', label: 'Review', icon: NotebookPen },
  ] },
  { title: 'More', items: [
    { to: '/ai-coach', label: 'Coach', icon: MessageCircle }, { to: '/journey', label: 'Journey', icon: Compass },
    { to: '/mt5', label: 'MT5', icon: LineChart }, { to: '/trading-tools', label: 'Tools', icon: Wrench },
    { to: '/connections', label: 'Connections', icon: Plug },
  ] },
  { title: 'Account', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
];

/** Every page in one place. Opens from the menu button, so nothing is ever hidden behind the dock. */
export const NavSheet = ({ onClose }: { onClose: () => void }) => {
  const { user, signOut } = useAuth();
  return (
    <IosSheet title="Menu" onClose={onClose}>
      <div className="space-y-4 pb-1">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">{g.title}</h2>
            <div className="bg-card border border-border rounded-[20px] px-3.5">
              {g.items.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={onClose} className="flex items-center gap-3 py-3 border-t border-border first:border-t-0 active:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  <span className="size-8 rounded-[9px] grid place-items-center bg-secondary shrink-0"><Icon className="size-[17px]" /></span>
                  <span className="flex-1 text-[16px]">{label}</span>
                  <ChevronRight className="size-[17px] text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        ))}
        <button onClick={() => { onClose(); signOut(); }} className="w-full flex items-center gap-3 bg-card border border-border rounded-[20px] px-3.5 py-3 text-left active:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="size-8 rounded-[9px] grid place-items-center shrink-0" style={{ background: 'hsl(var(--bear) / .14)', color: 'hsl(var(--bear))' }}><LogOut className="size-[17px]" /></span>
          <span className="flex-1"><span className="block text-[16px]" style={{ color: 'hsl(var(--bear))' }}>Sign out</span>{user?.email && <span className="block text-[12.5px] text-muted-foreground truncate">{user.email}</span>}</span>
        </button>
      </div>
    </IosSheet>
  );
};
