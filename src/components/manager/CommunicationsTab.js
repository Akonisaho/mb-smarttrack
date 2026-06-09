import { C, lbl } from '../../lib/styles';
import { fmtDate } from '../../lib/format';
import { saveClientCommunication, deleteClientCommunication, fetchClientCommunications, logAudit } from '../../lib/supabase';

export default function CommunicationsTab({ communications, setCommunications, showCommForm, setShowCommForm, commForm, setCommForm, clients, matters, profile, showAlert }) {
  const typeColors = { call: '#4A90D9', email: '#8DC63F', meeting: '#A78BFA', letter: '#EAB308', note: '#888', whatsapp: '#25D366' };

  const save = async () => {
    if (!commForm.body.trim()) return;
    const { error } = await saveClientCommunication({ ...commForm }, profile?.id);
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert('✓ Communication logged.');
    setShowCommForm(false);
    setCommForm({ client_id: '', matter_id: '', comm_type: 'call', direction: 'outbound', subject: '', body: '', comm_date: new Date().toLocaleDateString('en-CA') });
    const { communications: co } = await fetchClientCommunications({});
    setCommunications(co);
    await logAudit('communication_logged', 'client', commForm.client_id, { type: commForm.comm_type }, profile?.id);
  };

  const del = async id => {
    if (!confirm('Delete?')) return;
    await deleteClientCommunication(id);
    const { communications: co } = await fetchClientCommunications({});
    setCommunications(co);
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Client Communications</div>
          <div className="mb-sub">Log of all client interactions firm-wide</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setCommForm({ client_id: clients[0]?.id || '', matter_id: '', comm_type: 'call', direction: 'outbound', subject: '', body: '', comm_date: new Date().toLocaleDateString('en-CA') }); setShowCommForm(true); }}>+ Log Communication</button>
      </div>

      {!communications.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
          <div>No communications logged yet</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>{['Date', 'Type', 'Direction', 'Client', 'Matter', 'Subject', 'Logged By', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {communications.map(c => {
                const cl = clients.find(x => x.id === c.client_id);
                return (
                  <tr key={c.id}>
                    <td className="mb-td" style={{ fontSize: 10, color: '#666' }}>{fmtDate(c.comm_date)}</td>
                    <td className="mb-td"><span className="mb-badge" style={{ background: 'rgba(74,144,217,0.08)', color: typeColors[c.comm_type] || '#888' }}>{c.comm_type}</span></td>
                    <td className="mb-td"><span className="mb-badge" style={{ background: 'rgba(85,85,85,0.15)', color: c.direction === 'inbound' ? '#8DC63F' : '#4A90D9' }}>{c.direction}</span></td>
                    <td className="mb-td" style={{ color: '#C8C8C8' }}>{cl?.full_name || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{c.matter_id || '—'}</td>
                    <td className="mb-td" style={{ color: '#888', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject || c.body.substring(0, 40)}</td>
                    <td className="mb-td" style={{ fontSize: 10, color: '#555' }}>{c.profiles?.full_name || '—'}</td>
                    <td className="mb-td"><button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => del(c.id)}>Del</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCommForm && (
        <div className="mb-overlay" onClick={() => setShowCommForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Log Communication</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Client</label><select className="mb-inp" value={commForm.client_id} onChange={e => setCommForm(f => ({ ...f, client_id: e.target.value }))}><option value="">— Select client —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
                <div><label className="mb-lbl">Matter</label><select className="mb-inp" value={commForm.matter_id} onChange={e => setCommForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Select matter —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label className="mb-lbl">Type *</label><select className="mb-inp" value={commForm.comm_type} onChange={e => setCommForm(f => ({ ...f, comm_type: e.target.value }))}>{['call', 'email', 'meeting', 'letter', 'note', 'whatsapp'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
                <div><label className="mb-lbl">Direction</label><select className="mb-inp" value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value }))}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></div>
                <div><label className="mb-lbl">Date</label><input className="mb-inp" type="date" value={commForm.comm_date} onChange={e => setCommForm(f => ({ ...f, comm_date: e.target.value }))} /></div>
              </div>
              <div><label className="mb-lbl">Subject</label><input className="mb-inp" placeholder="Brief subject..." value={commForm.subject} onChange={e => setCommForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div><label className="mb-lbl">Notes / Body *</label><textarea className="mb-inp" style={{ minHeight: 80, resize: 'vertical' }} placeholder="What was discussed / communicated..." value={commForm.body} onChange={e => setCommForm(f => ({ ...f, body: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="mb-btn" onClick={() => setShowCommForm(false)}>Cancel</button>
              <button className="mb-btn mb-btn-primary" disabled={!commForm.body.trim()} onClick={save}>Log Communication</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
