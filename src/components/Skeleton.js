export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#1A1A1A 25%,#242424 50%,#1A1A1A 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function SkeletonCard({ rows = 3, style = {} }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      <Skeleton height={14} width="55%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={11} width={i % 2 === 0 ? '80%' : '65%'} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: '8px 12px' }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} height={10} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: '12px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 7 }}>
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} height={12} width={j === 0 ? '70%' : '50%'} />)}
        </div>
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        {[1,2,3,4].map(i => <SkeletonCard key={i} rows={2} />)}
      </div>
      <SkeletonTable rows={6} cols={4} />
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}
