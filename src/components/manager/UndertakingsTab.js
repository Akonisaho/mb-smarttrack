import { C, lbl } from '../../lib/styles';
import { fmtDate } from '../../lib/format';
import { fulfillUndertaking, deleteUndertaking, fetchUndertakings, saveUndertaking } from '../../lib/supabase';

export default function UndertakingsTab({ undertakings, setUndertakings, showUTForm, setShowUTForm, utForm, setUtForm, matters, showAlert, isMobile }) {
  const pending = undertakings.filter(u => u.status === 'pending');
  const overdue = undertakings.filter(u => u.due_date && new Date(u.due_date) < new Date() && u.status === 'pending');

  const fulfil = async id => {
    await fulfillUndertaking(id);
    const { undertakings: ut } = await fetchUndertakings({});
    setUndertakings(ut);
    showAlert('✓ Undertaking fulfilled.');
  };

  const del = async id => {
    if (!confirm('Delete?')) return;
    await deleteUndertaking(id);
    const { undertakings: ut } = await fetchUndertakings({});
    setUndertakings(ut);
  };

  const save = async () => {
    if (!utForm.description.trim() || !utForm.matter_id) return;
    const { error } = await saveUndertaking({ ...utForm });
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert('✓ Undertaking saved.');
    setShowUTForm(false);
    setUtForm({ matter_id: '', direction: 'given', description: '', given_to: '', due_date: '', notes: '' });
    const { undertakings: ut } = await fetchUndertakings({});
    setUndertakings(ut);
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Undertakings Register</div>
          <div className="mb-sub">Track undertakings given and received per matter</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setUtForm({ matter_id: matters[0]?.id || '', direction: 'given', description: '', given_to: '', due_date: '', notes: '' }); setShowUTForm(true); }}>+ New Undertaking</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total', v: undertakings.length, s: 'all undertakings' },
          { l: 'Pending', v: pending.length, s: 'awaiting fulfilment', w: pending.length > 0 },
          { l: 'Overdue', v: overdue.length, s: 'past due date', w: overdue.length > 0 },
        ].map(({ l, v, s, w }) => (
          <div key={l} style={C.stat(false, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: w && v > 0 ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      {!undertakings.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🤝</div>
          <div>No undertakings yet</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>{['Matter', 'Direction', 'Description', 'Given To', 'Due Date', 'Status', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {undertakings.map(u => {
                const isOverdue = u.due_date && new Date(u.due_date) < new Date() && u.status === 'pending';
                return (
                  <tr key={u.id}>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{u.matter_id}</td>
                    <td className="mb-td">
                      <span className="mb-badge" style={{ background: u.direction === 'given' ? 'rgba(74,144,217,0.1)' : 'rgba(167,139,250,0.1)', color: u.direction === 'given' ? '#4A90D9' : '#A78BFA' }}>{u.direction}</span>
                    </td>
                    <td className="mb-td" style={{ color: '#C8C8C8', maxWidth: 200 }}>{u.description}</td>
                    <td className="mb-td" style={{ color: '#777', fontSize: 10 }}>{u.given_to || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: isOverdue ? '#E05252' : '#888', fontWeight: isOverdue ? 700 : 400 }}>
                      {u.due_date ? fmtDate(u.due_date) : '—'}{isOverdue && ' ⚠'}
                    </td>
                    <td className="mb-td">
                      <span className="mb-badge" style={{ background: u.status === 'fulfilled' ? 'rgba(141,198,63,0.1)' : isOverdue ? 'rgba(220,80,80,0.1)' : 'rgba(234,179,8,0.1)', color: u.status === 'fulfilled' ? '#8DC63F' : isOverdue ? '#E05252' : '#EAB308' }}>{u.status}</span>
                    </td>
                    <td className="mb-td">
                      <div style={{ display: 'flex', gap: 4 }}>
                        {u.status === 'pending' && <button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => fulfil(u.id)}>✓ Fulfil</button>}
                        <button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => del(u.id)}>Del</button>
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
        <div className="mb-overlay" onClick={() => setShowUTForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New Undertaking</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Matter *</label><select className="mb-inp" value={utForm.matter_id} onChange={e => setUtForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Select —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
                <div><label className="mb-lbl">Direction *</label><select className="mb-inp" value={utForm.direction} onChange={e => setUtForm(f => ({ ...f, direction: e.target.value }))}><option value="given">Given (by us)</option><option value="received">Received (from other party)</option></select></div>
              </div>
              <div><label className="mb-lbl">Description *</label><textarea className="mb-inp" style={{ minHeight: 60, resize: 'vertical' }} placeholder="Describe the undertaking..." value={utForm.description} onChange={e => setUtForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Given To / Received From</label><input className="mb-inp" placeholder="Name / firm" value={utForm.given_to} onChange={e => setUtForm(f => ({ ...f, given_to: e.target.value }))} /></div>
                <div><label className="mb-lbl">Due Date</label><input className="mb-inp" type="date" value={utForm.due_date} onChange={e => setUtForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div><label className="mb-lbl">Notes</label><input className="mb-inp" placeholder="Additional notes..." value={utForm.notes} onChange={e => setUtForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="mb-btn" onClick={() => setShowUTForm(false)}>Cancel</button>
              <button className="mb-btn mb-btn-primary" disabled={!utForm.description.trim() || !utForm.matter_id} onClick={save}>Save Undertaking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
