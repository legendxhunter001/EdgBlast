export const BrandLoading = ({ label }: { label?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'hsl(var(--background))' }}>
    <svg viewBox="0 0 512 512" className="eb-loading-mark" style={{ width: 64, height: 64 }}>
      <defs>
        <linearGradient id="ebLoadingGrad" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#14C9AE" />
          <stop offset="100%" stopColor="#3D6FE5" />
        </linearGradient>
      </defs>
      <rect x="132" y="96" width="54" height="320" rx="10" fill="url(#ebLoadingGrad)" className="eb-lp eb-lp-1" />
      <polygon points="132,96 391,125 132,154" fill="url(#ebLoadingGrad)" className="eb-lp eb-lp-2" />
      <polygon points="132,227 351,256 132,285" fill="url(#ebLoadingGrad)" className="eb-lp eb-lp-3" />
      <polygon points="132,358 316,387 132,416" fill="url(#ebLoadingGrad)" className="eb-lp eb-lp-4" />
    </svg>
    {label && <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>}
    <style>{`
      .eb-lp { transform-origin: center; animation: eb-lp-pulse 1.4s ease-in-out infinite; }
      .eb-lp-1 { animation-delay: 0ms; }
      .eb-lp-2 { animation-delay: 120ms; }
      .eb-lp-3 { animation-delay: 240ms; }
      .eb-lp-4 { animation-delay: 360ms; }
      @keyframes eb-lp-pulse {
        0%, 100% { opacity: 0.35; transform: scale(0.94); }
        40% { opacity: 1; transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .eb-lp { animation: none; opacity: 1; }
      }
    `}</style>
  </div>
);

export default BrandLoading;
