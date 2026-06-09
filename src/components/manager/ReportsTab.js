import { C } from '../../lib/styles';
import { fmtR, fmonth, toHm } from '../../lib/format';

export default function ReportsTab({ invoices, invoicePayments, filteredProfiles, branches, isMobile, rate }) {
  const paid = invId => invoicePayments.filter(p => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0);

  const monthMap = {};
  invoices.forEach(inv => {
    const month = inv.created_at?.substring(0, 7);
    if (!month) return;
    if (!monthMap[month]) monthMap[month] = { month, invoiced: 0, collected: 0, units: 0, count: 0 };
    const amt = (inv.total_units || 0) * (inv.rate || 150) * 1.15;
    monthMap[month].invoiced += amt;
    monthMap[month].collected += paid(inv.id);
    monthMap[month].units += inv.total_units || 0;
    monthMap[month].count++;
  });

  const months = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
  const totalInvoiced = months.reduce((s, m) => s + m.invoiced, 0);
  const totalCollected = months.reduce((s, m) => s + m.collected, 0);
  const totalOutstanding = totalInvoiced - totalCollected;

  const attyRev = filteredProfiles.map(p => {
    const inv = invoices.filter(i => i.user_id === p.id);
    const invAmt = inv.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
    const coll = inv.reduce((s, i) => s + paid(i.id), 0);
    return { ...p, invoiced: invAmt, collected: coll, outstanding: invAmt - coll, units: inv.reduce((s, i) => s + (i.total_units || 0), 0) };
  }).sort((a, b) => b.invoiced - a.invoiced);

  return (
    <div className="mb-main">
      <div className="mb-heading">Financial Reports — Motsoeneng Bill</div>
      <div className="mb-sub" style={{ marginBottom: 14 }}>Revenue, collections and WIP summary</div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Invoiced', v: fmtR(totalInvoiced), a: true },
          { l: 'Total Collected', v: fmtR(totalCollected), a: true },
          { l: 'Outstanding', v: fmtR(totalOutstanding), w: totalOutstanding > 0 },
          { l: 'Collection Rate', v: `${totalInvoiced > 0 ? Math.round(totalCollected / totalInvoiced * 100) : 0}%`, a: true },
        ].map(({ l, v, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Monthly Revenue — All Time</div>
        <table className="mb-table">
          <thead><tr>{['Month', 'Invoices', 'Units', 'Invoiced (incl. VAT)', 'Collected', 'Outstanding', 'Collection %'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
          <tbody>
            {!months.length && <tr><td colSpan={7} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No invoice data yet</td></tr>}
            {months.map(m => {
              const pct = m.invoiced > 0 ? Math.round(m.collected / m.invoiced * 100) : 0;
              return (
                <tr key={m.month}>
                  <td className="mb-td" style={{ fontWeight: 600, color: '#D0D0D0' }}>{fmonth(m.month)}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#777', textAlign: 'center' }}>{m.count}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{m.units}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>{fmtR(m.invoiced)}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#4A90D9' }}>{m.collected > 0 ? fmtR(m.collected) : '—'}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: m.invoiced - m.collected > 0 ? '#EAB308' : '#555' }}>{m.invoiced - m.collected > 0 ? fmtR(m.invoiced - m.collected) : '—'}</td>
                  <td className="mb-td">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: '#1A1A1A', borderRadius: 2 }}><div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#8DC63F' : pct >= 50 ? '#EAB308' : '#E05252', borderRadius: 2 }} /></div>
                      <span style={{ fontSize: 10, color: '#888', minWidth: 30 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {months.length > 0 && (
              <tr style={{ background: 'rgba(141,198,63,0.05)' }}>
                <td className="mb-th" colSpan={3}>TOTAL</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{fmtR(totalInvoiced)}</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#4A90D9' }}>{fmtR(totalCollected)}</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#EAB308' }}>{fmtR(totalOutstanding)}</td>
                <td className="mb-th">{totalInvoiced > 0 ? Math.round(totalCollected / totalInvoiced * 100) : 0}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Attorney Revenue Summary</div>
        <table className="mb-table">
          <thead><tr>{['Attorney', 'Branch', 'Units Billed', 'Total Invoiced', 'Collected', 'Outstanding'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
          <tbody>
            {attyRev.map(a => (
              <tr key={a.id}>
                <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{a.full_name}</td>
                <td className="mb-td" style={{ fontSize: 10 }}><span style={{ background: 'rgba(74,144,217,0.1)', color: '#4A90D9', padding: '2px 8px', borderRadius: 20, fontSize: 9 }}>{branches.find(b => b.id === a.branch_id)?.name || '—'}</span></td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{a.units || '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>{a.invoiced > 0 ? fmtR(a.invoiced) : '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#4A90D9' }}>{a.collected > 0 ? fmtR(a.collected) : '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: a.outstanding > 0 ? '#EAB308' : '#555' }}>{a.outstanding > 0 ? fmtR(a.outstanding) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
