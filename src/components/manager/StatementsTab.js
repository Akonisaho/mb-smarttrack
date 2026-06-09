import { C } from '../../lib/styles';
import { fmtR, fmtDate } from '../../lib/format';

export default function StatementsTab({ invoices, invoicePayments, isMobile, profile }) {
  const paid = invId => invoicePayments.filter(p => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0);

  const clientMap = {};
  invoices.forEach(inv => {
    const k = inv.client || 'Unknown';
    if (!clientMap[k]) clientMap[k] = { client: k, invoices: [], billed: 0, paid: 0 };
    const amt = (inv.total_units || 0) * (inv.rate || 150) * 1.15;
    clientMap[k].invoices.push(inv);
    clientMap[k].billed += amt;
    clientMap[k].paid += paid(inv.id);
  });
  const clients = Object.values(clientMap).sort((a, b) => b.billed - a.billed);

  const printStatement = c => {
    const rows = c.invoices.map(inv => {
      const p = paid(inv.id), amt = (inv.total_units || 0) * (inv.rate || 150), vat = amt * .15, total = amt * 1.15, out = Math.max(0, total - p);
      return `<tr><td>${fmtDate(inv.created_at?.substring(0, 10))}</td><td style="font-family:monospace">${inv.id}</td><td>${inv.matter_name || inv.matter_id || '—'}</td><td align="right">${inv.total_units || 0}</td><td align="right">R${amt.toLocaleString()}</td><td align="right">R${vat.toFixed(2)}</td><td align="right">R${total.toFixed(2)}</td><td align="right" style="color:${p > 0 ? '#16a34a' : '#666'}">${p > 0 ? 'R' + p.toFixed(2) : '—'}</td><td align="right" style="font-weight:700;color:${out > 0 ? '#dc2626' : '#16a34a'}">${out > 0 ? 'R' + out.toFixed(2) : 'PAID'}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statement — ${c.client}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:900px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #8DC63F;padding-bottom:16px;margin-bottom:20px}.logo{font-size:26px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#8DC63F}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;color:#999;border-bottom:2px solid #eee;text-align:left}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px}.lbl{font-size:9px;text-transform:uppercase;color:#aaa;margin-bottom:3px}.val{font-size:16px;font-weight:700}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center}@media print{body{padding:20px}}</style></head><body><div class="top"><div><div class="logo">M<span>B</span></div><div style="font-size:11px;color:#999;margin-top:2px">Motsoeneng Bill</div></div><div style="text-align:right"><h2>ACCOUNT STATEMENT</h2><div style="font-size:11px;color:#999">Client: ${c.client} · ${new Date().toLocaleDateString('en-ZA')}</div></div></div><div class="summary"><div><div class="lbl">Total Invoiced</div><div class="val">R${c.billed.toFixed(2)}</div></div><div><div class="lbl">Total Paid</div><div class="val" style="color:#16a34a">R${c.paid.toFixed(2)}</div></div><div><div class="lbl">Balance Due</div><div class="val" style="color:${c.billed - c.paid > 0 ? '#dc2626' : '#16a34a'}">${c.billed - c.paid > 0 ? 'R' + (c.billed - c.paid).toFixed(2) : 'PAID IN FULL'}</div></div></div><table><thead><tr><th>Date</th><th>Invoice</th><th>Matter</th><th align="right">Units</th><th align="right">Excl. VAT</th><th align="right">VAT 15%</th><th align="right">Total</th><th align="right">Paid</th><th align="right">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#ccc;padding:16px">No invoices</td></tr>'}</tbody></table><div class="foot">Motsoeneng Bill · VAT Reg: ${profile?.vat_number || '4100000000'} · accounts@mb.co.za<br><em>Generated on ${new Date().toLocaleDateString('en-ZA')}.</em></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=980,height=760');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="mb-main">
      <div className="mb-heading">Billing Statements</div>
      <div className="mb-sub" style={{ marginBottom: 14 }}>Per-client account statements · Print or email to clients</div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total clients', v: clients.length },
          { l: 'Total invoiced', v: fmtR(clients.reduce((s, c) => s + c.billed, 0)), a: true },
          { l: 'Total outstanding', v: fmtR(clients.reduce((s, c) => s + Math.max(0, c.billed - c.paid), 0)), w: true },
        ].map(({ l, v, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      {!clients.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div>No invoices yet</div>
        </div>
      ) : clients.map(c => {
        const out = Math.max(0, c.billed - c.paid);
        return (
          <div key={c.client} className="mb-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{c.client}</div>
                <div style={{ fontSize: 10, color: '#555' }}>{c.invoices.length} invoice{c.invoices.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[['Invoiced', fmtR(c.billed), '#8DC63F'], ['Paid', fmtR(c.paid), '#4A90D9'], ['Balance', out > 0 ? fmtR(out) : 'Paid ✓', out > 0 ? '#EAB308' : '#8DC63F']].map(([l, v, col]) => (
                  <div key={l} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: col }}>{v}</div>
                  </div>
                ))}
                <button className="mb-btn mb-btn-primary" onClick={() => printStatement(c)}>Print Statement</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
