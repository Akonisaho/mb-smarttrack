import { C } from '../../lib/styles';
import { useRouter } from 'next/router';

export default function ClientsTab({ clients, ficaRecords, matters, isMobile, showAlert, updateFicaRisk }) {
  const router = useRouter();
  const ficaMap = Object.fromEntries(ficaRecords.map(r => [r.client_id, r]));
  const ficaStatus = id => { const r = ficaMap[id]; if (!r) return 'pending'; return r.fica_status || 'pending'; };
  const FSTA = {
    compliant: { label: 'Compliant', color: '#8DC63F', bg: 'rgba(141,198,63,0.1)' },
    partial:   { label: 'Partial',   color: '#EAB308', bg: 'rgba(234,179,8,0.1)' },
    pending:   { label: 'Pending',   color: '#E07B30', bg: 'rgba(224,123,48,0.1)' },
    expired:   { label: 'Expired',   color: '#E05252', bg: 'rgba(220,80,80,0.1)' },
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Clients</div>
          <div className="mb-sub">{clients.length} clients · Firm-wide</div>
        </div>
        <button className="mb-btn" onClick={() => router.push('/clients')}>Open Full CRM →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Clients', v: clients.length },
          { l: 'FICA Compliant', v: clients.filter(c => ficaStatus(c.id) === 'compliant').length, a: true },
          { l: 'FICA Pending', v: clients.filter(c => ficaStatus(c.id) === 'pending').length, w: true },
          { l: 'FICA Expired', v: clients.filter(c => ficaStatus(c.id) === 'expired').length, w: true },
        ].map(({ l, v, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w && v > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <table className="mb-table">
          <thead>
            <tr>{['Ref', 'Client', 'Type', 'Email', 'FICA', 'Risk', 'Matters'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {!clients.length && (
              <tr>
                <td colSpan={6} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>
                  No clients yet. <button className="mb-btn mb-btn-primary mb-btn-sm" style={{ marginLeft: 8 }} onClick={() => router.push('/clients')}>Add first client →</button>
                </td>
              </tr>
            )}
            {clients.slice(0, 50).map(c => {
              const fs = ficaStatus(c.id);
              const fst = FSTA[fs] || FSTA.pending;
              const cm = matters.filter(m => m.client_id === c.id);
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push('/clients')}>
                  <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#A78BFA' }}>{c.client_no || '—'}</td>
                  <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{c.full_name}</td>
                  <td className="mb-td" style={{ fontSize: 10, textTransform: 'capitalize', color: '#777' }}>{c.client_type || 'individual'}</td>
                  <td className="mb-td" style={{ fontSize: 10, color: '#555' }}>{c.email || '—'}</td>
                  <td className="mb-td">
                    <span className="mb-badge" style={{ background: fst.bg, color: fst.color, border: `1px solid ${fst.color}44` }}>{fst.label}</span>
                  </td>
                  <td className="mb-td">
                    <select className="mb-sel" style={{ fontSize: 9, padding: '2px 6px' }} value={c.risk_rating || 'low'} onChange={e => { e.stopPropagation(); updateFicaRisk(c.id, e.target.value); }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', textAlign: 'center', color: '#777' }}>{cm.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
