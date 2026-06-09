import { C } from '../../lib/styles';
import { fetchAuditLog } from '../../lib/supabase';

export default function AuditTab({ auditLogs, auditLoading, setAuditLogs, setAuditLoading }) {
  const refresh = () => {
    setAuditLoading(true);
    fetchAuditLog({}).then(r => { setAuditLogs(r.logs || []); setAuditLoading(false); });
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Audit Trail</div>
          <div className="mb-sub">Full log of all actions taken in the system</div>
        </div>
        <button className="mb-btn" onClick={refresh}>↻ Refresh</button>
      </div>

      {auditLoading ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>Loading…</div>
      ) : !auditLogs.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div>No audit entries yet</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 6 }}>Actions like invoicing, trust transactions and credit notes will appear here</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>
                {['Date & Time', 'User', 'Action', 'Entity', 'Details'].map(h => (
                  <th key={h} className="mb-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(l => (
                <tr key={l.id}>
                  <td className="mb-td" style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="mb-td" style={{ color: '#C8C8C8' }}>{l.profiles?.full_name || 'System'}</td>
                  <td className="mb-td">
                    <span className="mb-badge" style={{ background: 'rgba(141,198,63,0.08)', color: '#8DC63F' }}>
                      {l.action?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="mb-td" style={{ fontSize: 10, color: '#A78BFA', fontFamily: 'monospace' }}>
                    {l.entity_type} {l.entity_id ? `· ${l.entity_id.substring(0, 12)}…` : ''}
                  </td>
                  <td className="mb-td" style={{ fontSize: 10, color: '#555' }}>
                    {l.details ? JSON.stringify(l.details).substring(0, 60) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
