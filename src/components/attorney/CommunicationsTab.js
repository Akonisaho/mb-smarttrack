import { C } from '../../lib/attyStyles';
import { fmtDate } from '../../lib/format';
import { saveClientCommunication, deleteClientCommunication, fetchClientCommunications } from '../../lib/supabase';

const TYPE_COLORS = { call: '#4A90D9', email: '#6CC04A', meeting: '#A78BFA', letter: '#EAB308', note: '#888', whatsapp: '#25D366' };

export default function CommunicationsTab({ communications, setCommunications, showCommForm, setShowCommForm, commForm, setCommForm, matters, userId, toast }) {
  async function reload() {
    fetchClientCommunications({ userId }).then(r => setCommunications(r.communications || []));
  }

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Client Communications</div>
          <div style={{ fontSize: 11, color: '#444' }}>Log of all client interactions on your matters</div>
        </div>
        <button style={C.btn('p')} onClick={() => setShowCommForm(true)}>+ Log Communication</button>
      </div>

      {!communications.length ? (
        <div style={{ ...C.card, textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
          <div>No communications logged yet</div>
        </div>
      ) : (
        <div style={C.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Type', 'Direction', 'Matter', 'Subject / Notes', 'Action'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {communications.map(c => (
                <tr key={c.id}>
                  <td style={{ ...C.td, fontSize: 10, color: '#666' }}>{fmtDate(c.comm_date)}</td>
                  <td style={C.td}><span style={{ fontSize: 9, padding: '1px 8px', borderRadius: 20, background: 'rgba(74,144,217,0.08)', color: TYPE_COLORS[c.comm_type] || '#888', fontWeight: 600, textTransform: 'capitalize' }}>{c.comm_type}</span></td>
                  <td style={C.td}><span style={{ fontSize: 9, padding: '1px 8px', borderRadius: 20, background: 'rgba(85,85,85,0.15)', color: c.direction === 'inbound' ? '#6CC04A' : '#4A90D9', fontWeight: 600 }}>{c.direction}</span></td>
                  <td style={{ ...C.td, fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{c.matter_id || '—'}</td>
                  <td style={{ ...C.td, color: '#888', maxWidth: 200 }}>{c.subject || c.body?.substring(0, 50)}</td>
                  <td style={C.td}><button style={{ ...C.btn('r'), fontSize: 10, padding: '3px 8px' }} onClick={async () => { if (!confirm('Delete?')) return; await deleteClientCommunication(c.id); reload(); }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCommForm && (
        <div style={C.modal} onClick={() => setShowCommForm(false)}>
          <div style={{ ...C.mbox, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Log Communication</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={C.lbl}>Type</label><select style={C.inp} value={commForm.comm_type} onChange={e => setCommForm(f => ({ ...f, comm_type: e.target.value }))}>{['call', 'email', 'meeting', 'letter', 'note', 'whatsapp'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
                <div><label style={C.lbl}>Direction</label><select style={C.inp} value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value }))}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></div>
                <div><label style={C.lbl}>Date</label><input style={C.inp} type="date" value={commForm.comm_date} onChange={e => setCommForm(f => ({ ...f, comm_date: e.target.value }))} /></div>
              </div>
              <div><label style={C.lbl}>Matter</label><select style={C.inp} value={commForm.matter_id} onChange={e => setCommForm(f => ({ ...f, matter_id: e.target.value }))}><option value="">— Optional —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
              <div><label style={C.lbl}>Subject</label><input style={C.inp} placeholder="Brief subject..." value={commForm.subject} onChange={e => setCommForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div><label style={C.lbl}>Notes *</label><textarea style={{ ...C.inp, minHeight: 80, resize: 'vertical' }} placeholder="What was discussed..." value={commForm.body} onChange={e => setCommForm(f => ({ ...f, body: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={C.btn()} onClick={() => setShowCommForm(false)}>Cancel</button>
              <button style={C.btn('p')} disabled={!commForm.body?.trim()} onClick={async () => { const { error } = await saveClientCommunication({ ...commForm }, userId); if (error) { toast('Error: ' + error.message, 'error'); return; } setShowCommForm(false); reload(); }}>Log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
