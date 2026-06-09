import { C } from '../../lib/attyStyles';
import { toHm } from '../../lib/format';

export default function PerformanceTab({ allActs, invoices, monthTarget, invRate, profile, toast }) {
  const years = [...new Set(allActs.map(a => a.date?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);
  const allYears = years.length ? years : [new Date().getFullYear().toString()];

  const toHm2 = s => { s = Number(s) || 0; if (s <= 0) return '0m'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  function halfSummary(months, label) {
    const acts = allActs.filter(a => a.is_billable && months.some(m => a.date?.startsWith(m)));
    const units = acts.reduce((s, a) => s + (a.billing_units || 0), 0);
    const sec = acts.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const invAmt = invoices.filter(i => months.some(m => i.created_at?.startsWith(m))).reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
    const tgt = (monthTarget || 0) * 6;
    const pct3 = tgt > 0 ? Math.round(units / tgt * 100) : null;
    const allForPeriod = allActs.filter(a => months.some(m => a.date?.startsWith(m)));
    const util = allForPeriod.reduce((s, a) => s + (a.duration_seconds || 0), 0) > 0 ? Math.round(acts.reduce((s, a) => s + (a.duration_seconds || 0), 0) / allForPeriod.reduce((s, a) => s + (a.duration_seconds || 0), 1) * 100) : 0;
    return (
      <div key={label} style={{ ...C.card, background: 'rgba(108,192,74,0.03)', border: '1px solid rgba(108,192,74,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#D0D0D0' }}>{label} Performance Review — {new Date().getFullYear()}</div>
          <button style={{ ...C.btn('p'), fontSize: 11 }} onClick={() => {
            const txt = `PERFORMANCE REVIEW SUMMARY\n${label} ${new Date().getFullYear()}\nAttorney: ${profile?.full_name}\n\nBilling Units: ${units}${tgt > 0 ? ` / ${tgt} target (${pct3}%)` : ''}\nBillable Time: ${toHm2(sec)}\nUtilisation: ${util}%\nRevenue Invoiced: R${invAmt.toFixed(2)} incl. VAT\n\nMonthly Breakdown:\n${months.map(m => { const u = allActs.filter(a => a.is_billable && a.date?.startsWith(m)).reduce((s, a) => s + (a.billing_units || 0), 0); return new Date(m + '-01T12:00:00').toLocaleString('en-ZA', { month: 'long' }) + ': ' + u + ' units'; }).join('\n')}`;
            navigator.clipboard.writeText(txt);
            toast('Performance summary copied — paste into your review document', 'info');
          }}>📋 Copy for Review</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[{ l: 'Billing Units', v: units + (tgt > 0 ? ` / ${tgt}` : ' units'), c: '#6CC04A' }, { l: 'Billable Time', v: toHm2(sec), c: '#4A90D9' }, { l: 'Utilisation', v: util + '%', c: util >= 70 ? '#6CC04A' : '#EAB308' }, { l: 'Revenue', v: 'R' + invAmt.toLocaleString(undefined, { maximumFractionDigits: 0 }), c: '#6CC04A' }].map(({ l, v, c }) => (
            <div key={l} style={C.stat(false)}>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        {pct3 !== null && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#555' }}>Target achievement</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: pct3 >= 100 ? '#6CC04A' : pct3 >= 70 ? '#EAB308' : '#E05252' }}>{pct3}%</span>
            </div>
            <div style={{ height: 8, background: '#1A1A1A', borderRadius: 4 }}>
              <div style={{ width: `${Math.min(pct3, 100)}%`, height: '100%', background: pct3 >= 100 ? '#6CC04A' : pct3 >= 70 ? '#EAB308' : '#E05252', borderRadius: 4 }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const yr = new Date().getFullYear();
  const h1months = Array.from({ length: 6 }, (_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
  const h2months = Array.from({ length: 6 }, (_, i) => `${yr}-${String(i + 7).padStart(2, '0')}`);

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>My Performance</div>
          <div style={{ fontSize: 11, color: '#444' }}>Your billing history and performance over time</div>
        </div>
      </div>

      {allYears.map(yr => {
        const months = Array.from({ length: 12 }, (_, i) => {
          const key = `${yr}-${String(i + 1).padStart(2, '0')}`;
          const acts = allActs.filter(a => a.is_billable && a.date?.startsWith(key));
          const units = acts.reduce((s, a) => s + (a.billing_units || 0), 0);
          const invAmt = invoices.filter(i => i.created_at?.startsWith(key)).reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
          const tgt = monthTarget;
          const pct2 = tgt > 0 ? Math.min(100, Math.round(units / tgt * 100)) : null;
          const hasFuture = new Date(key + '-01') > new Date();
          return { key, month: new Date(key + '-01T12:00:00').toLocaleString('en-ZA', { month: 'short' }), units, invAmt, pct: pct2, hasFuture };
        });
        const yrTotal = months.reduce((s, m) => s + m.units, 0);
        const yrRev = months.reduce((s, m) => s + m.invAmt, 0);
        return (
          <div key={yr} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#D0D0D0' }}>{yr}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{yrTotal} units · R{yrRev.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
              {months.map(m => {
                const c = m.pct === null ? '#444' : m.pct >= 100 ? '#6CC04A' : m.pct >= 70 ? '#EAB308' : '#E05252';
                return (
                  <div key={m.key} style={{ background: m.units > 0 ? '#111' : '#0D0D0D', border: `1px solid ${m.units > 0 ? '#1A1A1A' : '#131313'}`, borderRadius: 8, padding: 12, opacity: m.hasFuture ? 0.4 : 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: m.units > 0 ? '#D0D0D0' : '#333', marginBottom: 6 }}>{m.month}</div>
                    {m.units > 0 ? (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#6CC04A', marginBottom: 2 }}>{m.units}</div>
                        <div style={{ fontSize: 9, color: '#555', marginBottom: 6 }}>units</div>
                        {m.pct !== null && <div style={{ height: 4, background: '#1A1A1A', borderRadius: 2, marginBottom: 4 }}><div style={{ width: `${m.pct}%`, height: '100%', background: c, borderRadius: 2 }} /></div>}
                        {m.pct !== null && <div style={{ fontSize: 9, color: c, fontWeight: 700 }}>{m.pct}% of target</div>}
                        <div style={{ fontSize: 9, color: '#4A90D9', marginTop: 4 }}>R{m.invAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: '#2A2A2A', marginTop: 8 }}>{m.hasFuture ? 'Future' : 'No data'}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Bi-Annual Performance Review</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {halfSummary(h1months, 'H1 (Jan–Jun')}
          {halfSummary(h2months, 'H2 (Jul–Dec')}
        </div>
      </div>
    </div>
  );
}
