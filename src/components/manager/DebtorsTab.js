import { useState } from 'react';
import { C } from '../../lib/styles';
import { fmtR, fmtDate } from '../../lib/format';
import { saveInvoicePayment, writeOffInvoice, undoWriteOff } from '../../lib/supabase';

export default function DebtorsTab({
  invoices, invoicePayments, isMobile, showAlert, load, profile, todayStr,
  emailingInv, setEmailingInv,
  setCnInvoice, setCnForm, setShowCNForm,
  setPayPlanInv, setPayPlanForm, setShowPayPlan,
}) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ invoiceId: '', amount: '', paymentDate: todayStr, reference: '', narration: '' });

  const now = new Date();
  const age = inv => Math.floor((now - new Date(inv.created_at || 0)) / 86400000);
  const paid = invId => invoicePayments.filter(p => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = inv => Math.max(0, (inv.total_units || 0) * (inv.rate || 150) * 1.15 - paid(inv.id));

  const bucket = a => a <= 30 ? '0-30' : a <= 60 ? '31-60' : a <= 90 ? '61-90' : a <= 120 ? '91-120' : '120+';
  const buckets = {
    '0-30':   { label: 'Current (0–30 days)',  color: '#8DC63F', invs: [] },
    '31-60':  { label: '30–60 days',            color: '#4A90D9', invs: [] },
    '61-90':  { label: '60–90 days',            color: '#EAB308', invs: [] },
    '91-120': { label: '90–120 days',           color: '#E07B30', invs: [] },
    '120+':   { label: '120+ days',             color: '#E05252', invs: [] },
  };

  const unpaidInvs = invoices.filter(inv => outstanding(inv) > 0);
  unpaidInvs.forEach(inv => { const b = bucket(age(inv)); if (buckets[b]) buckets[b].invs.push(inv); });
  const totalOut = unpaidInvs.reduce((s, inv) => s + outstanding(inv), 0);

  const clientMap = {};
  unpaidInvs.forEach(inv => { const k = inv.client || 'Unknown'; if (!clientMap[k]) clientMap[k] = { client: k, total: 0, invs: [] }; clientMap[k].total += outstanding(inv); clientMap[k].invs.push(inv); });
  const clients = Object.values(clientMap).sort((a, b) => b.total - a.total);

  const handleEmailInvoice = async (inv, customEmail) => {
    setEmailingInv(inv.id);
    const res = await fetch('/api/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.id, recipientEmail: customEmail || '' }) });
    const data = await res.json();
    setEmailingInv(null);
    if (!res.ok) { showAlert('Could not send: ' + (data.error || 'Unknown error'), 'error'); return; }
    showAlert(data.warning || `✓ Invoice emailed to ${data.sentTo}`);
  };

  const recordPayment = async () => {
    if (!payForm.invoiceId || !payForm.amount) { showAlert('Select invoice and amount.', 'error'); return; }
    const { error } = await saveInvoicePayment({ invoiceId: payForm.invoiceId, amount: parseFloat(payForm.amount), paymentDate: payForm.paymentDate, reference: payForm.reference, narration: payForm.narration }, profile?.id);
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert('✓ Payment recorded.');
    setShowPayForm(false);
    if (load) load();
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Debtors Age Analysis</div>
          <div className="mb-sub">Outstanding invoices · {new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setPayForm({ invoiceId: '', amount: '', paymentDate: todayStr, reference: '', narration: '' }); setShowPayForm(true); }}>+ Record Payment</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
        {Object.entries(buckets).map(([k, b]) => {
          const tot = b.invs.reduce((s, inv) => s + outstanding(inv), 0);
          return (
            <div key={k} style={C.stat(false, tot > 0)}>
              <div className="mb-stat-label">{b.label}</div>
              <div className="mb-stat-value" style={{ fontSize: 18, color: tot > 0 ? b.color : '#333' }}>{fmtR(tot)}</div>
              <div className="mb-stat-note">{b.invs.length} invoice{b.invs.length !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>Outstanding by Client</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAB308' }}>{fmtR(totalOut)} total outstanding</div>
        </div>
        {!clients.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#555', fontSize: 12 }}>✅ All invoices paid</div>
        ) : (
          <table className="mb-table">
            <thead><tr>{['Client', 'Invoices', '0–30', '31–60', '61–90', '90–120', '120+', 'Total Outstanding'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
            <tbody>
              {clients.map(c => {
                const bkts = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
                c.invs.forEach(inv => { const b = bucket(age(inv)); bkts[b] += outstanding(inv); });
                return (
                  <tr key={c.client}>
                    <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{c.client}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#777', textAlign: 'center' }}>{c.invs.length}</td>
                    {Object.entries(bkts).map(([k, v]) => <td key={k} className="mb-td" style={{ fontFamily: 'monospace', color: v > 0 ? buckets[k].color : '#333', fontWeight: v > 0 ? 700 : 400 }}>{v > 0 ? fmtR(v) : '—'}</td>)}
                    <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#EAB308' }}>{fmtR(c.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Invoice Detail</div>
        <table className="mb-table">
          <thead><tr>{['Invoice', 'Client', 'Matter', 'Date', 'Age', 'Invoice Amt', 'Paid', 'Outstanding', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
          <tbody>
            {!unpaidInvs.length && <tr><td colSpan={9} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No outstanding invoices</td></tr>}
            {unpaidInvs.sort((a, b) => age(b) - age(a)).map(inv => {
              const a = age(inv), p = paid(inv.id), o = outstanding(inv), amt = (inv.total_units || 0) * (inv.rate || 150) * 1.15;
              return (
                <tr key={inv.id} style={{ opacity: inv.written_off ? 0.5 : 1 }}>
                  <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#888' }}>{inv.id}{inv.written_off && <span style={{ marginLeft: 6, fontSize: 9, color: '#555', border: '1px solid #252525', borderRadius: 20, padding: '1px 6px' }}>W/O</span>}</td>
                  <td className="mb-td" style={{ color: '#C8C8C8' }}>{inv.client}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{inv.matter_id || '—'}</td>
                  <td className="mb-td" style={{ fontSize: 10, color: '#666' }}>{fmtDate(inv.created_at?.substring(0, 10))}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: buckets[bucket(a)].color, fontWeight: 700 }}>{a}d</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{fmtR(amt)}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', color: p > 0 ? '#8DC63F' : '#333' }}>{p > 0 ? fmtR(p) : '—'}</td>
                  <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#EAB308' }}>{fmtR(o)}</td>
                  <td className="mb-td">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="mb-btn mb-btn-sm" disabled={emailingInv === inv.id} onClick={() => { const em = prompt('Send to email:', inv.client_email || ''); if (em === null) return; handleEmailInvoice(inv, em); }}>{emailingInv === inv.id ? '…' : '✉'}</button>
                      <button className="mb-btn mb-btn-sm" onClick={() => { setCnInvoice(inv); setCnForm({ amount: '', reason: '' }); setShowCNForm(true); }}>CN</button>
                      <button className="mb-btn mb-btn-sm" onClick={() => { setPayPlanInv(inv); setPayPlanForm({ instalment: '', frequency: 'monthly', start_date: new Date().toLocaleDateString('en-CA'), notes: '' }); setShowPayPlan(true); }}>Plan</button>
                      {!inv.written_off
                        ? <button className="mb-btn mb-btn-warn mb-btn-sm" onClick={async () => { const r = prompt('Write-off reason:'); if (!r) return; await writeOffInvoice(inv.id, r, profile?.id); if (load) load(); }}>W/O</button>
                        : <button className="mb-btn mb-btn-sm" onClick={async () => { await undoWriteOff(inv.id); if (load) load(); }}>Undo</button>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPayForm && (
        <div className="mb-overlay" onClick={() => setShowPayForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Record Payment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="mb-lbl">Invoice *</label>
                <select className="mb-inp" value={payForm.invoiceId} onChange={e => setPayForm(f => ({ ...f, invoiceId: e.target.value }))}>
                  <option value="">— Select invoice —</option>
                  {invoices.filter(inv => { const p = paid(inv.id); return Math.max(0, (inv.total_units || 0) * (inv.rate || 150) * 1.15 - p) > 0; }).map(inv => <option key={inv.id} value={inv.id}>{inv.id} · {inv.client} · {fmtR((inv.total_units || 0) * (inv.rate || 150) * 1.15)}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Amount *</label><input className="mb-inp" type="number" placeholder="0.00" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="mb-lbl">Payment Date *</label><input className="mb-inp" type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} /></div>
              </div>
              <div><label className="mb-lbl">Reference</label><input className="mb-inp" type="text" placeholder="EFT ref, cheque no..." value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} /></div>
              <div><label className="mb-lbl">Narration</label><input className="mb-inp" type="text" placeholder="Payment description..." value={payForm.narration} onChange={e => setPayForm(f => ({ ...f, narration: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="mb-btn" onClick={() => setShowPayForm(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" onClick={recordPayment}>Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
