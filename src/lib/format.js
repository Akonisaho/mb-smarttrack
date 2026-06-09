export function toHm(s) {
  s = Number(s) || 0;
  if (s <= 0) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function calcUnits(s) { return Math.max(1, Math.ceil((Number(s) || 0) / 360)); }
export function calcAmt(s, rate) { return calcUnits(s) * (Number(rate) || 150); }
export function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

export function fmtR(n) {
  return 'R ' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fdate(d) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d || ''; }
}

export function fmonth(d) {
  try { return new Date(d + '-01T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }); }
  catch { return d || ''; }
}

export function ftime(ms) {
  return new Date(Number(ms)).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(d) {
  if (!d) return '';
  try { const p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  catch { return d; }
}

export function nextReceiptNo(transactions) {
  const nos = transactions
    .filter(t => t.type === 'receipt' && t.receipt_no)
    .map(t => parseInt((t.receipt_no || '').replace('TRR-', '')) || 0);
  const max = nos.length ? Math.max(...nos) : 0;
  return 'TRR-' + String(max + 1).padStart(3, '0');
}

export function appIcon(n) {
  n = (n || '').toLowerCase();
  if (n.includes('phone') || n.includes('call')) return '📞';
  if (n.includes('word')) return '📝';
  if (n.includes('excel')) return '📊';
  if (n.includes('outlook')) return '📧';
  if (n.includes('teams')) return '💬';
  if (n.includes('chrome') || n.includes('edge')) return '🌐';
  if (n.includes('acrobat')) return '📄';
  if (n.includes('powerpoint')) return '📑';
  if (n.includes('explorer')) return '📁';
  if (n.includes('code')) return '💻';
  return '🖥️';
}
