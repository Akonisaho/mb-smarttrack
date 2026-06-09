import { C } from '../../lib/attyStyles';
import { toHm, calcUnits, appIcon, pct } from '../../lib/format';

function BarChart({ data, height = 120 }) {
  if (!data || !data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 12 }}>No data</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingBottom: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: d.color || '#6CC04A', fontWeight: 600, marginBottom: 2 }}>{d.label2 || ''}</div>
          <div style={{ width: '100%', background: d.color || '#6CC04A', borderRadius: '3px 3px 0 0', height: `${Math.max((d.value / max) * 80, 2)}%`, opacity: 0.85, minHeight: d.value > 0 ? 4 : 0 }} />
          <div style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center', marginTop: 4, whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function appBars(acts) {
  const m = {};
  acts.forEach(a => { const k = a.app_display_name || 'Unknown'; if (!m[k]) m[k] = { label: k.replace('Microsoft ', '').substring(0, 10), value: 0, bill: 0 }; m[k].value += Number(a.duration_seconds || 0); if (a.classification === 'billable') m[k].bill += Number(a.duration_seconds || 0); });
  return Object.values(m).sort((a, b) => b.value - a.value).slice(0, 8).map(d => ({ ...d, label2: toHm(d.value), color: d.bill > d.value * 0.5 ? '#6CC04A' : '#2E4A6E' }));
}

function dayBars(acts) {
  const m = {};
  acts.forEach(a => { if (!m[a.date]) m[a.date] = { label: new Date(a.date + 'T12:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }), value: 0, bill: 0 }; m[a.date].value += Number(a.duration_seconds || 0); if (a.classification === 'billable') m[a.date].bill += Number(a.duration_seconds || 0); });
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => ({ ...d, label2: `${Math.round(d.value / 60)}m`, value: Math.round(d.value / 60), color: d.bill / Math.max(d.value, 1) > 0.5 ? '#6CC04A' : '#2E4A6E' }));
}

function hourBars(acts) {
  const m = {};
  acts.forEach(a => { const hr = new Date(Number(a.start_time)).getHours(); if (!m[hr]) m[hr] = { value: 0, bill: 0 }; m[hr].value += Number(a.duration_seconds || 0); if (a.classification === 'billable') m[hr].bill += Number(a.duration_seconds || 0); });
  return Array.from({ length: 13 }, (_, i) => i + 7).map(h => ({ label: `${String(h).padStart(2, '0')}h`, value: Math.round((m[h]?.value || 0) / 60), label2: m[h]?.value > 0 ? `${Math.round(m[h].value / 60)}m` : '', color: (m[h]?.bill || 0) > (m[h]?.value || 0) * 0.5 ? '#6CC04A' : '#2E4A6E' }));
}

export default function AnalyticsTab({ allActs, selDate, setSelDate, analyticsPeriod, setAP, invRate, getAnalyticsActs }) {
  const acts = getAnalyticsActs(analyticsPeriod);
  const tSec = acts.reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const bSec = acts.filter(a => a.classification === 'billable').reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const wSec = acts.filter(a => a.classification === 'work').reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const nbSec = acts.filter(a => a.classification === 'non-billable').reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const bU = acts.filter(a => a.classification === 'billable').reduce((s, a) => s + calcUnits(a.duration_seconds), 0);

  const periodLabel = analyticsPeriod === 'day'
    ? new Date(selDate + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : analyticsPeriod === 'week' ? 'This week'
    : new Date(selDate.substring(0, 7) + '-01T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Analytics</div>
          <div style={{ fontSize: 11, color: '#444' }}>{periodLabel} · {acts.length} sessions</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" style={C.sel} value={selDate} onChange={e => setSelDate(e.target.value)} />
          <div style={{ display: 'flex', background: '#1A1A1A', border: '1px solid #252525', borderRadius: 6, padding: 2 }}>
            {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => (
              <button key={v} style={C.ptab(analyticsPeriod === v)} onClick={() => setAP(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {!acts.length ? (
        <div style={{ ...C.card, textAlign: 'center', padding: '40px', color: '#333' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div>No data for this period</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
            {[{ l: 'Total Time', v: toHm(tSec), s: `${acts.length} sessions`, a: false }, { l: 'Billable Time', v: toHm(bSec), s: `${pct(bSec, tSec)}% of total`, a: true }, { l: 'Billing Units', v: bU, s: `@ R${invRate}/unit`, a: false }, { l: 'Est. Revenue', v: `R${(bU * invRate).toLocaleString()}`, s: 'excl. VAT', a: false }].map(({ l, v, s, a }) => (
              <div key={l} style={C.stat(a)}>
                <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: a ? '#6CC04A' : '#F0F0F0' }}>{v}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{s}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, marginBottom: 14 }}>
            <div style={C.card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 14 }}>Time breakdown</div>
              {[{ l: 'Billable', c: '#6CC04A', s: bSec, p: pct(bSec, tSec) }, { l: 'Work', c: '#4A90D9', s: wSec, p: pct(wSec, tSec) }, { l: 'Non-Billable', c: '#444', s: nbSec, p: pct(nbSec, tSec) }].map(r => (
                <div key={r.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid #181818' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: r.c }} />
                    <span style={{ fontSize: 11, color: '#888' }}>{r.l}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#C0C0C0', fontFamily: 'monospace' }}>{toHm(r.s)}</span>
                    <span style={{ fontSize: 10, color: '#444', marginLeft: 6 }}>{r.p}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={C.card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Time per application</div>
              <BarChart data={appBars(acts)} height={150} />
            </div>
          </div>

          <div style={C.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 4 }}>{analyticsPeriod === 'day' ? 'Activity by hour' : 'Activity by day'}</div>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 10 }}>Minutes tracked · green = mostly billable</div>
            <BarChart data={analyticsPeriod === 'day' ? hourBars(acts) : dayBars(acts)} height={130} />
          </div>
        </>
      )}
    </div>
  );
}
