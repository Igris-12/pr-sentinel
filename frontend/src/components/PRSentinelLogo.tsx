/**
 * PRSentinel Logo — matches the provided brand design:
 * Glass icon card with bar + line chart, "PR" in white, "Sentinel" in green.
 */
export function PRSentinelLogo({ size = 'md', showText = true }: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
}) {
  const dim = { xs: 22, sm: 28, md: 36, lg: 52 }[size];
  const titleSize = { xs: 13, sm: 15, md: 18, lg: 26 }[size];
  const subSize = { xs: 7, sm: 8, md: 9, lg: 12 }[size];
  const gap = { xs: 6, sm: 7, md: 10, lg: 14 }[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {/* Glass icon card */}
      <div style={{
        width: dim, height: dim,
        borderRadius: dim * 0.24,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(20,30,60,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Glossy top-left sheen */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: '50%', bottom: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
          borderRadius: `${dim * 0.24}px ${dim * 0.24}px 0 0`,
        }} />
        {/* SVG chart icon */}
        <svg
          width={dim * 0.65}
          height={dim * 0.65}
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Bar chart columns — muted blue */}
          <rect x="3" y="10" width="3" height="11" rx="0.5" fill="rgba(101,119,243,0.5)" />
          <rect x="8" y="6"  width="3" height="15" rx="0.5" fill="rgba(101,119,243,0.6)" />
          <rect x="13" y="3" width="3" height="18" rx="0.5" fill="rgba(101,119,243,0.7)" />
          <rect x="18" y="8" width="3" height="13" rx="0.5" fill="rgba(101,119,243,0.55)" />
          {/* Trend line — bright green */}
          <polyline
            points="3,17 8,12 13,8 18,5"
            stroke="#00e88a"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Dots */}
          {([3,17,8,12,13,8,18,5] as number[]).reduce<[number,number][]>((acc,v,i) =>
            i % 2 === 0 ? [...acc, [v, 0]] : acc.map((p,j) => j === acc.length-1 ? [p[0],v] : p), []
          ).map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.4" fill="#00e88a" />
          ))}
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <div style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
            <span style={{ color: 'var(--ps-text, #e6edf3)' }}>PR</span>
            <span style={{ color: '#00e88a' }}>Sentinel</span>
          </div>
          <div style={{ fontSize: subSize, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ps-text-muted, #8b949e)', marginTop: 2 }}>
            Engineering Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
