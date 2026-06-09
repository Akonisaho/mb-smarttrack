import { C } from '../../lib/attyStyles';
import { toHm } from '../../lib/format';

export default function HistoryTab({ histYear, setHistYear, histMonths, histYears, selMonth, monthData, invRate, setInvMatterId, setTab, loadMonth }) {
  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>Work History</div>
          <div style={{ fontSize: 11, color: '#444' }}>Full record of all tracked time</div>
        </div>
        <select style={C.sel} value={histYear} onChange={e => { setHistYear(Number(e.target.value)); }}>
          {histYears.length ? histYears.map(y => <option key={y} value={y}>{y}</option>) : <option value={histYear}>{histYear}</option>}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const monthStr = `${histYear}-${String(i + 1).padStart(2, '0')}`;
          const monthName = new Date(histYear, i, 1).toLocaleString('en-ZA', { month: 'long' });
          const data = histMonths.find(m => m.month === monthStr);
          const isSelected = selMonth === monthStr;
          const hasFuture = new Date(histYear, i, 1) > new Date();
          return (
            <div key={monthStr} style={{ background: isSelected ? 'rgba(108,192,74,0.08)' : data ? '#111' : '#0D0D0D', border: `1px solid ${isSelected ? 'rgba(108,192,74,0.4)' : data ? '#1A1A1A' : '#131313'}`, borderRadius: 8, padding: 14, cursor: data ? 'pointer' : 'default', opacity: hasFuture ? 0.4 : 1 }} onClick={() => data && loadMonth(monthStr)}>
              <div style={{ fontSize: 12, fontWeight: 600, color: data ? '#D0D0D0' : '#333', marginBottom: 6 }}>{monthName}</div>
              {data ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#6CC04A', marginBottom: 2 }}>{data.billable_units || 0} units</div>
                  <div style={{ fontSize: 11, color: '#4A90D9', fontWeight: 600, marginTop: 2 }}>R{((data.billable_units || 0) * invRate * 1.15).toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>incl. VAT</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#2A2A2A', marginTop: 8 }}>{hasFuture ? 'Future' : 'No data'}</div>
              )}
            </div>
          );
        })}
      </div>

      {selMonth && monthData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{new Date(selMonth + '-01T12:00:00').toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}</span>
              <span style={{ fontSize: 11, color: '#555', marginLeft: 12 }}>{monthData.totals?.billable_units || 0} units · {toHm(monthData.totals?.billable_seconds)} billable</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={C.btn('p')} onClick={() => { setInvMatterId(''); setTab('invoices'); }}>Invoice for this month</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'Billing Units', v: monthData.totals?.billable_units || 0, s: 'billable units', a: true },
              { l: 'Billable Time', v: toHm(monthData.totals?.billable_seconds), s: 'time billed', a: false },
              { l: 'Est. Revenue', v: `R${((monthData.totals?.billable_units || 0) * invRate * 1.15).toFixed(2)}`, s: 'incl. VAT', a: true },
            ].map(({ l, v, s, a }) => (
              <div key={l} style={C.stat(a)}>
                <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: a ? '#6CC04A' : '#F0F0F0' }}>{v}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
