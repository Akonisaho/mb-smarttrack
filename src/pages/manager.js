import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, fetchAllProfiles, fetchManagerSummary, fetchMatters, fetchInvoices, fetchMonthActivities, saveInvoice } from '../lib/supabase';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function calcUnits(s){ return Math.max(1,Math.ceil((Number(s)||0)/360)); }
function pct(a,b){ return b>0?Math.round((a/b)*100):0; }
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d;} }

export default function Manager() {
  const router = useRouter();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selDate, setSelDate]       = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary]       = useState([]);
  const [profiles, setProfiles]     = useState([]);
  const [matters, setMatters]       = useState([]);
  const [invoices, setInvoices]     = useState([]);
  const [selAtty, setSelAtty]       = useState('all');
  const [clock, setClock]           = useState('');
  const [rate, setRate]             = useState(150);

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if(!p || p.role !== 'manager'){ router.replace('/'); return; }
      setProfile(p);
      setLoading(false);
    });
  },[]);

  const load = useCallback(async()=>{
    const [sumRes, profRes, matRes, invRes] = await Promise.all([
      fetchManagerSummary(selDate),
      fetchAllProfiles(),
      fetchMatters(),
      fetchInvoices(),
    ]);
    if(sumRes.summary)  setSummary(sumRes.summary);
    if(profRes.profiles) setProfiles(profRes.profiles);
    if(matRes.matters)  setMatters(matRes.matters);
    if(invRes.invoices) setInvoices(invRes.invoices);
  },[selDate]);

  useEffect(()=>{ if(!loading) load(); },[loading, load]);

  // Firm-wide totals for today
  const filtered = selAtty==='all' ? summary : summary.filter(s=>s.user_id===selAtty);
  const firmTotalSec    = filtered.reduce((s,a)=>s+(a.total_seconds||0),0);
  const firmBillSec     = filtered.reduce((s,a)=>s+(a.billable_seconds||0),0);
  const firmBillUnits   = filtered.reduce((s,a)=>s+(a.billable_units||0),0);
  const firmEstValue    = firmBillUnits * rate;

  // Per-attorney rollup
  const byAtty = profiles.map(p=>{
    const rows = filtered.filter(s=>s.user_id===p.id);
    return {
      ...p,
      total_sec:   rows.reduce((s,r)=>s+(r.total_seconds||0),0),
      bill_sec:    rows.reduce((s,r)=>s+(r.billable_seconds||0),0),
      bill_units:  rows.reduce((s,r)=>s+(r.billable_units||0),0),
      sessions:    rows.reduce((s,r)=>s+(r.total_sessions||0),0),
    };
  }).sort((a,b)=>b.bill_units-a.bill_units);

  // Top matters across firm
  const topMatters = matters.map(m=>{
    const mInvs = invoices.filter(i=>i.matter_id===m.id);
    const totalAmt = mInvs.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0);
    return {...m, invoiceCount: mInvs.length, totalAmount: totalAmt};
  }).sort((a,b)=>b.totalAmount-a.totalAmount).slice(0,10);

  const C = {
    page:  {background:'#0A0A0A',minHeight:'100vh',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#F0F0F0'},
    hdr:   {background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    main:  {maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card:  {background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat:  (acc)=>({background:acc?'rgba(108,192,74,0.05)':'#111',border:`1px solid ${acc?'rgba(108,192,74,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    sel:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:    {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:    {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    btn:   {background:'transparent',border:'1px solid #252525',color:'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'},
    pill:  {display:'flex',alignItems:'center',gap:6,background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#6CC04A'},
    dot:   {width:7,height:7,borderRadius:'50%',background:'#6CC04A',boxShadow:'0 0 6px rgba(108,192,74,0.8)'},
    mark:  {background:'#000',border:'1px solid #252525',borderRadius:7,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,letterSpacing:'-0.06em'},
  };

  if(loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#444'}}>Loading...</div>;

  return(
    <>
      <Head><title>MB SmartTrack — Manager</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(108,192,74,0.025)}select option{background:#1A1A1A;color:#F0F0F0}input[type=date]{color-scheme:dark}`}</style>
      <div style={C.page}>
        {/* Header */}
        <div style={C.hdr}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={C.mark}>M<span style={{color:'#6CC04A'}}>B</span></div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Manager</div>
              <div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>{profile?.full_name}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button style={C.btn} onClick={()=>router.push('/')}>← Attorney View</button>
            <div style={C.pill}><div style={C.dot}/>{clock}</div>
          </div>
        </div>

        <div style={C.main}>
          {/* Controls */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Overview</div>
              <div style={{fontSize:11,color:'#444'}}>{fdate(selDate)} · {profiles.length} attorneys</div>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <input type="date" style={{...C.sel,padding:'5px 10px'}} value={selDate} onChange={e=>setSelDate(e.target.value)}/>
              <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}>
                <option value="all">All attorneys</option>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <select style={C.sel} value={rate} onChange={e=>setRate(parseInt(e.target.value)||150)}>
                <option value={150}>R150/unit</option>
                <option value={200}>R200/unit</option>
                <option value={250}>R250/unit</option>
                <option value={300}>R300/unit</option>
              </select>
            </div>
          </div>

          {/* Firm-wide stat cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            {[
              {l:'Total Time',     v:toHm(firmTotalSec),            s:`${profiles.length} attorneys`,    acc:false},
              {l:'Billable Time',  v:toHm(firmBillSec),             s:`${pct(firmBillSec,firmTotalSec)}% utilisation`, acc:true},
              {l:'Billing Units',  v:firmBillUnits,                  s:'across firm today',               acc:false},
              {l:'Est. Revenue',   v:`R${firmEstValue.toLocaleString()}`, s:`excl. VAT · @ R${rate}/unit`, acc:false},
            ].map(({l,v,s,acc})=>(
              <div key={l} style={C.stat(acc)}>
                <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div>
                <div style={{fontSize:22,fontWeight:800,letterSpacing:'-0.04em',marginBottom:4,color:acc?'#6CC04A':'#F0F0F0'}}>{v}</div>
                <div style={{fontSize:10,color:'#444'}}>{s}</div>
              </div>
            ))}
          </div>

          {/* Attorney leaderboard */}
          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Billing Leaderboard — {fdate(selDate)}</div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['#','Attorney','Total Time','Billable Time','Utilisation','Units','Est. Value (excl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!byAtty.filter(a=>a.sessions>0).length&&(
                  <tr><td colSpan={7} style={{padding:'30px',textAlign:'center',color:'#333',fontSize:13}}>No activity data for this date. Attorneys may not have started tracking yet.</td></tr>
                )}
                {byAtty.filter(a=>a.sessions>0).map((a,i)=>{
                  const barW = pct(a.bill_sec, a.total_sec);
                  const val  = a.bill_units * rate;
                  return(
                    <tr key={a.id}>
                      <td style={{...C.td,color:'#444',fontWeight:600,width:32}}>{i+1}</td>
                      <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.total_sec)}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{toHm(a.bill_sec)}</td>
                      <td style={C.td}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{background:'#1A1A1A',borderRadius:3,height:6,width:80,flexShrink:0}}>
                            <div style={{background:'#6CC04A',borderRadius:3,height:6,width:`${barW}%`}}/>
                          </div>
                          <span style={{fontSize:11,color:'#888',fontFamily:'monospace'}}>{barW}%</span>
                        </div>
                      </td>
                      <td style={{...C.td,fontFamily:'monospace',color:a.bill_units>0?'#6CC04A':'#444',fontWeight:600}}>{a.bill_units||'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:val>0?'#6CC04A':'#444'}}>{val>0?`R${val.toLocaleString()}`:'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Top matters / invoices */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Top Matters by Revenue</div>
              {!topMatters.length?(
                <div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No matters yet</div>
              ):(
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Matter ID','Client','Invoices','Total Billed'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {topMatters.map(m=>(
                      <tr key={m.id}>
                        <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td>
                        <td style={{...C.td,color:'#C8C8C8'}}>{m.client}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#777',textAlign:'center'}}>{m.invoiceCount}</td>
                        <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:m.totalAmount>0?'#6CC04A':'#444'}}>{m.totalAmount>0?`R${m.totalAmount.toLocaleString()}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent Invoices — All Attorneys</div>
              {!invoices.length?(
                <div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No invoices yet</div>
              ):(
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Invoice','Client / Matter','Period','Total (incl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {invoices.slice(0,8).map(inv=>(
                      <tr key={inv.id}>
                        <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td>
                        <td style={C.td}><div style={{color:'#C8C8C8',fontSize:11}}>{inv.client}</div><div style={{color:'#555',fontSize:10}}>{inv.matter_name}</div></td>
                        <td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td>
                        <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#6CC04A'}}>R{Math.round((inv.total_units||0)*(inv.rate||150)*1.15).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={{marginTop:14,textAlign:'center',fontSize:11,color:'#252525'}}>
            MB SmartTrack Manager View · Billing data only · Window titles and activity details are private to each attorney
          </div>
        </div>
      </div>
    </>
  );
}
