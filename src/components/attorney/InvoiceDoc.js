import { toHm, calcUnits, calcAmt, fdate, ftime } from '../../lib/format';

export default function InvoiceDoc({ inv, acts }) {
  const bill = (acts || []).filter(a => a.classification === 'billable');
  const rate = Number(inv.rate) || 150;
  const tU = bill.reduce((s, a) => s + calcUnits(a.duration_seconds), 0);
  const tAmt = tU * rate;

  return (
    <div style={{ background: '#fff', color: '#111', borderRadius: 8, padding: 28, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #6CC04A', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.04em' }}>M<span style={{ color: '#6CC04A' }}>B</span></div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Motsoeneng Bill</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>TAX INVOICE</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{inv.id}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: '#aaa', marginBottom: 3 }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.client}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{inv.matter_name}</div>
          <div style={{ fontSize: 11, color: '#bbb' }}>Ref: {inv.matter_id}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: '#aaa', marginBottom: 3 }}>Attorney</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.attorney}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Period: {inv.period_label}</div>
        </div>
      </div>

      <div style={{ display: 'flex', border: '1px solid #eee', borderRadius: 7, overflow: 'hidden', marginBottom: 16 }}>
        {[['Sessions', bill.length], ['Units', tU], ['Rate', `R${rate}/unit`], ['Total Due', `R${tAmt.toLocaleString()}`]].map(([l, v], i, arr) => (
          <div key={l} style={{ flex: 1, padding: 12, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #eee' : 'none' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#aaa' }}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9f9f9' }}>
            {['Date/Time', 'Application', 'Description', 'Time', 'Units', 'Amount'].map(h => (
              <th key={h} style={{ padding: '8px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#aaa', textAlign: ['Time', 'Units', 'Amount'].includes(h) ? 'right' : 'left', borderBottom: '2px solid #eee' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!bill.length && <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#ccc', fontSize: 11 }}>No billable activities.</td></tr>}
          {bill.map((a, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>{fdate(a.date)} {ftime(a.start_time)}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11 }}>{a.app_display_name}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11, color: '#777', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.window_title}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{toHm(a.duration_seconds)}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }}>{calcUnits(a.duration_seconds)}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', fontSize: 11, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>R{calcAmt(a.duration_seconds, rate).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background: '#f7f7f7', borderRadius: 7, padding: '14px 18px', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#555' }}><strong>{tU} units</strong> x R{rate} per unit</div>
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>1 billing unit = 6 minutes</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 12, color: '#888', marginBottom: 3 }}><span>Subtotal (excl. VAT)</span><span style={{ fontFamily: 'monospace', color: '#555' }}>R{tAmt.toLocaleString()}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 12, color: '#888', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #ddd' }}><span>VAT @ 15%</span><span style={{ fontFamily: 'monospace', color: '#555' }}>R{(tAmt * 0.15).toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'baseline' }}><span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>Total Due (incl. VAT)</span><span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>R{(tAmt * 1.15).toFixed(2)}</span></div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 10, color: '#ccc', textAlign: 'center', lineHeight: 1.8 }}>Motsoeneng Bill · VAT: 4100000000 · FNB 62000000000 · Branch: 250655<br />accounts@mb.co.za · Computer generated invoice.</div>
    </div>
  );
}
