import { C } from '../../lib/styles';
import { fmtR, toHm, fdate } from '../../lib/format';
import BarChart from '../ui/BarChart';

export default function OverviewTab({
  profiles, branches, branchTrustData, allTime, invoices, trustBalances, pendingPayments,
  isMobile, rate, selDate, setSelDate, overviewPeriod, setOverviewPeriod,
  selBranch, setSelBranch, selAtty, setSelAtty, isBranchManager, profile,
  filteredProfiles, filteredAllTime, getPeriodActs, getPeriodInvoices, setTab,
}) {
  const periodActs = getPeriodActs(filteredAllTime);
  const firmTotalSec = periodActs.reduce((s, a) => s + (a.duration_seconds || 0), 0);
  const firmBillSec = periodActs.filter(a => a.is_billable).reduce((s, a) => s + (a.duration_seconds || 0), 0);
  const firmAllUnits = periodActs.filter(a => a.is_billable).reduce((s, a) => s + (a.billing_units || 0), 0);
  const filtInvoices = selAtty === 'all' ? invoices : invoices.filter(i => i.user_id === selAtty);
  const billedUnits = filtInvoices.reduce((s, i) => s + (i.total_units || 0), 0);
  const billedRevenue = filtInvoices.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150), 0);
  const unbilledUnits = Math.max(0, firmAllUnits - billedUnits);
  const unbilledRev = unbilledUnits * rate;
  const totalTrustHeld = Object.values(trustBalances).reduce((s, v) => s + v, 0);

  const byAtty = filteredProfiles.map(p => {
    const allTimeP = allTime.filter(a => a.user_id === p.id);
    const periodP = getPeriodActs(allTimeP);
    const periodBill = periodP.filter(a => a.is_billable);
    const attyInvs = getPeriodInvoices(invoices).filter(i => i.user_id === p.id);
    const billedU = attyInvs.reduce((s, i) => s + (i.total_units || 0), 0);
    const allUnits = periodBill.reduce((s, a) => s + (a.billing_units || 0), 0);
    const mMap = {};
    periodBill.forEach(a => { if (!a.matter) return; if (!mMap[a.matter]) mMap[a.matter] = { units: 0, billedUnits: 0 }; mMap[a.matter].units += a.billing_units || 0; });
    attyInvs.forEach(i => { if (!i.matter_id) return; if (!mMap[i.matter_id]) mMap[i.matter_id] = { units: 0, billedUnits: 0 }; mMap[i.matter_id].billedUnits += i.total_units || 0; });
    const unbilledU = Object.values(mMap).reduce((s, m) => s + Math.max(0, m.units - m.billedUnits), 0) + periodBill.filter(a => !a.matter).reduce((s, a) => s + (a.billing_units || 0), 0);
    const br = branches.find(b => b.id === p.branch_id);
    return { ...p, branch_name: br?.name || '—', total_sec: periodP.reduce((s, a) => s + (a.duration_seconds || 0), 0), bill_sec: periodBill.reduce((s, a) => s + (a.duration_seconds || 0), 0), all_units: allUnits, billed_units: billedU, unbilled_units: unbilledU, invoiceCount: attyInvs.length };
  }).sort((a, b) => b.all_units - a.all_units);

  const matterMap = {};
  filtInvoices.forEach(inv => { const key = inv.matter_id || inv.matter_name || 'Unknown'; if (!matterMap[key]) matterMap[key] = { id: key, name: inv.matter_name || key, client: inv.client || '', invoiceCount: 0, billedAmt: 0 }; matterMap[key].invoiceCount++; matterMap[key].billedAmt += (inv.total_units || 0) * (inv.rate || 150); });
  const topMatters = Object.values(matterMap).sort((a, b) => b.billedAmt - a.billedAmt).slice(0, 10);


  const periodLabel = overviewPeriod === 'day' ? fdate(selDate) : overviewPeriod === 'week' ? 'This week' : overviewPeriod === 'month' ? new Date(selDate.substring(0, 7) + '-01T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : 'All time';

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Firm Overview — Motsoeneng Bill</div>
          <div className="mb-sub">{periodLabel} · {profiles.length} staff · {branches.length} branches</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" className="mb-sel" value={selDate} onChange={e => setSelDate(e.target.value)} />
          <div style={{ display: 'flex', background: '#1A1A1A', border: '1px solid #252525', borderRadius: 6, padding: 2 }}>
            {[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['all', 'All Time']].map(([v, l]) => (
              <button key={v} style={{ background: overviewPeriod === v ? '#2A2A2A' : 'transparent', border: 'none', color: overviewPeriod === v ? '#F0F0F0' : '#555', padding: '4px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: overviewPeriod === v ? 600 : 400 }} onClick={() => setOverviewPeriod(v)}>{l}</button>
            ))}
          </div>
          {!isBranchManager && (
            <select className="mb-sel" value={selBranch} onChange={e => { setSelBranch(e.target.value); setSelAtty('all'); }}>
              <option value="all">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {isBranchManager && <span style={{ fontSize: 12, color: '#4A90D9', border: '1px solid rgba(74,144,217,0.3)', padding: '5px 12px', borderRadius: 6 }}>{branches.find(b => b.id === profile?.branch_id)?.name || 'Your branch'}</span>}
          <select className="mb-sel" value={selAtty} onChange={e => setSelAtty(e.target.value)}>
            <option value="all">All attorneys</option>
            {filteredProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Billable Time', v: toHm(firmBillSec), s: `${firmAllUnits} units earned`, a: true },
          { l: 'Billed Revenue', v: `R${(billedRevenue * 1.15).toFixed(2)}`, s: `${billedUnits} units · incl. VAT`, a: true },
          { l: 'Unbilled Revenue', v: `R${unbilledRev.toLocaleString()}`, s: `${unbilledUnits} units not invoiced`, w: true },
          { l: 'Total Trust Held', v: fmtR(totalTrustHeld), s: `${pendingPayments.length} payment${pendingPayments.length === 1 ? '' : 's'} pending` },
        ].map(({ l, v, s, a, w }) => (
          <div key={l} style={C.stat(a, w)}>
            <div className="mb-stat-label">{l}</div>
            <div className="mb-stat-value" style={{ color: a ? '#8DC63F' : w ? '#EAB308' : '#F0F0F0' }}>{v}</div>
            <div className="mb-stat-note">{s}</div>
          </div>
        ))}
      </div>

      <div className="mb-card">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Attorney Leaderboard — {periodLabel}</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="mb-table">
            <thead><tr>{['#', 'Attorney', 'Branch', 'Billable Time', 'Units Earned', 'Target', 'Performance', 'Units Billed', 'Unbilled', 'Invoices'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
            <tbody>
              {!byAtty.length && <tr><td colSpan={10} className="mb-td" style={{ textAlign: 'center', color: '#333', padding: 30 }}>No data yet.</td></tr>}
              {byAtty.map((a, i) => {
                const target = a.monthly_target || 0;
                const pct = target > 0 ? Math.round((a.all_units / target) * 100) : null;
                const perfColor = pct === null ? '#555' : pct >= 100 ? '#8DC63F' : pct >= 70 ? '#EAB308' : '#E05252';
                return (
                  <tr key={a.id}>
                    <td className="mb-td" style={{ color: '#444', fontWeight: 600, width: 28 }}>{i + 1}</td>
                    <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{a.full_name}<div style={{ fontSize: 9, color: '#444' }}>{a.email}</div></td>
                    <td className="mb-td" style={{ fontSize: 10 }}><span style={{ background: 'rgba(74,144,217,0.1)', color: '#4A90D9', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 600 }}>{a.branch_name}</span></td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{toHm(a.bill_sec) || '0m'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>{a.all_units || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#555' }}>{target > 0 ? target : '—'}</td>
                    <td className="mb-td">
                      {pct !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#1A1A1A', borderRadius: 3 }}><div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: perfColor, borderRadius: 3 }} /></div>
                          <span style={{ fontSize: 10, color: perfColor, fontWeight: 700, minWidth: 35 }}>{pct}%</span>
                        </div>
                      ) : <span style={{ color: '#333', fontSize: 10 }}>No target</span>}
                    </td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{a.billed_units || '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: a.unbilled_units > 0 ? '#EAB308' : '#444' }}>{a.unbilled_units > 0 ? a.unbilled_units : '—'}</td>
                    <td className="mb-td" style={{ fontFamily: 'monospace', color: '#777' }}>{a.invoiceCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div className="mb-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Top Matters by Billed Revenue</div>
          {!topMatters.length ? <div style={{ textAlign: 'center', padding: 20, color: '#333', fontSize: 12 }}>No invoices yet</div> : (
            <table className="mb-table">
              <thead><tr>{['Matter ID', 'Client', 'Invoices', 'Billed'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
              <tbody>{topMatters.map((m, i) => (<tr key={i}><td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{m.id}</td><td className="mb-td" style={{ color: '#C8C8C8' }}>{m.client}</td><td className="mb-td" style={{ fontFamily: 'monospace', color: '#777', textAlign: 'center' }}>{m.invoiceCount}</td><td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>R{m.billedAmt.toLocaleString()}</td></tr>))}</tbody>
            </table>
          )}
        </div>
        <div className="mb-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Recent Invoices</div>
          {!filtInvoices.length ? <div style={{ textAlign: 'center', padding: 20, color: '#333', fontSize: 12 }}>No invoices yet</div> : (
            <table className="mb-table">
              <thead><tr>{['Invoice', 'Client', 'Period', 'Incl. VAT'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
              <tbody>{filtInvoices.slice(0, 8).map(inv => (<tr key={inv.id}><td className="mb-td" style={{ fontFamily: 'monospace', fontSize: 10, color: '#888' }}>{inv.id}</td><td className="mb-td"><div style={{ color: '#C8C8C8', fontSize: 11 }}>{inv.client}</div><div style={{ color: '#A78BFA', fontSize: 10 }}>{inv.matter_id}</div></td><td className="mb-td" style={{ color: '#666', fontSize: 10 }}>{inv.period_label}</td><td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8DC63F' }}>R{((inv.total_units || 0) * (inv.rate || 150) * 1.15).toFixed(2)}</td></tr>))}</tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: '#252525' }}>Motsoeneng Bill · MB SmartTrack Manager View</div>
    </div>
  );
}
