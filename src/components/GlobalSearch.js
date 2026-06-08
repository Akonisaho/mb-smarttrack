import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function GlobalSearch({ userId, isManager }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase().trim();
      const [mRes, cRes, iRes] = await Promise.all([
        supabase.from('matters').select('id,name,client').ilike('name', `%${q}%`).limit(5),
        supabase.from('clients').select('id,full_name,email,client_no').ilike('full_name', `%${q}%`).eq('is_active', true).limit(5),
        supabase.from('invoices').select('id,client,matter_name,total_amount').ilike('client', `%${q}%`).limit(5),
      ]);
      setResults({
        matters: mRes.data || [],
        clients: cRes.data || [],
        invoices: iRes.data || [],
      });
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const total = results ? results.matters.length + results.clients.length + results.invoices.length : 0;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 7, padding: '5px 12px', gap: 8, width: 220 }}>
        <span style={{ color: '#555', fontSize: 13 }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search matters, clients…"
          style={{ background: 'none', border: 'none', outline: 'none', color: '#F0F0F0', fontSize: 12, fontFamily: "'DM Sans',system-ui,sans-serif", width: '100%' }}
        />
        {query && <button onClick={() => { setQuery(''); setResults(null); setOpen(false); }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>}
      </div>

      {open && results && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#111', border: '1px solid #252525', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 500, maxHeight: 400, overflowY: 'auto', minWidth: 300 }}>
          {loading && <div style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>Searching…</div>}
          {!loading && total === 0 && <div style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>No results for "{query}"</div>}

          {results.matters.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Matters</div>
              {results.matters.map(m => (
                <button key={m.id} onClick={() => { setOpen(false); setQuery(''); router.push('/'); }} style={{ display: 'flex', flexDirection: 'column', width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #1A1A1A' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: 12, color: '#F0F0F0', fontWeight: 600 }}>{m.id} — {m.name}</span>
                  <span style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{m.client}</span>
                </button>
              ))}
            </div>
          )}

          {results.clients.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Clients</div>
              {results.clients.map(c => (
                <button key={c.id} onClick={() => { setOpen(false); setQuery(''); }} style={{ display: 'flex', flexDirection: 'column', width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #1A1A1A' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: 12, color: '#F0F0F0', fontWeight: 600 }}>{c.full_name}</span>
                  <span style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{c.client_no} · {c.email}</span>
                </button>
              ))}
            </div>
          )}

          {results.invoices.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Invoices</div>
              {results.invoices.map(i => (
                <button key={i.id} onClick={() => { setOpen(false); setQuery(''); }} style={{ display: 'flex', flexDirection: 'column', width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #1A1A1A' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: 12, color: '#F0F0F0', fontWeight: 600 }}>{i.id} — {i.client}</span>
                  <span style={{ fontSize: 11, color: '#666', marginTop: 2 }}>R {Number(i.total_amount || 0).toFixed(2)} · {i.matter_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
