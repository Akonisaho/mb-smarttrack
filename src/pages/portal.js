import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useFirmSettings } from '../lib/useFirmSettings';
import { generateInvoicePDF } from '../lib/generateInvoicePDF';

function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }


export default function ClientPortal() {
  const firm = useFirmSettings();
  const [step, setStep] = useState('email'); // email → otp → portal | request
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
  const [docs, setDocs] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docMsg, setDocMsg] = useState('');
  const fileInputRef = useRef(null);
  const [showServiceReq, setShowServiceReq] = useState(false);
  const [serviceForm, setServiceForm] = useState({serviceType:'',description:'',urgency:'normal'});
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqForm, setReqForm] = useState({fullName:'',email:'',phone:'',idNumber:'',serviceType:'',description:'',urgency:'normal'});
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSuccess, setReqSuccess] = useState(false);

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
    const [cRes, invRes, mRes, tRes, pRes, dRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', cid).single(),
      supabase.from('invoices').select('*').order('created_at', { ascending:false }),
      supabase.from('matters').select('id,name,client,client_id,status'),
      supabase.from('trust_transactions').select('*').eq('status','posted').order('date', { ascending:false }),
      supabase.from('invoice_payments').select('*'),
      supabase.from('client_documents').select('*').eq('client_id', cid).order('created_at', { ascending:false }),
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
    setDocs(dRes.data||[]);
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    if (file.size > 10 * 1024 * 1024) { setDocMsg('File too large — max 10 MB.'); return; }
    setUploadingDoc(true); setDocMsg('');
    const ext = file.name.split('.').pop();
    const path = `client-docs/${clientId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error: upErr } = await supabase.storage.from('client-documents').upload(path, file);
    if (upErr) { setDocMsg('Upload failed: ' + upErr.message); setUploadingDoc(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('client-documents').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('client_documents').insert({ client_id: clientId, name: file.name, path, url: publicUrl, size: file.size, uploaded_by: 'client' });
    setUploadingDoc(false);
    if (dbErr) { setDocMsg('Saved upload but metadata failed: ' + dbErr.message); return; }
    setDocMsg('Document uploaded successfully.');
    setTimeout(() => setDocMsg(''), 4000);
    const { data } = await supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending:false });
    setDocs(data||[]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:1,marginBottom:6}}>
            <img src="/logo.png" alt="MB" style={{height:48,width:'auto',objectFit:'contain',borderRadius:6}} onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend','<div style="height:28px;padding:0 6px;background:#8DC63F;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#0A0A0A">MB</div>');}}/>
            <span style={{fontWeight:900,fontSize:28,letterSpacing:'-0.04em'}}><span style={{color:'#111'}}>Smart</span><span style={{color:'#8DC63F'}}>Track</span></span>
          </div>
          <div style={{fontSize:13, color:'#9CA3AF'}}>{firm.firm_name} — Client Portal</div>
        </div>
        {children}
      </div>
    </div>
  );

  const SERVICE_TYPES = ['Conveyancing','Litigation','Family Law','Contract Review','Estate Planning','Labour Law','Corporate Law','Criminal Law','Immigration','General Consultation','Other'];

  if (step === 'request') return (<>
    <Head><title>Request Services — {firm.firm_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#F9FAFB}input:focus,select:focus,textarea:focus{border-color:#8DC63F!important;outline:1px solid rgba(141,198,63,0.4)!important}textarea{resize:vertical}`}</style>
    <div style={{...C.light,padding:'24px 16px'}}>
      <div style={{maxWidth:520,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontWeight:900,fontSize:24,letterSpacing:'-0.04em',marginBottom:4}}>{firm.firm_name||'MB SmartTrack'}</div>
          <div style={{fontSize:13,color:'#9CA3AF'}}>Request Legal Services</div>
        </div>
        {reqSuccess?(<div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,padding:32,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:12}}>✅</div>
          <div style={{fontSize:18,fontWeight:700,color:'#166534',marginBottom:8}}>Request Submitted!</div>
          <div style={{fontSize:14,color:'#555',marginBottom:20}}>Thank you. We have received your request and will be in contact with you shortly. A confirmation has been sent to your email.</div>
          <button style={{...C.btn,width:'auto',padding:'12px 28px'}} onClick={()=>{setStep('email');setReqSuccess(false);}}>Back to Login</button>
        </div>):(<div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:28}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>New Service Request</div>
          <div style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>Fill in your details and we'll get back to you as soon as possible.</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Full Name *</label><input style={C.inp} placeholder="Your full name" value={reqForm.fullName} onChange={e=>setReqForm(f=>({...f,fullName:e.target.value}))}/></div>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Email *</label><input style={C.inp} type="email" placeholder="your@email.com" value={reqForm.email} onChange={e=>setReqForm(f=>({...f,email:e.target.value}))}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Phone</label><input style={C.inp} placeholder="Phone number" value={reqForm.phone} onChange={e=>setReqForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>ID / Passport No.</label><input style={C.inp} placeholder="Optional" value={reqForm.idNumber} onChange={e=>setReqForm(f=>({...f,idNumber:e.target.value}))}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Service Type *</label><select style={{...C.inp,padding:'12px'}} value={reqForm.serviceType} onChange={e=>setReqForm(f=>({...f,serviceType:e.target.value}))}><option value="">— Select service —</option>{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Urgency</label><select style={{...C.inp,padding:'12px'}} value={reqForm.urgency} onChange={e=>setReqForm(f=>({...f,urgency:e.target.value}))}><option value="low">Low — no rush</option><option value="normal">Normal</option><option value="urgent">Urgent — time sensitive</option></select></div>
            </div>
            <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Brief Description *</label><textarea style={{...C.inp,minHeight:90}} placeholder="Please describe your legal matter briefly..." value={reqForm.description} onChange={e=>setReqForm(f=>({...f,description:e.target.value}))}/></div>
            {error&&<div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#DC2626'}}>{error}</div>}
            <button style={{...C.btn,opacity:reqSubmitting||!reqForm.fullName||!reqForm.email||!reqForm.serviceType||!reqForm.description?0.6:1}} disabled={reqSubmitting||!reqForm.fullName||!reqForm.email||!reqForm.serviceType||!reqForm.description} onClick={async()=>{
              setReqSubmitting(true); setError('');
              const res=await fetch('/api/client-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reqForm)});
              const data=await res.json();
              setReqSubmitting(false);
              if(!res.ok){setError(data.error||'Something went wrong. Please try again.');return;}
              setReqSuccess(true);
            }}>{reqSubmitting?'Submitting…':'Submit Request'}</button>
          </div>
          <div style={{textAlign:'center',marginTop:16}}><button style={{background:'none',border:'none',color:'#9CA3AF',fontSize:12,cursor:'pointer'}} onClick={()=>setStep('email')}>← Back to login</button></div>
        </div>)}
      </div>
    </div>
  </>);

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
        <div style={{borderTop:'1px solid #F3F4F6',marginTop:20,paddingTop:16,textAlign:'center'}}>
          <div style={{fontSize:12,color:'#9CA3AF',marginBottom:8}}>Not yet a client?</div>
          <button style={{background:'transparent',border:'1px solid #D1D5DB',color:'#374151',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600,width:'100%'}} onClick={()=>setStep('request')}>Request Legal Services →</button>
        </div>
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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>My Account</div>
            <div style={{fontSize:13,color:'#9CA3AF'}}>As at {new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
          <button style={{background:'#8DC63F',border:'none',color:'#0A0A0A',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:700}} onClick={()=>setShowServiceReq(true)}>+ Request a Service</button>
        </div>

        {/* SERVICE REQUEST MODAL */}
        {showServiceReq&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowServiceReq(false)}>
          <div style={{background:'#fff',borderRadius:12,padding:28,width:'100%',maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#111',marginBottom:4}}>Request a Service</div>
            <div style={{fontSize:13,color:'#9CA3AF',marginBottom:20}}>Tell us what you need and we'll get back to you.</div>
            {submittingReq?<div style={{textAlign:'center',padding:20,color:'#8DC63F',fontWeight:700}}>✓ Request submitted! We'll be in touch shortly.</div>:(<>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Service Type *</label><select style={{...C.inp,padding:'12px'}} value={serviceForm.serviceType} onChange={e=>setServiceForm(f=>({...f,serviceType:e.target.value}))}><option value="">— Select service type —</option>{['Conveyancing','Litigation','Family Law','Contract Review','Estate Planning','Labour Law','Corporate Law','Criminal Law','Immigration','General Consultation','Other'].map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Urgency</label><select style={{...C.inp,padding:'12px'}} value={serviceForm.urgency} onChange={e=>setServiceForm(f=>({...f,urgency:e.target.value}))}><option value="low">Low — no rush</option><option value="normal">Normal</option><option value="urgent">Urgent — time sensitive</option></select></div>
                <div><label style={{fontSize:11,color:'#666',display:'block',marginBottom:4}}>Description *</label><textarea style={{...C.inp,minHeight:80,resize:'vertical'}} placeholder="Describe what you need help with..." value={serviceForm.description} onChange={e=>setServiceForm(f=>({...f,description:e.target.value}))}/></div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:20}}>
                <button style={{flex:1,background:'transparent',border:'1px solid #D1D5DB',color:'#374151',padding:'12px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600}} onClick={()=>setShowServiceReq(false)}>Cancel</button>
                <button style={{flex:2,background:'#8DC63F',border:'none',color:'#0A0A0A',padding:'12px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:700,opacity:!serviceForm.serviceType||!serviceForm.description?0.6:1}} disabled={!serviceForm.serviceType||!serviceForm.description} onClick={async()=>{
                  setSubmittingReq(true);
                  const res=await fetch('/api/portal-service-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,serviceType:serviceForm.serviceType,description:serviceForm.description,urgency:serviceForm.urgency})});
                  setSubmittingReq(false);
                  if(res.ok){setServiceForm({serviceType:'',description:'',urgency:'normal'});setTimeout(()=>{setShowServiceReq(false);setSubmittingReq(false);},2000);}
                }}>Submit Request</button>
              </div>
            </>)}
          </div>
        </div>)}

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

        {/* PAYMENT INSTRUCTIONS */}
        {outstanding>0&&(firm.bank_name||firm.bank_account)&&(<div style={{...C.card,borderLeft:'4px solid #8DC63F',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:'#111'}}>⬇ Payment Instructions</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
            {[
              firm.bank_name&&['Bank',firm.bank_name],
              firm.bank_account&&['Account Number',firm.bank_account],
              firm.bank_branch&&['Branch Code',firm.bank_branch],
              ['Reference',`Your name / ${client?.full_name}`],
            ].filter(Boolean).map(([label,value])=>(<div key={label} style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:6,padding:'10px 14px'}}>
              <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{label}</div>
              <div style={{fontSize:13,fontWeight:700,color:'#111'}}>{value}</div>
            </div>))}
          </div>
          <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:11,color:'#16A34A',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Total Amount Due</div><div style={{fontSize:22,fontWeight:800,color:'#16A34A'}}>{fmtR(outstanding)}</div></div>
            <div style={{fontSize:11,color:'#9CA3AF',textAlign:'right'}}>Incl. VAT 15%<br/>Please use your invoice number as reference</div>
          </div>
          {firm.email&&<div style={{marginTop:10,fontSize:12,color:'#9CA3AF'}}>Questions about your invoice? Email us at <a href={`mailto:${firm.email}`} style={{color:'#8DC63F'}}>{firm.email}</a></div>}
        </div>)}

        {/* INVOICES */}
        <div style={C.card}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Invoices ({invoices.length})</div>
          {!invoices.length?<div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:13}}>No invoices yet.</div>:
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:680}}>
            <thead><tr>{['Invoice','Date','Matter','Amount (incl. VAT)','Paid','Balance',''].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>{invoices.map(inv=>{const p=paid(inv.id);const amt=(inv.total_units||0)*(inv.rate||150)*1.15;const bal=Math.max(0,amt-p);return(<tr key={inv.id}>
              <td style={{...C.td,fontFamily:'monospace',color:'#6366F1',fontSize:11}}>{inv.id}</td>
              <td style={C.td}>{fdate(inv.created_at?.substring(0,10))}</td>
              <td style={{...C.td,color:'#6B7280'}}>{inv.matter_name||inv.matter_id||'—'}</td>
              <td style={{...C.td,fontFamily:'monospace',fontWeight:600}}>{fmtR(amt)}</td>
              <td style={{...C.td,fontFamily:'monospace',color:p>0?'#16A34A':'#D1D5DB'}}>{p>0?fmtR(p):'—'}</td>
              <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#DC2626':'#16A34A'}}>{bal>0?fmtR(bal):'PAID ✓'}</td>
              <td style={C.td}><button style={{background:'#F9FAFB',border:'1px solid #E5E7EB',color:'#374151',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:600,whiteSpace:'nowrap'}} onClick={()=>generateInvoicePDF(inv,firm,client?.full_name)}>⬇ PDF</button></td>
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

        {/* DOCUMENTS */}
        <div style={C.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600}}>My Documents ({docs.length})</div>
            <label style={{background:'#8DC63F',border:'none',color:'#0A0A0A',padding:'7px 16px',borderRadius:7,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
              {uploadingDoc ? 'Uploading…' : '+ Upload Document'}
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt" style={{display:'none'}} disabled={uploadingDoc} onChange={handleDocUpload}/>
            </label>
          </div>
          {docMsg && <div style={{background: docMsg.includes('failed')||docMsg.includes('large') ? '#FEF2F2' : '#F0FDF4', border:`1px solid ${docMsg.includes('failed')||docMsg.includes('large')?'#FECACA':'#BBF7D0'}`, borderRadius:6, padding:'9px 14px', fontSize:12, color: docMsg.includes('failed')||docMsg.includes('large')?'#DC2626':'#16A34A', marginBottom:12}}>{docMsg}</div>}
          <div style={{fontSize:11,color:'#9CA3AF',marginBottom:10}}>Accepted: PDF, Word, Excel, Images (max 10 MB). Visible to your legal team.</div>
          {docs.length===0 ? <div style={{textAlign:'center',padding:20,color:'#9CA3AF',fontSize:13}}>No documents uploaded yet.</div> :
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {docs.map(d => {
              const ext = (d.name||'').split('.').pop().toLowerCase();
              const icon = ['pdf'].includes(ext)?'📄':['doc','docx'].includes(ext)?'📝':['xls','xlsx'].includes(ext)?'📊':['jpg','jpeg','png'].includes(ext)?'🖼️':'📎';
              const size = d.size ? (d.size > 1024*1024 ? (d.size/1024/1024).toFixed(1)+' MB' : Math.round(d.size/1024)+' KB') : '';
              return (
                <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,padding:'10px 14px'}}>
                  <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                    <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{size}{d.created_at ? ` · ${new Date(d.created_at).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'})}` : ''}{d.uploaded_by==='firm'?' · From your legal team':''}</div>
                  </div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" style={{background:'#F3F4F6',border:'1px solid #E5E7EB',color:'#374151',padding:'6px 14px',borderRadius:6,fontSize:12,textDecoration:'none',fontFamily:'inherit',fontWeight:600,whiteSpace:'nowrap'}}>⬇ Download</a>
                </div>
              );
            })}
          </div>}
        </div>

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#D1D5DB'}}>{firm.firm_name}{firm.vat_number?` · VAT: ${firm.vat_number}`:''}{firm.email?` · ${firm.email}`:''}<br/>This portal is read-only except for document uploads. Contact us for queries.</div>
      </div>
    </div>
  </>);
}
