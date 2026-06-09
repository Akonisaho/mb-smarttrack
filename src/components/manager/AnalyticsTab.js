import { C } from '../../lib/styles';
import { fmtR, toHm, fdate } from '../../lib/format';
import BarChart from '../ui/BarChart';

export default function AnalyticsTab({
  filteredProfiles, branches, allTime, invoices, isMobile, rate,
  selDate, setSelDate, selAtty, setSelAtty, overviewPeriod, setOverviewPeriod,
  getPeriodActs, getPeriodInvoices,
}) {
  const filteredAllTime = selAtty === 'all' ? allTime : allTime.filter(a => a.user_id === selAtty);
  const periodActs = getPeriodActs(filteredAllTime);
  const firmBillSec = periodActs.filter(a => a.is_billable).reduce((s, a) => s + (a.duration_seconds || 0), 0);
  const firmAllUnits = periodActs.filter(a => a.is_billable).reduce((s, a) => s + (a.billing_units || 0), 0);
  const filtInvoices = selAtty === 'all' ? invoices : invoices.filter(i => i.user_id === selAtty);
  const billedUnits = filtInvoices.reduce((s, i) => s + (i.total_units || 0), 0);
  const billedRevenue = filtInvoices.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150), 0);
  const unbilledUnits = Math.max(0, firmAllUnits - billedUnits);
  const unbilledRev = unbilledUnits * rate;

  const byAtty = filteredProfiles.map(p => {
    const allTimeP = allTime.filter(a => a.user_id === p.id);
    const periodP = getPeriodActs(allTimeP);
    const periodBill = periodP.filter(a => a.is_billable);
    const attyInvs = getPeriodInvoices(invoices).filter(i => i.user_id === p.id);
    const billedU = attyInvs.reduce((s, i) => s + (i.total_units || 0), 0);
    const allUnits = periodBill.reduce((s, a) => s + (a.billing_units || 0), 0);
    const br = branches.find(b => b.id === p.branch_id);
    return { ...p, branch_name: br?.name || '—', bill_sec: periodBill.reduce((s, a) => s + (a.duration_seconds || 0), 0), all_units: allUnits, billed_units: billedU, unbilled_units: Math.max(0, allUnits - billedU) };
  }).sort((a, b) => b.all_units - a.all_units);

  const periodLabel = overviewPeriod === 'day' ? fdate(selDate) : overviewPeriod === 'week' ? 'This Week' : overviewPeriod === 'month' ? new Date(selDate.substring(0, 7) + '-01T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : 'All Time';

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Firm Analytics</div>
          <div className="mb-sub">{periodLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" className="mb-sel" value={selDate} onChange={e => setSelDate(e.target.value)} />
          <div style={{ display: 'flex', background: '#1A1A1A', border: '1px solid #252525', borderRadius: 6, padding: 2 }}>
            {[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['all', 'All Time']].map(([v, l]) => (
              <button key={v} style={{ background: overviewPeriod === v ? '#2A2A2A' : 'transparent', border: 'none', color: overviewPeriod === v ? '#F0F0F0' : '#555', padding: '4px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: overviewPeriod === v ? 600 : 400 }} onClick={() => setOverviewPeriod(v)}>{l}</button>
            ))}
          </div>
          <select className="mb-sel" value={selAtty} onChange={e => setSelAtty(e.target.value)}>
            <option value="all">All attorneys</option>
            {filteredProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Staff', v: filteredProfiles.length, s: 'active staff' },
          { l: 'Billable Time', v: toHm(firmBillSec), s: `${firmAllUnits} units earned` },
          { l: 'Total Billed', v: `R${(billedRevenue * 1.15).toFixed(2)}`, s: `${billedUnits} units · incl. VAT`, a: true },
          { l: 'Unbilled Revenue', v: `R${unbilledRev.toLocaleString()}`, s: `${unbilledUnits} units not invoiced`, w: true },
        ].map(({ l, v, s, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      {byAtty.filter(a => a.all_units > 0).length > 0 && (
        <div className="mb-card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Billing units per attorney</div>
          <BarChart data={byAtty.filter(a => a.all_units > 0).map(a => ({ label: a.full_name.replace('Adv. ', '').split(' ')[0], label2: `${a.all_units}u`, value: a.all_units, color: '#8DC63F' }))} height={130} />
        </div>
      )}

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Attorney Performance</div>
        <table className="mb-table">
          <thead><tr>{['Attorney', 'Branch', 'Billable Time', 'Units Earned', 'Units Billed', 'Unbilled', 'Est. Value'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
          <tbody>
            {!byAtty.length && <tr><td colSpan={7} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No billable data for this period.</td></tr>}
            {byAtty.map(a => (
              <tr key={a.id}>
                <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{a.full_name}<div style={{ fontSize: 9, color: '#444' }}>{a.email}</div></td>
                <td className="mb-td" style={{ fontSize: 10 }}><span style={{ background: 'rgba(74,144,217,0.1)', color: '#4A90D9', padding: '2px 8px', borderRadius: 20, fontSize: 9 }}>{a.branch_name}</span></td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{toHm(a.bill_sec) || '0m'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>{a.all_units || '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{a.billed_units || '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: a.unbilled_units > 0 ? '#EAB308' : '#444' }}>{a.unbilled_units > 0 ? a.unbilled_units : '—'}</td>
                <td className="mb-td" style={{ fontFamily: 'monospace', color: a.unbilled_units > 0 ? '#EAB308' : '#444', fontWeight: 600 }}>{a.unbilled_units > 0 ? `R${(a.unbilled_units * rate).toLocaleString()}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
