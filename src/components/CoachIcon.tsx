/** The Edge Blast mark, drawn to match the line icons used across the app. */
export const CoachIcon = ({ strokeWidth = 1.9, className }: { strokeWidth?: number; className?: string }) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
    <g stroke="currentColor" strokeWidth={strokeWidth * 0.55} strokeLinecap="round" opacity=".55">
      <line x1="16" y1="16" x2="16" y2="6" /><line x1="16" y1="16" x2="16" y2="26" /><line x1="16" y1="16" x2="6" y2="16" /><line x1="16" y1="16" x2="26" y2="16" />
    </g>
    <g fill="currentColor">
      <circle cx="16" cy="6" r="2.3" /><circle cx="16" cy="26" r="2.3" /><circle cx="6" cy="16" r="2.3" /><circle cx="26" cy="16" r="2.3" />
      <circle cx="9" cy="9" r="1.8" opacity=".65" /><circle cx="23" cy="9" r="1.8" opacity=".65" /><circle cx="9" cy="23" r="1.8" opacity=".65" /><circle cx="23" cy="23" r="1.8" opacity=".65" />
      <circle cx="16" cy="16" r="3.2" />
    </g>
  </svg>
);
