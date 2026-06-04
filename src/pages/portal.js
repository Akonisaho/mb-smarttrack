import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, fetchPortalAccess } from '../lib/supabase';

function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

export default function ClientPortal(){
  const router = useRouter();
  const { token } = router.query;
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [trustTxns, setTrustTxns] = useState([]);
  const [matters, setMatters] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchPortalAccess(token).then(async ({ access: acc }) => {
      if (!acc) { setError('Invalid or expired portal link.'); setLoading(false); return; }
      setAccess(acc);
      const client = acc.clients;
      const [invRes, trustRes, matRes, payRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('client', client.full_name).order('created_at', { ascending:false }),
        supabase.from('trust_transactions').select('*').eq('status', 'posted').order('date', { ascending:false }),
        supabase.from('matters').select('id,name,client,status').eq('client', client.full_name),
        supabase.from('invoice_payments').select('*'),
      ]);
      setInvoices(invRes.data || []);
      setMatters(matRes.data || []);
      setPayments(payRes.data || []);
      const myMatterIds = (matRes.data || []).map(m => m.id);
      setTrustTxns((trustRes.data || []).filter(t => myMatterIds.includes(t.matter_id)));
      setLoading(false);
    });
  }, [token]);

  const paid = invId => payments.filter(p => p.invoice_id === invId).reduce((s,p) => s + Number(p.amount), 0);
  const trustBalance = trustTxns.reduce((s, t) => t.type === 'receipt' ? s + Number(t.amount) : s - Number(t.amount), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_units||0)*(i.rate||150)*1.15, 0);
  const totalPaid = invoices.reduce((s, i) => s + paid(i.id), 0);
  const outstanding = totalInvoiced - totalPaid;

  const C = {
    page: { background:'#F9FAFB', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#111' },
    hdr:  { background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 },
    main: { maxWidth:960, margin:'0 auto', padding:'28px 24px' },
    card: { background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20, marginBottom:16 },
    stat: { background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:16 },
    th:   { fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', padding:'10px 12px', borderBottom:'1px solid #F3F4F6', textAlign:'left', fontWeight:600 },
    td:   { padding:'10px 12px', fontSize:12, borderBottom:'1px solid #F9FAFB', color:'#374151', verticalAlign:'middle' },
  };

  if (!token) return <div style={{...C.page, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:14}}>No portal token provided.</div>;
  if (loading) return <div style={{...C.page, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:14}}>Loading your account…</div>;
  if (error) return <div style={{...C.page, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{textAlign:'center', padding:40}}><div style={{fontSize:32, marginBottom:16}}>🔒</div><div style={{fontSize:16, color:'#374151', fontWeight:600}}>{error}</div><div style={{fontSize:13, color:'#9CA3AF', marginTop:8}}>Please contact Motsoeneng Bill for a new link.</div></div></div>;

  const client = access.clients;

  return (<>
    <Head><title>Client Portal — {client.full_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}`}</style>
    <div style={C.page}>

      <div style={C.hdr}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontWeight:900, fontSize:22, letterSpacing:'-0.04em'}}>M<span style={{color:'#8DC63F'}}>B</span></div>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>Client Portal</div>
            <div style={{fontSize:10, color:'#9CA3AF'}}>Motsoeneng Bill Attorneys</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13, fontWeight:600, color:'#111'}}>{client.full_name}</div>
          <div style={{fontSize:11, color:'#9CA3AF'}}>{client.email}</div>
        </div>
      </div>

      <div style={C.main}>
        <div style={{fontSize:20, fontWeight:700, marginBottom:4}}>Account Overview</div>
        <div style={{fontSize:13, color:'#9CA3AF', marginBottom:20}}>Your invoices, payments and trust account — as at {new Date().toLocaleDateString('en-ZA')}</div>

        {/* SUMMARY STATS */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20}}>
          {[{l:'Total Invoiced',v:fmtR(totalInvoiced),c:'#111'},{l:'Total Paid',v:fmtR(totalPaid),c:'#16A34A'},{l:'Balance Due',v:outstanding>0?fmtR(outstanding):'Paid in full',c:outstanding>0?'#DC2626':'#16A34A'}].map(({l,v,c})=>(<div key={l} style={C.stat}><div style={{fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8}}>{l}</div><div style={{fontSize:22, fontWeight:800, color:c}}>{v}</div></div>))}
        </div>

        {/* TRUST BALANCE */}
        {trustBalance!==0&&(<div style={{...C.card, borderLeft:'4px solid #3B82F6', marginBottom:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><div style={{fontSize:13, fontWeight:600}}>Trust Account Balance</div><div style={{fontSize:11, color:'#9CA3AF', marginTop:2}}>Funds held on your behalf</div></div>
            <div style={{fontSize:24, fontWeight:800, color:'#3B82F6'}}>{fmtR(trustBalance)}</div>
          </div>
        </div>)}

        {/* MATTERS */}
        {matters.length>0&&(<div style={C.card}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:12}}>Your Matters</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {matters.map(m=>(<div key={m.id} style={{background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:6, padding:'8px 14px'}}>
              <div style={{fontSize:12, fontWeight:600, color:'#6366F1', fontFamily:'monospace'}}>{m.id}</div>
              <div style={{fontSize:12, color:'#374151'}}>{m.name}</div>
              <div style={{fontSize:10, color:'#9CA3AF', marginTop:2}}>{m.status||'open'}</div>
            </div>))}
          </div>
        </div>)}

        {/* INVOICES */}
        <div style={C.card}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:12}}>Invoices ({invoices.length})</div>
          {!invoices.length?<div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:13}}>No invoices yet.</div>:
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Invoice','Date','Matter','Amount (incl. VAT)','Paid','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {invoices.map(inv=>{const p=paid(inv.id);const amt=(inv.total_units||0)*(inv.rate||150)*1.15;const bal=Math.max(0,amt-p);return(<tr key={inv.id}>
                <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#6366F1'}}>{inv.id}</td>
                <td style={{...C.td}}>{fdate(inv.created_at?.substring(0,10))}</td>
                <td style={{...C.td,fontSize:11,color:'#6B7280'}}>{inv.matter_name||inv.matter_id||'—'}</td>
                <td style={{...C.td,fontFamily:'monospace',fontWeight:600}}>{fmtR(amt)}</td>
                <td style={{...C.td,fontFamily:'monospace',color:p>0?'#16A34A':'#D1D5DB'}}>{p>0?fmtR(p):'—'}</td>
                <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#DC2626':'#16A34A'}}>{bal>0?fmtR(bal):'PAID ✓'}</td>
              </tr>);})}
            </tbody>
          </table>}
        </div>

        {/* TRUST LEDGER */}
        {trustTxns.length>0&&(<div style={C.card}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:12}}>Trust Account Transactions</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Date','Type','Reference','Description','Amount','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(()=>{let run=0;return trustTxns.sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{if(t.type==='receipt')run+=Number(t.amount);else run-=Number(t.amount);return(<tr key={t.id}><td style={C.td}>{fdate(t.date)}</td><td style={{...C.td,textTransform:'capitalize',fontWeight:500,color:t.type==='receipt'?'#16A34A':'#DC2626'}}>{t.type}</td><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#9CA3AF'}}>{t.receipt_no||t.reference||'—'}</td><td style={{...C.td,color:'#6B7280'}}>{t.narration||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:t.type==='receipt'?'#16A34A':'#DC2626',fontWeight:600}}>{fmtR(t.amount)}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:run>=0?'#16A34A':'#DC2626'}}>{fmtR(run)}</td></tr>);});})()}
            </tbody>
          </table>
        </div>)}

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#D1D5DB'}}>Motsoeneng Bill Attorneys · VAT Reg: 4100000000 · accounts@mb.co.za<br/>This portal is read-only. Contact us at 012 000 0000 for queries.</div>
      </div>
    </div>
  </>);
}
