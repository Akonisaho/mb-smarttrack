import { C } from '../../lib/styles';
import { fmtR, fmtDate } from '../../lib/format';

export default function TrustTab({
  trustTxns, trustBalances, pendingPayments, matters, branches, branchTrustData, isMobile,
  selBranch, setSelBranch, profile, showAlert,
  approvePayment, rejectPayment, load,
}) {
  const totalTrustHeld = Object.values(trustBalances).reduce((s, v) => s + v, 0);

  return (
    <div className="mb-main">
      <div className="mb-heading">Trust Accounting</div>
      <div className="mb-sub" style={{ marginBottom: 16 }}>All branches · Legal Practice Act compliant</div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Total trust held', v: fmtR(totalTrustHeld), a: true },
          { l: 'Total receipts', v: fmtR(trustTxns.filter(t => t.type === 'receipt' && t.status === 'posted').reduce((s, t) => s + Number(t.amount), 0)) },
          { l: 'Total payments', v: fmtR(trustTxns.filter(t => t.type === 'payment' && t.status === 'posted').reduce((s, t) => s + Number(t.amount), 0)) },
          { l: 'Pending approvals', v: pendingPayments.length, w: pendingPayments.length > 0 },
        ].map(({ l, v, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {branchTrustData.map(b => (
          <div key={b.id} className="mb-card" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => setSelBranch(selBranch === b.id ? 'all' : b.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{b.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4A90D9' }}>{fmtR(b.balance)}</div>
            </div>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>{b.address}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
              <div><div style={{ fontSize: 9, color: '#444', marginBottom: 1 }}>Receipts</div><div style={{ color: '#8DC63F' }}>{fmtR(b.receipts)}</div></div>
              <div><div style={{ fontSize: 9, color: '#444', marginBottom: 1 }}>Payments</div><div style={{ color: '#E05252' }}>{fmtR(b.payments)}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>
          Payment approvals {pendingPayments.length > 0 && <span className="mb-badge" style={{ marginLeft: 8, background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)' }}>{pendingPayments.length} pending</span>}
        </div>
        {!pendingPayments.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#555' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 12 }}>No payments pending approval</div>
          </div>
        ) : pendingPayments.map((t, i) => {
          const m = matters.find(x => x.id === t.matter_id), br = branches.find(b => b.id === t.branch_id), bal = trustBalances[t.matter_id] || 0;
          return (
            <div key={i} style={{ border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="mb-badge" style={{ background: 'rgba(234,179,8,0.1)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)' }}>PENDING APPROVAL</span>
                    <span style={{ fontSize: 10, color: '#555' }}>{fmtDate(t.date)}</span>
                    {br && <span style={{ fontSize: 10, color: '#555', border: '1px solid #252525', padding: '1px 8px', borderRadius: 20 }}>{br.name}</span>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#EAB308', marginBottom: 6 }}>{fmtR(t.amount)}</div>
                  <div style={{ fontSize: 12, color: '#D0D0D0', marginBottom: 2 }}>Payee: <strong>{t.payee}</strong></div>
                  <div style={{ fontSize: 12, color: '#D0D0D0', marginBottom: 2 }}>Matter: <span style={{ color: '#A78BFA' }}>{t.matter_id}</span> — {m?.client || '—'}</div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>{t.narration}</div>
                  <div style={{ background: 'rgba(234,179,8,0.05)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#888' }}>Balance: <strong style={{ color: '#8DC63F' }}>{fmtR(bal)}</strong> · After: <strong style={{ color: bal - Number(t.amount) >= 0 ? '#8DC63F' : '#E05252' }}>{fmtR(bal - Number(t.amount))}</strong></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                  <button className="mb-btn mb-btn-primary" onClick={() => { if (confirm(`Approve payment of ${fmtR(t.amount)} to ${t.payee}?`)) approvePayment(t.id); }}>✓ Approve</button>
                  <button className="mb-btn mb-btn-danger" onClick={() => { const r = prompt('Reason for rejection:'); if (r !== null) rejectPayment(t.id, r); }}>✗ Reject</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Trust balances — all matters</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="mb-table">
            <thead><tr>{['Matter ID', 'Client', 'Branch', 'Trust Balance'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
            <tbody>
              {!matters.length && <tr><td colSpan={4} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 20 }}>No matters yet</td></tr>}
              {matters.map(m => {
                const bal = trustBalances[m.id] || 0;
                const br = branches.find(b => b.id === m.branch_id);
                return (
                  <tr key={m.id} style={{ opacity: bal === 0 ? 0.4 : 1 }}>
                    <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#A78BFA' }}>{m.id}</td>
                    <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{m.client}</td>
                    <td className="mb-td" style={{ fontSize: 10, color: '#555' }}>{br?.name || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: bal > 0 ? '#8DC63F' : bal < 0 ? '#E05252' : '#555' }}>{fmtR(bal)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#0D0D0D' }}>
                <td colSpan={3} className="mb-th">Grand total</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', fontSize: 13, color: '#8DC63F', textAlign: 'right' }}>{fmtR(totalTrustHeld)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
