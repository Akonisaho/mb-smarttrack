export default function BarChart({ data, height = 120 }) {
  if (!data || !data.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 12 }}>
        No data
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingBottom: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: d.color || '#8DC63F', fontWeight: 600, marginBottom: 2 }}>{d.label2 || ''}</div>
          <div style={{ width: '100%', background: d.color || '#8DC63F', borderRadius: '3px 3px 0 0', height: `${Math.max((d.value / max) * 80, 2)}%`, opacity: 0.85, minHeight: d.value > 0 ? 4 : 0 }} />
          <div style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center', marginTop: 4, whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}
