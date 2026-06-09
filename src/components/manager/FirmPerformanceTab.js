import { useState } from 'react';
import { C } from '../../lib/styles';
import { toHm } from '../../lib/format';

export default function FirmPerformanceTab({ allTime, profiles, branches, invoices, isMobile, showAlert }) {
  const [perfYear, setPerfYear] = useState(new Date().getFullYear());
  const [perfAtty, setPerfAtty] = useState('all');

  const attyList = perfAtty === 'all'
    ? profiles.filter(p => p.role === 'attorney' || p.role === 'branch_manager')
    : [profiles.find(p => p.id === perfAtty)].filter(Boolean);

  const h1months = Array.from({ length: 6 }, (_, i) => `${perfYear}-${String(i + 1).padStart(2, '0')}`);
  const h2months = Array.from({ length: 6 }, (_, i) => `${perfYear}-${String(i + 7).padStart(2, '0')}`);

  const getStats = (atty, months) => {
    const acts = allTime.filter(a => a.user_id === atty.id && a.is_billable && months.some(m => a.date?.startsWith(m)));
    const allA = allTime.filter(a => a.user_id === atty.id && months.some(m => a.date?.startsWith(m)));
    const units = acts.reduce((s, a) => s + (a.billing_units || 0), 0);
    const sec = acts.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const totalSec = allA.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const invAmt = invoices.filter(i => i.user_id === atty.id && months.some(m => i.created_at?.startsWith(m))).reduce((s, i) => s + (i.total_units || 0) * (i.rate || atty.rate || 150) * 1.15, 0);
    const tgt = (atty.monthly_target || 0) * 6;
    const pct = tgt > 0 ? Math.round(units / tgt * 100) : null;
    const util = totalSec > 0 ? Math.round(sec / totalSec * 100) : 0;
    const monthly = months.map(m => { const u = allTime.filter(a => a.user_id === atty.id && a.is_billable && a.date?.startsWith(m)).reduce((s, a) => s + (a.billing_units || 0), 0); return { m, u, label: new Date(m + '-01T12:00:00').toLocaleString('en-ZA', { month: 'short' }) }; });
    return { units, sec, totalSec, invAmt, pct, util, tgt, monthly };
  };

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Firm Performance</div>
          <div className="mb-sub">Attorney performance · bi-annual review reports</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="mb-sel" value={perfYear} onChange={e => setPerfYear(Number(e.target.value))}>{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
          <select className="mb-sel" value={perfAtty} onChange={e => setPerfAtty(e.target.value)}><option value="all">All attorneys</option>{profiles.filter(p => p.role === 'attorney' || p.role === 'branch_manager').map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        </div>
      </div>

      {attyList.map(atty => {
        const s1 = getStats(atty, h1months), s2 = getStats(atty, h2months);
        const br = branches.find(b => b.id === atty.branch_id);
        return (
          <div key={atty.id} className="mb-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#D0D0D0' }}>{atty.full_name}</div>
                <div style={{ fontSize: 11, color: '#555' }}>{atty.email} · {br?.name || '—'} · Target: {atty.monthly_target || 0} units/month</div>
              </div>
              <button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => {
                const txt = `PERFORMANCE REVIEW ${perfYear}\nAttorney: ${atty.full_name}\nFirm: ${br?.name || '—'}\nMonthly Target: ${atty.monthly_target || 0} units\n\nH1 (Jan–Jun):\nUnits: ${s1.units}${s1.tgt > 0 ? ' / ' + s1.tgt + ' (' + s1.pct + '%)' : ''}\nBillable Time: ${toHm(s1.sec)}\nUtilisation: ${s1.util}%\nRevenue: R${s1.invAmt.toFixed(2)}\n\nH2 (Jul–Dec):\nUnits: ${s2.units}${s2.tgt > 0 ? ' / ' + s2.tgt + ' (' + s2.pct + '%)' : ''}\nBillable Time: ${toHm(s2.sec)}\nUtilisation: ${s2.util}%\nRevenue: R${s2.invAmt.toFixed(2)}`;
                navigator.clipboard.writeText(txt);
                showAlert('✓ Performance review copied to clipboard');
              }}>📋 Copy for Review</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
              {[{ label: 'H1 (Jan–Jun)', s: s1 }, { label: 'H2 (Jul–Dec)', s: s2 }].map(({ label, s }) => (
                <div key={label} style={{ background: '#0D0D0D', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 10 }}>{label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[['Units', s.units + (s.tgt > 0 ? ' / ' + s.tgt : ''), '#8DC63F'], ['Time', toHm(s.sec), '#4A90D9'], ['Utilisation', s.util + '%', s.util >= 70 ? '#8DC63F' : '#EAB308'], ['Revenue', 'R' + s.invAmt.toLocaleString(undefined, { maximumFractionDigits: 0 }), '#8DC63F']].map(([l, v, c]) => (
                      <div key={l}><div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div></div>
                    ))}
                  </div>
                  {s.pct !== null && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ fontSize: 10, color: '#555' }}>Target</span><span style={{ fontSize: 10, fontWeight: 700, color: s.pct >= 100 ? '#8DC63F' : s.pct >= 70 ? '#EAB308' : '#E05252' }}>{s.pct}%</span></div>
                      <div style={{ height: 6, background: '#1A1A1A', borderRadius: 3 }}><div style={{ width: `${Math.min(s.pct, 100)}%`, height: '100%', background: s.pct >= 100 ? '#8DC63F' : s.pct >= 70 ? '#EAB308' : '#E05252', borderRadius: 3 }} /></div>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                    {s.monthly.map(({ m, u, label: ml }) => {
                      const tgt2 = atty.monthly_target || 0;
                      const p = tgt2 > 0 ? Math.min(100, Math.round(u / tgt2 * 100)) : null;
                      const c = p === null ? '#444' : p >= 100 ? '#8DC63F' : p >= 70 ? '#EAB308' : '#E05252';
                      return (
                        <div key={m} style={{ flex: 1, minWidth: 30, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: '#333', marginBottom: 2 }}>{ml}</div>
                          <div style={{ height: 30, background: '#111', borderRadius: 3, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                            <div style={{ width: '100%', background: c, height: `${u > 0 ? Math.max(15, p || 20) : 0}%`, borderRadius: '2px 2px 0 0' }} />
                          </div>
                          <div style={{ fontSize: 8, color: c, fontWeight: 700, marginTop: 1 }}>{u}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
