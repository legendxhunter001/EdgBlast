export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden>
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
  )
}
