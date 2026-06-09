import { useState } from 'react';
import { C } from '../../lib/styles';
import { fmtR, fmtDate, fmonth } from '../../lib/format';

export default function VatTab({ invoices, disbursements, profile, isMobile, showAlert }) {
  const today = new Date().toLocaleDateString('en-CA').substring(0, 7);
  const [vatPeriod, setVatPeriod] = useState(today);

  const periodInvs = invoices.filter(i => i.created_at?.substring(0, 7) === vatPeriod);
  const periodDisbs = disbursements.filter(d => d.date?.substring(0, 7) === vatPeriod && d.vat_applicable);
  const outputExcl = periodInvs.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150), 0);
  const outputVat = outputExcl * 0.15;
  const inputVat = periodDisbs.reduce((s, d) => s + Number(d.amount) * 0.15, 0);
  const vatPayable = outputVat - inputVat;

  const copyVat201 = () => {
    const txt = `VAT RETURN SUMMARY\nPeriod: ${fmonth(vatPeriod)}\n\nField 1 - Standard Rated Supplies: R${outputExcl.toFixed(2)}\nField 4 - Output Tax: R${outputVat.toFixed(2)}\nField 15 - Input Tax (Disbursements): R${inputVat.toFixed(2)}\nField 20 - VAT Payable: R${vatPayable.toFixed(2)}\n\nVAT Reg No: ${profile?.vat_number || '[Add VAT number in Settings]'}`;
    navigator.clipboard.writeText(txt);
    showAlert('✓ VAT summary copied to clipboard');
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">VAT Report — VAT201 Supporting Schedule</div>
          <div className="mb-sub">Output VAT collected minus Input VAT on disbursements</div>
        </div>
        <input type="month" className="mb-sel" value={vatPeriod} onChange={e => setVatPeriod(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Output VAT (excl.)', v: fmtR(outputExcl), s: 'invoiced excl. VAT', a: true },
          { l: 'Output VAT (15%)', v: fmtR(outputVat), s: 'VAT collected', a: true },
          { l: 'Input VAT', v: fmtR(inputVat), s: 'VAT on disbursements' },
          { l: 'VAT Payable to SARS', v: fmtR(vatPayable), s: vatPayable > 0 ? 'Due to SARS' : 'VAT credit', w: vatPayable > 0, a: vatPayable <= 0 },
        ].map(({ l, v, s, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Output VAT — Invoices ({fmonth(vatPeriod)})</div>
        {!periodInvs.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#555', fontSize: 12 }}>No invoices for this period</div>
        ) : (
          <table className="mb-table">
            <thead><tr>{['Invoice', 'Client', 'Matter', 'Excl. VAT', 'VAT 15%', 'Incl. VAT'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
            <tbody>
              {periodInvs.map(inv => { const e = (inv.total_units || 0) * (inv.rate || 150), v = e * 0.15; return (
                <tr key={inv.id}>
                  <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#888' }}>{inv.id}</td>
                  <td className="mb-td">{inv.client}</td>
                  <td className="mb-td" style={{ color: '#A78BFA', fontSize: 10 }}>{inv.matter_id}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{fmtR(e)}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#EAB308' }}>{fmtR(v)}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>{fmtR(e + v)}</td>
                </tr>
              );})}
              <tr style={{ background: 'rgba(141,198,63,0.05)' }}>
                <td colSpan={3} className="mb-th">TOTAL</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{fmtR(outputExcl)}</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#EAB308' }}>{fmtR(outputVat)}</td>
                <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{fmtR(outputExcl + outputVat)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>VAT201 Summary</div>
          <button className="mb-btn mb-btn-primary" onClick={copyVat201}>📋 Copy for VAT201</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Field 1', 'Standard rated supplies (excl. VAT)', fmtR(outputExcl)],
            ['Field 4', 'Output Tax (VAT collected)', fmtR(outputVat)],
            ['Field 15', 'Input Tax (VAT on disbursements)', fmtR(inputVat)],
            ['Field 20', 'VAT payable to SARS', fmtR(vatPayable)],
          ].map(([f, l, v]) => (
            <div key={f} style={{ background: '#0D0D0D', borderRadius: 6, padding: '10px 12px' }}>
              <div className="mb-lbl">{f} — {l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8DC63F' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
