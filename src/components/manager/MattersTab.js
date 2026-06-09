import { C } from '../../lib/styles';
import { fmtR, fmtDate } from '../../lib/format';
import { deleteMatterNote, updateMatter } from '../../lib/supabase';

export default function MattersTab({
  matters, profiles, branches, trustBalances, selBranch, setSelBranch,
  mgrNotesMatter, setMgrNotesMatter, mgrNotesMap, mgrNoteText, setMgrNoteText, mgrNoteType, setMgrNoteType, savingMgrNote,
  showOppForm, setShowOppForm, oppMatter, setOppMatter, oppForm, setOppForm,
  closingMatter, setClosingMatter, closureForm, setClosureForm,
  handleSaveMgrNote, handleCloseMatter, handleSaveOpp, sendSatisfactionRequest, loadMgrNotes, load, showAlert,
}) {
  const filteredMatters = matters.filter(m => selBranch === 'all' || profiles.find(p => p.id === m.user_id)?.branch_id === selBranch);

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">All Matters</div>
          <div className="mb-sub">{matters.length} matters · firm-wide</div>
        </div>
        <select className="mb-sel" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
          <option value="all">All branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {!filteredMatters.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📁</div>
          <div>No matters yet</div>
        </div>
      ) : filteredMatters.map(m => {
        const atty = profiles.find(p => p.id === m.user_id);
        const trustBal = trustBalances[m.id] || 0;
        const prescDue = m.prescription_date ? Math.floor((new Date(m.prescription_date) - new Date()) / 86400000) : null;
        const prescWarn = prescDue !== null && prescDue <= 30;

        return (
          <div key={m.id} className="mb-card" style={{ border: prescWarn ? '1px solid rgba(220,80,80,0.4)' : '1px solid #1A1A1A', opacity: m.status === 'closed' ? 0.6 : 1, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#A78BFA', fontFamily: 'monospace', fontWeight: 600 }}>{m.id}</span>
                  <span className="mb-badge" style={{ background: m.status === 'closed' ? 'rgba(85,85,85,0.2)' : 'rgba(141,198,63,0.1)', color: m.status === 'closed' ? '#555' : '#8DC63F' }}>{m.status || 'open'}</span>
                  {prescWarn && <span style={{ fontSize: 9, color: '#E05252', border: '1px solid rgba(220,80,80,0.4)', padding: '1px 8px', borderRadius: 20 }}>⚠ Prescribes in {prescDue}d</span>}
                  {m.budget_units > 0 && <span style={{ fontSize: 9, color: '#4A90D9', border: '1px solid rgba(74,144,217,0.3)', padding: '1px 8px', borderRadius: 20 }}>Budget: {m.budget_units} units</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#E0E0E0', marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>Client: <strong style={{ color: '#C0C0C0' }}>{m.client}</strong> · Attorney: <span style={{ color: '#4A90D9' }}>{atty?.full_name || '—'}</span></div>
                {m.prescription_date && <div style={{ fontSize: 10, color: prescWarn ? '#E05252' : '#555', marginTop: 3 }}>Prescription: {fmtDate(m.prescription_date)}</div>}
                {m.next_action_date && <div style={{ fontSize: 10, color: '#EAB308', marginTop: 2 }}>Next action: {fmtDate(m.next_action_date)}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>Trust</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: trustBal > 0 ? '#4A90D9' : '#444' }}>{fmtR(trustBal)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button className="mb-btn mb-btn-sm" onClick={() => { const nid = mgrNotesMatter === m.id ? null : m.id; setMgrNotesMatter(nid); if (nid && !mgrNotesMap[m.id]) loadMgrNotes(m.id); }}>📝 {mgrNotesMap[m.id]?.length > 0 ? `Notes (${mgrNotesMap[m.id].length})` : 'Notes'}</button>
                  <button className="mb-btn mb-btn-sm" onClick={() => { setOppMatter(m); setOppForm({ opposing_party: m.opposing_party || '', opposing_attorney: m.opposing_attorney || '', opposing_firm: m.opposing_firm || '' }); setShowOppForm(true); }}>⚔ Opposing</button>
                  {m.status !== 'closed' && <button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => { setClosingMatter(m); setClosureForm({ closure_notes: '' }); }}>Close</button>}
                  {m.status === 'closed' && (
                    <>
                      <button className="mb-btn mb-btn-sm" onClick={async () => { await updateMatter(m.id, { status: 'open', closed_at: null, closed_by: null }); load(); }}>Reopen</button>
                      <button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => sendSatisfactionRequest(m)}>⭐ Rate</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {mgrNotesMatter === m.id && (
              <div style={{ borderTop: '1px solid #1A1A1A', marginTop: 12, paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <select style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '5px 8px', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }} value={mgrNoteType} onChange={e => setMgrNoteType(e.target.value)}>
                    {['general', 'call', 'email', 'meeting', 'instruction', 'court'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <textarea style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '8px 10px', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', flex: 1, minHeight: 48, resize: 'vertical' }} placeholder="Add a note..." value={mgrNoteText} onChange={e => setMgrNoteText(e.target.value)} />
                  <button className="mb-btn mb-btn-primary" style={{ flexShrink: 0, alignSelf: 'flex-start' }} disabled={savingMgrNote || !mgrNoteText.trim()} onClick={() => handleSaveMgrNote(m.id)}>{savingMgrNote ? '…' : 'Save'}</button>
                </div>
                {!(mgrNotesMap[m.id] || []).length && <div style={{ fontSize: 11, color: '#333', textAlign: 'center', padding: '8px 0' }}>No notes yet.</div>}
                {(mgrNotesMap[m.id] || []).map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '8px 10px', background: '#0D0D0D', borderRadius: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span className="mb-badge" style={{ background: 'rgba(74,144,217,0.1)', color: '#4A90D9' }}>{n.note_type}</span>
                        <span style={{ fontSize: 10, color: '#555' }}>{n.profiles?.full_name}</span>
                        <span style={{ fontSize: 9, color: '#333' }}>{new Date(n.created_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#C8C8C8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: '#2A2A2A', cursor: 'pointer', fontSize: 14, flexShrink: 0 }} onClick={async () => { await deleteMatterNote(n.id); loadMgrNotes(m.id); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showOppForm && oppMatter && (
        <div className="mb-overlay" onClick={() => setShowOppForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Opposing Party — {oppMatter.id}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="mb-lbl">Opposing Party</label><input className="mb-inp" placeholder="Name of opposing party" value={oppForm.opposing_party} onChange={e => setOppForm(f => ({ ...f, opposing_party: e.target.value }))} /></div>
              <div><label className="mb-lbl">Opposing Attorney</label><input className="mb-inp" placeholder="Attorney name" value={oppForm.opposing_attorney} onChange={e => setOppForm(f => ({ ...f, opposing_attorney: e.target.value }))} /></div>
              <div><label className="mb-lbl">Opposing Firm</label><input className="mb-inp" placeholder="Law firm name" value={oppForm.opposing_firm} onChange={e => setOppForm(f => ({ ...f, opposing_firm: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="mb-btn" onClick={() => setShowOppForm(false)}>Cancel</button>
              <button className="mb-btn mb-btn-primary" onClick={handleSaveOpp}>Save</button>
            </div>
          </div>
        </div>
      )}

      {closingMatter && (
        <div className="mb-overlay" onClick={() => setClosingMatter(null)}>
          <div className="mb-modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Close Matter — {closingMatter.id}</div>
            <div><label className="mb-lbl">Closure Notes *</label><textarea className="mb-inp" style={{ minHeight: 80, resize: 'vertical' }} placeholder="Reason for closure, outcome, archive instructions..." value={closureForm.closure_notes} onChange={e => setClosureForm(f => ({ ...f, closure_notes: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="mb-btn" onClick={() => setClosingMatter(null)}>Cancel</button>
              <button className="mb-btn mb-btn-danger" disabled={!closureForm.closure_notes.trim()} onClick={() => handleCloseMatter(closingMatter)}>Close Matter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
