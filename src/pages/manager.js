import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchManagerSummary, fetchMatters, fetchInvoices } from '../lib/supabase';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function pct(a,b){ return b>0?Math.round((a/b)*100):0; }
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d;} }
function fmonth(m){ try{return new Date(m+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'});}catch{return m;} }

function BarChart({data,height=120}){
  if(!data||!data.length) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:12}}>No data</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height,paddingBottom:20}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',height:'100%',justifyContent:'flex-end'}}>
          <div style={{fontSize:9,color:d.color||'#6CC04A',fontWeight:600,marginBottom:2}}>{d.label2||''}</div>
          <div style={{width:'100%',background:d.color||'#6CC04A',borderRadius:'3px 3px 0 0',height:`${Math.max((d.value/max)*80,2)}%`,opacity:0.85}}/>
          <div style={{fontSize:9,color:'#555',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',textAlign:'center',marginTop:4,whiteSpace:'nowrap'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Manager() {
  const router = useRouter();
  const [profile,setProfile]     = useState(null);
  const [loading,setLoading]     = useState(true);
  const [tab,setTab]             = useState('overview');
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selDate,setSelDate]     = useState(todayStr);
  const [summary,setSummary]     = useState([]);
  const [profiles,setProfiles]   = useState([]);
  const [invoices,setInvoices]   = useState([]);
  const [allTime,setAllTime]     = useState([]);
  const [selAtty,setSelAtty]     = useState('all');
  const [clock,setClock]         = useState('');
  const [rate,setRate]           = useState(150);
  // History
  const [histYear,setHistYear]   = useState(new Date().getFullYear());
  const [histData,setHistData]   = useState([]);
  const [selMonth,setSelMonth]   = useState(null);
  const [monthActs,setMonthActs] = useState([]);

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      const isManager = p?.role==='manager'||data.session.user.email==='livhuwaningwn@gmail.com';
      if(!isManager){ router.replace('/'); return; }
      setProfile(p||{full_name:data.session.user.email,role:'manager'});
      setLoading(false);
    });
  },[]);

  const load = useCallback(async()=>{
    const [sumRes,profRes,invRes] = await Promise.all([
      fetchManagerSummary(selDate),
      fetchAllProfiles(),
      fetchInvoices(null),
    ]);
    if(sumRes.summary)   setSummary(sumRes.summary);
    if(sumRes.allTime)   setAllTime(sumRes.allTime);
    if(profRes.profiles) setProfiles(profRes.profiles);
    if(invRes.invoices)  setInvoices(invRes.invoices||[]);
  },[selDate]);

  useEffect(()=>{ if(!loading){ load(); const t=setInterval(load,30000); return()=>clearInterval(t); } },[loading,load]);

  // Load history for selected year
  useEffect(()=>{
    if(tab!=='history') return;
    const fetchHist = async()=>{
      const { data } = await supabase.from('activities')
        .select('user_id, date, duration_seconds, is_billable, billing_units')
        .neq('agent_id','demo')
        .gte('date',`${histYear}-01-01`).lte('date',`${histYear}-12-31`);
      // Group by month
      const months = {};
      for(let m=1;m<=12;m++){
        const key=`${histYear}-${String(m).padStart(2,'0')}`;
        months[key]={month:key,sessions:0,total_seconds:0,billable_seconds:0,billable_units:0};
      }
      (data||[]).forEach(a=>{
        const key=a.date.substring(0,7);
        if(!months[key]) return;
        months[key].sessions++;
        months[key].total_seconds+=a.duration_seconds||0;
        months[key].billable_seconds+=a.is_billable?(a.duration_seconds||0):0;
        months[key].billable_units+=a.is_billable?(a.billing_units||0):0;
      });
      setHistData(Object.values(months));
    };
    fetchHist();
  },[tab,histYear]);

  // Load month detail
  const loadMonth = async(month, attyId)=>{
    setSelMonth(month);
    let q = supabase.from('activities').select('*, profiles(full_name)')
      .neq('agent_id','demo')
      .gte('date',`${month}-01`).lte('date',`${month}-31`)
      .order('start_time',{ascending:true});
    if(attyId) q = q.eq('user_id',attyId);
    const {data} = await q;
    setMonthActs(data||[]);
  };

  // Derived stats
  const filtered = selAtty==='all' ? summary : summary.filter(s=>s.user_id===selAtty);
  const filteredAllTime = selAtty==='all' ? allTime : allTime.filter(a=>a.user_id===selAtty);

  // All-time totals
  const firmTotalSec   = filteredAllTime.reduce((s,a)=>s+(a.duration_seconds||0),0);
  const firmBillSec    = filteredAllTime.filter(a=>a.is_billable).reduce((s,a)=>s+(a.duration_seconds||0),0);
  const firmAllUnits   = filteredAllTime.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);

  // Billed vs unbilled
  const filtInvoices   = selAtty==='all' ? invoices : invoices.filter(i=>i.user_id===selAtty);
  const billedUnits    = filtInvoices.reduce((s,i)=>s+(i.total_units||0),0);
  const billedRevenue  = filtInvoices.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0);
  const unbilledUnits  = Math.max(0, firmAllUnits - billedUnits);
  const unbilledRev    = unbilledUnits * rate;

  // Per-attorney
  const byAtty = profiles.map(p=>{
    const todayRows  = filtered.filter(s=>s.user_id===p.id);
    const allTimeP   = allTime.filter(a=>a.user_id===p.id);
    const attyInvs   = invoices.filter(i=>i.user_id===p.id);
    const billedU    = attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
    const allUnits   = allTimeP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);
    return {
      ...p,
      total_sec:     allTimeP.reduce((s,a)=>s+(a.duration_seconds||0),0),
      bill_sec:      allTimeP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.duration_seconds||0),0),
      all_units:     allUnits,
      billed_units:  billedU,
      unbilled_units:Math.max(0,allUnits-billedU),
      today_sec:     todayRows.reduce((s,r)=>s+(r.total_seconds||0),0),
      today_bill_u:  todayRows.reduce((s,r)=>s+(r.billable_units||0),0),
      invoiceCount:  attyInvs.length,
    };
  }).sort((a,b)=>b.all_units-a.all_units);

  // Top matters from invoices
  const matterMap={};
  filtInvoices.forEach(inv=>{
    const key=inv.matter_id||inv.matter_name||'Unknown';
    if(!matterMap[key]) matterMap[key]={id:key,name:inv.matter_name||key,client:inv.client||'',invoiceCount:0,billedAmt:0};
    matterMap[key].invoiceCount++;
    matterMap[key].billedAmt+=(inv.total_units||0)*(inv.rate||150);
  });
  const topMatters=Object.values(matterMap).sort((a,b)=>b.billedAmt-a.billedAmt).slice(0,10);

  // Month bar chart data
  const monthBars = histData.filter(m=>m.sessions>0).map(m=>({
    label: new Date(m.month+'-01T12:00:00').toLocaleString('en-ZA',{month:'short'}),
    label2: `${m.billable_units}u`,
    value: m.billable_units,
    color: m.billable_units>0?'#6CC04A':'#2E4A6E'
  }));

  const C={
    page:  {background:'#0A0A0A',minHeight:'100vh',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#F0F0F0'},
    hdr:   {background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    main:  {maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card:  {background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat:  (acc,warn)=>({background:acc?'rgba(108,192,74,0.05)':warn?'rgba(234,179,8,0.05)':'#111',border:`1px solid ${acc?'rgba(108,192,74,0.25)':warn?'rgba(234,179,8,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    sel:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:    {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:    {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    btn:   {background:'transparent',border:'1px solid #252525',color:'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'},
    pill:  {display:'flex',alignItems:'center',gap:6,background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#6CC04A'},
    dot:   {width:7,height:7,borderRadius:'50%',background:'#6CC04A',boxShadow:'0 0 6px rgba(108,192,74,0.8)'},
    mark:  {background:'#000',border:'1px solid #252525',borderRadius:7,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,letterSpacing:'-0.06em'},
    ntab:  (on)=>({background:'transparent',border:`1px solid ${on?'#2A2A2A':'transparent'}`,color:on?'#F0F0F0':'#555',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
  };

  if(loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return(
    <>
      <Head><title>MB SmartTrack — Manager</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(108,192,74,0.025)}select option{background:#1A1A1A;color:#F0F0F0}input[type=date]{color-scheme:dark}`}</style>
      <div style={C.page}>

        {/* Header */}
        <div style={C.hdr}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={C.mark}>M<span style={{color:'#6CC04A'}}>B</span></div>
            <div><div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Manager</div><div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>{profile?.full_name}</div></div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['overview','Overview'],['analytics','Analytics'],['history','History'],['invoices','Invoices']].map(([v,l])=>(
              <button key={v} style={C.ntab(tab===v)} onClick={()=>setTab(v)}>{l}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button style={C.btn} onClick={()=>router.push('/')}>← Attorney View</button>
            <div style={C.pill}><div style={C.dot}/>{clock}</div>
            <button style={{...C.btn,color:'#E05252',borderColor:'rgba(220,80,80,0.3)'}} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
          </div>
        </div>

        {/* ══ OVERVIEW ════════════════════════════════════════════ */}
        {tab==='overview'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Overview</div><div style={{fontSize:11,color:'#444'}}>{fdate(selDate)} · {profiles.length} attorney{profiles.length===1?'':'s'}</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <input type="date" style={{...C.sel}} value={selDate} onChange={e=>setSelDate(e.target.value)}/>
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

            {/* Stat cards — billed vs unbilled split */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
              <div style={C.stat(false,false)}>
                <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>Total Time Tracked</div>
                <div style={{fontSize:24,fontWeight:800,marginBottom:4}}>{toHm(firmTotalSec)}</div>
                <div style={{fontSize:10,color:'#444'}}>{toHm(firmBillSec)} billable time</div>
              </div>
              <div style={C.stat(true,false)}>
                <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>Billed Revenue</div>
                <div style={{fontSize:24,fontWeight:800,color:'#6CC04A',marginBottom:4}}>R{(billedRevenue*1.15).toFixed(2)}</div>
                <div style={{fontSize:10,color:'#444'}}>{billedUnits} units invoiced · incl. VAT 15%</div>
              </div>
              <div style={C.stat(false,true)}>
                <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>Unbilled (Not Yet Invoiced)</div>
                <div style={{fontSize:24,fontWeight:800,color:'#D97706',marginBottom:4}}>R{unbilledRev.toLocaleString()}</div>
                <div style={{fontSize:10,color:'#444'}}>{unbilledUnits} units tracked but not invoiced yet</div>
              </div>
            </div>

            {/* Attorney leaderboard */}
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Billing Leaderboard — All Time</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['#','Attorney','Total Time','Billable','All Units','Billed','Unbilled','Invoices'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!byAtty.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333',fontSize:13}}>No attorney data yet.</td></tr>}
                  {byAtty.map((a,i)=>{
                    const barW=pct(a.bill_sec,a.total_sec);
                    return(
                      <tr key={a.id}>
                        <td style={{...C.td,color:'#444',fontWeight:600,width:28}}>{i+1}</td>
                        <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}<div style={{fontSize:9,color:'#444'}}>today: {toHm(a.today_sec)}</div></td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.total_sec)}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{toHm(a.bill_sec)}</td>

                        <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',fontWeight:700}}>{a.all_units||'—'}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{a.billed_units||'—'}<div style={{fontSize:9,color:'#444'}}>R{(a.billed_units*rate).toLocaleString()}</div></td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#D97706'}}>{a.unbilled_units>0?a.unbilled_units:'—'}{a.unbilled_units>0&&<div style={{fontSize:9,color:'#444'}}>R{(a.unbilled_units*rate).toLocaleString()}</div>}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{a.invoiceCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Top matters + recent invoices */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Top Matters by Billed Revenue</div>
                {!topMatters.length?<div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No invoices yet</div>:(
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr>{['Matter ID','Client','Invoices','Billed (excl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {topMatters.map((m,i)=>(
                        <tr key={i}>
                          <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td>
                          <td style={{...C.td,color:'#C8C8C8'}}>{m.client}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#777',textAlign:'center'}}>{m.invoiceCount}</td>
                          <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#6CC04A'}}>R{m.billedAmt.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent Invoices — All Attorneys</div>
                {!filtInvoices.length?<div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No invoices yet</div>:(
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr>{['Invoice','Client · Matter','Period','Billed (incl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filtInvoices.slice(0,8).map(inv=>(
                        <tr key={inv.id}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td>
                          <td style={C.td}><div style={{color:'#C8C8C8',fontSize:11}}>{inv.client}</div><div style={{color:'#A78BFA',fontSize:10}}>{inv.matter_id}</div></td>
                          <td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td>
                          <td style={{...C.td,fontFamily:"monospace",fontWeight:700,color:"#6CC04A"}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div style={{marginTop:14,textAlign:'center',fontSize:11,color:'#252525'}}>MB SmartTrack Manager View · Billing data only · Window titles and activity details are private to each attorney</div>
          </div>
        )}

        {/* ══ ANALYTICS ═══════════════════════════════════════════ */}
        {tab==='analytics'&&(
          <div style={C.main}>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:14}}>Firm Analytics</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {[
                {l:'Total Attorneys',v:profiles.length,s:'in the firm'},
                {l:'Total Units (All Time)',v:allTime.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0),s:'billable units earned'},
                {l:"Total Billed",v:`R${(billedRevenue*1.15).toFixed(2)}`,s:`${billedUnits} units · incl. VAT`},
                {l:'Total Unbilled',v:`R${unbilledRev.toLocaleString()}`,s:`${unbilledUnits} units pending`},
              ].map(({l,v,s})=>(
                <div key={l} style={C.stat(false,false)}>
                  <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>{v}</div>
                  <div style={{fontSize:10,color:'#444'}}>{s}</div>
                </div>
              ))}
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Performance — All Time</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Attorney','Total Time','Billable','Units Earned','Units Billed','Units Unbilled','Est. Unbilled Value'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {byAtty.map(a=>(
                    <tr key={a.id}>
                      <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.total_sec)}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{toHm(a.bill_sec)}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',fontWeight:700}}>{a.all_units||'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{a.billed_units||'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#D97706':'#444'}}>{a.unbilled_units>0?a.unbilled_units:'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#D97706':'#444',fontWeight:600}}>{a.unbilled_units>0?`R${(a.unbilled_units*rate).toLocaleString()}`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ HISTORY ═════════════════════════════════════════════ */}
        {tab==='history'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm History</div><div style={{fontSize:11,color:'#444'}}>All attorneys · {histYear}</div></div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);}}>
                  {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}>
                  <option value="all">All attorneys</option>
                  {profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>

            {monthBars.length>0&&(
              <div style={{...C.card,marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>Billing units by month — {histYear}</div>
                <BarChart data={monthBars} height={130}/>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {histData.map(m=>{
                const isSelected=selMonth===m.month;
                const hasFuture=new Date(m.month+'-01')>new Date();
                return(
                  <div key={m.month}
                    style={{background:isSelected?'rgba(108,192,74,0.08)':m.sessions?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(108,192,74,0.4)':m.sessions?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:m.sessions?'pointer':'default',opacity:hasFuture?0.4:1}}
                    onClick={()=>m.sessions&&loadMonth(m.month, selAtty==='all'?null:selAtty)}>
                    <div style={{fontSize:12,fontWeight:600,color:m.sessions?'#D0D0D0':'#333',marginBottom:6}}>{new Date(m.month+'-01T12:00:00').toLocaleString('en-ZA',{month:'long'})}</div>
                    {m.sessions?(
                      <>
                        <div style={{fontSize:18,fontWeight:800,color:isSelected?'#6CC04A':'#888',marginBottom:2}}>{toHm(m.total_seconds)}</div>
                        <div style={{fontSize:10,color:'#555'}}>{m.sessions} sessions</div>
                        <div style={{fontSize:11,color:'#6CC04A',marginTop:4,fontWeight:600}}>{m.billable_units} units</div>
                        <div style={{fontSize:9,color:'#444'}}>R{(m.billable_units*rate).toLocaleString()} est.</div>
                      </>
                    ):(
                      <div style={{fontSize:11,color:'#2A2A2A',marginTop:8}}>{hasFuture?'Future':'No data'}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {selMonth&&monthActs.length>0&&(
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>{fmonth(selMonth)} · {monthActs.length} sessions</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Attorney','Application','Duration','Units','Status'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {monthActs.filter(a=>a.is_billable).map(a=>(
                      <tr key={a.id}>
                        <td style={{...C.td,fontSize:10,color:'#555',fontFamily:'monospace'}}>{a.date}</td>
                        <td style={{...C.td,color:'#C8C8C8'}}>{a.profiles?.full_name||'—'}</td>
                        <td style={{...C.td,color:'#888'}}>{a.app_display_name}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',fontWeight:600}}>{a.billing_units}</td>
                        <td style={C.td}><span style={{color:'#6CC04A',fontSize:9,padding:'2px 8px',border:'1px solid rgba(108,192,74,0.3)',borderRadius:20}}>Billable</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ INVOICES ════════════════════════════════════════════ */}
        {tab==='invoices'&&(
          <div style={C.main}>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:14}}>All Invoices</div>
            <div style={{...C.card}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Invoice ID','Client','Matter ID','Attorney','Period','Units','Rate','Excl. VAT','Incl. VAT 15%'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!filtInvoices.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333'}}>No invoices yet</td></tr>}
                  {filtInvoices.map(inv=>(
                    <tr key={inv.id}>
                      <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td>
                      <td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{inv.matter_id}</td>
                      <td style={{...C.td,color:'#777'}}>{inv.attorney}</td>
                      <td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',fontWeight:600}}>{inv.total_units}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>R{inv.rate}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>R{((inv.total_units||0)*(inv.rate||150)).toLocaleString()}</td>
                      <td style={{...C.td,fontFamily:"monospace",fontWeight:700,color:"#6CC04A"}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td>
                    </tr>
                  ))}
                  {filtInvoices.length>0&&(
                    <tr style={{background:'rgba(108,192,74,0.05)'}}>
                      <td colSpan={7} style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>TOTAL</td>
                      <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#6CC04A'}}>R{billedRevenue.toLocaleString()}</td>
                      <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#6CC04A'}}>R{(Math.round(billedRevenue*1.15).toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}