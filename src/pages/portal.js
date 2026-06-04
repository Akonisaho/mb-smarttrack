import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useFirmSettings } from '../lib/useFirmSettings';

function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

export default function ClientPortal() {
  const firm = useFirmSettings();
  const [step, setStep] = useState('email'); // email → otp → portal
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [clientId, setClientId] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [trustTxns, setTrustTxns] = useState([]);
  const [matters, setMatters] = useState([]);
  const [payments, setPayments] = useState([]);
  const otpRefs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];
  const [otpDigits, setOtpDigits] = useState(['','','','','','']);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function sendOtp() {
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/portal-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.toLowerCase().trim() }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Failed to send code.'); return; }
    setMsg('A 6-digit code has been sent to your email. Check your inbox.');
    setStep('otp');
  }

  async function verifyOtp() {
    const code = otpDigits.join('');
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/portal-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.toLowerCase().trim(), action:'verify', otp: code }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Invalid code.'); return; }
    setClientId(data.clientId);
    loadPortal(data.clientId);
    setStep('portal');
  }

  function handleOtpInput(i, val) {
    const v = val.replace(/\D/,'');
    const next = [...otpDigits]; next[i] = v;
    setOtpDigits(next);
    if (v && i < 5) otpRefs[i+1].current?.focus();
    if (!v && i > 0) otpRefs[i-1].current?.focus();
  }

  async function loadPortal(cid) {
    const [cRes, invRes, mRes, tRes, pRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', cid).single(),
      supabase.from('invoices').select('*').order('created_at', { ascending:false }),
      supabase.from('matters').select('id,name,client,client_id,status'),
      supabase.from('trust_transactions').select('*').eq('status','posted').order('date', { ascending:false }),
      supabase.from('invoice_payments').select('*'),
    ]);
    const c = cRes.data;
    setClient(c);
    const clientMatters = (mRes.data||[]).filter(m => m.client_id === cid || m.client === c?.full_name);
    const clientMatterIds = clientMatters.map(m => m.id);
    const clientInvs = (invRes.data||[]).filter(i => i.client_id === cid || i.client === c?.full_name);
    setMatters(clientMatters);
    setInvoices(clientInvs);
    setTrustTxns((tRes.data||[]).filter(t => clientMatterIds.includes(t.matter_id)));
    setPayments(pRes.data||[]);
  }

  const paid = invId => payments.filter(p => p.invoice_id === invId).reduce((s,p) => s+Number(p.amount), 0);
  const trustBalance = trustTxns.reduce((s,t) => t.type==='receipt'?s+Number(t.amount):s-Number(t.amount), 0);
  const totalInvoiced = invoices.reduce((s,i) => s+(i.total_units||0)*(i.rate||150)*1.15, 0);
  const totalPaid = invoices.reduce((s,i) => s+paid(i.id), 0);
  const outstanding = Math.max(0, totalInvoiced - totalPaid);

  const C = {
    light: { background:'#F9FAFB', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#111' },
    hdr:   { background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 },
    main:  { maxWidth:960, margin:'0 auto', padding:'28px 24px' },
    card:  { background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20, marginBottom:16 },
    th:    { fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', padding:'10px 12px', borderBottom:'1px solid #F3F4F6', textAlign:'left', fontWeight:600 },
    td:    { padding:'10px 12px', fontSize:12, borderBottom:'1px solid #F9FAFB', color:'#374151', verticalAlign:'middle' },
    inp:   { border:'1px solid #D1D5DB', borderRadius:8, padding:'12px 16px', fontSize:14, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box', outline:'none', background:'#fff' },
    btn:   { background:'#8DC63F', border:'none', color:'#0A0A0A', padding:'13px', borderRadius:8, cursor:'pointer', fontSize:14, fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight:700, width:'100%' },
  };

  const loginBox = (children) => (
    <div style={{...C.light, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{width:'100%', maxWidth:400, padding:20}}>
        <div style={{textAlign:'center', marginBottom:28}}>
          <div style={{fontWeight:900, fontSize:28, letterSpacing:'-0.04em', marginBottom:8}}>Smart<span style={{color:'#8DC63F'}}>Track</span></div>
          <div style={{fontSize:13, color:'#9CA3AF'}}>{firm.firm_name} — Client Portal</div>
        </div>
        {children}
      </div>
    </div>
  );

  if (step === 'email') return (<>
    <Head><title>Client Portal — {firm.firm_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#F9FAFB}input:focus{border-color:#8DC63F!important;outline:1px solid rgba(141,198,63,0.4)!important}`}</style>
    {loginBox(<>
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:28}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>Sign in to your account</div>
        <div style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>Enter your email and we'll send you a one-time login code.</div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <input style={C.inp} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendOtp()}/>
          {error&&<div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#DC2626'}}>{error}</div>}
          <button style={{...C.btn,opacity:loading?.6:1}} disabled={loading} onClick={sendOtp}>{loading?'Sending code…':'Send Login Code'}</button>
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:11,color:'#D1D5DB'}}>A 6-digit code will be emailed to you. Valid for 10 minutes.</div>
      </div>
    </>)}
  </>);

  if (step === 'otp') return (<>
    <Head><title>Enter Code — {firm.firm_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#F9FAFB}`}</style>
    {loginBox(<>
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:28}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>Check your email</div>
        <div style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>We sent a 6-digit code to <strong>{email}</strong>. Enter it below.</div>
        <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:20}}>
          {otpDigits.map((d,i)=>(
            <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={d}
              style={{width:46,height:54,textAlign:'center',fontSize:22,fontWeight:700,border:'2px solid #E5E7EB',borderRadius:8,outline:'none',fontFamily:'monospace',background:'#fff',borderColor:d?'#8DC63F':'#E5E7EB'}}
              onChange={e=>handleOtpInput(i,e.target.value)}
              onKeyDown={e=>{ if(e.key==='Backspace'&&!d&&i>0) otpRefs[i-1].current?.focus(); if(e.key==='Enter') verifyOtp(); }}
            />
          ))}
        </div>
        {msg&&<div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#16A34A',marginBottom:12}}>{msg}</div>}
        {error&&<div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#DC2626',marginBottom:12}}>{error}</div>}
        <button style={{...C.btn,opacity:loading?.6:1}} disabled={loading} onClick={verifyOtp}>{loading?'Verifying…':'Verify Code'}</button>
        <div style={{textAlign:'center',marginTop:12}}>
          <button style={{background:'none',border:'none',color:'#9CA3AF',fontSize:12,cursor:'pointer'}} onClick={()=>{setStep('email');setOtpDigits(['','','','','','']);setError('');}}>← Use a different email</button>
        </div>
        <div style={{textAlign:'center',marginTop:8}}>
          <button style={{background:'none',border:'none',color:'#8DC63F',fontSize:12,cursor:'pointer',textDecoration:'underline'}} onClick={sendOtp}>Resend code</button>
        </div>
      </div>
    </>)}
  </>);

  return (<>
    <Head><title>My Account — {firm.firm_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#F9FAFB}`}</style>
    <div style={C.light}>
      <div style={C.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontWeight:900,fontSize:20,letterSpacing:'-0.04em'}}>Smart<span style={{color:'#8DC63F'}}>Track</span></div>
          <div style={{height:20,width:1,background:'#E5E7EB'}}/>
          <div style={{fontSize:12,color:'#9CA3AF'}}>{firm.firm_name}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13,fontWeight:600}}>{client?.full_name}</div>
          <div style={{fontSize:11,color:'#9CA3AF'}}>{client?.email}</div>
        </div>
      </div>
      <div style={C.main}>
        <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>My Account</div>
        <div style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>As at {new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'long',year:'numeric'})}</div>

        {/* SUMMARY */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          {[{l:'Total Invoiced',v:fmtR(totalInvoiced),c:'#111'},{l:'Total Paid',v:fmtR(totalPaid),c:'#16A34A'},{l:'Balance Due',v:outstanding>0?fmtR(outstanding):'Paid in full',c:outstanding>0?'#DC2626':'#16A34A'}].map(({l,v,c})=>(<div key={l} style={C.card}><div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>{l}</div><div style={{fontSize:24,fontWeight:800,color:c}}>{v}</div></div>))}
        </div>

        {/* TRUST */}
        {trustBalance!==0&&(<div style={{...C.card,borderLeft:'4px solid #3B82F6',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:14,fontWeight:600}}>Trust Account Balance</div><div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>Funds held on your behalf</div></div>
            <div style={{fontSize:26,fontWeight:800,color:'#3B82F6'}}>{fmtR(trustBalance)}</div>
          </div>
        </div>)}

        {/* MATTERS */}
        {matters.length>0&&(<div style={C.card}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Your Matters ({matters.length})</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {matters.map(m=>(<div key={m.id} style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,padding:'10px 16px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#6366F1',fontFamily:'monospace'}}>{m.id}</div>
              <div style={{fontSize:13,fontWeight:500,color:'#111',marginTop:2}}>{m.name}</div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2,textTransform:'capitalize'}}>{m.status||'open'}</div>
            </div>))}
          </div>
        </div>)}

        {/* INVOICES */}
        <div style={C.card}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Invoices ({invoices.length})</div>
          {!invoices.length?<div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:13}}>No invoices yet.</div>:
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
            <thead><tr>{['Invoice','Date','Matter','Amount (incl. VAT)','Paid','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>{invoices.map(inv=>{const p=paid(inv.id);const amt=(inv.total_units||0)*(inv.rate||150)*1.15;const bal=Math.max(0,amt-p);return(<tr key={inv.id}>
              <td style={{...C.td,fontFamily:'monospace',color:'#6366F1',fontSize:11}}>{inv.id}</td>
              <td style={C.td}>{fdate(inv.created_at?.substring(0,10))}</td>
              <td style={{...C.td,color:'#6B7280'}}>{inv.matter_name||inv.matter_id||'—'}</td>
              <td style={{...C.td,fontFamily:'monospace',fontWeight:600}}>{fmtR(amt)}</td>
              <td style={{...C.td,fontFamily:'monospace',color:p>0?'#16A34A':'#D1D5DB'}}>{p>0?fmtR(p):'—'}</td>
              <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#DC2626':'#16A34A'}}>{bal>0?fmtR(bal):'PAID ✓'}</td>
            </tr>);})}
            </tbody>
          </table></div>}
        </div>

        {/* TRUST LEDGER */}
        {trustTxns.length>0&&(<div style={C.card}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Trust Account Transactions</div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
            <thead><tr>{['Date','Type','Reference','Description','Amount','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>{(()=>{let run=0;return trustTxns.sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{if(t.type==='receipt')run+=Number(t.amount);else run-=Number(t.amount);return(<tr key={t.id}><td style={C.td}>{fdate(t.date)}</td><td style={{...C.td,textTransform:'capitalize',fontWeight:500,color:t.type==='receipt'?'#16A34A':'#DC2626'}}>{t.type}</td><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#9CA3AF'}}>{t.receipt_no||t.reference||'—'}</td><td style={{...C.td,color:'#6B7280'}}>{t.narration||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:t.type==='receipt'?'#16A34A':'#DC2626',fontWeight:600}}>{fmtR(t.amount)}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:run>=0?'#16A34A':'#DC2626'}}>{fmtR(run)}</td></tr>);});})()}</tbody>
          </table></div>
        </div>)}

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#D1D5DB'}}>{firm.firm_name}{firm.vat_number?` · VAT: ${firm.vat_number}`:''}{firm.email?` · ${firm.email}`:''}<br/>This portal is read-only. Contact us for queries.</div>
      </div>
    </div>
  </>);
}
