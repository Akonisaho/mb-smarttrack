import { C } from '../../lib/styles';

export default function StatCard({ label, value, note, accent = false, warn = false }) {
  return (
    <div style={C.stat(accent, warn)}>
      <div className="mb-stat-label">{label}</div>
      <div className="mb-stat-value" style={{ color: accent ? '#8DC63F' : warn ? '#EAB308' : '#F0F0F0' }}>{value}</div>
      {note && <div className="mb-stat-note">{note}</div>}
    </div>
  );
}
