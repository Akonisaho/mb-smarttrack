import { C } from '../../lib/styles';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';

export default function RequestsTab({ clientRequests, setClientRequests, profile, showAlert, isMobile }) {
  const router = useRouter();
  const pending = clientRequests.filter(r => r.status === 'pending');
  const urgColor = u => u === 'urgent' ? '#E05252' : u === 'low' ? '#555' : '#EAB308';
  const statusBg = s => s === 'pending' ? 'rgba(234,179,8,0.1)' : s === 'converted' ? 'rgba(141,198,63,0.1)' : s === 'rejected' ? 'rgba(220,80,80,0.1)' : 'rgba(74,144,217,0.1)';
  const statusCol = s => s === 'pending' ? '#EAB308' : s === 'converted' ? '#8DC63F' : s === 'rejected' ? '#E05252' : '#4A90D9';

  const refresh = () =>
    supabase.from('client_requests').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setClientRequests(data || []));

  const markReviewed = async r => {
    await supabase.from('client_requests').update({ status: 'reviewed', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', r.id);
    setClientRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'reviewed' } : x));
    showAlert(`✓ Request from ${r.full_name} marked as reviewed.`);
  };

  const markConverted = async r => {
    await supabase.from('client_requests').update({ status: 'converted' }).eq('id', r.id);
    setClientRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'converted' } : x));
    showAlert('✓ Marked as converted.');
  };

  const reject = async r => {
    if (!confirm('Reject this request?')) return;
    await supabase.from('client_requests').update({ status: 'rejected', reviewed_by: profile?.id }).eq('id', r.id);
    setClientRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'rejected' } : x));
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Client Requests</div>
          <div className="mb-sub">New client enquiries and service requests from the portal</div>
        </div>
        <button className="mb-btn" onClick={refresh}>↻ Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Requests', v: clientRequests.length },
          { l: 'Pending', v: pending.length, w: pending.length > 0 },
          { l: 'Converted to Clients', v: clientRequests.filter(r => r.status === 'converted').length, a: true },
        ].map(({ l, v, w, a }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w && v > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      {!clientRequests.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
          <div style={{ fontSize: 14 }}>No requests yet</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 6 }}>Client requests submitted via the portal will appear here</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>{['Date', 'Name', 'Email', 'Phone', 'Service', 'Urgency', 'Status', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {clientRequests.map(r => (
                <tr key={r.id}>
                  <td className="mb-td" style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="mb-td" style={{ fontWeight: 600, color: '#D0D0D0' }}>{r.full_name}</td>
                  <td className="mb-td" style={{ fontSize: 11, color: '#555' }}>{r.email}</td>
                  <td className="mb-td" style={{ fontSize: 11, color: '#555' }}>{r.phone || '—'}</td>
                  <td className="mb-td" style={{ color: '#8DC63F', fontWeight: 600, fontSize: 11 }}>{r.service_type}</td>
                  <td className="mb-td"><span className="mb-badge" style={{ background: 'rgba(85,85,85,0.15)', color: urgColor(r.urgency) }}>{r.urgency}</span></td>
                  <td className="mb-td"><span className="mb-badge" style={{ background: statusBg(r.status), color: statusCol(r.status) }}>{r.status}</span></td>
                  <td className="mb-td">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.status === 'pending' && (
                        <>
                          <button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => markReviewed(r)}>Review</button>
                          <button className="mb-btn mb-btn-sm" onClick={() => { router.push('/clients'); showAlert(`Opening clients — add ${r.full_name} as a new client.`); }}>→ Client</button>
                        </>
                      )}
                      {r.status === 'reviewed' && <button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => markConverted(r)}>✓ Converted</button>}
                      <button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => reject(r)}>Reject</button>
                    </div>
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
