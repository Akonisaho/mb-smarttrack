import { C } from '../../lib/styles';
import { fmtR, toHm } from '../../lib/format';

export default function WipTab({ allTime, invoices, filteredProfiles, branches, matters, selBranch, setSelBranch, selAtty, setSelAtty, rate, isMobile }) {
  const wipData = filteredProfiles.map(p => {
    const attyActs = allTime.filter(a => a.user_id === p.id && a.is_billable);
    const attyInvs = invoices.filter(i => i.user_id === p.id);
    const earnedUnits = attyActs.reduce((s, a) => s + (a.billing_units || 0), 0);
    const billedUnits = attyInvs.reduce((s, i) => s + (i.total_units || 0), 0);
    const attyRate = p.rate || 150;
    const matterMap = {};
    attyActs.forEach(a => { if (!a.matter) return; if (!matterMap[a.matter]) matterMap[a.matter] = { matterId: a.matter, units: 0, billedUnits: 0 }; matterMap[a.matter].units += a.billing_units || 0; });
    attyInvs.forEach(i => { if (!i.matter_id) return; if (!matterMap[i.matter_id]) matterMap[i.matter_id] = { matterId: i.matter_id, units: 0, billedUnits: 0 }; matterMap[i.matter_id].billedUnits += i.total_units || 0; });
    const wipMatters = Object.values(matterMap).map(m => ({ ...m, unbilled: Math.max(0, m.units - m.billedUnits), matter: matters.find(x => x.id === m.matterId) })).filter(m => m.unbilled > 0);
    const unassignedUnits = attyActs.filter(a => !a.matter).reduce((s, a) => s + (a.billing_units || 0), 0);
    if (unassignedUnits > 0) wipMatters.push({ matterId: '—', units: unassignedUnits, billedUnits: 0, unbilled: unassignedUnits, matter: { client: '⚠ No matter assigned — needs attention' } });
    const totalUnbilled = wipMatters.reduce((s, m) => s + m.unbilled, 0);
    return { ...p, earnedUnits, billedUnits, unbilledUnits: totalUnbilled, estValue: totalUnbilled * attyRate, attyRate, wipMatters };
  }).filter(p => p.unbilledUnits > 0).sort((a, b) => b.estValue - a.estValue);

  const totalUnbilled = wipData.reduce((s, p) => s + p.unbilledUnits, 0);
  const totalValue = wipData.reduce((s, p) => s + p.estValue, 0);

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Work In Progress — WIP Report</div>
          <div className="mb-sub">Billable work not yet invoiced · {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="mb-sel" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
            <option value="all">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="mb-sel" value={selAtty} onChange={e => setSelAtty(e.target.value)}>
            <option value="all">All attorneys</option>
            {filteredProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Attorneys with unbilled work', v: wipData.length, s: 'need to invoice' },
          { l: 'Total unbilled units', v: totalUnbilled, s: 'across all matters' },
          { l: 'Total unbilled value', v: fmtR(totalValue), s: 'excl. VAT', w: true },
        ].map(({ l, v, s, w }) => (
          <div key={l} style={C.stat(false, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      {!wipData.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14 }}>All billable work has been invoiced</div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>No outstanding WIP</div>
        </div>
      ) : wipData.map(p => (
        <div key={p.id} className="mb-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{p.full_name}</div>
              <div style={{ fontSize: 10, color: '#555' }}>{p.email} · {branches.find(b => b.id === p.branch_id)?.name || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {[['Earned', p.earnedUnits, '#888'], ['Billed', p.billedUnits, '#8DC63F'], ['Unbilled', p.unbilledUnits, '#EAB308'], ['Est. Value', `R${p.estValue.toLocaleString()}`, '#EAB308']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {p.wipMatters.length > 0 && (
            <table className="mb-table">
              <thead><tr>{['Matter ID', 'Client', 'Units Earned', 'Units Billed', 'Unbilled', 'Est. Value (excl. VAT)'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
              <tbody>
                {p.wipMatters.map((m, i) => (
                  <tr key={i}>
                    <td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#A78BFA' }}>{m.matterId}</td>
                    <td className="mb-td" style={{ color: '#C8C8C8' }}>{m.matter?.client || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#888' }}>{m.units}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{m.billedUnits || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#EAB308', fontWeight: 700 }}>{m.unbilled}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#EAB308', fontWeight: 700 }}>R{(m.unbilled * p.attyRate).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
