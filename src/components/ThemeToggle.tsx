import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { mode, theme, setMode } = useTheme();
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
  const Icon = mode === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMode(next)}
      aria-label={`Theme: ${mode}`}
      title={`Theme: ${mode} (click for ${next})`}
      className={cn('relative size-9 rounded-lg hover:bg-secondary', className)}
    >
      <Icon className="size-4 transition-all" />
    </Button>
  );
};
