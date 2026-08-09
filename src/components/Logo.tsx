import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo = ({ size = 36, className }: LogoProps) => (
  <div
    className={cn(
      'rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-black border border-border',
      className,
    )}
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 512 512" width={size * 0.7} height={size * 0.7} aria-hidden>
      <defs>
        <linearGradient id="ebLogoGrad" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(217 36% 63%)" />
        </linearGradient>
      </defs>
      <rect x="132" y="96" width="54" height="320" rx="10" fill="url(#ebLogoGrad)" />
      <polygon points="132,96 391,125 132,154" fill="url(#ebLogoGrad)" />
      <polygon points="132,227 351,256 132,285" fill="url(#ebLogoGrad)" />
      <polygon points="132,358 316,387 132,416" fill="url(#ebLogoGrad)" />
    </svg>
  </div>
);
