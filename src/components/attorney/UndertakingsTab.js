import { C } from '../../lib/attyStyles';
import { fmtDate } from '../../lib/format';
import { fulfillUndertaking, deleteUndertaking, saveUndertaking, fetchUndertakings } from '../../lib/supabase';

export default function UndertakingsTab({ undertakings, setUndertakings, showUTForm, setShowUTForm, utForm, setUtForm, matters, userId, toast }) {
  const pending = undertakings.filter(u => u.status === 'pending');
  const overdue = undertakings.filter(u => u.due_date && new Date(u.due_date) < new Date() && u.status === 'pending');

  async function reload() {
    fetchUndertakings({ userId }).then(r => setUndertakings(r.undertakings || []));
  }

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Undertakings</div>
          <div style={{ fontSize: 11, color: '#444' }}>Track undertakings given and received on your matters</div>
        </div>
        <button style={C.btn('p')} onClick={() => { setUtForm({ matter_id: matters[0]?.id || '', direction: 'given', description: '', given_to: '', due_date: '', notes: '' }); setShowUTForm(true); }}>+ New Undertaking</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[{ l: 'Total', v: undertakings.length }, { l: 'Pending', v: pending.length, w: pending.length > 0 }, { l: 'Overdue', v: overdue.length, w: overdue.length > 0 }].map(({ l, v, w }) => (
          <div key={l} style={C.stat(false, w)}>
            <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: w && v > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
          </div>
        ))}
      </div>

      {!undertakings.length ? (
        <div style={{ ...C.card, textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🤝</div>
          <div>No undertakings yet</div>
        </div>
      ) : (
        <div style={C.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Matter', 'Direction', 'Description', 'Given To', 'Due Date', 'Status', 'Action'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {undertakings.map(u => {
                const isOD = u.due_date && new Date(u.due_date) < new Date() && u.status === 'pending';
                return (
                  <tr key={u.id}>
                    <td style={{ ...C.td, fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{u.matter_id}</td>
                    <td style={C.td}><span style={{ fontSize: 9, padding: '1px 8px', borderRadius: 20, background: u.direction === 'given' ? 'rgba(74,144,217,0.1)' : 'rgba(167,139,250,0.1)', color: u.direction === 'given' ? '#4A90D9' : '#A78BFA', fontWeight: 600 }}>{u.direction}</span></td>
                    <td style={{ ...C.td, color: '#C8C8C8', maxWidth: 200 }}>{u.description}</td>
                    <td style={{ ...C.td, color: '#777', fontSize: 10 }}>{u.given_to || '—'}</td>
                    <td style={{ ...C.td, fontFamily: 'monospace', color: isOD ? '#E05252' : '#888', fontWeight: isOD ? 700 : 400 }}>{u.due_date ? fmtDate(u.due_date) : '—'}{isOD && ' ⚠'}</td>
                    <td style={C.td}><span style={{ fontSize: 9, padding: '1px 8px', borderRadius: 20, background: u.status === 'fulfilled' ? 'rgba(108,192,74,0.1)' : isOD ? 'rgba(220,80,80,0.1)' : 'rgba(234,179,8,0.1)', color: u.status === 'fulfilled' ? '#6CC04A' : isOD ? '#E05252' : '#EAB308', fontWeight: 600 }}>{u.status}</span></td>
                    <td style={C.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {u.status === 'pending' && <button style={{ ...C.btn('p'), fontSize: 10, padding: '3px 8px' }} onClick={async () => { await fulfillUndertaking(u.id); reload(); }}>✓</button>}
                        <button style={{ ...C.btn('r'), fontSize: 10, padding: '3px 8px' }} onClick={async () => { if (!confirm('Delete?')) return; await deleteUndertaking(u.id); reload(); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showUTForm && (
        <div style={C.modal} onClick={() => setShowUTForm(false)}>
          <div style={{ ...C.mbox, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New Undertaking</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Matter *</label><select style={C.inp} value={utForm.matter_id} onChange={e => setUtForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Select —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
                <div><label style={C.lbl}>Direction</label><select style={C.inp} value={utForm.direction} onChange={e => setUtForm(f => ({ ...f, direction: e.target.value }))}><option value="given">Given (by me)</option><option value="received">Received</option></select></div>
              </div>
              <div><label style={C.lbl}>Description *</label><textarea style={{ ...C.inp, minHeight: 60, resize: 'vertical' }} value={utForm.description} onChange={e => setUtForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the undertaking..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Given To / Received From</label><input style={C.inp} value={utForm.given_to} onChange={e => setUtForm(f => ({ ...f, given_to: e.target.value }))} placeholder="Name or firm" /></div>
                <div><label style={C.lbl}>Due Date</label><input style={C.inp} type="date" value={utForm.due_date} onChange={e => setUtForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={C.btn()} onClick={() => setShowUTForm(false)}>Cancel</button>
              <button style={C.btn('p')} disabled={!utForm.description.trim() || !utForm.matter_id} onClick={async () => { const { error } = await saveUndertaking({ ...utForm }, userId); if (error) { toast('Error: ' + error.message, 'error'); return; } setShowUTForm(false); reload(); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
