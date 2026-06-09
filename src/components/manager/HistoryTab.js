import { useState } from 'react';
import { C } from '../../lib/styles';
import { toHm, fmonth } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import BarChart from '../ui/BarChart';

export default function HistoryTab({ allTime, profiles, branches, rate, isMobile, selAtty, setSelAtty }) {
  const [histYear, setHistYear] = useState(new Date().getFullYear());
  const [histLoading, setHistLoading] = useState(false);
  const [selMonth, setSelMonth] = useState(null);
  const [monthActs, setMonthActs] = useState([]);
  const [histData, setHistData] = useState(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => ({ month: `${y}-${String(i + 1).padStart(2, '0')}`, sessions: 0, total_seconds: 0, billable_seconds: 0, billable_units: 0 }));
  });

  const fetchHist = async year => {
    setHistLoading(true);
    const { data } = await supabase.from('activities').select('user_id,date,duration_seconds,is_billable,billing_units').neq('agent_id', 'demo').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      months[key] = { month: key, sessions: 0, total_seconds: 0, billable_seconds: 0, billable_units: 0 };
    }
    (data || []).forEach(a => {
      const key = a.date.substring(0, 7);
      if (!months[key]) return;
      months[key].sessions++;
      months[key].total_seconds += a.duration_seconds || 0;
      months[key].billable_seconds += a.is_billable ? (a.duration_seconds || 0) : 0;
      months[key].billable_units += a.is_billable ? (a.billing_units || 0) : 0;
    });
    setHistData(Object.values(months));
    setHistLoading(false);
  };

  const loadMonth = async (month, attyId) => {
    setSelMonth(month);
    let q = supabase.from('activities').select('user_id,date,duration_seconds,billing_units,is_billable').neq('agent_id', 'demo').gte('date', `${month}-01`).lte('date', `${month}-31`).eq('is_billable', true).order('date', { ascending: true });
    if (attyId) q = q.eq('user_id', attyId);
    const { data } = await q;
    setMonthActs((data || []).map(a => ({ ...a, profiles: { full_name: profiles.find(p => p.id === a.user_id)?.full_name || 'Unknown' } })));
  };

  const handleYearChange = y => { setHistYear(y); setSelMonth(null); setMonthActs([]); fetchHist(y); };

  const monthBars = histData.filter(m => m.sessions > 0).map(m => ({ label: new Date(m.month + '-01T12:00:00').toLocaleString('en-ZA', { month: 'short' }), label2: `${m.billable_units}u`, value: m.billable_units, color: m.billable_units > 0 ? '#8DC63F' : '#2E4A6E' }));

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Firm History</div>
          <div className="mb-sub">{histLoading ? 'Loading…' : 'Click a month to see attorney billing details'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="mb-sel" value={histYear} onChange={e => handleYearChange(Number(e.target.value))}>{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
          <select className="mb-sel" value={selAtty} onChange={e => setSelAtty(e.target.value)}><option value="all">All attorneys</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        </div>
      </div>

      {!histLoading && histData.every(m => m.sessions === 0) && (
        <div className="mb-card" style={{ textAlign: 'center', padding: '30px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 13, color: '#555' }}>No activity data for {histYear}</div>
        </div>
      )}

      {monthBars.length > 0 && (
        <div className="mb-card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#D0D0D0', marginBottom: 4 }}>Billing units by month — {histYear}</div>
          <BarChart data={monthBars} height={130} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {histData.map(m => {
          const isSelected = selMonth === m.month;
          const hasFuture = new Date(m.month + '-01') > new Date();
          const revenue = (m.billable_units || 0) * rate * 1.15;
          return (
            <div key={m.month} style={{ background: isSelected ? 'rgba(141,198,63,0.08)' : m.sessions ? '#111' : '#0D0D0D', border: `1px solid ${isSelected ? 'rgba(141,198,63,0.4)' : m.sessions ? '#1A1A1A' : '#131313'}`, borderRadius: 8, padding: 14, cursor: m.sessions ? 'pointer' : 'default', opacity: hasFuture ? 0.4 : 1 }} onClick={() => m.sessions && loadMonth(m.month, selAtty === 'all' ? null : selAtty)}>
              <div style={{ fontSize: 12, fontWeight: 600, color: m.sessions ? '#D0D0D0' : '#333', marginBottom: 6 }}>{new Date(m.month + '-01T12:00:00').toLocaleString('en-ZA', { month: 'long' })}</div>
              {m.sessions ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#8DC63F', marginBottom: 2 }}>{m.billable_units || 0} units</div>
                  <div style={{ fontSize: 11, color: '#4A90D9', fontWeight: 600, marginBottom: 2 }}>R{revenue.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>est. incl. VAT</div>
                </>
              ) : <div style={{ fontSize: 11, color: '#2A2A2A', marginTop: 8 }}>{hasFuture ? 'Future' : 'No data'}</div>}
            </div>
          );
        })}
      </div>

      {selMonth && (
        <div className="mb-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{fmonth(selMonth)} — Attorney Billing</div>
            <button className="mb-btn mb-btn-sm" onClick={() => { setSelMonth(null); setMonthActs([]); }}>✕ Close</button>
          </div>
          {!monthActs.filter(a => a.is_billable).length ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#555', fontSize: 12 }}>No billable activities for this month.</div>
          ) : (() => {
            const attyMap = {};
            monthActs.filter(a => a.is_billable).forEach(a => {
              const name = a.profiles?.full_name || 'Unknown';
              if (!attyMap[name]) attyMap[name] = { name, billSec: 0, units: 0 };
              attyMap[name].billSec += a.duration_seconds || 0;
              attyMap[name].units += a.billing_units || 0;
            });
            const attyList = Object.values(attyMap).sort((a, b) => b.units - a.units);
            return (
              <table className="mb-table">
                <thead><tr>{['Attorney', 'Billable Time', 'Units Earned', 'Est. Revenue (incl. VAT)'].map(h => <th key={h} className="mb-th">{h}</th>)}</tr></thead>
                <tbody>
                  {attyList.map((a, i) => (
                    <tr key={i}>
                      <td className="mb-td" style={{ fontWeight: 500, color: '#D0D0D0' }}>{a.name}</td>
                      <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{toHm(a.billSec)}</td>
                      <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>{a.units}</td>
                      <td className="mb-td" style={{ fontFamily: 'monospace', color: '#8DC63F', fontWeight: 700 }}>R{(a.units * rate * 1.15).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#0D0D0D' }}>
                    <td className="mb-th">Total</td>
                    <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{toHm(attyList.reduce((s, a) => s + a.billSec, 0))}</td>
                    <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>{attyList.reduce((s, a) => s + a.units, 0)}</td>
                    <td className="mb-th" style={{ fontFamily: 'monospace', color: '#8DC63F' }}>R{(attyList.reduce((s, a) => s + a.units, 0) * rate * 1.15).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            );
          })()}
        </div>
      )}
    </div>
  );
}
