import { C } from '../../lib/attyStyles';
import { fmtR } from '../../lib/format';
import InvoiceDoc from './InvoiceDoc';

export default function InvoicesTab({ matters, allActs, invMatterId, setInvMatterId, invAtty, invRate, invPeriod, setInvPeriod, selDate, setSelDate, preview, setPreview, buildPreview, handleSaveInvoice, trustBalances, firm, generateDetailedInvoicePDF, setTab }) {
  const invMatter = matters.find(m => m.id === invMatterId) || null;

  return (
    <div style={C.main}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Generate Invoice</div>
        <div style={{ fontSize: 11, color: '#444' }}>Select a matter — pulls only activities assigned to it</div>
      </div>

      <div style={C.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Step 1 — Select Matter</div>
        {!matters.length ? (
          <div style={{ padding: '10px 0', fontSize: 12, color: '#555' }}>
            No matters yet. <button style={{ ...C.btn('pur'), padding: '4px 12px', fontSize: 11, marginLeft: 8 }} onClick={() => setTab('matters')}>Go to Matters →</button>
          </div>
        ) : (
          <select style={{ ...C.inp, maxWidth: 500 }} value={invMatterId} onChange={e => { setInvMatterId(e.target.value); setPreview(null); }}>
            <option value="">— choose a matter —</option>
            {matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}
          </select>
        )}
        {invMatter && (
          <div style={{ marginTop: 10, display: 'flex', gap: 20, fontSize: 11, flexWrap: 'wrap' }}>
            <div><span style={{ color: '#555' }}>Client: </span><strong style={{ color: '#C0C0C0' }}>{invMatter.client}</strong></div>
            <div><span style={{ color: '#555' }}>Activities: </span><strong style={{ color: '#6CC04A' }}>{allActs.filter(a => a.matter === invMatterId).length}</strong></div>
            <div><span style={{ color: '#555' }}>Trust balance: </span><strong style={{ color: '#4A90D9' }}>{fmtR(trustBalances[invMatterId] || 0)}</strong></div>
          </div>
        )}
      </div>

      {invMatterId && (
        <div style={C.card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Step 2 — Configure</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={C.lbl}>Attorney</label><div style={{ ...C.inp, color: '#D0D0D0', display: 'flex', alignItems: 'center' }}>{invAtty}</div></div>
            <div><label style={C.lbl}>Rate per unit</label><div style={{ ...C.inp, color: '#6CC04A', display: 'flex', alignItems: 'center' }}>R{invRate}/unit · set by manager</div></div>
            <div><label style={C.lbl}>Billing date</label><input style={C.inp} type="date" value={selDate} onChange={e => setSelDate(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => (
              <button key={v} style={{ ...C.btn(invPeriod === v ? 'p' : 's'), padding: '5px 18px' }} onClick={() => setInvPeriod(v)}>{l}</button>
            ))}
          </div>
          <button style={C.btn('p')} onClick={buildPreview}>Preview Invoice</button>
        </div>
      )}

      {preview && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Preview · {preview.bill.length} billable sessions · {preview.tU} units</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={C.btn()} onClick={() => setPreview(null)}>Cancel</button>
              <button style={C.btn('g')} onClick={() => generateDetailedInvoicePDF({ ...preview, id: 'MB-PREVIEW', client: invMatter?.client, matter_id: invMatter?.id, matter_name: invMatter?.name, attorney: invAtty, rate: invRate, period_label: preview.label }, preview.filtered, firm)}>⬇ PDF</button>
              <button style={C.btn('p')} onClick={handleSaveInvoice}>Save to Archive</button>
            </div>
          </div>
          <InvoiceDoc inv={{ client: invMatter?.client, matter_id: invMatter?.id, matter_name: invMatter?.name, attorney: invAtty, rate: invRate, period_label: preview.label, id: 'MB-PREVIEW' }} acts={preview.filtered} />
        </div>
      )}
    </div>
  );
}
