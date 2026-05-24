import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchManagerSummary, fetchInvoices } from '../lib/supabase';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d;} }
function fmonth(m){ try{return new Date(m+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'});}catch{return m;} }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fmtDate(d){ if(!d)return''; try{ const p=d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }catch{return d;} }

function BarChart({data,height=120}){
  if(!data||!data.length) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:12}}>No data</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height,paddingBottom:20}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',height:'100%',justifyContent:'flex-end'}}>
          <div style={{fontSize:9,color:d.color||'#8DC63F',fontWeight:600,marginBottom:2}}>{d.label2||''}</div>
          <div style={{width:'100%',background:d.color||'#8DC63F',borderRadius:'3px 3px 0 0',height:`${Math.max((d.value/max)*80,2)}%`,opacity:0.85}}/>
          <div style={{fontSize:9,color:'#555',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',textAlign:'center',marginTop:4,whiteSpace:'nowrap'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Manager() {
  const router = useRouter();
  const [profile,setProfile]             = useState(null);
  const [loading,setLoading]             = useState(true);
  const [tab,setTab]                     = useState('overview');
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selDate,setSelDate]             = useState(todayStr);
  const [summary,setSummary]             = useState([]);
  const [profiles,setProfiles]           = useState([]);
  const [invoices,setInvoices]           = useState([]);
  const [allTime,setAllTime]             = useState([]);
  const [selAtty,setSelAtty]             = useState('all');
  const [selBranch,setSelBranch]         = useState('all');
  const [branches,setBranches]           = useState([]);
  const [clock,setClock]                 = useState('');
  const [histYear,setHistYear]           = useState(new Date().getFullYear());
  const [histData,setHistData]           = useState([]);
  const [selMonth,setSelMonth]           = useState(null);
  const [monthActs,setMonthActs]         = useState([]);
  const [trustTxns,setTrustTxns]         = useState([]);
  const [trustBalances,setTrustBalances] = useState({});
  const [pendingPayments,setPendingPayments] = useState([]);
  const [trustAlert,setTrustAlert]       = useState({msg:'',type:''});
  const [matters,setMatters]             = useState([]);
  const [showInvite,setShowInvite]       = useState(false);
  const [inviteForm,setInviteForm]       = useState({fullName:'',email:'',role:'attorney',branchId:''});
  const [inviting,setInviting]           = useState(false);
  const [inviteMsg,setInviteMsg]         = useState({msg:'',type:''});
  const rate = 150;
  const [overviewPeriod, setOverviewPeriod] = useState('day');

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      const isManager = p?.role==='manager'||p?.role==='national_manager'||p?.role==='branch_manager'||data.session.user.email==='livhuwaningwn@gmail.com';
      if(!isManager){ router.replace('/'); return; }
      setProfile(p||{full_name:data.session.user.email,role:'manager'});
      setLoading(false);
    });
  },[]);

  const load = useCallback(async()=>{
    const [sumRes,profRes,invRes,branchRes,trustRes,matRes] = await Promise.all([
      fetchManagerSummary(selDate),
      fetchAllProfiles(),
      fetchInvoices(null),
      supabase.from('branches').select('*').eq('is_active',true).order('name'),
      supabase.from('trust_transactions').select('*').order('date',{ascending:false}),
      supabase.from('matters').select('*').order('created_at',{ascending:false}),
    ]);
    if(sumRes.summary)   setSummary(sumRes.summary);
    if(sumRes.allTime)   setAllTime(sumRes.allTime);
    if(profRes.profiles) setProfiles(profRes.profiles);
    if(invRes.invoices)  setInvoices(invRes.invoices||[]);
    setBranches(branchRes.data||[]);
    setMatters(matRes.data||[]);
    const txns=trustRes.data||[];
    setTrustTxns(txns);
    setPendingPayments(txns.filter(t=>t.status==='pending'));
    const bals={};
    txns.filter(t=>t.status==='posted').forEach(t=>{
      if(!bals[t.matter_id]) bals[t.matter_id]=0;
      if(t.type==='receipt') bals[t.matter_id]+=Number(t.amount);
      else bals[t.matter_id]-=Number(t.amount);
    });
    setTrustBalances(bals);
  },[selDate]);

  useEffect(()=>{ if(!loading){ load(); const t=setInterval(load,30000); return()=>clearInterval(t); } },[loading,load]);


  useEffect(()=>{
    if(tab!=='history') return;
    const fetchHist=async()=>{
      const {data}=await supabase.from('activities')
        .select('user_id,date,duration_seconds,is_billable,billing_units')
        .neq('agent_id','demo')
        .gte('date',`${histYear}-01-01`).lte('date',`${histYear}-12-31`);
      const months={};
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

  const loadMonth=async(month,attyId)=>{
    setSelMonth(month);
    let q=supabase.from('activities').select('user_id,date,duration_seconds,billing_units,is_billable')
      .neq('agent_id','demo')
      .gte('date',`${month}-01`)
      .lte('date',`${month}-31`)
      .eq('is_billable',true)
      .order('date',{ascending:true});
    if(attyId) q=q.eq('user_id',attyId);
    const {data,error}=await q;
    if(error) console.error('loadMonth error:',error.message);
    setMonthActs((data||[]).map(a=>({...a,profiles:{full_name:profiles.find(p=>p.id===a.user_id)?.full_name||'Unknown'}})));
  };

  function getPeriodActs(acts) {
    if(!acts||!acts.length) return [];
    try {
      if (overviewPeriod === 'day') return acts.filter(a => a.date === selDate);
      if (overviewPeriod === 'week') {
        const d = new Date(selDate + 'T12:00:00');
        const day = d.getDay() === 0 ? 7 : d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const start = monday.toLocaleDateString('en-CA');
        const end = sunday.toLocaleDateString('en-CA');
        console.log('Week range:', start, 'to', end);
        return acts.filter(a => a.date >= start && a.date <= end);
      }
      if (overviewPeriod === 'month') return acts.filter(a => a.date && a.date.startsWith(selDate.substring(0, 7)));
      return acts;
    } catch(e) { return acts; }
  }

  function getPeriodInvoices(invs) {
    if (overviewPeriod === 'all') return invs;
    if (overviewPeriod === 'day') return invs.filter(i => i.created_at?.substring(0,10) === selDate);
    if (overviewPeriod === 'week') {
      const d = new Date(selDate + 'T12:00:00');
      const day = d.getDay() === 0 ? 7 : d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const start = monday.toLocaleDateString('en-CA');
      const end = sunday.toLocaleDateString('en-CA');
      return invs.filter(i => { const d = i.created_at?.substring(0,10)||''; return d >= start && d <= end; });
    }
    if (overviewPeriod === 'month') return invs.filter(i => i.created_at?.substring(0,7) === selDate.substring(0,7));
    return invs;
  }

  function showAlert(msg,type='success'){ setTrustAlert({msg,type}); setTimeout(()=>setTrustAlert({msg:'',type:''}),60000); }
  async function approvePayment(id){ const {error}=await supabase.from('trust_transactions').update({status:'posted',approved_by:profile?.id,approved_at:new Date().toISOString()}).eq('id',id); if(error){showAlert('Error: '+error.message,'error');return;} showAlert('✓ Payment approved and posted.','success'); load(); }
  async function rejectPayment(id,reason){ const {error}=await supabase.from('trust_transactions').update({status:'rejected',rejection_reason:reason||'Rejected by manager'}).eq('id',id); if(error){showAlert('Error: '+error.message,'error');return;} showAlert('Payment rejected.','success'); load(); }
  async function assignBranch(userId,branchId){ const {error}=await supabase.from('profiles').update({branch_id:branchId}).eq('id',userId); if(error){showAlert('Error: '+error.message,'error');return;} showAlert('✓ Branch updated.','success'); load(); }
  async function removeStaff(userId,name){ if(!confirm(`Remove ${name} from the system? This cannot be undone.`)) return; const res=await fetch('/api/remove-staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})}); const data=await res.json(); if(!res.ok){showAlert('Error: '+data.error,'error');return;} showAlert(`✓ ${name} removed.`,'success'); load(); }

  async function handleInvite(){
    if(!inviteForm.fullName||!inviteForm.email||!inviteForm.branchId){ setInviteMsg({msg:'Please fill in all fields.',type:'error'}); return; }
    setInviting(true);
    setInviteMsg({msg:'',type:''});
    const res = await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(inviteForm)});
    const result = await res.json();
    if(!res.ok){ setInviteMsg({msg:'Error: '+(result.error||'Failed'),type:'error'}); setInviting(false); return; }
    const branchName=branches.find(b=>b.id===inviteForm.branchId)?.name||'the firm';
    showAlert(`✓ ${inviteForm.fullName} added to ${branchName}. Temporary password: ${result.tempPassword||'see records'} — share this with the staff member.`,'success');
    setInviting(false);
    setShowInvite(false);
    setInviteForm({fullName:'',email:'',role:'attorney',branchId:branches[0]?.id||''});
    load();
  }

  const isBranchManager = profile?.role==='branch_manager';
  const myBranch = isBranchManager ? profile?.branch_id : selBranch;
  const filteredProfiles = myBranch==='all'||!myBranch ? profiles : profiles.filter(p=>p.branch_id===myBranch);
  const filteredAllTime = selAtty==='all' ? allTime : allTime.filter(a=>a.user_id===selAtty);
  const periodActs     = getPeriodActs(filteredAllTime);
  const firmTotalSec   = periodActs.reduce((s,a)=>s+(a.duration_seconds||0),0);
  const firmBillSec    = periodActs.filter(a=>a.is_billable).reduce((s,a)=>s+(a.duration_seconds||0),0);
  const firmAllUnits   = periodActs.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);
  const filtInvoices   = selAtty==='all' ? invoices : invoices.filter(i=>i.user_id===selAtty);
  const billedUnits    = filtInvoices.reduce((s,i)=>s+(i.total_units||0),0);
  const billedRevenue  = filtInvoices.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0);
  const unbilledUnits  = Math.max(0,firmAllUnits-billedUnits);
  const unbilledRev    = unbilledUnits*rate;
  const totalTrustHeld = Object.values(trustBalances).reduce((s,v)=>s+v,0);

  const byAtty=filteredProfiles.map(p=>{
    const allTimeP=allTime.filter(a=>a.user_id===p.id);
    const periodP=getPeriodActs(allTimeP);
    const attyInvs=getPeriodInvoices(invoices).filter(i=>i.user_id===p.id);
    const billedU=attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
    const allUnits=periodP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);
    const br=branches.find(b=>b.id===p.branch_id);
    return{...p,branch_name:br?.name||'—',total_sec:periodP.reduce((s,a)=>s+(a.duration_seconds||0),0),bill_sec:periodP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.duration_seconds||0),0),all_units:allUnits,billed_units:billedU,unbilled_units:Math.max(0,allUnits-billedU),invoiceCount:attyInvs.length};
  }).sort((a,b)=>b.all_units-a.all_units);

  const byAttyAllTime=filteredProfiles.map(p=>{
    const allTimeP=allTime.filter(a=>a.user_id===p.id);
    const attyInvs=invoices.filter(i=>i.user_id===p.id);
    const billedU=attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
    const allUnits=allTimeP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);
    const br=branches.find(b=>b.id===p.branch_id);
    return{...p,branch_name:br?.name||'—',bill_sec:allTimeP.filter(a=>a.is_billable).reduce((s,a)=>s+(a.duration_seconds||0),0),all_units:allUnits,billed_units:billedU,unbilled_units:Math.max(0,allUnits-billedU),invoiceCount:attyInvs.length};
  }).sort((a,b)=>b.all_units-a.all_units);

  const matterMap={};
  filtInvoices.forEach(inv=>{ const key=inv.matter_id||inv.matter_name||'Unknown'; if(!matterMap[key]) matterMap[key]={id:key,name:inv.matter_name||key,client:inv.client||'',invoiceCount:0,billedAmt:0}; matterMap[key].invoiceCount++; matterMap[key].billedAmt+=(inv.total_units||0)*(inv.rate||150); });
  const topMatters=Object.values(matterMap).sort((a,b)=>b.billedAmt-a.billedAmt).slice(0,10);
  const monthBars=histData.filter(m=>m.sessions>0).map(m=>({label:new Date(m.month+'-01T12:00:00').toLocaleString('en-ZA',{month:'short'}),label2:`${m.billable_units}u`,value:m.billable_units,color:m.billable_units>0?'#8DC63F':'#2E4A6E'}));
  const branchTrustData=branches.map(b=>{ const bTxns=trustTxns.filter(t=>t.branch_id===b.id&&t.status==='posted'); return{...b,balance:bTxns.reduce((s,t)=>t.type==='receipt'?s+Number(t.amount):s-Number(t.amount),0),receipts:bTxns.filter(t=>t.type==='receipt').reduce((s,t)=>s+Number(t.amount),0),payments:bTxns.filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0),txnCount:bTxns.length}; });

  const roleColor=(role)=>role==='manager'||role==='national_manager'?'#A78BFA':role==='branch_manager'?'#4A90D9':role==='bookkeeper'?'#EAB308':'#8DC63F';
  const roleBg=(role)=>role==='manager'||role==='national_manager'?'rgba(167,139,250,0.1)':role==='branch_manager'?'rgba(74,144,217,0.1)':role==='bookkeeper'?'rgba(234,179,8,0.1)':'rgba(141,198,63,0.1)';
  const lbl={fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'};

  const C={
    page:  {background:'#0A0A0A',minHeight:'100vh',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#F0F0F0'},
    hdr:   {background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    main:  {maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card:  {background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat:  (acc,warn)=>({background:acc?'rgba(141,198,63,0.05)':warn?'rgba(234,179,8,0.05)':'#111',border:`1px solid ${acc?'rgba(141,198,63,0.25)':warn?'rgba(234,179,8,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    sel:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:    {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:    {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    btn:   (v='s')=>({background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':v==='warn'?'rgba(234,179,8,0.15)':'transparent',border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':v==='warn'?'1px solid rgba(234,179,8,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='r'?'#E05252':v==='warn'?'#EAB308':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'?700:500}),
    pill:  {display:'flex',alignItems:'center',gap:6,background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#8DC63F'},
    dot:   {width:7,height:7,borderRadius:'50%',background:'#8DC63F',boxShadow:'0 0 6px rgba(141,198,63,0.8)'},
    ntab:  (on)=>({background:'transparent',border:`1px solid ${on?'#2A2A2A':'transparent'}`,color:on?'#F0F0F0':'#555',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
  };

  if(loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return(
    <>
      <Head><title>MB SmartTrack — Manager</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(141,198,63,0.025)}select option{background:#1A1A1A;color:#F0F0F0}input[type=date]{color-scheme:dark}button:hover{opacity:.85}.mb-inp{background:#1A1A1A;border:1px solid #252525;color:#F0F0F0;padding:10px 14px;border-radius:7px;font-size:13px;font-family:'DM Sans',system-ui,sans-serif;width:100%;display:block;}.mb-inp:focus{outline:1px solid rgba(141,198,63,0.5);border-color:rgba(141,198,63,0.4);}.mb-inp option{background:#1A1A1A;color:#F0F0F0;}`}</style>
      <div style={C.page}>

        <div style={C.hdr}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/logo.png" alt="MB" style={{width:34,height:34,objectFit:'contain',borderRadius:6}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
            <div style={{display:'none',background:'#8DC63F',borderRadius:6,width:34,height:34,alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#0A0A0A'}}>MB</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Manager</div>
              <div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill · {profile?.full_name}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[['overview','Overview'],['trust','🏦 Trust'],['analytics','Analytics'],['history','History'],['invoices','Invoices'],['staff','Staff']].map(([v,l])=>(
              <button key={v} style={{...C.ntab(tab===v),position:'relative',color:v==='trust'?'#4A90D9':tab===v?'#F0F0F0':'#555',border:v==='trust'?`1px solid ${tab===v?'rgba(74,144,217,0.5)':'rgba(74,144,217,0.2)'}`:tab===v?'1px solid #2A2A2A':'1px solid transparent'}} onClick={()=>setTab(v)}>
                {l}{v==='trust'&&pendingPayments.length>0&&<span style={{position:'absolute',top:-4,right:-4,background:'#EAB308',color:'#000',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingPayments.length}</span>}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            
            <div style={C.pill}><div style={C.dot}/>{clock}</div>
            <button style={{...C.btn('r')}} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
          </div>
        </div>

        {trustAlert.msg&&(<div style={{background:trustAlert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${trustAlert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'14px 24px',fontSize:12,color:trustAlert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
  <span style={{flex:1}}>{trustAlert.msg}</span>
  {trustAlert.type==='success'&&trustAlert.msg.includes('Temporary password:')&&(
    <button style={{background:'rgba(141,198,63,0.2)',border:'1px solid rgba(141,198,63,0.4)',color:'#8DC63F',padding:'4px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={()=>{ const pwd=trustAlert.msg.match(/Temporary password: ([^\s—]+)/)?.[1]; if(pwd){navigator.clipboard.writeText(pwd);} }}>📋 Copy Password</button>
  )}
  <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',flexShrink:0}} onClick={()=>setTrustAlert({msg:'',type:''})}>✕</button>
</div>)}
        {pendingPayments.length>0&&tab!=='trust'&&(<div style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.3)',padding:'10px 24px',fontSize:12,color:'#EAB308',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>⏳ {pendingPayments.length} trust payment{pendingPayments.length>1?'s':''} pending your approval — {fmtR(pendingPayments.reduce((s,t)=>s+Number(t.amount),0))}</span><button style={C.btn('warn')} onClick={()=>setTab('trust')}>Review approvals →</button></div>)}

        {tab==='overview'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Overview — Motsoeneng Bill</div><div style={{fontSize:11,color:'#444'}}>{overviewPeriod==='day'?fdate(selDate):overviewPeriod==='week'?'This week':overviewPeriod==='month'?new Date(selDate+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'}):'All time'} · {profiles.length} staff · {branches.length} branches</div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <input type="date" style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}/>
              <div style={{display:'flex',background:'#1A1A1A',border:'1px solid #252525',borderRadius:6,padding:2}}>
                {[['day','Day'],['week','Week'],['month','Month'],['all','All Time']].map(([v,l])=>(
                  <button key={v} style={{background:overviewPeriod===v?'#2A2A2A':'transparent',border:'none',color:overviewPeriod===v?'#F0F0F0':'#555',padding:'4px 12px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:overviewPeriod===v?600:400}} onClick={()=>setOverviewPeriod(v)}>{l}</button>
                ))}
              </div>
              {!isBranchManager&&(<select style={C.sel} value={selBranch} onChange={e=>{setSelBranch(e.target.value);setSelAtty('all');}}><option value="all">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>)}
              {isBranchManager&&(<span style={{fontSize:12,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'5px 12px',borderRadius:6}}>{branches.find(b=>b.id===profile?.branch_id)?.name||'Your branch'}</span>)}
              <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}><option value="all">All attorneys</option>{filteredProfiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            {[{l:'Billable Time',v:toHm(firmBillSec),s:`${firmAllUnits} units earned`,a:true,w:false},{l:'Billed Revenue',v:`R${(billedRevenue*1.15).toFixed(2)}`,s:`${billedUnits} units · incl. VAT`,a:true,w:false},{l:'Unbilled Revenue',v:`R${unbilledRev.toLocaleString()}`,s:`${unbilledUnits} units not invoiced`,a:false,w:true},{l:'Total Trust Held',v:fmtR(totalTrustHeld),s:`${pendingPayments.length} payment${pendingPayments.length===1?'':'s'} pending`,a:false,w:false}].map(({l,v,s,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
            {branchTrustData.map(b=>(<div key={b.id} style={{...C.card,marginBottom:0}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{b.name}</div><div style={{fontSize:15,fontWeight:700,color:'#4A90D9'}}>{fmtR(b.balance)}</div></div><div style={{fontSize:10,color:'#555',marginBottom:2}}>{b.address}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:8,fontSize:11}}><div><div style={{fontSize:9,color:'#444',textTransform:'uppercase',marginBottom:2}}>Receipts</div><div style={{color:'#8DC63F',fontWeight:600}}>{fmtR(b.receipts)}</div></div><div><div style={{fontSize:9,color:'#444',textTransform:'uppercase',marginBottom:2}}>Payments</div><div style={{color:'#E05252',fontWeight:600}}>{fmtR(b.payments)}</div></div><div><div style={{fontSize:9,color:'#444',textTransform:'uppercase',marginBottom:2}}>Transactions</div><div style={{color:'#888',fontWeight:600}}>{b.txnCount}</div></div></div><div style={{marginTop:8,fontSize:10,color:'#555'}}>{profiles.filter(p=>p.branch_id===b.id).length} staff assigned</div></div>))}
          </div>
          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Leaderboard — {overviewPeriod==='day'?fdate(selDate):overviewPeriod==='week'?'This Week':overviewPeriod==='month'?new Date(selDate.substring(0,7)+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'}):'All Time'}</div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['#','Attorney','Branch','Billable Time','Units Earned','Units Billed','Unbilled Units','Invoices'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!byAtty.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333',fontSize:13}}>No data yet.</td></tr>}{byAtty.map((a,i)=>(<tr key={a.id}><td style={{...C.td,color:'#444',fontWeight:600,width:28}}>{i+1}</td><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}<div style={{fontSize:9,color:'#444'}}>{a.email}</div></td><td style={{...C.td,fontSize:10}}><span style={{background:'rgba(74,144,217,0.1)',color:'#4A90D9',padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:600}}>{a.branch_name}</span></td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{toHm(a.bill_sec)||'0m'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.all_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{a.billed_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#EAB308':'#444'}}>{a.unbilled_units>0?a.unbilled_units:'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{a.invoiceCount}</td></tr>))}</tbody></table></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Top Matters by Billed Revenue</div>{!topMatters.length?<div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No invoices yet</div>:<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Invoices','Billed'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{topMatters.map((m,i)=>(<tr key={i}><td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td><td style={{...C.td,color:'#C8C8C8'}}>{m.client}</td><td style={{...C.td,fontFamily:'monospace',color:'#777',textAlign:'center'}}>{m.invoiceCount}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{m.billedAmt.toLocaleString()}</td></tr>))}</tbody></table>}</div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent Invoices</div>{!filtInvoices.length?<div style={{textAlign:'center',padding:'20px',color:'#333',fontSize:12}}>No invoices yet</div>:<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice','Client','Period','Incl. VAT'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{filtInvoices.slice(0,8).map(inv=>(<tr key={inv.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td><td style={C.td}><div style={{color:'#C8C8C8',fontSize:11}}>{inv.client}</div><div style={{color:'#A78BFA',fontSize:10}}>{inv.matter_id}</div></td><td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td></tr>))}</tbody></table>}</div>
          </div>
          <div style={{marginTop:14,textAlign:'center',fontSize:11,color:'#252525'}}>Motsoeneng Bill · MB SmartTrack Manager View</div>
        </div>)}

        {tab==='trust'&&(<div style={C.main}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>Trust Accounting</div>
          <div style={{fontSize:11,color:'#444',marginBottom:16}}>All branches · Legal Practice Act compliant</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[{l:'Total trust held',v:fmtR(totalTrustHeld),a:true,w:false},{l:'Total receipts',v:fmtR(trustTxns.filter(t=>t.type==='receipt'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false,w:false},{l:'Total payments',v:fmtR(trustTxns.filter(t=>t.type==='payment'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false,w:false},{l:'Pending approvals',v:pendingPayments.length,a:false,w:pendingPayments.length>0}].map(({l,v,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div></div>))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
            {branchTrustData.map(b=>(<div key={b.id} style={{...C.card,marginBottom:0,cursor:'pointer'}} onClick={()=>setSelBranch(selBranch===b.id?'all':b.id)}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{b.name}</div><div style={{fontSize:16,fontWeight:700,color:'#4A90D9'}}>{fmtR(b.balance)}</div></div><div style={{fontSize:10,color:'#555',marginBottom:8}}>{b.address}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:11}}><div><div style={{fontSize:9,color:'#444',marginBottom:1}}>Receipts</div><div style={{color:'#8DC63F'}}>{fmtR(b.receipts)}</div></div><div><div style={{fontSize:9,color:'#444',marginBottom:1}}>Payments</div><div style={{color:'#E05252'}}>{fmtR(b.payments)}</div></div></div></div>))}
          </div>
          <div style={C.card}>
            <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Payment approvals {pendingPayments.length>0&&<span style={{marginLeft:8,background:'rgba(234,179,8,0.15)',color:'#EAB308',fontSize:10,padding:'2px 10px',borderRadius:20,border:'1px solid rgba(234,179,8,0.3)'}}>{pendingPayments.length} pending</span>}</div>
            {!pendingPayments.length?(<div style={{textAlign:'center',padding:'30px',color:'#555'}}><div style={{fontSize:24,marginBottom:8}}>✅</div><div style={{fontSize:12}}>No payments pending approval</div></div>):pendingPayments.map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id),br=branches.find(b=>b.id===t.branch_id),bal=trustBalances[t.matter_id]||0; return(<div key={i} style={{border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:16,marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}><div style={{flex:1}}><div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}><span style={{fontSize:9,background:'rgba(234,179,8,0.1)',color:'#EAB308',border:'1px solid rgba(234,179,8,0.3)',padding:'2px 10px',borderRadius:20,fontWeight:600}}>PENDING APPROVAL</span><span style={{fontSize:10,color:'#555'}}>{fmtDate(t.date)}</span>{br&&<span style={{fontSize:10,color:'#555',border:'1px solid #252525',padding:'1px 8px',borderRadius:20}}>{br.name}</span>}</div><div style={{fontSize:20,fontWeight:700,color:'#EAB308',marginBottom:6}}>{fmtR(t.amount)}</div><div style={{fontSize:12,color:'#D0D0D0',marginBottom:2}}>Payee: <strong>{t.payee}</strong></div><div style={{fontSize:12,color:'#D0D0D0',marginBottom:2}}>Matter: <span style={{color:'#A78BFA'}}>{t.matter_id}</span> — {m?.client||'—'}</div><div style={{fontSize:11,color:'#555',marginBottom:8}}>{t.narration}</div><div style={{background:'rgba(234,179,8,0.05)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'#888'}}>Balance: <strong style={{color:'#8DC63F'}}>{fmtR(bal)}</strong> · After: <strong style={{color:bal-Number(t.amount)>=0?'#8DC63F':'#E05252'}}>{fmtR(bal-Number(t.amount))}</strong></div></div><div style={{display:'flex',flexDirection:'column',gap:8,minWidth:140}}><button style={C.btn('p')} onClick={()=>{ if(confirm(`Approve payment of ${fmtR(t.amount)} to ${t.payee}?`)) approvePayment(t.id); }}>✓ Approve</button><button style={C.btn('r')} onClick={()=>{ const r=prompt('Reason for rejection:'); if(r!==null) rejectPayment(t.id,r); }}>✗ Reject</button></div></div></div>); })}
          </div>
          <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Trust balances — all matters</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Branch','Trust Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!matters.length&&<tr><td colSpan={4} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No matters yet</td></tr>}{matters.map(m=>{ const bal=trustBalances[m.id]||0,br=branches.find(b=>b.id===m.branch_id); return(<tr key={m.id} style={{opacity:bal===0?0.4:1}}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{m.client}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,textAlign:'right',color:bal>0?'#8DC63F':bal<0?'#E05252':'#555'}}>{fmtR(bal)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={3} style={{...C.th,paddingTop:12}}>Grand total</td><td style={{...C.th,fontFamily:'monospace',fontSize:13,color:'#8DC63F',textAlign:'right',paddingTop:12}}>{fmtR(totalTrustHeld)}</td></tr></tbody></table></div></div>
        </div>)}

        {tab==='analytics'&&(<div style={C.main}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
    <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Analytics</div><div style={{fontSize:11,color:'#444'}}>{overviewPeriod==='day'?fdate(selDate):overviewPeriod==='week'?'This Week':overviewPeriod==='month'?new Date(selDate.substring(0,7)+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'}):'All Time'}</div></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
      <input type="date" style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}/>
      <div style={{display:'flex',background:'#1A1A1A',border:'1px solid #252525',borderRadius:6,padding:2}}>
        {[['day','Day'],['week','Week'],['month','Month'],['all','All Time']].map(([v,l])=>(
          <button key={v} style={{background:overviewPeriod===v?'#2A2A2A':'transparent',border:'none',color:overviewPeriod===v?'#F0F0F0':'#555',padding:'4px 12px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:overviewPeriod===v?600:400}} onClick={()=>setOverviewPeriod(v)}>{l}</button>
        ))}
      </div>
      <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}><option value="all">All attorneys</option>{filteredProfiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
    </div>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
    {[{l:'Total Staff',v:filteredProfiles.length,s:'active staff'},{l:'Billable Time',v:toHm(firmBillSec),s:`${firmAllUnits} units earned`},{l:'Total Billed',v:`R${(billedRevenue*1.15).toFixed(2)}`,s:`${billedUnits} units · incl. VAT`},{l:'Unbilled Revenue',v:`R${unbilledRev.toLocaleString()}`,s:`${unbilledUnits} units not invoiced`}].map(({l,v,s})=>(<div key={l} style={C.stat(l==='Total Billed',l==='Unbilled Revenue')}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:l==='Total Billed'?'#8DC63F':l==='Unbilled Revenue'?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
  </div>
  {byAtty.filter(a=>a.all_units>0).length>0&&(<div style={{...C.card,marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Billing units per attorney</div><BarChart data={byAtty.filter(a=>a.all_units>0).map(a=>({label:a.full_name.replace('Adv. ','').split(' ')[0],label2:`${a.all_units}u`,value:a.all_units,color:'#8DC63F'}))} height={130}/></div>)}
  <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Performance</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Attorney','Branch','Billable Time','Units Earned','Units Billed','Unbilled','Est. Value'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!byAtty.length&&<tr><td colSpan={7} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No billable data for this period.</td></tr>}{byAtty.map(a=>(<tr key={a.id}><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}<div style={{fontSize:9,color:'#444'}}>{a.email}</div></td><td style={{...C.td,fontSize:10}}><span style={{background:'rgba(74,144,217,0.1)',color:'#4A90D9',padding:'2px 8px',borderRadius:20,fontSize:9}}>{a.branch_name}</span></td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{toHm(a.bill_sec)||'0m'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.all_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{a.billed_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#EAB308':'#444'}}>{a.unbilled_units>0?a.unbilled_units:'—'}</td><td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#EAB308':'#444',fontWeight:600}}>{a.unbilled_units>0?`R${(a.unbilled_units*rate).toLocaleString()}`:'—'}</td></tr>))}</tbody></table></div>
</div>)}

        {tab==='history'&&(<div style={C.main}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
    <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm History</div><div style={{fontSize:11,color:'#444'}}>Click a month to see attorney billing details</div></div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);setMonthActs([]);}}>{[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
      <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}><option value="all">All attorneys</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
    </div>
  </div>
  {monthBars.length>0&&(<div style={{...C.card,marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>Billing units by month — {histYear}</div><BarChart data={monthBars} height={130}/></div>)}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
    {histData.map(m=>{
      const isSelected=selMonth===m.month;
      const hasFuture=new Date(m.month+'-01')>new Date();
      const revenue=(m.billable_units||0)*rate;
      return(<div key={m.month} style={{background:isSelected?'rgba(141,198,63,0.08)':m.sessions?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(141,198,63,0.4)':m.sessions?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:m.sessions?'pointer':'default',opacity:hasFuture?0.4:1}} onClick={()=>m.sessions&&loadMonth(m.month,selAtty==='all'?null:selAtty)}>
        <div style={{fontSize:12,fontWeight:600,color:m.sessions?'#D0D0D0':'#333',marginBottom:6}}>{new Date(m.month+'-01T12:00:00').toLocaleString('en-ZA',{month:'long'})}</div>
        {m.sessions?(<>
          <div style={{fontSize:20,fontWeight:800,color:'#8DC63F',marginBottom:2}}>{m.billable_units||0} units</div>
          <div style={{fontSize:11,color:'#4A90D9',fontWeight:600,marginBottom:2}}>R{revenue.toLocaleString()}</div>
          <div style={{fontSize:10,color:'#555'}}>est. excl. VAT</div>
        </>):(<div style={{fontSize:11,color:'#2A2A2A',marginTop:8}}>{hasFuture?'Future':'No data'}</div>)}
      </div>);
    })}
  </div>
  {selMonth&&(<div style={C.card}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{fmonth(selMonth)} — Attorney Billing</div>
      <button style={{...C.btn(),fontSize:11}} onClick={()=>{setSelMonth(null);setMonthActs([]);}}>✕ Close</button>
    </div>
    {!monthActs.filter(a=>a.is_billable).length?(
      <div style={{textAlign:'center',padding:'30px',color:'#555',fontSize:12}}>No billable activities for this month.</div>
    ):(()=>{
      const attyMap={};
      monthActs.filter(a=>a.is_billable).forEach(a=>{
        const name=a.profiles?.full_name||'Unknown';
        if(!attyMap[name]) attyMap[name]={name,billSec:0,units:0};
        attyMap[name].billSec+=a.duration_seconds||0;
        attyMap[name].units+=a.billing_units||0;
      });
      const attyList=Object.values(attyMap).sort((a,b)=>b.units-a.units);
      return(<table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr>{['Attorney','Billable Time','Units Earned','Est. Revenue (excl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>{attyList.map((a,i)=>(<tr key={i}>
          <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.name}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{toHm(a.billSec)}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.units}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>R{(a.units*rate).toLocaleString()}</td>
        </tr>))}
        <tr style={{background:'#0D0D0D'}}>
          <td style={{...C.th,paddingTop:12}}>Total</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>{toHm(attyList.reduce((s,a)=>s+a.billSec,0))}</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>{attyList.reduce((s,a)=>s+a.units,0)}</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>R{(attyList.reduce((s,a)=>s+a.units,0)*rate).toLocaleString()}</td>
        </tr></tbody>
      </table>);
    })()}
  </div>)}
</div>)}

        {tab==='invoices'&&(<div style={C.main}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:14}}>All Invoices — Motsoeneng Bill</div>
          <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice ID','Client','Matter ID','Attorney','Period','Units','Rate','Excl. VAT','Incl. VAT 15%'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!filtInvoices.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333'}}>No invoices yet</td></tr>}{filtInvoices.map(inv=>(<tr key={inv.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td><td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td><td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{inv.matter_id}</td><td style={{...C.td,color:'#777'}}>{inv.attorney}</td><td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:600}}>{inv.total_units}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>R{inv.rate}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)).toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td></tr>))}{filtInvoices.length>0&&(<tr style={{background:'rgba(141,198,63,0.05)'}}><td colSpan={7} style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>TOTAL</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{billedRevenue.toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{(billedRevenue*1.15).toFixed(2)}</td></tr>)}</tbody></table></div>
        </div>)}

        {tab==='staff'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Staff Management</div><div style={{fontSize:11,color:'#444',marginTop:2}}>{profiles.length} staff members · {branches.length} branches · No IT needed</div></div>
            <button style={C.btn('p')} onClick={()=>{ setShowInvite(true); setInviteForm({fullName:'',email:'',role:'attorney',branchId:branches[0]?.id||''}); setInviteMsg({msg:'',type:''}); }}>+ Add Staff Member</button>
          </div>
          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All staff</div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Email','Role','Branch','Change Branch','Remove'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!profiles.length&&<tr><td colSpan={6} style={{padding:'30px',textAlign:'center',color:'#333'}}>No staff yet</td></tr>}{profiles.map(p=>{ const br=branches.find(b=>b.id===p.branch_id); return(<tr key={p.id}><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{p.full_name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{p.email||'—'}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:roleBg(p.role),color:roleColor(p.role)}}>{p.role||'attorney'}</span></td><td style={C.td}>{br?<span style={{fontSize:10,color:'#4A90D9',background:'rgba(74,144,217,0.1)',padding:'2px 8px',borderRadius:20}}>{br.name}</span>:<span style={{fontSize:10,color:'#555'}}>Not assigned</span>}</td><td style={C.td}><select className="mb-inp" style={{padding:'5px 10px',fontSize:11}} value={p.branch_id||''} onChange={e=>assignBranch(p.id,e.target.value)}><option value="">— select —</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></td><td style={C.td}><button style={{...C.btn('r'),fontSize:10,padding:'3px 10px'}} onClick={()=>removeStaff(p.id,p.full_name)}>Remove</button></td></tr>); })}</tbody></table></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {branches.map(b=>{ const bStaff=profiles.filter(p=>p.branch_id===b.id); return(<div key={b.id} style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>{b.name}</div><div style={{fontSize:10,color:'#555',marginBottom:10}}>{b.address}</div><div style={{fontSize:22,fontWeight:800,color:'#8DC63F',marginBottom:2}}>{bStaff.length}</div><div style={{fontSize:10,color:'#555',marginBottom:10}}>staff members</div><div style={{display:'flex',flexDirection:'column',gap:4}}>{bStaff.map(s=>(<div key={s.id} style={{fontSize:11,color:'#888',display:'flex',alignItems:'center',gap:6}}><span style={{width:6,height:6,borderRadius:'50%',background:roleColor(s.role),display:'inline-block',flexShrink:0}}/><span>{s.full_name}</span><span style={{fontSize:9,color:'#444'}}>({s.role||'attorney'})</span></div>))}{!bStaff.length&&<div style={{fontSize:11,color:'#333'}}>No staff assigned</div>}</div></div>); })}
          </div>
        </div>)}

        {showInvite&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowInvite(false)}>
          <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:32,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>Add Staff Member</div>
            <div style={{fontSize:11,color:'#555',marginBottom:24}}>Create an account. The temporary password will be shown after — share it with the staff member..</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={lbl}>Full name *</label><input className="mb-inp" type="text" placeholder="e.g. Adv. Sarah Nkosi" value={inviteForm.fullName} onChange={e=>setInviteForm(f=>({...f,fullName:e.target.value}))}/></div>
              <div><label style={lbl}>Email address *</label><input className="mb-inp" type="email" placeholder="their@email.com" value={inviteForm.email} onChange={e=>setInviteForm(f=>({...f,email:e.target.value}))}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={lbl}>Role *</label><select className="mb-inp" value={inviteForm.role} onChange={e=>setInviteForm(f=>({...f,role:e.target.value}))}><option value="attorney">Attorney / Fee Earner</option><option value="branch_manager">Branch Manager</option><option value="manager">National Manager</option><option value="bookkeeper">Bookkeeper</option></select></div>
                <div><label style={lbl}>Branch *</label><select className="mb-inp" value={inviteForm.branchId} onChange={e=>setInviteForm(f=>({...f,branchId:e.target.value}))}><option value="">Select branch...</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              </div>
              {inviteMsg.msg&&(<div style={{background:inviteMsg.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${inviteMsg.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,borderRadius:6,padding:'10px 12px',fontSize:12,color:inviteMsg.type==='error'?'#E05252':'#8DC63F'}}>{inviteMsg.msg}</div>)}
              <div style={{display:'flex',gap:10,marginTop:8,justifyContent:'flex-end'}}>
                <button style={C.btn()} onClick={()=>setShowInvite(false)}>Cancel</button>
                <button style={{...C.btn('p'),opacity:inviting||!inviteForm.fullName||!inviteForm.email||!inviteForm.branchId?0.6:1}} disabled={inviting||!inviteForm.fullName||!inviteForm.email||!inviteForm.branchId} onClick={handleInvite}>{inviting?'Creating account...':'Add Staff Member'}</button>
              </div>
            </div>
          </div>
        </div>)}

      </div>
    </>
  );
}

