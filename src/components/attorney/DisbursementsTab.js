import { C } from '../../lib/attyStyles';
import { saveDisbursement, deleteDisbursement, fetchDisbursements } from '../../lib/supabase';

const CATS = { copies: '📋', filing_fee: '📁', sheriff: '⚖️', travel: '🚗', counsel: '👔', search: '🔍', postage: '📮', other: '📎' };

export default function DisbursementsTab({ disbursements, setDisbursements, showDisbForm, setShowDisbForm, disbForm, setDisbForm, matters, today, userId, profile }) {
  const unbilled = disbursements.filter(d => d.status === 'unbilled');
  const totalUnbilled = unbilled.reduce((s, d) => s + Number(d.amount), 0);

  async function reload() {
    const r = await fetchDisbursements({ userId, all: false });
    setDisbursements(r.disbursements || []);
  }

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Costs &amp; Disbursements</div>
          <div style={{ fontSize: 11, color: '#444' }}>Costs advanced on behalf of clients</div>
        </div>
        <button style={{ background: '#8DC63F', border: 'none', color: '#0A0A0A', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }} onClick={() => { setDisbForm({ matter_id: '', date: today, category: 'copies', description: '', amount: '', quantity: 1, vat_applicable: false, reference: '' }); setShowDisbForm(true); }}>+ Add Cost</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[{ l: 'Unbilled items', v: unbilled.length, s: 'awaiting invoicing' }, { l: 'Unbilled amount', v: 'R ' + totalUnbilled.toFixed(2), s: 'excl. VAT', w: totalUnbilled > 0 }, { l: 'Total costs', v: disbursements.length, s: 'all time' }].map(({ l, v, s, w }) => (
          <div key={l} style={{ background: w ? 'rgba(234,179,8,0.05)' : '#111', border: `1px solid ${w ? 'rgba(234,179,8,0.25)' : '#1A1A1A'}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: w && totalUnbilled > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div style={{ fontSize: 10, color: '#444' }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['', 'Date', 'Matter', 'Description', 'Qty', 'Amount', 'Status', 'Del'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
          <tbody>
            {!disbursements.length && <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#333', fontSize: 12 }}>No costs yet. Click + Add Cost to record your first disbursement.</td></tr>}
            {disbursements.map(d => {
              const m = matters.find(x => x.id === d.matter_id);
              return (
                <tr key={d.id}>
                  <td style={{ padding: '9px 10px', fontSize: 16, borderBottom: '1px solid #161616' }}>{CATS[d.category] || '📎'}</td>
                  <td style={{ ...C.td, color: '#666' }}>{d.date}</td>
                  <td style={{ ...C.td, fontSize: 10, fontFamily: 'monospace', color: '#A78BFA' }}>{d.matter_id || '—'}{m && <div style={{ fontSize: 9, color: '#555' }}>{m.client}</div>}</td>
                  <td style={{ ...C.td, color: '#C8C8C8' }}>{d.description}</td>
                  <td style={{ ...C.td, fontFamily: 'monospace', textAlign: 'center', color: '#777' }}>{d.quantity || 1}</td>
                  <td style={{ ...C.td, fontFamily: 'monospace', color: '#8DC63F', fontWeight: 600 }}>R{Number(d.amount).toFixed(2)}</td>
                  <td style={C.td}><span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: d.status === 'billed' ? 'rgba(141,198,63,0.1)' : 'rgba(234,179,8,0.1)', color: d.status === 'billed' ? '#8DC63F' : '#EAB308', fontWeight: 600 }}>{d.status || 'unbilled'}</span></td>
                  <td style={C.td}>{d.status !== 'billed' && <button style={{ background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.3)', color: '#E05252', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }} onClick={async () => { if (!confirm('Delete?')) return; await deleteDisbursement(d.id); reload(); }}>✕</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showDisbForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowDisbForm(false)}>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Add Cost / Disbursement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={C.lbl}>Matter *</label><select style={{ ...C.inp, padding: '9px 12px' }} value={disbForm.matter_id} onChange={e => setDisbForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Select matter —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Date *</label><input style={{ ...C.inp, padding: '9px 12px' }} type="date" value={disbForm.date} onChange={e => setDisbForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label style={C.lbl}>Category</label><select style={{ ...C.inp, padding: '9px 12px' }} value={disbForm.category} onChange={e => setDisbForm(f => ({ ...f, category: e.target.value }))}>{Object.keys(CATS).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select></div>
              </div>
              <div><label style={C.lbl}>Description *</label><input style={{ ...C.inp, padding: '9px 12px' }} type="text" placeholder="e.g. High Court filing fee" value={disbForm.description} onChange={e => setDisbForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Amount (R) *</label><input style={{ ...C.inp, padding: '9px 12px' }} type="number" placeholder="0.00" value={disbForm.amount} onChange={e => setDisbForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label style={C.lbl}>Quantity</label><input style={{ ...C.inp, padding: '9px 12px' }} type="number" min="1" value={disbForm.quantity} onChange={e => setDisbForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button style={C.btn()} onClick={() => setShowDisbForm(false)}>Cancel</button>
                <button style={{ background: '#8DC63F', border: 'none', color: '#0A0A0A', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }} onClick={async () => { if (!disbForm.matter_id || !disbForm.description || !disbForm.amount) return; const { error } = await saveDisbursement({ matter_id: disbForm.matter_id, date: disbForm.date, category: disbForm.category, description: disbForm.description, amount: parseFloat(disbForm.amount) * disbForm.quantity, quantity: disbForm.quantity, reference: disbForm.reference, branch_id: profile?.branch_id || null, status: 'unbilled' }, userId); if (error) return; setShowDisbForm(false); reload(); }}>Add Cost</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
