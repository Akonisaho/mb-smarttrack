import { C } from '../../lib/attyStyles';
import { toHm, calcUnits, fmtR, fmtDate } from '../../lib/format';
import { updateMatter } from '../../lib/supabase';

export default function MattersTab({
  matters, allActs, invoices, trustBalances, balanceAlerts, invRate,
  openNotesMatter, setOpenNotesMatter, matterNotesMap, noteText, setNoteText, noteType, setNoteType, savingNote,
  setShowMatterForm, handleSaveNote, handleDeleteNote, loadNotes, handleDeleteMatter,
  setInvMatterId, setTab, matterMsg,
}) {
  return (
    <div style={C.main}>
      {matterMsg && <div style={{ background: 'rgba(108,192,74,0.08)', border: '1px solid rgba(108,192,74,0.25)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6CC04A' }}>{matterMsg}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Client Matters</div>
          <div style={{ fontSize: 11, color: '#444' }}>Activities auto-linked by title matching</div>
        </div>
        <button style={C.btn('p')} onClick={() => setShowMatterForm(true)}>+ New Matter</button>
      </div>

      {!matters.length ? (
        <div style={{ ...C.card, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 14, color: '#444', marginBottom: 8 }}>No matters yet</div>
          <button style={C.btn('p')} onClick={() => setShowMatterForm(true)}>+ Create first matter</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {matters.map(m => {
            const mActs = allActs.filter(a => a.matter === m.id);
            const mBill = mActs.filter(a => a.classification === 'billable');
            const mU = mBill.reduce((s, a) => s + calcUnits(a.duration_seconds), 0);
            const mSec = mActs.reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
            const trustBal = trustBalances[m.id] || 0;
            const alert = balanceAlerts.find(a => a.matter_id === m.id && a.is_active);
            const isLow = alert && trustBal < Number(alert.minimum_balance);
            const pd = m.prescription_date ? Math.floor((new Date(m.prescription_date) - new Date()) / 86400000) : null;
            const prescWarn = pd !== null && pd <= 30;

            return (
              <div key={m.id} style={{ ...C.card, border: isLow ? '1px solid rgba(220,80,80,0.3)' : '1px solid #1A1A1A' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#A78BFA', fontFamily: 'monospace', fontWeight: 600 }}>{m.id}</span>
                      {isLow && <span style={{ fontSize: 9, color: '#E05252', border: '1px solid rgba(220,80,80,0.4)', padding: '1px 8px', borderRadius: 20 }}>⚠ Low trust balance</span>}
                      {prescWarn && <span style={{ fontSize: 9, color: '#E05252', border: '1px solid rgba(220,80,80,0.4)', padding: '1px 8px', borderRadius: 20 }}>⚠ Prescribes in {pd}d</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E0E0E0', marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>Client: <strong style={{ color: '#C0C0C0' }}>{m.client}</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                    {[['Activities', mActs.length, '#888'], ['Time', toHm(mSec), '#888'], ['Units', mU, mU > 0 ? '#6CC04A' : '#444'], ['Value', `R${(mU * invRate).toLocaleString()}`, mU > 0 ? '#6CC04A' : '#444'], ['Trust', fmtR(trustBal), isLow ? '#E05252' : trustBal > 0 ? '#4A90D9' : '#444']].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button style={{ ...C.btn('p'), fontSize: 11, padding: '5px 12px' }} onClick={() => { setInvMatterId(m.id); setTab('invoices'); }}>Invoice</button>
                      <button style={{ ...C.btn('trust'), fontSize: 11, padding: '5px 12px' }} onClick={() => setTab('trust')}>Trust</button>
                      <button style={{ ...C.btn('r'), fontSize: 11, padding: '5px 12px' }} onClick={() => handleDeleteMatter(m.id)}>Delete</button>
                      <button style={{ ...C.btn(), fontSize: 11, padding: '5px 12px' }} onClick={() => { const nid = openNotesMatter === m.id ? null : m.id; setOpenNotesMatter(nid); if (nid && !matterNotesMap[m.id]) loadNotes(m.id); }}>📝 {matterNotesMap[m.id]?.length > 0 ? `Notes (${matterNotesMap[m.id].length})` : 'Notes'}</button>
                    </div>
                  </div>
                </div>

                {openNotesMatter === m.id && (
                  <div style={{ borderTop: '1px solid #1A1A1A', marginTop: 12, paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <select style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '5px 8px', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }} value={noteType} onChange={e => setNoteType(e.target.value)}>
                        {['general', 'call', 'email', 'meeting', 'instruction', 'court'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                      <textarea style={{ ...C.inp, flex: 1, minHeight: 52, resize: 'vertical' }} placeholder="Type your note..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                      <button style={{ ...C.btn('p'), padding: '6px 14px', flexShrink: 0, alignSelf: 'flex-start' }} disabled={savingNote || !noteText.trim()} onClick={() => handleSaveNote(m.id)}>{savingNote ? '…' : 'Save'}</button>
                    </div>
                    {!(matterNotesMap[m.id] || []).length && <div style={{ fontSize: 11, color: '#333', textAlign: 'center', padding: '8px 0' }}>No notes yet.</div>}
                    {(matterNotesMap[m.id] || []).map(n => (
                      <div key={n.id} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '8px 10px', background: '#0D0D0D', borderRadius: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 20, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontWeight: 600, textTransform: 'capitalize' }}>{n.note_type || 'general'}</span>
                            <span style={{ fontSize: 10, color: '#555' }}>{n.profiles?.full_name || 'You'}</span>
                            <span style={{ fontSize: 9, color: '#333' }}>{new Date(n.created_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#C8C8C8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                        </div>
                        <button style={{ background: 'none', border: 'none', color: '#2A2A2A', cursor: 'pointer', fontSize: 14, flexShrink: 0, alignSelf: 'flex-start', padding: '2px 4px' }} onClick={() => handleDeleteNote(n.id, m.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
