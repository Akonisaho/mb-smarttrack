import { C } from '../../lib/attyStyles';
import { writeOffInvoice, undoWriteOff, deleteInvoice } from '../../lib/supabase';

export default function ArchiveTab({ invoices, allActs, archFilter, setArchFilter, emailingInv, setEmailingInv, handleEmailInvoice, setCnInvoice, setCnForm, setShowCNForm, setViewInv, userId, load, invRate, firm, generateDetailedInvoicePDF }) {
  const filtered = invoices.filter(i => !archFilter || i.period === archFilter);

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Invoice Archive</div>
          <div style={{ fontSize: 11, color: '#444' }}>{invoices.length} saved invoices</div>
        </div>
        <select style={C.sel} value={archFilter} onChange={e => setArchFilter(e.target.value)}>
          <option value="">All periods</option>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>

      {!filtered.length ? (
        <div style={{ ...C.card, textAlign: 'center', padding: '40px', color: '#333' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗃️</div>
          <div style={{ fontSize: 14, color: '#444' }}>No invoices saved yet</div>
        </div>
      ) : (
        filtered.map(inv => {
          const invActs = allActs.filter(a => (inv.activity_ids || []).includes(a.id));
          return (
            <div key={inv.id} style={{ ...C.card, marginBottom: 8, cursor: 'pointer' }} onClick={() => setViewInv(inv)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#D0D0D0' }}>{inv.id}</span>
                    {inv.written_off && <span style={{ fontSize: 9, color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.08)', padding: '1px 8px', borderRadius: 20 }}>Written Off</span>}
                    {!inv.written_off && <span style={{ fontSize: 9, color: '#6CC04A', border: '1px solid rgba(108,192,74,0.3)', background: 'rgba(108,192,74,0.08)', padding: '1px 8px', borderRadius: 20 }}>Saved</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#555' }}>{inv.client} · <span style={{ color: '#A78BFA' }}>{inv.matter_id || inv.matter_name}</span></div>
                  <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>{inv.period_label} · {inv.total_units} units</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: inv.written_off ? '#555' : '#6CC04A', textDecoration: inv.written_off ? 'line-through' : 'none' }}>R{((inv.total_units || 0) * (inv.rate || 150) * 1.15).toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>incl. VAT</div>
                  </div>
                  <button style={{ ...C.btn('g'), fontSize: 11, padding: '5px 12px' }} onClick={e => { e.stopPropagation(); generateDetailedInvoicePDF(inv, invActs, firm); }}>⬇ PDF</button>
                  <button style={{ ...C.btn(), fontSize: 11, padding: '5px 12px' }} disabled={emailingInv === inv.id} onClick={async e => { e.stopPropagation(); const email = prompt('Send to email address:', inv.client_email || ''); if (email === null) return; await handleEmailInvoice(inv, email); }}>{emailingInv === inv.id ? 'Sending…' : '✉ Email'}</button>
                  <button style={{ ...C.btn(), fontSize: 11, padding: '5px 12px' }} onClick={e => { e.stopPropagation(); setCnInvoice(inv); setCnForm({ amount: '', reason: '' }); setShowCNForm(true); }}>Credit Note</button>
                  {!inv.written_off
                    ? <button style={{ ...C.btn('warn'), fontSize: 11, padding: '5px 12px' }} onClick={async e => { e.stopPropagation(); const r = prompt('Reason for write-off:'); if (!r) return; await writeOffInvoice(inv.id, r, userId); load(); }}>Write Off</button>
                    : <button style={{ ...C.btn(), fontSize: 11, padding: '5px 12px' }} onClick={async e => { e.stopPropagation(); await undoWriteOff(inv.id); load(); }}>Undo W/O</button>
                  }
                  <button style={{ ...C.btn('r'), fontSize: 11, padding: '5px 12px' }} onClick={async e => { e.stopPropagation(); if (!confirm(`Delete ${inv.id}?`)) return; await deleteInvoice(inv.id); load(); }}>Delete</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
