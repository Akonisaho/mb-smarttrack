import { C } from '../../lib/styles';
import { fmtR } from '../../lib/format';
import { saveDisbursement, deleteDisbursement } from '../../lib/supabase';

const CATS = { copies: '📋', filing_fee: '📁', sheriff: '⚖️', travel: '🚗', counsel: '👔', search: '🔍', postage: '📮', other: '📎' };

export default function DisbursementsTab({ disbursements, matters, showDisbForm, setShowDisbForm, disbForm, setDisbForm, todayStr, profile, showAlert, load }) {
  const unbilled = disbursements.filter(d => d.status === 'unbilled');
  const totalUnbilled = unbilled.reduce((s, d) => s + Number(d.amount), 0);
  const byMatter = {};
  unbilled.forEach(d => { if (!byMatter[d.matter_id]) byMatter[d.matter_id] = { matterId: d.matter_id, items: [], total: 0 }; byMatter[d.matter_id].items.push(d); byMatter[d.matter_id].total += Number(d.amount); });

  const save = async () => {
    if (!disbForm.matter_id || !disbForm.description || !disbForm.amount) { showAlert('Fill in all required fields.', 'error'); return; }
    const { error } = await saveDisbursement({ matter_id: disbForm.matter_id, date: disbForm.date, category: disbForm.category, description: disbForm.description, amount: parseFloat(disbForm.amount) * disbForm.quantity, quantity: disbForm.quantity, reference: disbForm.reference, branch_id: profile?.branch_id || null, status: 'unbilled' }, profile?.id);
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert('✓ Disbursement added.');
    setShowDisbForm(false);
    if (load) load();
  };

  const del = async id => {
    if (!confirm('Delete?')) return;
    await deleteDisbursement(id);
    if (load) load();
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Disbursements</div>
          <div className="mb-sub">Costs advanced — all attorneys</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setDisbForm({ matter_id: '', date: todayStr, category: 'copies', description: '', amount: '', quantity: 1, vat_applicable: false, reference: '' }); setShowDisbForm(true); }}>+ Add Disbursement</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Unbilled disbursements', v: unbilled.length, s: 'items' },
          { l: 'Total unbilled', v: fmtR(totalUnbilled), s: 'excl. VAT', w: totalUnbilled > 0 },
          { l: 'Matters affected', v: Object.keys(byMatter).length, s: 'with unbilled costs' },
        ].map(({ l, v, s, w }) => (
          <div key={l} style={C.stat(false, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: w && totalUnbilled > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>All Disbursements</div>
        <table className="mb-table">
          <thead><tr>{['Cat', 'Date', 'Matter', 'Description', 'Qty', 'Amount', 'Status', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
          <tbody>
            {!disbursements.length && <tr><td colSpan={8} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No disbursements yet</td></tr>}
            {disbursements.map(d => (
              <tr key={d.id}>
                <td className="mb-td" style={{ width: 28, textAlign: 'center' }}>{CATS[d.category] || '📎'}</td>
                <td className="mb-td" style={{ fontSize: 10, color: '#666' }}>{d.date}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{d.matter_id || '—'}</td>
                <td className="mb-td" style={{ color: '#C8C8C8' }}>{d.description}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', textAlign: 'center', color: '#777' }}>{d.quantity || 1}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 600 }}>{fmtR(d.amount)}</td>
                <td className="mb-td">
                  <span className="mb-badge" style={{ background: d.status === 'billed' ? 'rgba(141,198,63,0.1)' : d.status === 'written_off' ? 'rgba(85,85,85,0.2)' : 'rgba(234,179,8,0.1)', color: d.status === 'billed' ? '#8DC63F' : d.status === 'written_off' ? '#555' : '#EAB308' }}>{d.status || 'unbilled'}</span>
                </td>
                <td className="mb-td">
                  <button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => del(d.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDisbForm && (
        <div className="mb-overlay" onClick={() => setShowDisbForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Add Disbursement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="mb-lbl">Matter *</label><select className="mb-inp" value={disbForm.matter_id} onChange={e => setDisbForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Select matter —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Date *</label><input className="mb-inp" type="date" value={disbForm.date} onChange={e => setDisbForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="mb-lbl">Category *</label><select className="mb-inp" value={disbForm.category} onChange={e => setDisbForm(f => ({ ...f, category: e.target.value }))}>{Object.keys(CATS).map(k => <option key={k} value={k} style={{ textTransform: 'capitalize' }}>{k.replace('_', ' ')}</option>)}</select></div>
              </div>
              <div><label className="mb-lbl">Description *</label><input className="mb-inp" type="text" placeholder="e.g. Copies of affidavit" value={disbForm.description} onChange={e => setDisbForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Amount (R) *</label><input className="mb-inp" type="number" placeholder="0.00" value={disbForm.amount} onChange={e => setDisbForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="mb-lbl">Quantity</label><input className="mb-inp" type="number" min="1" value={disbForm.quantity} onChange={e => setDisbForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} /></div>
              </div>
              <div><label className="mb-lbl">Reference</label><input className="mb-inp" type="text" value={disbForm.reference} onChange={e => setDisbForm(f => ({ ...f, reference: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="mb-btn" onClick={() => setShowDisbForm(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" onClick={save}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
