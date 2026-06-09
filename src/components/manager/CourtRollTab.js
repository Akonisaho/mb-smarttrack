import { useState } from 'react';
import { C } from '../../lib/styles';
import { fmtDate } from '../../lib/format';

export default function CourtRollTab({ matters, profiles, isMobile }) {
  const [filter, setFilter] = useState('');

  const upcomingMatters = matters.filter(m => {
    if (m.status === 'closed') return false;
    if (filter) {
      const q = filter.toLowerCase();
      const atty = profiles.find(p => p.id === m.user_id);
      return m.id.toLowerCase().includes(q) || m.client.toLowerCase().includes(q) || atty?.full_name.toLowerCase().includes(q);
    }
    return true;
  }).filter(m => m.prescription_date || m.next_action_date);

  const sorted = upcomingMatters.sort((a, b) => {
    const da = a.prescription_date || a.next_action_date || '9999';
    const db = b.prescription_date || b.next_action_date || '9999';
    return da.localeCompare(db);
  });

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Court Roll</div>
          <div className="mb-sub">All upcoming court appearances across all matters</div>
        </div>
        <input className="mb-sel" type="text" placeholder="Filter by attorney or matter..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {!sorted.length ? (
        <div className="mb-card" style={{ textAlign: 'center', padding: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⚖️</div>
          <div style={{ fontSize: 14 }}>No court dates or action dates set</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 6 }}>Set prescription dates and next action dates on matters to see them here</div>
        </div>
      ) : (
        <div className="mb-card">
          <table className="mb-table">
            <thead>
              <tr>{['Date', 'Type', 'Matter', 'Client', 'Attorney', 'Days Away', 'Status'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.flatMap(m => {
                const atty = profiles.find(p => p.id === m.user_id);
                const dates = [];
                if (m.prescription_date) dates.push({ date: m.prescription_date, type: 'Prescription', urgent: Math.floor((new Date(m.prescription_date) - new Date()) / 86400000) <= 30 });
                if (m.next_action_date) dates.push({ date: m.next_action_date, type: 'Next Action', urgent: Math.floor((new Date(m.next_action_date) - new Date()) / 86400000) <= 7 });
                return dates.map((d, i) => {
                  const days = Math.floor((new Date(d.date) - new Date()) / 86400000);
                  return (
                    <tr key={m.id + i} style={{ background: d.urgent ? 'rgba(220,80,80,0.04)' : '' }}>
                      <td className="mb-td" style={{ fontFamily: 'monospace', fontWeight: 700, color: d.urgent ? '#E05252' : '#888' }}>{fmtDate(d.date)}</td>
                      <td className="mb-td">
                        <span className="mb-badge" style={{ background: d.type === 'Prescription' ? 'rgba(220,80,80,0.1)' : 'rgba(234,179,8,0.1)', color: d.type === 'Prescription' ? '#E05252' : '#EAB308' }}>{d.type}</span>
                      </td>
                      <td className="mb-td" style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 10 }}>{m.id}</td>
                      <td className="mb-td" style={{ color: '#C8C8C8' }}>{m.client}</td>
                      <td className="mb-td" style={{ color: '#4A90D9', fontSize: 11 }}>{atty?.full_name || '—'}</td>
                      <td className="mb-td" style={{ fontFamily: 'monospace', color: days <= 7 ? '#E05252' : days <= 30 ? '#EAB308' : '#555', fontWeight: days <= 30 ? 700 : 400 }}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`}
                      </td>
                      <td className="mb-td">
                        <span className="mb-badge" style={{ background: m.status === 'closed' ? 'rgba(85,85,85,0.2)' : 'rgba(141,198,63,0.1)', color: m.status === 'closed' ? '#555' : '#8DC63F' }}>{m.status || 'open'}</span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
