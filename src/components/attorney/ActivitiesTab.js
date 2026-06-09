import { C } from '../../lib/attyStyles';
import { toHm, calcUnits, appIcon, fdate, ftime } from '../../lib/format';

function Badge({ c }) {
  const s = c === 'billable' ? { color: '#6CC04A', border: '1px solid rgba(108,192,74,0.35)', bg: 'rgba(108,192,74,0.1)' } : c === 'work' ? { color: '#4A90D9', border: '1px solid rgba(74,144,217,0.35)', bg: 'rgba(74,144,217,0.1)' } : { color: '#666', border: '1px solid #2A2A2A', bg: 'rgba(42,42,42,0.4)' };
  return <span style={{ color: s.color, border: s.border, background: s.bg, fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize', display: 'inline-block' }}>{c}</span>;
}

export default function ActivitiesTab({ filtActs, allActs, matters, dates, filterCls, setFilterCls, filterDate, setFilterDate, filterApp, setFilterApp, allApps, reclassify, assignMatter }) {
  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>All Activities</div>
          <div style={{ fontSize: 11, color: '#444' }}>{filtActs.length} sessions</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={C.sel} value={filterCls} onChange={e => setFilterCls(e.target.value)}>
            <option value="">All types</option>
            <option value="billable">Billable</option>
            <option value="work">Work</option>
            <option value="non-billable">Non-Billable</option>
          </select>
          <select style={C.sel} value={filterDate} onChange={e => setFilterDate(e.target.value)}>
            <option value="">All dates</option>
            {dates.map(d => <option key={d.date} value={d.date}>{fdate(d.date)}</option>)}
          </select>
          <select style={C.sel} value={filterApp} onChange={e => setFilterApp(e.target.value)}>
            <option value="">All apps</option>
            {allApps.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {(filterCls || filterDate || filterApp) && (
            <button style={C.btn()} onClick={() => { setFilterCls(''); setFilterDate(''); setFilterApp(''); }}>✕ Clear</button>
          )}
        </div>
      </div>

      <div style={C.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Date', 'Time', 'App', 'Description', 'Matter', 'Duration', 'Units', 'Status', 'Override'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!filtActs.length && (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: 13 }}>{!allActs.length ? 'No tracked activities yet.' : 'No sessions match your filters.'}</td></tr>
              )}
              {filtActs.map(a => {
                const am = matters.find(m => m.id === a.matter);
                return (
                  <tr key={a.id}>
                    <td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10, color: '#555', whiteSpace: 'nowrap' }}>{fdate(a.date)}</td>
                    <td style={{ ...C.td, fontFamily: 'monospace', color: '#555', whiteSpace: 'nowrap' }}>{ftime(a.start_time)}</td>
                    <td style={{ ...C.td, whiteSpace: 'nowrap' }}>{appIcon(a.app_display_name)} <span style={{ color: '#C8C8C8' }}>{a.app_display_name}</span></td>
                    <td style={{ ...C.td, color: '#555', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.window_title}>{a.window_title}</td>
                    <td style={{ ...C.td, minWidth: 160 }}>
                      <select style={{ ...C.asel, width: '100%', color: am ? '#A78BFA' : '#555', borderColor: am ? 'rgba(167,139,250,0.5)' : '#252525' }} value={a.matter || ''} onChange={e => assignMatter(a.id, e.target.value)}>
                        <option value="">— none —</option>
                        {matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
                      </select>
                      {am && <div style={{ fontSize: 9, color: '#A78BFA', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{am.name}</div>}
                    </td>
                    <td style={{ ...C.td, fontFamily: 'monospace', color: '#777' }}>{toHm(a.duration_seconds)}</td>
                    <td style={{ ...C.td, fontFamily: 'monospace', color: a.classification === 'billable' ? '#6CC04A' : '#444', fontWeight: 600 }}>{a.classification === 'billable' ? calcUnits(a.duration_seconds) : '—'}</td>
                    <td style={C.td}><Badge c={a.classification} /></td>
                    <td style={C.td}>
                      <select style={C.asel} value={a.classification} onChange={e => reclassify(a.id, e.target.value)}>
                        <option value="billable">Billable</option>
                        <option value="work">Work</option>
                        <option value="non-billable">Non-Billable</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
