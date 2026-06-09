import { useState } from 'react';
import { C, lbl } from '../../lib/styles';
import { saveFeeSchedule } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

export default function SchedulesTab({ feeSchedules, showAlert, load }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', unit_rate: 150, description: '', is_default: false });

  const save = async () => {
    if (!form.name) { showAlert('Name is required.', 'error'); return; }
    const { error } = await saveFeeSchedule({ ...form, is_active: true });
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    showAlert('✓ Schedule saved.');
    setShowForm(false);
    load();
  };

  const archive = async id => {
    if (!confirm('Archive this schedule?')) return;
    await supabase.from('fee_schedules').update({ is_active: false }).eq('id', id);
    load();
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Fee Schedules</div>
          <div className="mb-sub">Billing rate cards for the firm</div>
        </div>
        <button className="mb-btn mb-btn-primary" onClick={() => { setForm({ name: '', unit_rate: 150, description: '', is_default: false }); setShowForm(true); }}>+ New Schedule</button>
      </div>

      <div className="mb-card">
        <table className="mb-table">
          <thead>
            <tr>{['Name', 'Rate per Unit (R)', 'Description', 'Default', 'Actions'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {!feeSchedules.length && <tr><td colSpan={5} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No fee schedules yet. The default rate is R150/unit.</td></tr>}
            {feeSchedules.map(s => (
              <tr key={s.id}>
                <td className="mb-td" style={{ fontWeight: 600, color: '#D0D0D0' }}>{s.name}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>R{s.unit_rate || 150}</td>
                <td className="mb-td" style={{ color: '#666' }}>{s.description || '—'}</td>
                <td className="mb-td" style={{ textAlign: 'center' }}>{s.is_default ? <span style={{ color: '#8DC63F', fontWeight: 700 }}>✓ Default</span> : '—'}</td>
                <td className="mb-td"><button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => archive(s.id)}>Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="mb-overlay" onClick={() => setShowForm(false)}>
          <div className="mb-modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>New Fee Schedule</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="mb-lbl">Schedule Name *</label><input className="mb-field" type="text" placeholder="e.g. Standard, Litigation Rate" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="mb-lbl">Rate per Billing Unit (R) *</label><input className="mb-field" type="number" value={form.unit_rate} onChange={e => setForm(f => ({ ...f, unit_rate: parseFloat(e.target.value) || 150 }))} /></div>
              <div><label className="mb-lbl">Description</label><input className="mb-field" type="text" placeholder="When to use this rate..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#888', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} /> Set as firm default rate
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="mb-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" onClick={save}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
