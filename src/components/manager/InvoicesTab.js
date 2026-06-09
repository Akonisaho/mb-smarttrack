import { C } from '../../lib/styles';
import { fmtR } from '../../lib/format';

export default function InvoicesTab({ invoices, isMobile }) {
  const billedRevenue = invoices.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150), 0);

  return (
    <div className="mb-main">
      <div className="mb-heading" style={{ marginBottom: 14 }}>All Invoices — Motsoeneng Bill</div>
      <div className="mb-card">
        <table className="mb-table">
          <thead>
            <tr>
              {['Invoice ID', 'Client', 'Matter ID', 'Attorney', 'Period', 'Units', 'Rate', 'Excl. VAT', 'Incl. VAT 15%'].map(h => (
                <th key={h} className="mb-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!invoices.length && (
              <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#333' }}>No invoices yet</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#888' }}>{inv.id}</td>
                <td className="mb-td" style={{ color: '#C8C8C8' }}>{inv.client}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{inv.matter_id}</td>
                <td className="mb-td" style={{ color: '#777' }}>{inv.attorney}</td>
                <td className="mb-td" style={{ color: '#666', fontSize: 10 }}>{inv.period_label}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 600 }}>{inv.total_units}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#777' }}>R{inv.rate}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>R{((inv.total_units || 0) * (inv.rate || 150)).toLocaleString()}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>R{((inv.total_units || 0) * (inv.rate || 150) * 1.15).toFixed(2)}</td>
              </tr>
            ))}
            {invoices.length > 0 && (
              <tr style={{ background: 'rgba(141,198,63,0.05)' }}>
                <td colSpan={7} className="mb-td" style={{ fontWeight: 600, color: '#D0D0D0' }}>TOTAL</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>{fmtR(billedRevenue)}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>{fmtR(billedRevenue * 1.15)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
