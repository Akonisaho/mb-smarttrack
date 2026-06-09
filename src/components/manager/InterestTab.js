import { C } from '../../lib/styles';
import { fmtR, fmtDate } from '../../lib/format';
import { supabase } from '../../lib/supabase';

export default function InterestTab({ invoices, invoicePayments, profile, showAlert, load }) {
  const now = new Date();
  const age = inv => Math.floor((now - new Date(inv.created_at || 0)) / 86400000);
  const paid = invId => invoicePayments.filter(p => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = inv => Math.max(0, (inv.total_units || 0) * (inv.rate || 150) * 1.15 - paid(inv.id));

  const overdueInvs = invoices
    .filter(inv => age(inv) > 30 && outstanding(inv) > 0 && !inv.written_off)
    .sort((a, b) => age(b) - age(a));

  const totalInterest = overdueInvs.reduce((s, inv) => {
    const a = age(inv);
    const o = outstanding(inv);
    return s + parseFloat((o * (10.5 / 100) * (a / 365)).toFixed(2));
  }, 0);

  const addInterest = async inv => {
    const a = age(inv);
    const rate = 10.5;
    const o = outstanding(inv);
    const interest = parseFloat((o * (rate / 100) * (a / 365)).toFixed(2));
    if (interest <= 0) { showAlert('No interest due — invoice is not overdue.', 'error'); return; }
    if (!confirm(`Add R${interest.toFixed(2)} interest charge (${rate}% p.a. × ${a} days) to invoice ${inv.id}?`)) return;
    const { error } = await supabase.from('interest_charges').insert([{
      invoice_id: inv.id, amount: interest, rate_percent: rate, days_overdue: a, created_by: profile?.id
    }]);
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert(`✓ Interest charge of R${interest.toFixed(2)} added.`);
    if (load) load();
  };

  return (
    <div className="mb-main">
      <div style={{ marginBottom: 14 }}>
        <div className="mb-heading">Interest Charges</div>
        <div className="mb-sub">Statutory interest on overdue invoices (10.5% p.a.)</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Overdue Invoices', v: overdueInvs.length, s: '> 30 days outstanding', w: overdueInvs.length > 0 },
          { l: 'Total Outstanding', v: fmtR(overdueInvs.reduce((s, inv) => s + outstanding(inv), 0)), s: 'sum of overdue balances', w: true },
          { l: 'Potential Interest', v: fmtR(totalInterest), s: 'at 10.5% p.a.', w: totalInterest > 0 },
        ].map(({ l, v, s, w }) => (
          <div key={l} style={C.stat(false, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: w && (typeof v === 'string' ? true : v > 0) ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      {!overdueInvs.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
          <div>No overdue invoices — interest up to date</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>{['Invoice', 'Client', 'Date', 'Age', 'Outstanding', 'Interest (10.5%)', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {overdueInvs.map(inv => {
                const a = age(inv);
                const o = outstanding(inv);
                const interest = parseFloat((o * 0.105 * (a / 365)).toFixed(2));
                return (
                  <tr key={inv.id}>
                    <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#888' }}>{inv.id}</td>
                    <td className="mb-td" style={{ color: '#C8C8C8' }}>{inv.client}</td>
                    <td className="mb-td" style={{ fontSize: 10, color: '#666' }}>{fmtDate(inv.created_at?.substring(0, 10))}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: a > 90 ? '#E05252' : a > 60 ? '#E07B30' : '#EAB308', fontWeight: 700 }}>{a}d</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#EAB308', fontWeight: 700 }}>{fmtR(o)}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#E07B30', fontWeight: 700 }}>+ {fmtR(interest)}</td>
                    <td className="mb-td">
                      <button className="mb-btn mb-btn-warn mb-btn-sm" onClick={() => addInterest(inv)}>+ Charge Interest</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
