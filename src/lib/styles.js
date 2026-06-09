// Shared design tokens — import C in any dashboard page/component
export const C = {
  page:  { background: '#0A0A0A', minHeight: '100vh', fontFamily: "'DM Sans',system-ui,sans-serif", color: '#F0F0F0' },
  main:  { maxWidth: 1300, margin: '0 auto', padding: '20px 24px' },
  card:  { background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: 16, marginBottom: 14 },
  card0: { background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: 16 },
  stat:  (acc, warn) => ({
    background: acc ? 'rgba(141,198,63,0.05)' : warn ? 'rgba(234,179,8,0.05)' : '#111',
    border: `1px solid ${acc ? 'rgba(141,198,63,0.25)' : warn ? 'rgba(234,179,8,0.25)' : '#1A1A1A'}`,
    borderRadius: 8,
    padding: 14,
  }),
  sel:   { background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' },
  th:    { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#444', padding: '9px 10px', borderBottom: '1px solid #181818', textAlign: 'left', fontWeight: 600 },
  td:    { padding: '9px 10px', fontSize: 11, borderBottom: '1px solid #161616', verticalAlign: 'middle' },
  btn:   (v = 's') => ({
    background: v === 'p' ? '#8DC63F' : v === 'r' ? 'rgba(220,80,80,0.15)' : v === 'warn' ? 'rgba(234,179,8,0.15)' : 'transparent',
    border:     v === 'p' ? 'none'    : v === 'r' ? '1px solid rgba(220,80,80,0.4)' : v === 'warn' ? '1px solid rgba(234,179,8,0.4)' : '1px solid #252525',
    color:      v === 'p' ? '#0A0A0A' : v === 'r' ? '#E05252' : v === 'warn' ? '#EAB308' : '#888',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: v === 'p' ? 700 : 500,
  }),
  pill:  { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(141,198,63,0.08)', border: '1px solid rgba(141,198,63,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#8DC63F' },
  dot:   { width: 7, height: 7, borderRadius: '50%', background: '#8DC63F', boxShadow: '0 0 6px rgba(141,198,63,0.8)' },
  ntab:  (on) => ({
    background: 'transparent',
    border: `1px solid ${on ? '#2A2A2A' : 'transparent'}`,
    color: on ? '#F0F0F0' : '#555',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: on ? 600 : 400,
  }),
};

export const roleColor = (role) =>
  role === 'manager' || role === 'national_manager' ? '#A78BFA' :
  role === 'branch_manager' ? '#4A90D9' :
  role === 'bookkeeper' ? '#EAB308' : '#8DC63F';

export const roleBg = (role) =>
  role === 'manager' || role === 'national_manager' ? 'rgba(167,139,250,0.1)' :
  role === 'branch_manager' ? 'rgba(74,144,217,0.1)' :
  role === 'bookkeeper' ? 'rgba(234,179,8,0.1)' : 'rgba(141,198,63,0.1)';

export const lbl = { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4, display: 'block' };
export const inp = { background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '9px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
