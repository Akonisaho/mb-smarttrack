import { C, roleColor, roleBg } from '../../lib/styles';
import { supabase } from '../../lib/supabase';

export default function StaffTab({
  profiles, branches, isMobile, showAlert, load, isBranchManager,
  showInvite, setShowInvite, inviteForm, setInviteForm, inviting, setInviting,
  inviteMsg, setInviteMsg, editingTitle, setEditingTitle,
  handleInvite, removeStaff, assignBranch, saveTitle,
}) {
  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Staff Management</div>
          <div className="mb-sub">{profiles.length} staff members · {branches.length} branches · No IT needed</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setShowInvite(true); setInviteForm({ fullName: '', email: '', role: 'attorney', branchId: branches[0]?.id || '' }); setInviteMsg({ msg: '', type: '' }); }}>+ Add Staff Member</button>
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>All staff</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="mb-table">
            <thead><tr>{['Name', 'Title', 'Role', 'Branch', 'Change Branch', 'Rate (R)', 'Monthly Target (units)', 'Remove'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
            <tbody>
              {!profiles.length && <tr><td colSpan={8} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No staff yet</td></tr>}
              {profiles.map(p => {
                const br = branches.find(b => b.id === p.branch_id);
                return (
                  <tr key={p.id}>
                    <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{p.full_name}<div style={{ fontSize: 10, color: '#555' }}>{p.email || '—'}</div></td>
                    <td className="mb-td">
                      {editingTitle[p.id] ? (
                        <input autoFocus type="text" defaultValue={p.title || ''} placeholder="e.g. Senior Attorney" style={{ background: '#1A1A1A', border: '1px solid #4A90D9', color: '#F0F0F0', padding: '4px 8px', borderRadius: 6, fontSize: 11, width: 160, fontFamily: 'inherit' }} onBlur={e => saveTitle(p.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingTitle(prev => ({ ...prev, [p.id]: false })); }} />
                      ) : (
                        <span style={{ fontSize: 11, color: p.title ? '#C8C8C8' : '#4A90D9', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => setEditingTitle(prev => ({ ...prev, [p.id]: true }))} title="Click to edit">{p.title || 'Set title'}</span>
                      )}
                    </td>
                    <td className="mb-td"><span className="mb-badge" style={{ background: roleBg(p.role), color: roleColor(p.role) }}>{p.role || 'attorney'}</span></td>
                    <td className="mb-td">
                      {br ? <span style={{ fontSize: 10, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', padding: '2px 8px', borderRadius: 20 }}>{br.name}</span> : <span style={{ fontSize: 10, color: '#555' }}>Not assigned</span>}
                    </td>
                    <td className="mb-td">
                      <select className="mb-inp" style={{ padding: '5px 10px', fontSize: 11 }} value={p.branch_id || ''} onChange={e => assignBranch(p.id, e.target.value)}>
                        <option value="">— select —</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                    <td className="mb-td">
                      <input type="number" style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '4px 8px', borderRadius: 6, fontSize: 11, width: 80, fontFamily: 'inherit' }} defaultValue={p.rate || 150} onBlur={async e => { const r = parseFloat(e.target.value) || 150; await supabase.from('profiles').update({ rate: r }).eq('id', p.id); showAlert(`✓ Rate updated for ${p.full_name}`, 'success'); }} />
                    </td>
                    <td className="mb-td">
                      <input type="number" min="0" style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '4px 8px', borderRadius: 6, fontSize: 11, width: 80, fontFamily: 'inherit' }} defaultValue={p.monthly_target || 0} onBlur={async e => { const target = parseInt(e.target.value) || 0; await supabase.from('profiles').update({ monthly_target: target }).eq('id', p.id); showAlert(`✓ Target updated for ${p.full_name}`, 'success'); }} placeholder="0" />
                    </td>
                    <td className="mb-td">
                      <button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => removeStaff(p.id, p.full_name)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
        {branches.map(b => {
          const bStaff = profiles.filter(p => p.branch_id === b.id);
          return (
            <div key={b.id} className="mb-card">
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 4 }}>{b.name}</div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 10 }}>{b.address}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#8DC63F', marginBottom: 2 }}>{bStaff.length}</div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 10 }}>staff members</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bStaff.map(s => (
                  <div key={s.id} style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor(s.role), display: 'inline-block', flexShrink: 0 }} />
                    <span>{s.full_name}</span>
                    <span style={{ fontSize: 9, color: '#444' }}>({s.role || 'attorney'})</span>
                  </div>
                ))}
                {!bStaff.length && <div style={{ fontSize: 11, color: '#333' }}>No staff assigned</div>}
              </div>
            </div>
          );
        })}
      </div>

      {showInvite && (
        <div className="mb-overlay" onClick={() => setShowInvite(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F0F0', marginBottom: 4 }}>Add Staff Member</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 24 }}>Create an account. The temporary password will be shown after — share it with the staff member.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="mb-lbl">Full name *</label><input className="mb-inp" type="text" placeholder="e.g. Adv. Sarah Nkosi" value={inviteForm.fullName} onChange={e => setInviteForm(f => ({ ...f, fullName: e.target.value }))} /></div>
              <div><label className="mb-lbl">Email address *</label><input className="mb-inp" type="email" placeholder="their@email.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="mb-lbl">System Role *</label>
                  <select className="mb-inp" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value, title: '' }))}>
                    <option value="attorney">Attorney / Fee Earner</option>
                    {!isBranchManager && <option value="branch_manager">Branch Manager</option>}
                    {!isBranchManager && <option value="manager">National Manager</option>}
                    {!isBranchManager && <option value="hr">HR</option>}
                    <option value="bookkeeper">Bookkeeper</option>
                    <option value="receptionist">Receptionist</option>
                  </select>
                </div>
                <div>
                  <label className="mb-lbl">Branch *</label>
                  <select className="mb-inp" value={inviteForm.branchId} onChange={e => setInviteForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">Select branch...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-lbl">Professional Title</label>
                <input className="mb-inp" type="text" placeholder={['attorney', 'branch_manager', 'manager'].includes(inviteForm.role) ? 'e.g. Senior Attorney, Partner, Candidate Attorney…' : inviteForm.role === 'bookkeeper' ? 'e.g. Senior Bookkeeper, Accounts Clerk…' : inviteForm.role === 'receptionist' ? 'e.g. Office Manager, Receptionist…' : inviteForm.role === 'hr' ? 'e.g. HR Manager, HR Officer…' : 'Enter title…'} value={inviteForm.title} onChange={e => setInviteForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              {inviteMsg.msg && (
                <div style={{ background: inviteMsg.type === 'error' ? 'rgba(220,80,80,0.1)' : 'rgba(141,198,63,0.1)', border: `1px solid ${inviteMsg.type === 'error' ? 'rgba(220,80,80,0.4)' : 'rgba(141,198,63,0.3)'}`, borderRadius: 6, padding: '10px 12px', fontSize: 12, color: inviteMsg.type === 'error' ? '#E05252' : '#8DC63F' }}>{inviteMsg.msg}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                <button className="mb-btn" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" style={{ opacity: inviting || !inviteForm.fullName || !inviteForm.email || !inviteForm.branchId ? 0.6 : 1 }} disabled={inviting || !inviteForm.fullName || !inviteForm.email || !inviteForm.branchId} onClick={handleInvite}>{inviting ? 'Creating account...' : 'Add Staff Member'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
