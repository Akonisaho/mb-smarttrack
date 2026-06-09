import { useState, useRef } from 'react';
import { C } from '../../lib/attyStyles';
import { fmtR, fmtDate, nextReceiptNo } from '../../lib/format';
import { supabase } from '../../lib/supabase';

const APPROVAL_THRESHOLD = 50000;

function printTrustStatement(matter, transactions) {
  let running = 0;
  const rows = transactions.map(t => {
    const isR = t.type === 'receipt';
    if (isR) running += Number(t.amount); else running -= Number(t.amount);
    return `<tr><td>${fmtDate(t.date)}</td><td style="text-transform:capitalize">${t.type}</td><td>${t.receipt_no || t.reference || '—'}</td><td>${t.narration || ''}</td><td align="right" style="color:#dc2626">${!isR ? fmtR(t.amount) : ''}</td><td align="right" style="color:#16a34a">${isR ? fmtR(t.amount) : ''}</td><td align="right" style="font-weight:700;color:${running >= 0 ? '#16a34a' : '#dc2626'}">${fmtR(running)}</td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trust Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6CC04A;padding-bottom:16px;margin-bottom:20px}.logo{font-size:26px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#6CC04A}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;border-bottom:2px solid #eee;text-align:left}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3}.info{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px}.lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#aaa;margin-bottom:3px}.val{font-size:13px;font-weight:600}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center;line-height:1.8}@media print{body{padding:20px}}</style></head><body>
  <div class="top"><div><div class="logo">M<span>B</span></div><div style="font-size:11px;color:#999;margin-top:2px">Motsoeneng Bill</div></div><div style="text-align:right"><h2>TRUST ACCOUNT STATEMENT</h2><div style="font-size:11px;color:#999">Matter: ${matter?.id} · Generated: ${new Date().toLocaleDateString('en-ZA')}</div></div></div>
  <div class="info"><div><div class="lbl">Client</div><div class="val">${matter?.client || '—'}</div></div><div><div class="lbl">Matter</div><div class="val">${matter?.name || '—'}</div></div><div><div class="lbl">Current trust balance</div><div class="val" style="color:#16a34a">${fmtR(running)}</div></div><div><div class="lbl">Total transactions</div><div class="val">${transactions.length}</div></div></div>
  <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th align="right">Debit</th><th align="right">Credit</th><th align="right">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#ccc;padding:20px">No transactions</td></tr>'}</tbody></table>
  <div class="foot">Motsoeneng Bill · VAT: 4100000000 · FNB 62000000000 · Branch: 250655 · accounts@mb.co.za</div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=920,height=720');
  w.document.write(html);
  w.document.close();
}

export default function TrustTab({
  trustTransactions, trustAccounts, trustBalances, balanceAlerts, lockedPeriods,
  branches, matters, allMatters, invoices, pendingPayments, trustLoading,
  profile, userId, loadTrust,
}) {
  const today = new Date().toLocaleDateString('en-CA');
  const [trustTab, setTrustTab] = useState('ledger');
  const [trustAlert, setTrustAlert] = useState({ msg: '', type: '' });
  const [trustSaving, setTrustSaving] = useState(false);
  const [rForm, setRForm] = useState({ date: today, amount: '', matterId: '', accountId: trustAccounts[0]?.id || '', reference: '', receivedFrom: '', narration: '', branchId: '' });
  const [pForm, setPForm] = useState({ date: today, amount: '', matterId: '', accountId: trustAccounts[0]?.id || '', payee: '', reference: '', narration: '', branchId: '' });
  const [pBalanceCheck, setPBalanceCheck] = useState(null);
  const [tForm, setTForm] = useState({ date: today, amount: '', matterId: '', fromAccountId: trustAccounts[0]?.id || '', toAccount: 'FNB Business', invoiceId: '', narration: '', branchId: '' });
  const [tBalanceCheck, setTBalanceCheck] = useState(null);
  const [bankLines, setBankLines] = useState([]);
  const [newBankLine, setNewBankLine] = useState({ date: today, description: '', amount: '', isCredit: true });
  const [matched, setMatched] = useState({});
  const [csvError, setCsvError] = useState('');
  const [reconPeriod, setReconPeriod] = useState(today.substring(0, 7));
  const [reportType, setReportType] = useState('trial');
  const [reportFrom, setReportFrom] = useState(today.substring(0, 7) + '-01');
  const [reportTo, setReportTo] = useState(today);
  const [reportBranch, setReportBranch] = useState('');
  const [alertMatterId, setAlertMatterId] = useState('');
  const [alertMinBal, setAlertMinBal] = useState(5000);
  const [selectedTrustMatter, setSelectedTrustMatter] = useState('');

  function showTrustAlert(msg, type = 'success') { setTrustAlert({ msg, type }); setTimeout(() => setTrustAlert({ msg: '', type: '' }), 6000); }
  function getMatterBalance(id) { return trustBalances[id] || 0; }
  function isLocked(date) { return date && lockedPeriods.includes(date.substring(0, 7)); }
  function isPeriodLocked(p) { return lockedPeriods.includes(p); }
  function totalTrustHeld() { return Object.values(trustBalances).reduce((s, v) => s + v, 0); }
  function getMatterLedger(matterId) {
    let run = 0;
    return trustTransactions.filter(t => t.matter_id === matterId && t.status === 'posted').sort((a, b) => a.date.localeCompare(b.date)).map(t => { if (t.type === 'receipt') run += Number(t.amount); else run -= Number(t.amount); return { ...t, runningBalance: run }; });
  }
  function getMatterInvoices(matterId) { return invoices.filter(i => i.matter_id === matterId); }
  function getReportTxns() { let t = trustTransactions.filter(x => x.date >= reportFrom && x.date <= reportTo && x.status === 'posted'); if (reportBranch) t = t.filter(x => x.branch_id === reportBranch); return t; }
  function checkPaymentBalance(matterId, amount) { if (!matterId || !amount) { setPBalanceCheck(null); return; } const bal = getMatterBalance(matterId), amt = parseFloat(amount); if (isNaN(amt) || amt <= 0) { setPBalanceCheck(null); return; } setPBalanceCheck({ bal, amt, ok: amt <= bal, needsApproval: amt >= APPROVAL_THRESHOLD }); }
  function checkTransferBalance(matterId, amount) { if (!matterId || !amount) { setTBalanceCheck(null); return; } const bal = getMatterBalance(matterId), amt = parseFloat(amount); if (isNaN(amt) || amt <= 0) { setTBalanceCheck(null); return; } setTBalanceCheck({ bal, amt, ok: amt <= bal }); }

  async function postReceipt() {
    if (!rForm.date || !rForm.amount || !rForm.matterId || !rForm.narration) { showTrustAlert('Please fill in all required fields.', 'error'); return; }
    if (isLocked(rForm.date)) { showTrustAlert(`Period ${rForm.date.substring(0, 7)} is locked.`, 'error'); return; }
    const amount = parseFloat(rForm.amount);
    if (isNaN(amount) || amount <= 0) { showTrustAlert('Enter a valid amount.', 'error'); return; }
    setTrustSaving(true);
    const receiptNo = nextReceiptNo(trustTransactions);
    const { error } = await supabase.from('trust_transactions').insert([{ type: 'receipt', matter_id: rForm.matterId, user_id: userId, date: rForm.date, amount, receipt_no: receiptNo, received_from: rForm.receivedFrom, trust_account_id: rForm.accountId || null, reference: rForm.reference, narration: rForm.narration, captured_by: userId, branch_id: rForm.branchId || profile?.branch_id || null, status: 'posted' }]);
    if (error) { showTrustAlert('Error: ' + error.message, 'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Receipt ${receiptNo} posted — ${fmtR(amount)} credited to ${matters.find(m => m.id === rForm.matterId)?.client || rForm.matterId}`, 'success');
    setRForm(f => ({ ...f, amount: '', matterId: '', reference: '', receivedFrom: '', narration: '' }));
    setTrustSaving(false); loadTrust();
  }

  async function postPayment() {
    if (!pForm.date || !pForm.amount || !pForm.matterId || !pForm.payee || !pForm.narration) { showTrustAlert('Please fill in all required fields.', 'error'); return; }
    if (isLocked(pForm.date)) { showTrustAlert(`Period ${pForm.date.substring(0, 7)} is locked.`, 'error'); return; }
    const amount = parseFloat(pForm.amount);
    if (isNaN(amount) || amount <= 0) { showTrustAlert('Enter a valid amount.', 'error'); return; }
    const bal = getMatterBalance(pForm.matterId);
    if (amount > bal) { showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)} — Requested: ${fmtR(amount)}.`, 'error'); return; }
    setTrustSaving(true);
    const needsApproval = amount >= APPROVAL_THRESHOLD;
    const { error } = await supabase.from('trust_transactions').insert([{ type: 'payment', matter_id: pForm.matterId, user_id: userId, date: pForm.date, amount, payee: pForm.payee, trust_account_id: pForm.accountId || null, reference: pForm.reference, narration: pForm.narration, captured_by: userId, branch_id: pForm.branchId || profile?.branch_id || null, status: needsApproval ? 'pending' : 'posted' }]);
    if (error) { showTrustAlert('Error: ' + error.message, 'error'); setTrustSaving(false); return; }
    showTrustAlert(needsApproval ? `⏳ Payment of ${fmtR(amount)} submitted for partner approval.` : `✓ Payment of ${fmtR(amount)} to ${pForm.payee} posted.`, 'success');
    setPForm(f => ({ ...f, amount: '', matterId: '', payee: '', reference: '', narration: '' }));
    setPBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  async function postTransfer() {
    if (!tForm.date || !tForm.amount || !tForm.matterId) { showTrustAlert('Please fill in all required fields.', 'error'); return; }
    if (isLocked(tForm.date)) { showTrustAlert(`Period ${tForm.date.substring(0, 7)} is locked.`, 'error'); return; }
    const amountExclVAT = parseFloat(tForm.amount);
    if (isNaN(amountExclVAT) || amountExclVAT <= 0) { showTrustAlert('Enter a valid amount.', 'error'); return; }
    const vatAmount = parseFloat((amountExclVAT * 0.15).toFixed(2));
    const totalAmount = parseFloat((amountExclVAT + vatAmount).toFixed(2));
    const bal = getMatterBalance(tForm.matterId);
    if (totalAmount > bal) { showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)} — Required incl. VAT: ${fmtR(totalAmount)}.`, 'error'); return; }
    setTrustSaving(true);
    const { error } = await supabase.from('trust_transactions').insert([{ type: 'transfer', matter_id: tForm.matterId, user_id: userId, date: tForm.date, amount: totalAmount, amount_excl_vat: amountExclVAT, vat_amount: vatAmount, trust_account_id: tForm.fromAccountId || null, to_account: tForm.toAccount, invoice_id: tForm.invoiceId, narration: tForm.narration || `Transfer of fees — ${tForm.matterId}`, captured_by: userId, branch_id: tForm.branchId || null, status: 'posted' }]);
    if (error) { showTrustAlert('Error: ' + error.message, 'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Transfer posted — Fees: ${fmtR(amountExclVAT)} + VAT: ${fmtR(vatAmount)} = Total: ${fmtR(totalAmount)} deducted from trust.`, 'success');
    setTForm(f => ({ ...f, amount: '', matterId: '', invoiceId: '', narration: '' }));
    setTBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  async function approvePayment(id) { const { error } = await supabase.from('trust_transactions').update({ status: 'posted', approved_by: userId, approved_at: new Date().toISOString() }).eq('id', id); if (error) { showTrustAlert('Error: ' + error.message, 'error'); return; } showTrustAlert('✓ Payment approved and posted.', 'success'); loadTrust(); }
  async function rejectPayment(id, reason) { const { error } = await supabase.from('trust_transactions').update({ status: 'rejected', rejection_reason: reason || 'Rejected' }).eq('id', id); if (error) { showTrustAlert('Error: ' + error.message, 'error'); return; } showTrustAlert('Payment rejected.', 'success'); loadTrust(); }
  async function lockPeriod(period) { if (!confirm(`Lock period ${period}? No transactions can be posted after locking.`)) return; const { error } = await supabase.from('trust_period_locks').insert([{ period, locked_by: userId }]); if (error) { showTrustAlert('Error: ' + error.message, 'error'); return; } showTrustAlert(`✓ Period ${period} locked.`, 'success'); loadTrust(); }
  async function unlockPeriod(period) { if (!confirm(`Unlock period ${period}? Only do this with partner authorisation.`)) return; const { error } = await supabase.from('trust_period_locks').delete().eq('period', period); if (error) { showTrustAlert('Error: ' + error.message, 'error'); return; } showTrustAlert(`Period ${period} unlocked.`, 'success'); loadTrust(); }
  async function saveBalanceAlert() { if (!alertMatterId) { showTrustAlert('Select a matter.', 'error'); return; } const { error } = await supabase.from('trust_balance_alerts').upsert([{ matter_id: alertMatterId, minimum_balance: alertMinBal, is_active: true, created_by: userId }], { onConflict: 'matter_id' }); if (error) { showTrustAlert('Error: ' + error.message, 'error'); return; } showTrustAlert('✓ Balance alert saved.', 'success'); loadTrust(); }

  function handleCSVImport(e) {
    const file = e.target.files[0]; if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split('\n').filter(l => l.trim());
        const parsed = [];
        lines.forEach((line, i) => {
          if (i === 0 && (line.toLowerCase().includes('date') || line.toLowerCase().includes('description'))) return;
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) return;
          const date = cols[0], desc = cols[1] || cols[2] || '', amtRaw = cols[2] || cols[3] || '0';
          const amt = parseFloat(amtRaw.replace(/[^0-9.-]/g, ''));
          if (isNaN(amt) || !date) return;
          parsed.push({ id: Date.now() + i, date: date.includes('/') ? date.split('/').reverse().join('-') : date, description: desc, amount: Math.abs(amt), isCredit: amt > 0 });
        });
        if (!parsed.length) { setCsvError('No valid rows found. Check your CSV format.'); return; }
        setBankLines(l => [...l, ...parsed]);
        showTrustAlert(`✓ Imported ${parsed.length} bank statement lines`, 'success');
      } catch (err) { setCsvError('Failed to parse CSV: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const total = totalTrustHeld();
  const ledger = selectedTrustMatter ? getMatterLedger(selectedTrustMatter) : [];
  const systemTotal = trustTransactions.filter(t => t.status === 'posted').reduce((s, t) => t.type === 'receipt' ? s + Number(t.amount) : s - Number(t.amount), 0);
  const bankTotal = bankLines.reduce((s, l) => l.isCredit ? s + Number(l.amount || 0) : s - Number(l.amount || 0), 0);
  const diff = Math.abs(systemTotal - bankTotal);

  return (
    <div>
      {trustAlert.msg && (
        <div style={{ background: trustAlert.type === 'error' ? 'rgba(220,80,80,0.1)' : 'rgba(108,192,74,0.1)', border: `1px solid ${trustAlert.type === 'error' ? 'rgba(220,80,80,0.4)' : 'rgba(108,192,74,0.3)'}`, borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: trustAlert.type === 'error' ? '#E05252' : '#6CC04A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{trustAlert.msg}</span>
          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }} onClick={() => setTrustAlert({ msg: '', type: '' })}>✕</button>
        </div>
      )}
      {pendingPayments.length > 0 && (
        <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#EAB308', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⏳ {pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} pending approval — {fmtR(pendingPayments.reduce((s, t) => s + Number(t.amount), 0))}</span>
          <button style={{ ...C.btn('warn'), fontSize: 11 }} onClick={() => setTrustTab('approvals')}>Review →</button>
        </div>
      )}
      {balanceAlerts.filter(a => a.is_active && getMatterBalance(a.matter_id) < Number(a.minimum_balance)).map(a => {
        const m = matters.find(x => x.id === a.matter_id);
        return <div key={a.matter_id} style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.3)', borderRadius: 6, padding: '8px 14px', marginBottom: 8, fontSize: 12, color: '#E05252' }}>⚠ Low balance: {m?.client || a.matter_id} — {fmtR(getMatterBalance(a.matter_id))} below minimum {fmtR(a.minimum_balance)}</div>;
      })}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['ledger', '📊 Ledger'], ['receipt', '⬇ Receipt'], ['payment', '⬆ Payment'], ['transfer', '↔ Transfer'], ['recon', '🔁 Reconciliation'], ['reports', '📋 Reports'], ['approvals', '✅ Approvals'], ['settings', '⚙ Settings']].map(([v, l]) => (
          <button key={v} style={{ ...C.ttab(trustTab === v), position: 'relative' }} onClick={() => setTrustTab(v)}>
            {l}{v === 'approvals' && pendingPayments.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#EAB308', color: '#000', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingPayments.length}</span>}
          </button>
        ))}
        {trustLoading && <span style={{ fontSize: 11, color: '#555', alignSelf: 'center' }}>Loading…</span>}
      </div>

      {/* ── LEDGER ── */}
      {trustTab === 'ledger' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[{ l: 'Total trust held', v: fmtR(total), a: true }, { l: 'Receipts', v: fmtR(trustTransactions.filter(t => t.type === 'receipt' && t.status === 'posted').reduce((s, t) => s + Number(t.amount), 0)), a: false }, { l: 'Payments', v: fmtR(trustTransactions.filter(t => t.type === 'payment' && t.status === 'posted').reduce((s, t) => s + Number(t.amount), 0)), a: false }, { l: 'Transferred', v: fmtR(trustTransactions.filter(t => t.type === 'transfer' && t.status === 'posted').reduce((s, t) => s + Number(t.amount), 0)), a: false }].map(({ l, v, a }) => (
              <div key={l} style={C.stat(a)}><div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: a ? '#6CC04A' : '#F0F0F0' }}>{v}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#555' }}>Branch:</span>
            {[{ id: '', name: 'All branches' }, ...branches].map(b => (
              <button key={b.id} style={{ ...C.btn(reportBranch === b.id ? 'trust' : 's'), fontSize: 11, padding: '4px 12px' }} onClick={() => setReportBranch(b.id)}>{b.name}</button>
            ))}
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>All matters — trust balances</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Matter ID', 'Client', 'Description', 'Branch', 'Balance', 'Alert', 'Actions'].map(h => <th key={h} style={{ ...C.th, textAlign: h === 'Balance' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {!matters.length && <tr><td colSpan={7} style={{ ...C.td, textAlign: 'center', color: '#333', padding: 30 }}>No matters found.</td></tr>}
                  {matters.map(m => {
                    const bal = getMatterBalance(m.id), alert = balanceAlerts.find(a => a.matter_id === m.id && a.is_active), isLow = alert && bal < Number(alert.minimum_balance), br = branches.find(b => b.id === m.branch_id);
                    return (
                      <tr key={m.id} style={{ background: isLow ? 'rgba(220,80,80,0.03)' : '' }}>
                        <td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#A78BFA' }}>{m.id}</td>
                        <td style={{ ...C.td, fontWeight: 500, color: '#C8C8C8' }}>{m.client}</td>
                        <td style={{ ...C.td, color: '#555', fontSize: 10 }}>{m.name}</td>
                        <td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td>
                        <td style={{ ...C.td, fontFamily: 'monospace', fontWeight: 700, color: bal > 0 ? '#6CC04A' : bal < 0 ? '#E05252' : '#555', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtR(bal)}</td>
                        <td style={C.td}>{isLow ? <span style={{ fontSize: 9, color: '#E05252', border: '1px solid rgba(220,80,80,0.4)', padding: '2px 8px', borderRadius: 20 }}>⚠ Low</span> : alert ? <span style={{ fontSize: 9, color: '#555', border: '1px solid #252525', padding: '2px 8px', borderRadius: 20 }}>Monitored</span> : '—'}</td>
                        <td style={C.td}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={{ ...C.btn('trust'), fontSize: 10, padding: '3px 8px' }} onClick={() => setSelectedTrustMatter(selectedTrustMatter === m.id ? '' : m.id)}>{selectedTrustMatter === m.id ? 'Hide' : 'Ledger'}</button>
                            <button style={{ ...C.btn('g'), fontSize: 10, padding: '3px 8px' }} onClick={() => printTrustStatement(m, getMatterLedger(m.id))}>Statement</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#0D0D0D' }}>
                    <td colSpan={4} style={{ ...C.th, paddingTop: 12 }}>Grand total</td>
                    <td style={{ ...C.th, fontFamily: 'monospace', fontSize: 12, color: '#6CC04A', textAlign: 'right', paddingTop: 12 }}>{fmtR(total)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {selectedTrustMatter && (
            <div style={C.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4A90D9' }}>{selectedTrustMatter} — {matters.find(m => m.id === selectedTrustMatter)?.client} — Running ledger</div>
                <button style={{ ...C.btn('g'), fontSize: 11 }} onClick={() => printTrustStatement(matters.find(m => m.id === selectedTrustMatter), ledger)}>Print statement</button>
              </div>
              {!ledger.length ? <div style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: 20 }}>No transactions yet.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Date', 'Type', 'Receipt No', 'Reference', 'Narration', 'Debit', 'Credit', 'Balance'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {ledger.map((t, i) => {
                        const isR = t.type === 'receipt';
                        return (
                          <tr key={i}>
                            <td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                            <td style={C.td}><span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: isR ? 'rgba(108,192,74,0.1)' : t.type === 'payment' ? 'rgba(220,80,80,0.1)' : 'rgba(74,144,217,0.1)', color: isR ? '#6CC04A' : t.type === 'payment' ? '#E05252' : '#4A90D9' }}>{t.type}</span></td>
                            <td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{t.receipt_no || '—'}</td>
                            <td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.reference || '—'}</td>
                            <td style={C.td}>{t.narration}</td>
                            <td style={{ ...C.td, fontFamily: 'monospace', color: '#E05252', textAlign: 'right' }}>{!isR ? fmtR(t.amount) : ''}</td>
                            <td style={{ ...C.td, fontFamily: 'monospace', color: '#6CC04A', textAlign: 'right' }}>{isR ? fmtR(t.amount) : ''}</td>
                            <td style={{ ...C.td, fontFamily: 'monospace', fontWeight: 700, color: t.runningBalance >= 0 ? '#6CC04A' : '#E05252', textAlign: 'right' }}>{fmtR(t.runningBalance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── RECEIPT ── */}
      {trustTab === 'receipt' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={C.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>New trust receipt</div>
              <span style={{ fontSize: 10, color: '#4A90D9', border: '1px solid rgba(74,144,217,0.3)', padding: '2px 10px', borderRadius: 20 }}>Next: {nextReceiptNo(trustTransactions)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={rForm.date} onChange={e => setRForm(f => ({ ...f, date: e.target.value }))} />{isLocked(rForm.date) && <div style={{ fontSize: 10, color: '#E05252', marginTop: 4 }}>⚠ Period locked</div>}</div>
                <div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="e.g. 10000.00" defaultValue={rForm.amount} onBlur={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); e.target.value = v; setRForm(f => ({ ...f, amount: v })); }} /></div>
              </div>
              <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={rForm.matterId} onChange={e => setRForm(f => ({ ...f, matterId: e.target.value }))}><option value="">Select matter...</option>{allMatters.map(m => <option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}</select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Trust bank account</label><select style={C.tinp} value={rForm.accountId} onChange={e => setRForm(f => ({ ...f, accountId: e.target.value }))}>{trustAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label style={C.lbl}>Branch</label><div style={{ ...C.tinp, color: '#4A90D9', display: 'flex', alignItems: 'center' }}>{branches.find(b => b.id === profile?.branch_id)?.name || 'Not assigned'}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="EFT ref, cheque no." defaultValue={rForm.reference} onBlur={e => setRForm(f => ({ ...f, reference: e.target.value }))} /></div>
                <div><label style={C.lbl}>Received from</label><input style={C.tinp} placeholder="Payer name" defaultValue={rForm.receivedFrom} onBlur={e => setRForm(f => ({ ...f, receivedFrom: e.target.value }))} /></div>
              </div>
              <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Description of receipt" defaultValue={rForm.narration} onBlur={e => setRForm(f => ({ ...f, narration: e.target.value }))} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button style={C.btn()} onClick={() => setRForm(f => ({ ...f, amount: '', matterId: '', reference: '', receivedFrom: '', narration: '' }))}>Clear</button>
                <button style={C.btn('p')} onClick={() => { setRForm(f => ({ ...f, branchId: profile?.branch_id || '' })); postReceipt(); }} disabled={trustSaving || isLocked(rForm.date)}>{trustSaving ? 'Posting…' : 'Post receipt'}</button>
              </div>
            </div>
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Recent receipts</div>
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Receipt', 'Date', 'Matter', 'Client', 'Amount', 'Branch'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!trustTransactions.filter(t => t.type === 'receipt').length && <tr><td colSpan={6} style={{ ...C.td, textAlign: 'center', color: '#333', padding: 20 }}>No receipts yet</td></tr>}
                  {trustTransactions.filter(t => t.type === 'receipt').map((t, i) => { const m = matters.find(x => x.id === t.matter_id), br = branches.find(b => b.id === t.branch_id); return (<tr key={i}><td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#4A90D9' }}>{t.receipt_no}</td><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={C.td}>{m?.client || '—'}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#6CC04A', textAlign: 'right' }}>{fmtR(t.amount)}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td></tr>); })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT ── */}
      {trustTab === 'payment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={C.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>New trust payment</div>
              <span style={{ fontSize: 10, color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 10px', borderRadius: 20 }}>≥ {fmtR(APPROVAL_THRESHOLD)} needs approval</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={pForm.date} onChange={e => setPForm(f => ({ ...f, date: e.target.value }))} />{isLocked(pForm.date) && <div style={{ fontSize: 10, color: '#E05252', marginTop: 4 }}>⚠ Period locked</div>}</div>
                <div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={pForm.amount} onBlur={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); e.target.value = v; setPForm(f => ({ ...f, amount: v })); checkPaymentBalance(pForm.matterId, v); }} /></div>
              </div>
              <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={pForm.matterId} onChange={e => { setPForm(f => ({ ...f, matterId: e.target.value })); checkPaymentBalance(e.target.value, pForm.amount); }}><option value="">Select matter...</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
              {pBalanceCheck && <div style={{ background: pBalanceCheck.ok ? 'rgba(108,192,74,0.08)' : 'rgba(220,80,80,0.08)', border: `1px solid ${pBalanceCheck.ok ? 'rgba(108,192,74,0.3)' : 'rgba(220,80,80,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: pBalanceCheck.ok ? '#6CC04A' : '#E05252' }}>{pBalanceCheck.ok ? `✓ Available: ${fmtR(pBalanceCheck.bal)} · After: ${fmtR(pBalanceCheck.bal - pBalanceCheck.amt)}${pBalanceCheck.needsApproval ? ' · ⏳ Needs partner approval' : ''}` : `✗ Insufficient — available: ${fmtR(pBalanceCheck.bal)}, shortfall: ${fmtR(pBalanceCheck.amt - pBalanceCheck.bal)}`}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Trust bank account</label><select style={C.tinp} value={pForm.accountId} onChange={e => setPForm(f => ({ ...f, accountId: e.target.value }))}>{trustAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label style={C.lbl}>Branch</label><div style={{ ...C.tinp, color: '#4A90D9', display: 'flex', alignItems: 'center' }}>{branches.find(b => b.id === profile?.branch_id)?.name || 'Not assigned'}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Payee *</label><input style={C.tinp} placeholder="Sheriff, advocate, municipality…" defaultValue={pForm.payee} onBlur={e => setPForm(f => ({ ...f, payee: e.target.value }))} /></div>
                <div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="Cheque or EFT ref" defaultValue={pForm.reference} onBlur={e => setPForm(f => ({ ...f, reference: e.target.value }))} /></div>
              </div>
              <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Payment description" defaultValue={pForm.narration} onBlur={e => setPForm(f => ({ ...f, narration: e.target.value }))} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button style={C.btn()} onClick={() => { setPForm(f => ({ ...f, amount: '', matterId: '', payee: '', reference: '', narration: '' })); setPBalanceCheck(null); }}>Clear</button>
                <button style={C.btn('p')} onClick={postPayment} disabled={trustSaving || isLocked(pForm.date)}>{trustSaving ? 'Posting…' : pBalanceCheck?.needsApproval ? 'Submit for approval' : 'Post payment'}</button>
              </div>
            </div>
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Recent payments</div>
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Date', 'Matter', 'Payee', 'Amount', 'Status', 'Branch'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!trustTransactions.filter(t => t.type === 'payment').length && <tr><td colSpan={6} style={{ ...C.td, textAlign: 'center', color: '#333', padding: 20 }}>No payments yet</td></tr>}
                  {trustTransactions.filter(t => t.type === 'payment').map((t, i) => { const br = branches.find(b => b.id === t.branch_id); return (<tr key={i}><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={C.td}>{t.payee}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#E05252', textAlign: 'right' }}>{fmtR(t.amount)}</td><td style={C.td}><span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: t.status === 'posted' ? 'rgba(108,192,74,0.1)' : t.status === 'pending' ? 'rgba(234,179,8,0.1)' : 'rgba(220,80,80,0.1)', color: t.status === 'posted' ? '#6CC04A' : t.status === 'pending' ? '#EAB308' : '#E05252' }}>{t.status}</span></td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td></tr>); })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER ── */}
      {trustTab === 'transfer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={C.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>Trust to business transfer</div>
              <span style={{ fontSize: 10, color: '#4A90D9', border: '1px solid rgba(74,144,217,0.3)', padding: '2px 10px', borderRadius: 20 }}>Both legs auto-posted</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={tForm.date} onChange={e => setTForm(f => ({ ...f, date: e.target.value }))} />{isLocked(tForm.date) && <div style={{ fontSize: 10, color: '#E05252', marginTop: 4 }}>⚠ Period locked</div>}</div>
                <div><label style={C.lbl}>Amount excl. VAT *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={tForm.amount} onBlur={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); e.target.value = v; setTForm(f => ({ ...f, amount: v })); checkTransferBalance(tForm.matterId, v); }} /></div>
              </div>
              <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={tForm.matterId} onChange={e => { setTForm(f => ({ ...f, matterId: e.target.value, invoiceId: '', amount: '' })); checkTransferBalance(e.target.value, tForm.amount); }}><option value="">Select matter...</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
              {tBalanceCheck && (
                <div style={{ background: tBalanceCheck.ok ? 'rgba(108,192,74,0.08)' : 'rgba(220,80,80,0.08)', border: `1px solid ${tBalanceCheck.ok ? 'rgba(108,192,74,0.3)' : 'rgba(220,80,80,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: tBalanceCheck.ok ? '#6CC04A' : '#E05252' }}>
                  {tBalanceCheck.ok ? <div><div>✓ Available: {fmtR(tBalanceCheck.bal)}</div><div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>Excl. VAT: {fmtR(tBalanceCheck.amt)} + VAT 15%: {fmtR(tBalanceCheck.amt * 0.15)} = <strong style={{ color: '#EAB308' }}>Total from trust: {fmtR(tBalanceCheck.amt * 1.15)}</strong></div><div style={{ marginTop: 2, fontSize: 11, color: '#555' }}>After transfer: {fmtR(tBalanceCheck.bal - tBalanceCheck.amt * 1.15)}</div></div> : `✗ Insufficient — available: ${fmtR(tBalanceCheck.bal)}, required incl. VAT: ${fmtR(tBalanceCheck.amt * 1.15)}`}
                </div>
              )}
              {tForm.matterId && getMatterInvoices(tForm.matterId).length > 0 && (
                <div><label style={C.lbl}>Link to invoice (optional)</label><select style={C.tinp} value={tForm.invoiceId} onChange={e => { const inv = invoices.find(i => i.id === e.target.value); setTForm(f => ({ ...f, invoiceId: e.target.value, narration: inv ? `Transfer of fees — ${inv.matter_name} — ${inv.id}` : '' })); }}><option value="">Select invoice (optional)…</option>{getMatterInvoices(tForm.matterId).map(i => <option key={i.id} value={i.id}>{i.id} — R{((i.total_units || 0) * (i.rate || 150) * 1.15).toFixed(2)} incl. VAT</option>)}</select></div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>From trust account</label><select style={C.tinp} value={tForm.fromAccountId} onChange={e => setTForm(f => ({ ...f, fromAccountId: e.target.value }))}>{trustAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label style={C.lbl}>To business account</label><select style={C.tinp} value={tForm.toAccount} onChange={e => setTForm(f => ({ ...f, toAccount: e.target.value }))}><option value="FNB Business">FNB Business Account</option><option value="ABSA Business">ABSA Business Account</option></select></div>
              </div>
              <div><label style={C.lbl}>Narration</label><input style={C.tinp} placeholder="e.g. Transfer of professional fees" defaultValue={tForm.narration} onBlur={e => setTForm(f => ({ ...f, narration: e.target.value }))} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button style={C.btn()} onClick={() => { setTForm(f => ({ ...f, amount: '', matterId: '', invoiceId: '', narration: '' })); setTBalanceCheck(null); }}>Clear</button>
                <button style={C.btn('p')} onClick={postTransfer} disabled={trustSaving || isLocked(tForm.date)}>{trustSaving ? 'Posting…' : 'Post transfer'}</button>
              </div>
            </div>
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Transfer history</div>
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Date', 'Matter', 'From', 'To', 'Invoice', 'Amount'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!trustTransactions.filter(t => t.type === 'transfer').length && <tr><td colSpan={6} style={{ ...C.td, textAlign: 'center', color: '#333', padding: 20 }}>No transfers yet</td></tr>}
                  {trustTransactions.filter(t => t.type === 'transfer').map((t, i) => (
                    <tr key={i}><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{trustAccounts.find(a => a.id === t.trust_account_id)?.name || 'Trust'}</td><td style={{ ...C.td, fontSize: 10, color: '#6CC04A' }}>{t.to_account}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.invoice_id || '—'}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#4A90D9', textAlign: 'right' }}>{fmtR(t.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RECONCILIATION ── */}
      {trustTab === 'recon' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[{ l: 'System trust balance', v: fmtR(systemTotal), c: '#4A90D9' }, { l: 'Bank statement total', v: fmtR(bankTotal), c: '#F0F0F0' }, { l: 'Difference', v: fmtR(diff), c: diff < 0.01 ? '#6CC04A' : '#E05252', sub: diff < 0.01 ? '✓ Reconciled' : 'Unreconciled' }].map(({ l, v, c, sub }) => (
              <div key={l} style={C.stat(diff < 0.01 && l === 'Difference')}><div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>{sub && <div style={{ fontSize: 10, color: c, marginTop: 4 }}>{sub}</div>}</div>
            ))}
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Period management — month-end lock</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" style={{ ...C.sel, width: 150 }} value={reconPeriod} onChange={e => setReconPeriod(e.target.value)} />
              {isPeriodLocked(reconPeriod) ? (<><span style={{ fontSize: 11, color: '#E05252', border: '1px solid rgba(220,80,80,0.3)', padding: '4px 12px', borderRadius: 6 }}>🔒 Period {reconPeriod} is LOCKED</span><button style={C.btn('r')} onClick={() => unlockPeriod(reconPeriod)}>Unlock</button></>) : (<><span style={{ fontSize: 11, color: '#555' }}>Period {reconPeriod} is open</span><button style={C.btn('warn')} onClick={() => lockPeriod(reconPeriod)}>🔒 Lock period</button></>)}
              {lockedPeriods.length > 0 && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>Locked: {lockedPeriods.join(', ')}</div>}
            </div>
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Import bank statement — CSV</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>Import directly from FNB, ABSA, Standard Bank, Nedbank — or add lines manually.</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.3)', color: '#4A90D9', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>📂 Import CSV<input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSVImport} /></label>
              {bankLines.length > 0 && <span style={{ fontSize: 11, color: '#555' }}>{bankLines.length} lines · <button style={{ background: 'none', border: 'none', color: '#E05252', cursor: 'pointer', fontSize: 11 }} onClick={() => { if (confirm('Clear all bank lines?')) { setBankLines([]); setMatched({}); } }}>Clear all</button></span>}
              {csvError && <span style={{ fontSize: 11, color: '#E05252' }}>{csvError}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 90px 80px', gap: 8, alignItems: 'flex-end' }}>
              <div><label style={C.lbl}>Date</label><input type="date" style={C.tinp} value={newBankLine.date} onChange={e => setNewBankLine(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={C.lbl}>Description</label><input style={C.tinp} placeholder="Bank line description" defaultValue={newBankLine.description} onBlur={e => setNewBankLine(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label style={C.lbl}>Amount</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={newBankLine.amount} onBlur={e => setNewBankLine(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><label style={C.lbl}>Type</label><select style={C.tinp} value={newBankLine.isCredit ? 'credit' : 'debit'} onChange={e => setNewBankLine(f => ({ ...f, isCredit: e.target.value === 'credit' }))}><option value="credit">Credit</option><option value="debit">Debit</option></select></div>
              <button style={{ ...C.btn('p'), marginTop: 16 }} onClick={() => { if (!newBankLine.description || !newBankLine.amount) return; setBankLines(l => [...l, { ...newBankLine, id: Date.now() }]); setNewBankLine({ date: today, description: '', amount: '', isCredit: true }); }}>Add</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={C.card}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Bank statement ({bankLines.length} lines)</div>
              {!bankLines.length ? <div style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: 20 }}>Import CSV or add lines above</div> : bankLines.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #252525', borderRadius: 6, marginBottom: 6, opacity: matched['b' + l.id] ? 0.4 : 1, textDecoration: matched['b' + l.id] ? 'line-through' : 'none' }}>
                  <input type="checkbox" checked={!!matched['b' + l.id]} onChange={e => setMatched(m => ({ ...m, ['b' + l.id]: e.target.checked }))} style={{ accentColor: '#6CC04A' }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{l.description}</div><div style={{ fontSize: 10, color: '#555' }}>{fmtDate(l.date)}</div></div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: l.isCredit ? '#6CC04A' : '#E05252' }}>{l.isCredit ? '+' : '-'}{fmtR(Math.abs(l.amount))}</div>
                  <button style={{ ...C.btn('r'), padding: '2px 8px', fontSize: 10 }} onClick={() => setBankLines(ls => ls.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
            <div style={C.card}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>System transactions</div>
              {!trustTransactions.filter(t => t.status === 'posted').length ? <div style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: 20 }}>No transactions yet</div> : trustTransactions.filter(t => t.status === 'posted' && t.type !== 'transfer').map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #252525', borderRadius: 6, marginBottom: 6, opacity: matched['s' + i] ? 0.4 : 1, textDecoration: matched['s' + i] ? 'line-through' : 'none' }}>
                  <input type="checkbox" checked={!!matched['s' + i]} onChange={e => setMatched(m => ({ ...m, ['s' + i]: e.target.checked }))} style={{ accentColor: '#6CC04A' }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{t.narration}</div><div style={{ fontSize: 10, color: '#555' }}>{fmtDate(t.date)} · {t.matter_id}</div></div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: t.type === 'receipt' ? '#6CC04A' : '#E05252' }}>{t.type === 'receipt' ? '+' : '-'}{fmtR(t.amount)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={C.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>Reconciliation certificate — {reconPeriod}</div>
              <button style={C.btn('g')} onClick={() => {
                const mc = Object.values(matched).filter(Boolean).length;
                const w = window.open('', '_blank', 'width=700,height=600');
                w.document.write(`<!DOCTYPE html><html><head><title>Trust Recon Certificate</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #eee;font-size:12px}.sig{margin-top:40px;display:flex;justify-content:space-between}.sig-line{width:200px;border-top:1px solid #111;padding-top:6px;font-size:11px;color:#888}</style></head><body><h2 style="color:#6CC04A">Motsoeneng Bill</h2><h3>Trust Account Reconciliation Certificate</h3><p style="color:#888;font-size:12px">Period: ${reconPeriod} · Generated: ${new Date().toLocaleDateString('en-ZA')}</p><table><tr><td>Trust bank balance per bank statement</td><td style="text-align:right;font-weight:700">${fmtR(bankTotal)}</td></tr><tr><td>Trust balance per system</td><td style="text-align:right;font-weight:700">${fmtR(systemTotal)}</td></tr><tr style="font-weight:700;color:${diff < 0.01 ? 'green' : 'red'}"><td>Difference</td><td style="text-align:right">${fmtR(diff)}</td></tr><tr><td>Items matched</td><td style="text-align:right">${mc}</td></tr><tr><td>Period status</td><td style="text-align:right">${isPeriodLocked(reconPeriod) ? 'LOCKED' : 'Open'}</td></tr></table><p style="color:${diff < 0.01 ? 'green' : 'red'};font-weight:700">${diff < 0.01 ? '✓ Accounts reconcile' : '✗ Investigate outstanding items'}</p><div class="sig"><div class="sig-line">Bookkeeper signature</div><div class="sig-line">Partner / Director signature</div></div></body></html>`);
                w.document.close();
              }}>Print certificate</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12 }}>
              <div>{[['Bank statement balance', fmtR(bankTotal)], ['System trust balance', fmtR(systemTotal)], ['Difference', fmtR(diff)]].map(([l, v], i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1A1A1A' }}><span style={{ color: '#888' }}>{l}</span><span style={{ fontFamily: 'monospace', fontWeight: i === 2 ? 700 : 400, color: i === 2 ? (diff < 0.01 ? '#6CC04A' : '#E05252') : '#F0F0F0' }}>{v}</span></div>))}</div>
              <div>{[['Items matched', Object.values(matched).filter(Boolean).length], ['Bank lines', bankLines.length], ['System transactions', trustTransactions.filter(t => t.status === 'posted' && t.type !== 'transfer').length], ['Period status', isPeriodLocked(reconPeriod) ? '🔒 Locked' : 'Open']].map(([l, v], i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1A1A1A' }}><span style={{ color: '#888' }}>{l}</span><span style={{ fontFamily: 'monospace' }}>{v}</span></div>))}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVALS ── */}
      {trustTab === 'approvals' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#D0D0D0', marginBottom: 16 }}>Payment approvals — partner review</div>
          {!pendingPayments.length ? (
            <div style={{ ...C.card, textAlign: 'center', padding: '40px', color: '#555' }}><div style={{ fontSize: 28, marginBottom: 10 }}>✅</div><div>No payments pending approval</div></div>
          ) : pendingPayments.map((t, i) => {
            const m = matters.find(x => x.id === t.matter_id), br = branches.find(b => b.id === t.branch_id);
            return (
              <div key={i} style={{ ...C.card, border: '1px solid rgba(234,179,8,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, background: 'rgba(234,179,8,0.1)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>PENDING APPROVAL</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{fmtDate(t.date)}</span>
                      {br && <span style={{ fontSize: 10, color: '#555', border: '1px solid #252525', padding: '1px 8px', borderRadius: 20 }}>{br.name}</span>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#EAB308', marginBottom: 6 }}>{fmtR(t.amount)}</div>
                    <div style={{ fontSize: 12, color: '#D0D0D0', marginBottom: 2 }}>Payee: <strong>{t.payee}</strong></div>
                    <div style={{ fontSize: 12, color: '#D0D0D0', marginBottom: 2 }}>Matter: <span style={{ color: '#A78BFA' }}>{t.matter_id}</span> — {m?.client || '—'}</div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>{t.narration}</div>
                    <div style={{ padding: '8px 12px', background: 'rgba(234,179,8,0.05)', borderRadius: 6, fontSize: 11, color: '#888' }}>Balance available: <strong style={{ color: '#6CC04A' }}>{fmtR(getMatterBalance(t.matter_id))}</strong> · After approval: <strong style={{ color: getMatterBalance(t.matter_id) - Number(t.amount) >= 0 ? '#6CC04A' : '#E05252' }}>{fmtR(getMatterBalance(t.matter_id) - Number(t.amount))}</strong></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
                    <span style={{ fontSize: 10, color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', padding: '4px 12px', borderRadius: 6, textAlign: 'center' }}>⏳ Awaiting manager approval</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── REPORTS ── */}
      {trustTab === 'reports' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            {[['trial', 'Trial Balance'], ['receipts', 'Receipts Journal'], ['payments', 'Payments Journal'], ['transfers', 'Transfers Journal']].map(([v, l]) => (
              <button key={v} style={{ ...C.btn(reportType === v ? 'trust' : 's'), fontSize: 11 }} onClick={() => setReportType(v)}>{l}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select style={{ ...C.sel, width: 130 }} value={reportBranch} onChange={e => setReportBranch(e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <input type="date" style={{ ...C.sel, width: 130 }} value={reportFrom} onChange={e => setReportFrom(e.target.value)} />
              <span style={{ fontSize: 11, color: '#555' }}>to</span>
              <input type="date" style={{ ...C.sel, width: 130 }} value={reportTo} onChange={e => setReportTo(e.target.value)} />
            </div>
          </div>
          {reportType === 'trial' && (
            <div style={C.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>Trust trial balance{reportBranch ? ' — ' + branches.find(b => b.id === reportBranch)?.name : ' — all branches'}</div><span style={{ fontSize: 10, color: '#555' }}>Grand total must equal trust bank balance</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Matter ID', 'Client', 'Description', 'Branch', 'Trust Balance'].map(h => <th key={h} style={{ ...C.th, textAlign: h === 'Trust Balance' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {matters.map(m => { const bal = getMatterBalance(m.id), br = branches.find(b => b.id === m.branch_id); return (<tr key={m.id} style={{ opacity: bal === 0 ? 0.4 : 1 }}><td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#A78BFA' }}>{m.id}</td><td style={{ ...C.td, fontWeight: 500 }}>{m.client}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{m.name}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td><td style={{ ...C.td, fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: bal > 0 ? '#6CC04A' : bal < 0 ? '#E05252' : '#555' }}>{fmtR(bal)}</td></tr>); })}
                  <tr style={{ background: '#0D0D0D' }}><td colSpan={4} style={{ ...C.th, paddingTop: 12 }}>Grand total</td><td style={{ ...C.th, fontFamily: 'monospace', fontSize: 12, color: '#6CC04A', textAlign: 'right', paddingTop: 12 }}>{fmtR(totalTrustHeld())}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {reportType === 'receipts' && (
            <div style={C.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Receipts journal — {reportFrom} to {reportTo}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Receipt No', 'Date', 'Matter', 'Client', 'Received From', 'Branch', 'Narration', 'Amount'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>{getReportTxns().filter(t => t.type === 'receipt').map((t, i) => { const m = matters.find(x => x.id === t.matter_id), br = branches.find(b => b.id === t.branch_id); return <tr key={i}><td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#4A90D9' }}>{t.receipt_no}</td><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={C.td}>{m?.client || '—'}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.received_from || '—'}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.narration}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#6CC04A', textAlign: 'right' }}>{fmtR(t.amount)}</td></tr>; })}<tr style={{ background: '#0D0D0D' }}><td colSpan={7} style={{ ...C.th, paddingTop: 12 }}>Total</td><td style={{ ...C.th, fontFamily: 'monospace', fontSize: 12, color: '#6CC04A', textAlign: 'right', paddingTop: 12 }}>{fmtR(getReportTxns().filter(t => t.type === 'receipt').reduce((s, t) => s + Number(t.amount), 0))}</td></tr></tbody>
              </table>
            </div>
          )}
          {reportType === 'payments' && (
            <div style={C.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Payments journal — {reportFrom} to {reportTo}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Date', 'Matter', 'Client', 'Payee', 'Branch', 'Status', 'Narration', 'Amount'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>{getReportTxns().filter(t => t.type === 'payment').map((t, i) => { const m = matters.find(x => x.id === t.matter_id), br = branches.find(b => b.id === t.branch_id); return <tr key={i}><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={C.td}>{m?.client || '—'}</td><td style={C.td}>{t.payee}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{br?.name || '—'}</td><td style={C.td}><span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: t.status === 'posted' ? 'rgba(108,192,74,0.1)' : 'rgba(234,179,8,0.1)', color: t.status === 'posted' ? '#6CC04A' : '#EAB308' }}>{t.status}</span></td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.narration}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#E05252', textAlign: 'right' }}>{fmtR(t.amount)}</td></tr>; })}<tr style={{ background: '#0D0D0D' }}><td colSpan={7} style={{ ...C.th, paddingTop: 12 }}>Total</td><td style={{ ...C.th, fontFamily: 'monospace', fontSize: 12, color: '#E05252', textAlign: 'right', paddingTop: 12 }}>{fmtR(getReportTxns().filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0))}</td></tr></tbody>
              </table>
            </div>
          )}
          {reportType === 'transfers' && (
            <div style={C.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Transfers journal — {reportFrom} to {reportTo}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Date', 'Matter', 'Client', 'From', 'To Business', 'Invoice', 'Amount'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>{getReportTxns().filter(t => t.type === 'transfer').map((t, i) => { const m = matters.find(x => x.id === t.matter_id); return <tr key={i}><td style={{ ...C.td, fontSize: 10 }}>{fmtDate(t.date)}</td><td style={{ ...C.td, fontSize: 10, color: '#A78BFA' }}>{t.matter_id}</td><td style={C.td}>{m?.client || '—'}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{trustAccounts.find(a => a.id === t.trust_account_id)?.name || 'Trust'}</td><td style={{ ...C.td, fontSize: 10, color: '#6CC04A' }}>{t.to_account}</td><td style={{ ...C.td, fontSize: 10, color: '#555' }}>{t.invoice_id || '—'}</td><td style={{ ...C.td, fontFamily: 'monospace', color: '#4A90D9', textAlign: 'right' }}>{fmtR(t.amount)}</td></tr>; })}<tr style={{ background: '#0D0D0D' }}><td colSpan={6} style={{ ...C.th, paddingTop: 12 }}>Total</td><td style={{ ...C.th, fontFamily: 'monospace', fontSize: 12, color: '#4A90D9', textAlign: 'right', paddingTop: 12 }}>{fmtR(getReportTxns().filter(t => t.type === 'transfer').reduce((s, t) => s + Number(t.amount), 0))}</td></tr></tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {trustTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={C.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 16 }}>Low balance alerts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div><label style={C.lbl}>Matter</label><select style={C.tinp} value={alertMatterId} onChange={e => setAlertMatterId(e.target.value)}><option value="">Select matter...</option>{allMatters.map(m => <option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}</select></div>
              <div><label style={C.lbl}>Minimum balance threshold (ZAR)</label><input type="number" style={C.tinp} value={alertMinBal} onChange={e => setAlertMinBal(parseFloat(e.target.value) || 5000)} /><div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>Alert shows when balance drops below this</div></div>
              <button style={C.btn('p')} onClick={saveBalanceAlert}>Save alert</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 8 }}>Active alerts</div>
            {!balanceAlerts.length ? <div style={{ fontSize: 11, color: '#333' }}>No alerts configured</div> : balanceAlerts.map((a, i) => {
              const m = matters.find(x => x.id === a.matter_id), bal = getMatterBalance(a.matter_id);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#0D0D0D', borderRadius: 6, marginBottom: 6 }}>
                  <div><div style={{ fontSize: 12, fontWeight: 500, color: bal < Number(a.minimum_balance) ? '#E05252' : '#D0D0D0' }}>{m?.client || a.matter_id}</div><div style={{ fontSize: 10, color: '#555' }}>Min: {fmtR(a.minimum_balance)} · Now: <span style={{ color: bal < Number(a.minimum_balance) ? '#E05252' : '#6CC04A' }}>{fmtR(bal)}</span></div></div>
                  <button style={{ ...C.btn('r'), fontSize: 10, padding: '3px 8px' }} onClick={async () => { await supabase.from('trust_balance_alerts').delete().eq('id', a.id); loadTrust(); }}>Remove</button>
                </div>
              );
            })}
          </div>
          <div style={C.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 16 }}>Branch trust overview — {branches.length} branches</div>
            {branches.map(b => {
              const bT = trustTransactions.filter(t => t.branch_id === b.id && t.status === 'posted');
              const bBal = bT.reduce((s, t) => t.type === 'receipt' ? s + Number(t.amount) : s - Number(t.amount), 0);
              const bR = bT.filter(t => t.type === 'receipt').reduce((s, t) => s + Number(t.amount), 0);
              const bP = bT.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0);
              return (
                <div key={b.id} style={{ padding: '12px 14px', background: '#0D0D0D', borderRadius: 8, marginBottom: 10, border: '1px solid #1A1A1A' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{b.name}</div><div style={{ fontSize: 16, fontWeight: 700, color: '#4A90D9' }}>{fmtR(bBal)}</div></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>{[['Receipts', fmtR(bR), '#6CC04A'], ['Payments', fmtR(bP), '#E05252'], ['Transactions', bT.length, '#888']].map(([l, v, c]) => (<div key={l}><div style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{l}</div><div style={{ color: c, fontWeight: 600 }}>{v}</div></div>))}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
