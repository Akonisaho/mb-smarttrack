import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Fuse from 'fuse.js';
import {
  supabase, signOut, getProfile,
  fetchActivities, fetchAllActivities, patchActivity, patchActivityMatter,
  fetchMatters, createMatter, deleteMatter,
  fetchInvoices, saveInvoice, deleteInvoice,
  fetchHistory, fetchMonthActivities,
  searchAll
} from '../lib/supabase';
import Head from 'next/head';

// ── Helpers ──────────────────────────────────────────────────────────
function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function calcUnits(s){ return Math.max(1,Math.ceil((Number(s)||0)/360)); }
function calcAmt(s,rate){ return calcUnits(s)*(Number(rate)||150); }
function appIcon(n){ n=(n||'').toLowerCase(); if(n.includes('phone')||n.includes('call'))return'📞'; if(n.includes('word'))return'📝'; if(n.includes('excel'))return'📊'; if(n.includes('outlook'))return'📧'; if(n.includes('teams'))return'💬'; if(n.includes('chrome')||n.includes('edge'))return'🌐'; if(n.includes('acrobat'))return'📄'; if(n.includes('powerpoint'))return'📑'; if(n.includes('explorer'))return'📁'; if(n.includes('code'))return'💻'; return'🖥️'; }
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fmonth(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'});}catch{return d||'';} }
function ftime(ms){ return new Date(Number(ms)).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}); }
function pct(a,b){ return b>0?Math.round((a/b)*100):0; }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fmtDate(d){ if(!d)return''; try{ const p=d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }catch{return d;} }
function nextReceiptNo(transactions){ const nos=transactions.filter(t=>t.type==='receipt'&&t.receipt_no).map(t=>parseInt((t.receipt_no||'').replace('TRR-',''))||0); const max=nos.length?Math.max(...nos):0; return 'TRR-'+String(max+1).padStart(3,'0'); }

function Badge({c}){
  const s=c==='billable'?{color:'#6CC04A',border:'1px solid rgba(108,192,74,0.35)',bg:'rgba(108,192,74,0.1)'}:c==='work'?{color:'#4A90D9',border:'1px solid rgba(74,144,217,0.35)',bg:'rgba(74,144,217,0.1)'}:{color:'#666',border:'1px solid #2A2A2A',bg:'rgba(42,42,42,0.4)'};
  return <span style={{color:s.color,border:s.border,background:s.bg,fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,textTransform:'capitalize',display:'inline-block'}}>{c}</span>;
}

// ── PDF ──────────────────────────────────────────────────────────────
function downloadPDF(inv, acts) {
  const bill=(acts||[]).filter(a=>a.classification==='billable');
  const rate=Number(inv.rate)||150;
  const tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
  const tAmt=tU*rate;
  const tSec=(acts||[]).reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const bSec=bill.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const rows=bill.map(a=>`<tr>
    <td>${fdate(a.date)} ${ftime(a.start_time)}</td>
    <td>${a.app_display_name||''}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.window_title||''}</td>
    <td align="right">${toHm(a.duration_seconds)}</td>
    <td align="right">${calcUnits(a.duration_seconds)}</td>
    <td align="right"><strong>R${calcAmt(a.duration_seconds,rate).toLocaleString()}</strong></td>
  </tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.id}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6CC04A;padding-bottom:18px;margin-bottom:24px}
  .logo{font-size:28px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#6CC04A}.logo-sub{font-size:11px;color:#999;margin-top:3px}
  .right{text-align:right}.right h1{font-size:22px;font-weight:900}.right p{font-size:11px;color:#999;margin-top:3px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
  .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#aaa;margin-bottom:3px}.val{font-size:14px;font-weight:700}.sub{font-size:11px;color:#888;margin-top:2px}
  .sumbar{display:flex;border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px}
  .sb{flex:1;padding:12px;text-align:center;border-right:1px solid #eee}.sb:last-child{border:none}
  .slbl{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa}.sval{font-size:17px;font-weight:800;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;border-bottom:2px solid #eee}
  td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3;color:#444}
  .tbox{background:#f8f8f8;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
  .tamt{font-size:30px;font-weight:900;color:#111}.tlbl{font-size:11px;color:#aaa;margin-bottom:3px}
  .foot{margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center;line-height:1.8}
  @media print{body{padding:20px}@page{margin:15mm}}</style></head><body>
  <div class="top">
    <div><div class="logo">M<span>B</span></div><div class="logo-sub">Motsoeneng Bill Attorneys</div><div class="logo-sub">The Quality of Now</div></div>
    <div class="right"><h1>TAX INVOICE</h1><p>${inv.id}</p><p>Issued: ${fdate(new Date().toISOString().split('T')[0])}</p></div>
  </div>
  <div class="grid">
    <div><div class="lbl">Billed To</div><div class="val">${inv.client||''}</div><div class="sub">Matter: ${inv.matter_name||inv.matter||''}</div><div class="sub">Ref: ${inv.matter_id||''}</div></div>
    <div><div class="lbl">Attorney</div><div class="val">${inv.attorney||''}</div><div class="sub">Period: ${inv.period_label||''}</div><div class="sub">Total: ${toHm(tSec)} | Billable: ${toHm(bSec)}</div></div>
  </div>
  <div class="sumbar">
    <div class="sb"><div class="slbl">Sessions</div><div class="sval">${bill.length}</div></div>
    <div class="sb"><div class="slbl">Total Time</div><div class="sval">${toHm(tSec)}</div></div>
    <div class="sb"><div class="slbl">Billable</div><div class="sval">${toHm(bSec)}</div></div>
    <div class="sb"><div class="slbl">Units</div><div class="sval">${tU}</div></div>
    <div class="sb"><div class="slbl">Rate/Unit</div><div class="sval">R${rate}</div></div>
  </div>
  <table><thead><tr>
    <th align="left">Date/Time</th><th align="left">Application</th><th align="left">Description</th>
    <th align="right">Time</th><th align="right">Units</th><th align="right">Amount</th>
  </tr></thead><tbody>
    ${rows||'<tr><td colspan="6" align="center" style="color:#ccc;padding:16px">No billable activities.</td></tr>'}
  </tbody></table>
  <div class="tbox" style="align-items:flex-start">
    <div><div style="font-size:12px;color:#555"><strong>${tU} units</strong> x R${rate}/unit</div><div style="font-size:10px;color:#bbb;margin-top:3px">1 billing unit = 6 minutes (standard South African legal billing)</div></div>
    <div style="text-align:right;min-width:240px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:0">
        <tr><td style="padding:4px 8px;font-size:12px;color:#888;border:none;text-align:left">Subtotal (excl. VAT)</td><td style="padding:4px 8px;font-size:12px;color:#555;border:none;text-align:right;font-family:monospace">R${tAmt.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 8px;font-size:12px;color:#888;border:none;text-align:left">VAT @ 15%</td><td style="padding:4px 8px;font-size:12px;color:#555;border:none;text-align:right;font-family:monospace">R${(tAmt*0.15).toFixed(2)}</td></tr>
        <tr style="border-top:2px solid #ddd"><td style="padding:6px 8px;font-size:13px;font-weight:700;color:#111;border:none;text-align:left">Total Due (incl. VAT)</td><td style="padding:6px 8px;font-size:22px;font-weight:900;color:#111;border:none;text-align:right">R${(tAmt*1.15).toFixed(2)}</td></tr>
      </table>
    </div>
  </div>
  <div class="foot">Motsoeneng Bill Attorneys | VAT Reg No: 4100000000<br>FNB Account: 62000000000 | Branch: 250655<br>accounts@motsoenengbill.co.za | +27 (0)11 000 0000 | www.motsoenengbill.co.za<br><em>This invoice is computer generated and valid without a signature.</em></div>
  <script>window.onload=function(){window.print();}</script></body></html>`;
  const w=window.open('','_blank','width=920,height=720');
  w.document.write(html); w.document.close();
}

// ── Charts ────────────────────────────────────────────────────────────
function BarChart({data,height=120}){
  if(!data||!data.length) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:12}}>No data</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height,paddingBottom:20}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',height:'100%',justifyContent:'flex-end'}}>
          <div style={{fontSize:9,color:d.color||'#6CC04A',fontWeight:600,marginBottom:2}}>{d.label2||''}</div>
          <div style={{width:'100%',background:d.color||'#6CC04A',borderRadius:'3px 3px 0 0',height:`${Math.max((d.value/max)*80,2)}%`,opacity:0.85,minHeight:d.value>0?4:0}}/>
          <div style={{fontSize:9,color:'#555',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',textAlign:'center',marginTop:4,whiteSpace:'nowrap'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({segments,size=140}){
  const total=segments.reduce((s,d)=>s+d.value,0);
  if(!total) return <div style={{width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:11}}>No data</div>;
  const r=45,cx=size/2,cy=size/2,sw=18; let angle=-90;
  const arcs=segments.filter(s=>s.value>0).map(seg=>{
    const p=seg.value/total,a1=angle,a2=angle+p*360; angle=a2;
    return{...seg,pct:Math.round(p*100),
      x1:cx+r*Math.cos(a1*Math.PI/180),y1:cy+r*Math.sin(a1*Math.PI/180),
      x2:cx+r*Math.cos(a2*Math.PI/180),y2:cy+r*Math.sin(a2*Math.PI/180)};
  });
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A1A" strokeWidth={sw}/>
      {arcs.map((a,i)=>(
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw}
          strokeDasharray={`${a.pct*2.827} 282.7`}
          strokeDashoffset={`${282.7*(1-arcs.slice(0,i).reduce((s,x)=>s+x.pct,0)/100)}`}
          strokeLinecap="butt"/>
      ))}
      <text x={cx} y={cy-5} textAnchor="middle" fill="#F0F0F0" fontSize="13" fontWeight="700">{arcs[0]?.pct||0}%</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="#555" fontSize="9">billable</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const today=new Date().toISOString().split('T')[0];
  const router = useRouter();
  const [user,setUser]       = useState(null);
  const [profile,setProfile] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [tab,setTab]               = useState('today');
  const [online,setOnline]         = useState(false);
  const [clock,setClock]           = useState('');
  const [liveActs,setLiveActs]     = useState([]);
  const [allActs,setAllActs]       = useState([]);
  const [dates,setDates]           = useState([]);
  const [selDate,setSelDate]       = useState(today);
  const [analyticsPeriod,setAP]    = useState('day');
  const [invoices,setInvoices]     = useState([]);
  const [matters,setMatters]       = useState([]);
  const [viewInv,setViewInv]       = useState(null);
  const [invMatterId,setInvMatterId] = useState('');
  const [invAtty,setInvAtty]       = useState('Adv. T. Motsoeneng');
  const [invRate,setInvRate]       = useState(150);
  const [invPeriod,setInvPeriod]   = useState('day');
  const [preview,setPreview]       = useState(null);
  const [seeding,setSeeding]       = useState(false);
  const [filterCls,setFilterCls]   = useState('');
  const [filterDate,setFilterDate] = useState('');
  const [filterApp,setFilterApp]   = useState('');
  const [archFilter,setArchFilter] = useState('');
  const searchRef                  = useRef(null);
  const [searchQuery,setSearchQuery]   = useState('');
  const [searchResults,setSearchResults] = useState(null);
  const [searching,setSearching]       = useState(false);
  const [histYear,setHistYear]         = useState(new Date().getFullYear());
  const [histMonths,setHistMonths]     = useState([]);
  const [histYears,setHistYears]       = useState([]);
  const [selMonth,setSelMonth]         = useState(null);
  const [monthData,setMonthData]       = useState(null);
  const [showCall,setShowCall]     = useState(false);
  const [callForm,setCallForm]     = useState({description:'',matterId:'',durationMins:6,date:today});
  const [callSaving,setCallSaving] = useState(false);
  const [showMatterForm,setShowMatterForm] = useState(false);
  const [matterForm,setMatterForm] = useState({id:'',name:'',client:'',description:''});
  const [matterSaving,setMatterSaving] = useState(false);
  const [matterMsg,setMatterMsg]   = useState('');

  // ── Trust State ───────────────────────────────────────────────────
  const [trustTransactions,setTrustTransactions] = useState([]);
  const [trustAccounts,setTrustAccounts]         = useState([]);
  const [trustBalances,setTrustBalances]         = useState({});
  const [trustLoading,setTrustLoading]           = useState(false);
  const [trustTab,setTrustTab]                   = useState('ledger');
  const [trustAlert,setTrustAlert]               = useState({msg:'',type:''});
  const [trustSaving,setTrustSaving]             = useState(false);
  // Receipt form
  const [rForm,setRForm] = useState({date:today,amount:'',matterId:'',accountId:'',reference:'',receivedFrom:'',narration:''});
  // Payment form
  const [pForm,setPForm] = useState({date:today,amount:'',matterId:'',accountId:'',payee:'',reference:'',narration:''});
  const [pBalanceCheck,setPBalanceCheck] = useState(null);
  // Transfer form
  const [tForm,setTForm] = useState({date:today,amount:'',matterId:'',fromAccountId:'',toAccount:'FNB Business',invoiceId:'',narration:''});
  const [tBalanceCheck,setTBalanceCheck] = useState(null);
  // Reconciliation
  const [reconPeriod,setReconPeriod] = useState(today.substring(0,7));
  const [reconAccount,setReconAccount] = useState('');
  const [bankLines,setBankLines] = useState([]);
  const [newBankLine,setNewBankLine] = useState({date:today,description:'',amount:'',isCredit:true});
  const [matched,setMatched] = useState({});
  // Reports
  const [reportType,setReportType] = useState('trial');
  const [reportFrom,setReportFrom] = useState(today.substring(0,7)+'-01');
  const [reportTo,setReportTo]     = useState(today);

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000);
    return()=>clearInterval(t);
  },[]);

  // ── Auth ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const u = data.session.user;
      setUser(u);
      const p = await getProfile(u.id);
      setProfile(p);
      if(p?.role==='manager'||u.email==='livhuwaningwn@gmail.com'){
        router.replace('/manager'); return;
      }
      setAuthLoading(false);
    });
  },[]);

  const userId = user?.id || null;
  const isManager = profile?.role==='manager';

  // ── Load main data ────────────────────────────────────────────────────
  useEffect(()=>{
    if(authLoading || !userId) return;
    let cancelled = false;
    const doLoad = async () => {
      const [liveRes, allRes, invRes, matRes] = await Promise.all([
        fetchActivities({ date: selDate, userId }),
        fetchAllActivities({ userId }),
        fetchInvoices(userId),
        fetchMatters(userId),
      ]);
      if(cancelled) return;
      setOnline(true);
      setLiveActs((liveRes.activities||[]).sort((a,b)=>a.start_time-b.start_time));
      setAllActs(allRes.activities||[]);
      setInvoices(invRes.invoices||[]);
      setMatters(matRes.matters||[]);
      const dmap={};
      (allRes.activities||[]).forEach(a=>{ if(!dmap[a.date]) dmap[a.date]={date:a.date,sessions:0}; dmap[a.date].sessions++; });
      setDates(Object.values(dmap).sort((a,b)=>b.date.localeCompare(a.date)));
    };
    doLoad();
    const t = setInterval(doLoad, 15000);
    return()=>{ cancelled=true; clearInterval(t); };
  },[authLoading, userId, selDate]);

  const load = useCallback(async()=>{
    if(!userId) return;
    const [liveRes, allRes, invRes, matRes] = await Promise.all([
      fetchActivities({ date: selDate, userId }),
      fetchAllActivities({ userId }),
      fetchInvoices(userId),
      fetchMatters(userId),
    ]);
    setOnline(true);
    setLiveActs((liveRes.activities||[]).sort((a,b)=>a.start_time-b.start_time));
    setAllActs(allRes.activities||[]);
    setInvoices(invRes.invoices||[]);
    setMatters(matRes.matters||[]);
    const dmap={};
    (allRes.activities||[]).forEach(a=>{ if(!dmap[a.date]) dmap[a.date]={date:a.date,sessions:0}; dmap[a.date].sessions++; });
    setDates(Object.values(dmap).sort((a,b)=>b.date.localeCompare(a.date)));
  },[userId, selDate]);

  // ── Load trust data ───────────────────────────────────────────────────
  const loadTrust = useCallback(async()=>{
    if(!userId) return;
    setTrustLoading(true);
    // Load trust accounts
    const { data: accs } = await supabase.from('trust_accounts').select('*').eq('is_active',true).order('name');
    setTrustAccounts(accs||[]);
    if(accs&&accs.length&&!rForm.accountId) {
      setRForm(f=>({...f,accountId:accs[0].id}));
      setPForm(f=>({...f,accountId:accs[0].id}));
      setTForm(f=>({...f,fromAccountId:accs[0].id}));
      setReconAccount(accs[0].id);
    }
    // Load all trust transactions
    const { data: txns } = await supabase
      .from('trust_transactions')
      .select('*')
      .order('date',{ascending:false})
      .order('created_at',{ascending:false});
    setTrustTransactions(txns||[]);
    // Compute balances per matter
    const bals={};
    (txns||[]).forEach(t=>{
      if(!bals[t.matter_id]) bals[t.matter_id]=0;
      if(t.type==='receipt') bals[t.matter_id]+=Number(t.amount);
      else bals[t.matter_id]-=Number(t.amount);
    });
    setTrustBalances(bals);
    setTrustLoading(false);
  },[userId]);

  useEffect(()=>{ if(tab==='trust'&&userId) loadTrust(); },[tab,userId]);

  // ── Search ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!searchQuery.trim()){ setSearchResults(null); return; }
    const t = setTimeout(async()=>{
      if(!userId) return;
      setSearching(true);
      const res = await searchAll(searchQuery.trim(), userId);
      const fuseA = new Fuse(res.activities||[], {keys:['window_title','app_display_name','matter'],threshold:0.4});
      const fuseM = new Fuse(res.matters||[],    {keys:['name','client','id'],threshold:0.3});
      const fuseI = new Fuse(res.invoices||[],   {keys:['client','matter_name','id'],threshold:0.3});
      const q = searchQuery.toLowerCase();
      const foundA = fuseA.search(q).map(r=>r.item);
      const foundM = fuseM.search(q).map(r=>r.item);
      const foundI = fuseI.search(q).map(r=>r.item);
      const aIds = new Set(foundA.map(a=>a.id));
      const mIds = new Set(foundM.map(m=>m.id));
      const iIds = new Set(foundI.map(i=>i.id));
      setSearchResults({
        activities:[...foundA,...(res.activities||[]).filter(a=>!aIds.has(a.id))].slice(0,40),
        matters:   [...foundM,...(res.matters||[]).filter(m=>!mIds.has(m.id))],
        invoices:  [...foundI,...(res.invoices||[]).filter(i=>!iIds.has(i.id))],
        query: searchQuery
      });
      setSearching(false);
    }, 350);
    return()=>clearTimeout(t);
  },[searchQuery, userId]);

  // ── History ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(tab!=='history'||!userId) return;
    fetchHistory(histYear, userId).then(res=>{
      if(res.months) setHistMonths(res.months);
      setHistYears([...new Set(allActs.map(a=>a.date?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a));
    });
  },[tab, histYear, userId]);

  const loadMonth = (month)=>{
    if(!userId) return;
    setSelMonth(month);
    fetchMonthActivities(month, userId).then(res=>{
      if(!res.activities) return;
      const acts=res.activities;
      const tSec=acts.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
      const bSec=acts.filter(a=>a.is_billable).reduce((s,a)=>s+Number(a.duration_seconds||0),0);
      const bU=acts.filter(a=>a.is_billable).reduce((s,a)=>s+Number(a.billing_units||0),0);
      setMonthData({activities:acts,totals:{sessions:acts.length,total_seconds:tSec,billable_seconds:bSec,billable_units:bU}});
    });
  };

  // ── Trust helper — show alert ─────────────────────────────────────────
  function showTrustAlert(msg,type='success'){
    setTrustAlert({msg,type});
    setTimeout(()=>setTrustAlert({msg:'',type:''}),5000);
  }

  // ── Trust — get balance for a matter ─────────────────────────────────
  function getMatterBalance(matterId){ return trustBalances[matterId]||0; }

  // ── Trust — post receipt ──────────────────────────────────────────────
  async function postReceipt(){
    if(!rForm.date||!rForm.amount||!rForm.matterId||!rForm.narration){
      showTrustAlert('Please fill in all required fields.','error'); return;
    }
    const amount=parseFloat(rForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    setTrustSaving(true);
    const receiptNo = nextReceiptNo(trustTransactions);
    const { error } = await supabase.from('trust_transactions').insert([{
      type:'receipt', matter_id:rForm.matterId, user_id:userId,
      date:rForm.date, amount, receipt_no:receiptNo,
      received_from:rForm.receivedFrom, trust_account_id:rForm.accountId||null,
      reference:rForm.reference, narration:rForm.narration, captured_by:userId
    }]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`Receipt ${receiptNo} posted — ${fmtR(amount)} credited to ${matters.find(m=>m.id===rForm.matterId)?.client||rForm.matterId}`,'success');
    setRForm({date:today,amount:'',matterId:'',accountId:rForm.accountId,reference:'',receivedFrom:'',narration:''});
    setTrustSaving(false);
    loadTrust();
  }

  // ── Trust — post payment ──────────────────────────────────────────────
  async function postPayment(){
    if(!pForm.date||!pForm.amount||!pForm.matterId||!pForm.payee||!pForm.narration){
      showTrustAlert('Please fill in all required fields.','error'); return;
    }
    const amount=parseFloat(pForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const bal=getMatterBalance(pForm.matterId);
    if(amount>bal){
      showTrustAlert(`Insufficient trust balance. Available: ${fmtR(bal)} — Requested: ${fmtR(amount)}. Payment blocked.`,'error'); return;
    }
    setTrustSaving(true);
    const { error } = await supabase.from('trust_transactions').insert([{
      type:'payment', matter_id:pForm.matterId, user_id:userId,
      date:pForm.date, amount, payee:pForm.payee,
      trust_account_id:pForm.accountId||null,
      reference:pForm.reference, narration:pForm.narration, captured_by:userId
    }]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`Payment of ${fmtR(amount)} to ${pForm.payee} posted successfully.`,'success');
    setPForm({date:today,amount:'',matterId:'',accountId:pForm.accountId,payee:'',reference:'',narration:''});
    setPBalanceCheck(null);
    setTrustSaving(false);
    loadTrust();
  }

  // ── Trust — post transfer ─────────────────────────────────────────────
  async function postTransfer(){
    if(!tForm.date||!tForm.amount||!tForm.matterId){
      showTrustAlert('Please fill in all required fields.','error'); return;
    }
    const amount=parseFloat(tForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const bal=getMatterBalance(tForm.matterId);
    if(amount>bal){
      showTrustAlert(`Insufficient trust balance. Available: ${fmtR(bal)}. Transfer blocked.`,'error'); return;
    }
    setTrustSaving(true);
    const { error } = await supabase.from('trust_transactions').insert([{
      type:'transfer', matter_id:tForm.matterId, user_id:userId,
      date:tForm.date, amount,
      trust_account_id:tForm.fromAccountId||null,
      to_account:tForm.toAccount,
      invoice_id:tForm.invoiceId,
      narration:tForm.narration||`Transfer of fees — ${tForm.matterId}`,
      captured_by:userId
    }]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`Transfer of ${fmtR(amount)} posted. Both trust and business legs recorded.`,'success');
    setTForm({date:today,amount:'',matterId:'',fromAccountId:tForm.fromAccountId,toAccount:'FNB Business',invoiceId:'',narration:''});
    setTBalanceCheck(null);
    setTrustSaving(false);
    loadTrust();
  }

  // ── Trust — check balance live ────────────────────────────────────────
  function checkPaymentBalance(matterId,amount){
    if(!matterId||!amount){ setPBalanceCheck(null); return; }
    const bal=getMatterBalance(matterId);
    const amt=parseFloat(amount);
    if(isNaN(amt)||amt<=0){ setPBalanceCheck(null); return; }
    setPBalanceCheck({bal,amt,ok:amt<=bal});
  }
  function checkTransferBalance(matterId,amount){
    if(!matterId||!amount){ setTBalanceCheck(null); return; }
    const bal=getMatterBalance(matterId);
    const amt=parseFloat(amount);
    if(isNaN(amt)||amt<=0){ setTBalanceCheck(null); return; }
    setTBalanceCheck({bal,amt,ok:amt<=bal});
  }

  // ── Trust — get matter transactions ──────────────────────────────────
  function getMatterTransactions(matterId){
    return trustTransactions.filter(t=>t.matter_id===matterId).sort((a,b)=>a.date.localeCompare(b.date)||a.created_at?.localeCompare(b.created_at||'')||0);
  }

  // ── Trust — running balance for matter ledger ─────────────────────────
  function getMatterLedger(matterId){
    let running=0;
    return getMatterTransactions(matterId).map(t=>{
      if(t.type==='receipt') running+=Number(t.amount);
      else running-=Number(t.amount);
      return {...t,runningBalance:running};
    });
  }

  // ── Trust — total trust held ──────────────────────────────────────────
  function totalTrustHeld(){ return Object.values(trustBalances).reduce((s,v)=>s+v,0); }

  // ── Trust — reports ───────────────────────────────────────────────────
  function getReportTransactions(){
    return trustTransactions.filter(t=>t.date>=reportFrom&&t.date<=reportTo);
  }

  // ── Reclassify ────────────────────────────────────────────────────────
  async function reclassify(id,cls){
    const act = [...allActs,...liveActs].find(a=>a.id===id);
    const units = cls==='billable' ? Math.max(1,Math.ceil((act?.duration_seconds||0)/360)) : 0;
    await patchActivity(id, {classification:cls,billing_units:units,is_billable:cls==='billable'});
    load();
  }

  async function assignMatter(actId,matterId){
    await patchActivityMatter(actId, matterId);
    load();
  }

  async function seedDemo(){
    if(!user) return;
    setSeeding(true);
    const dayStart = new Date(selDate+'T08:00:00').getTime();
    const LEGAL_KW = ['contract','client','case','matter','settlement','litigation','counsel','court','deed','agreement'];
    const demos = [
      {app:'WINWORD.EXE', disp:'Microsoft Word',    title:'Smith v Jones - Settlement Agreement Draft.docx', dur:2400},
      {app:'Teams.exe',   disp:'Microsoft Teams',   title:'Client Consultation Call - ABC Corp Matter',       dur:3600},
      {app:'OUTLOOK.EXE',disp:'Microsoft Outlook', title:'RE: Case Update - Litigation Matter 2025',         dur:720 },
      {app:'chrome.exe',  disp:'Google Chrome',     title:'LexisNexis - Case Law Research - Contract Law',    dur:1800},
      {app:'EXCEL.EXE',   disp:'Microsoft Excel',   title:'Client Billing Summary Q1 2025.xlsx',             dur:1200},
      {app:'Acrobat.exe', disp:'Adobe Acrobat',     title:'Pleadings - Motion to Dismiss - Client Matter.pdf',dur:2100},
      {app:'WINWORD.EXE', disp:'Microsoft Word',    title:'Contract Draft - XYZ Acquisition Agreement.docx', dur:1800},
      {app:'chrome.exe',  disp:'Google Chrome',     title:'YouTube - Music Mix',                              dur:600 },
      {app:'OUTLOOK.EXE',disp:'Microsoft Outlook', title:'FWD: Trust Deed Amendment - Estate Matter',        dur:540 },
    ];
    const rows = demos.map((d,i)=>{
      const st  = dayStart + i*(d.dur*1000+60000);
      const t   = d.title.toLowerCase();
      const isBrowser = ['chrome','edge'].some(b=>d.app.toLowerCase().includes(b));
      const hasLegal  = LEGAL_KW.some(k=>t.includes(k));
      const cls = isBrowser?(hasLegal?'work':'non-billable'):(hasLegal?'billable':'work');
      const units = cls==='billable'?Math.max(1,Math.ceil(d.dur/360)):0;
      return { user_id:user.id, agent_id:'demo', app_name:d.app, app_display_name:d.disp, window_title:d.title, start_time:st, end_time:st+d.dur*1000, duration_seconds:d.dur, classification:cls, billing_units:units, is_billable:cls==='billable', matter:'', date:selDate };
    });
    await supabase.from('activities').upsert(rows, {onConflict:'user_id,agent_id,start_time',ignoreDuplicates:true});
    await load(); setSeeding(false);
  }

  async function logCall(){
    if(!callForm.description) return;
    setCallSaving(true);
    const durSec=Math.max(6,Number(callForm.durationMins)||6)*60;
    const m=matters.find(x=>x.id===callForm.matterId);
    const title=`📞 Call: ${callForm.description}${m?' ['+m.id+']':''}`;
    const now=Date.now();
    const uniqueAgent=`manual-call-${now}`;
    const units = Math.max(1,Math.ceil(durSec/360));
    await supabase.from('activities').insert({ user_id:user.id, agent_id:uniqueAgent, app_name:'Phone Call', app_display_name:'Phone Call', window_title:title, start_time:now, end_time:now+durSec*1000, duration_seconds:durSec, classification:'billable', billing_units:units, is_billable:true, matter:callForm.matterId||'', date:new Date().toISOString().split('T')[0] });
    await load();
    setCallSaving(false); setShowCall(false);
    setCallForm({description:'',matterId:'',durationMins:6,date:today});
  }

  async function handleCreateMatter(){
    if(!matterForm.name||!matterForm.client) return;
    setMatterSaving(true);
    const res = await createMatter({...matterForm, userId:user.id});
    if(res.error){ alert(res.error.message); setMatterSaving(false); return; }
    const savedId = (res.data?.id || matterForm.id).toUpperCase();
    const words = [...matterForm.name.toLowerCase().split(/[\s\-\/,.()]+/),...matterForm.client.toLowerCase().split(/[\s\-\/,.()]+/)].filter(w=>w.length>2);
    const toLink = allActs.filter(a=>!a.matter && words.some(w=>(a.window_title||'').toLowerCase().includes(w)));
    if(toLink.length > 0) await Promise.all(toLink.map(a=>patchActivityMatter(a.id, savedId)));
    setMatterSaving(false);
    setShowMatterForm(false);
    setMatterForm({id:'',name:'',client:'',description:''});
    setMatterMsg(`Matter ${savedId} created — ${toLink.length} activit${toLink.length===1?'y':'ies'} linked.`);
    setTimeout(()=>setMatterMsg(''),4000);
    load();
  }

  async function handleDeleteMatter(id){
    if(!confirm(`Delete matter ${id}? Activities will be unlinked.`)) return;
    await deleteMatter(id);
    load();
  }

  const invMatter=matters.find(m=>m.id===invMatterId)||null;

  function buildPreview(){
    if(!invMatterId) return;
    const mActs=allActs.filter(a=>a.matter===invMatterId);
    let filtered;
    if(invPeriod==='day') filtered=mActs.filter(a=>a.date===selDate);
    else if(invPeriod==='week'){
      const d=new Date(selDate+'T12:00:00'); d.setDate(d.getDate()-d.getDay()+1);
      const s=d.toISOString().split('T')[0]; const e=new Date(d); e.setDate(d.getDate()+6);
      filtered=mActs.filter(a=>a.date>=s&&a.date<=e.toISOString().split('T')[0]);
    } else { filtered=mActs.filter(a=>a.date.startsWith(selDate.substring(0,7))); }
    const label=invPeriod==='day'?fdate(selDate):invPeriod==='week'?'This week':fmonth(selDate);
    const bill=filtered.filter(a=>a.classification==='billable');
    const tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    setPreview({label,filtered,bill,tU,tAmt:tU*invRate});
  }

  async function handleSaveInvoice(){
    if(!preview||!invMatter) return;
    const res=await saveInvoice({ client:invMatter.client, matter_id:invMatter.id, matter_name:invMatter.name, attorney:invAtty, period:invPeriod, period_label:preview.label, rate:invRate, total_units:preview.tU, total_amount:preview.tAmt, activity_ids:preview.bill.map(a=>a.id) }, user.id);
    if(res.error){ alert('Error saving invoice: ' + res.error.message); return; }
    setPreview(null); await load(); setTab('archive');
  }

  // Analytics helpers
  function getAnalyticsActs(p){
    if(p==='day') return allActs.filter(a=>a.date===selDate);
    if(p==='week'){
      const d=new Date(selDate+'T12:00:00'); d.setDate(d.getDate()-d.getDay()+1);
      const s=d.toISOString().split('T')[0]; const e=new Date(d); e.setDate(d.getDate()+6);
      return allActs.filter(a=>a.date>=s&&a.date<=e.toISOString().split('T')[0]);
    }
    return allActs.filter(a=>a.date.startsWith(selDate.substring(0,7)));
  }
  function appBars(acts){ const m={}; acts.forEach(a=>{ const k=a.app_display_name||'Unknown'; if(!m[k]) m[k]={label:k.replace('Microsoft ','').substring(0,10),value:0,bill:0}; m[k].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[k].bill+=Number(a.duration_seconds||0); }); return Object.values(m).sort((a,b)=>b.value-a.value).slice(0,8).map(d=>({...d,label2:toHm(d.value),color:d.bill>d.value*0.5?'#6CC04A':'#2E4A6E'})); }
  function dayBars(acts){ const m={}; acts.forEach(a=>{ if(!m[a.date]) m[a.date]={label:new Date(a.date+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short'}),value:0,bill:0}; m[a.date].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[a.date].bill+=Number(a.duration_seconds||0); }); return Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).map(([,d])=>({...d,label2:`${Math.round(d.value/60)}m`,value:Math.round(d.value/60),color:d.bill/Math.max(d.value,1)>0.5?'#6CC04A':'#2E4A6E'})); }
  function hourBars(acts){ const m={}; acts.forEach(a=>{ const hr=new Date(Number(a.start_time)).getHours(); if(!m[hr]) m[hr]={value:0,bill:0}; m[hr].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[hr].bill+=Number(a.duration_seconds||0); }); return Array.from({length:13},(_,i)=>i+7).map(h=>({label:`${String(h).padStart(2,'0')}h`,value:Math.round((m[h]?.value||0)/60),label2:m[h]?.value>0?`${Math.round(m[h].value/60)}m`:'',color:(m[h]?.bill||0)>(m[h]?.value||0)*0.5?'#6CC04A':'#2E4A6E'})); }

  const dayActs=liveActs;
  const daySec=dayActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const dayBillSec=dayActs.filter(a=>a.classification==='billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const dayBillU=dayActs.filter(a=>a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
  const allApps=[...new Set(allActs.map(a=>a.app_display_name))].sort();
  const filtActs=allActs.filter(a=>{
    if(filterCls && a.classification!==filterCls) return false;
    if(filterDate && a.date!==filterDate) return false;
    if(filterApp && a.app_display_name!==filterApp) return false;
    return true;
  }).sort((a,b)=>b.start_time-a.start_time);

  // ── Styles ────────────────────────────────────────────────────────
  const C={
    page:  {background:'#0A0A0A',minHeight:'100vh',fontFamily:'system-ui,sans-serif',color:'#F0F0F0'},
    hdr:   {background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    mark:  {background:'#000',border:'1px solid #252525',borderRadius:7,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,letterSpacing:'-0.06em'},
    ntab:  (on)=>({background:'transparent',border:`1px solid ${on?'#2A2A2A':'transparent'}`,color:on?'#F0F0F0':'#555',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
    pill:  {display:'flex',alignItems:'center',gap:6,background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#6CC04A'},
    dot:   {width:7,height:7,borderRadius:'50%',background:'#6CC04A',boxShadow:'0 0 6px rgba(108,192,74,0.8)'},
    main:  {maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card:  {background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat:  (acc)=>({background:acc?'rgba(108,192,74,0.05)':'#111',border:`1px solid ${acc?'rgba(108,192,74,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    btn:   (v='s')=>({background:v==='p'?'#6CC04A':v==='pur'?'#A78BFA':v==='r'?'rgba(220,80,80,0.15)':v==='trust'?'rgba(74,144,217,0.15)':'transparent',border:v==='p'?'none':v==='pur'?'none':v==='g'?'1px solid rgba(108,192,74,0.35)':v==='r'?'1px solid rgba(220,80,80,0.4)':v==='trust'?'1px solid rgba(74,144,217,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='pur'?'#0A0A0A':v==='g'?'#6CC04A':v==='r'?'#E05252':v==='trust'?'#4A90D9':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'||v==='pur'?700:500,whiteSpace:'nowrap'}),
    sel:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:    {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:    {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    inp:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%'},
    asel:  {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'3px 7px',borderRadius:4,fontSize:10,fontFamily:'inherit'},
    ptab:  (on)=>({background:on?'#2A2A2A':'transparent',border:'none',color:on?'#F0F0F0':'#555',padding:'5px 14px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:on?600:400}),
    modal: {position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20},
    mbox:  {background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:480},
    lbl:   {fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'},
    tinp:  {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',marginTop:4},
    ttab:  (on)=>({background:on?'rgba(74,144,217,0.15)':'transparent',border:`1px solid ${on?'rgba(74,144,217,0.4)':'#252525'}`,color:on?'#4A90D9':'#555',padding:'6px 16px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
  };

  // ── InvoiceDoc ────────────────────────────────────────────────────
  function InvoiceDoc({inv,acts}){
    const bill=(acts||[]).filter(a=>a.classification==='billable');
    const rate=Number(inv.rate)||150;
    const tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    const tAmt=tU*rate;
    const tSec=(acts||[]).reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    const bSec=bill.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    return(
      <div style={{background:'#fff',color:'#111',borderRadius:8,padding:28,fontFamily:'system-ui'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'2px solid #6CC04A',paddingBottom:16,marginBottom:20}}>
          <div><div style={{fontWeight:900,fontSize:24,letterSpacing:'-0.04em'}}>M<span style={{color:'#6CC04A'}}>B</span></div><div style={{fontSize:11,color:'#999',marginTop:2}}>Motsoeneng Bill Attorneys</div></div>
          <div style={{textAlign:'right'}}><div style={{fontWeight:800,fontSize:20}}>TAX INVOICE</div><div style={{fontSize:12,color:'#888',marginTop:3}}>{inv.id}</div><div style={{fontSize:11,color:'#bbb'}}>Issued: {fdate(new Date().toISOString().split('T')[0])}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:14}}>
          <div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Billed To</div><div style={{fontWeight:700,fontSize:14}}>{inv.client}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{inv.matter_name||inv.matter}</div><div style={{fontSize:11,color:'#bbb'}}>Ref: {inv.matter_id||''}</div></div>
          <div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Attorney</div><div style={{fontWeight:600,fontSize:13}}>{inv.attorney}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>Period: {inv.period_label}</div><div style={{fontSize:11,color:'#888'}}>Total: {toHm(tSec)} · Billable: {toHm(bSec)}</div></div>
        </div>
        <div style={{display:'flex',border:'1px solid #eee',borderRadius:7,overflow:'hidden',marginBottom:16}}>
          {[['Sessions',bill.length],['Units',tU],['Rate',`R${rate}/unit`],['Total Due',`R${tAmt.toLocaleString()}`]].map(([l,v],i,arr)=>(
            <div key={l} style={{flex:1,padding:12,textAlign:'center',borderRight:i<arr.length-1?'1px solid #eee':'none'}}>
              <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.06em',color:'#aaa'}}>{l}</div>
              <div style={{fontWeight:800,fontSize:17,marginTop:3}}>{v}</div>
            </div>
          ))}
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#f9f9f9'}}>{['Date/Time','Application','Description','Time','Units','Amount'].map(h=><th key={h} style={{padding:'8px',fontSize:9,textTransform:'uppercase',letterSpacing:'.06em',color:'#aaa',textAlign:['Time','Units','Amount'].includes(h)?'right':'left',borderBottom:'2px solid #eee'}}>{h}</th>)}</tr></thead>
          <tbody>
            {!bill.length&&<tr><td colSpan={6} style={{padding:16,textAlign:'center',color:'#ccc',fontSize:11}}>No billable activities.</td></tr>}
            {bill.map((a,i)=>(
              <tr key={i}>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,color:'#666',whiteSpace:'nowrap'}}>{fdate(a.date)} {ftime(a.start_time)}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11}}>{a.app_display_name}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,color:'#777',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.window_title}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace'}}>{toHm(a.duration_seconds)}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace'}}>{calcUnits(a.duration_seconds)}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace',fontWeight:600}}>R{calcAmt(a.duration_seconds,rate).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{background:'#f7f7f7',borderRadius:7,padding:'14px 18px',marginTop:14,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
          <div><div style={{fontSize:12,color:'#555'}}><strong>{tU} units</strong> x R{rate} per unit</div><div style={{fontSize:10,color:'#bbb',marginTop:3}}>1 billing unit = 6 minutes (standard SA legal billing)</div></div>
          <div style={{textAlign:'right',minWidth:220}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:12,color:'#888',marginBottom:3}}><span>Subtotal (excl. VAT)</span><span style={{fontFamily:'monospace',color:'#555'}}>R{tAmt.toLocaleString()}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:12,color:'#888',marginBottom:8,paddingBottom:8,borderBottom:'1px solid #ddd'}}><span>VAT @ 15%</span><span style={{fontFamily:'monospace',color:'#555'}}>R{(tAmt*0.15).toFixed(2)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'baseline'}}><span style={{fontSize:12,fontWeight:600,color:'#111'}}>Total Due (incl. VAT)</span><span style={{fontSize:22,fontWeight:900,color:'#111'}}>R{(tAmt*1.15).toFixed(2)}</span></div>
          </div>
        </div>
        <div style={{marginTop:14,fontSize:10,color:'#ccc',textAlign:'center',lineHeight:1.8}}>Motsoeneng Bill Attorneys · VAT: 4100000000 · FNB 62000000000 · Branch: 250655<br/>accounts@motsoenengbill.co.za · Computer generated invoice.</div>
      </div>
    );
  }

  // ── AnalyticsTab ──────────────────────────────────────────────────
  function AnalyticsTab(){
    const acts=getAnalyticsActs(analyticsPeriod);
    const tSec=acts.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    const bSec=acts.filter(a=>a.classification==='billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    const wSec=acts.filter(a=>a.classification==='work').reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    const nbSec=acts.filter(a=>a.classification==='non-billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    const bU=acts.filter(a=>a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    const label=analyticsPeriod==='day'?fdate(selDate):analyticsPeriod==='week'?'This week':fmonth(selDate);
    return(
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Analytics</div><div style={{fontSize:11,color:'#444'}}>{label} · {acts.length} sessions</div></div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <select style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}>
              <option value={today}>Today</option>
              {dates.filter(d=>d.date!==today).map(d=><option key={d.date} value={d.date}>{fdate(d.date)}</option>)}
            </select>
            <div style={{display:'flex',background:'#1A1A1A',border:'1px solid #252525',borderRadius:6,padding:2}}>
              {[['day','Day'],['week','Week'],['month','Month']].map(([v,l])=>(
                <button key={v} style={C.ptab(analyticsPeriod===v)} onClick={()=>setAP(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        {!acts.length?<div style={{...C.card,textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:28,marginBottom:10}}>📊</div><div>No data for this period</div></div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {[{l:'Total Time',v:toHm(tSec),s:`${acts.length} sessions`,a:false},{l:'Billable Time',v:toHm(bSec),s:`${pct(bSec,tSec)}% of total`,a:true},{l:'Billing Units',v:bU,s:`@ R${invRate}/unit`,a:false},{l:'Est. Revenue',v:`R${(bU*invRate).toLocaleString()}`,s:`${bU} units`,a:false}].map(({l,v,s,a})=>(
                <div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:14,marginBottom:14}}>
              <div style={C.card}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:14}}>Time breakdown</div>
                <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><DonutChart segments={[{color:'#6CC04A',value:pct(bSec,tSec)},{color:'#4A90D9',value:pct(wSec,tSec)},{color:'#333',value:pct(nbSec,tSec)}]} size={140}/></div>
                {[{l:'Billable',c:'#6CC04A',s:bSec,p:pct(bSec,tSec)},{l:'Work',c:'#4A90D9',s:wSec,p:pct(wSec,tSec)},{l:'Non-Billable',c:'#444',s:nbSec,p:pct(nbSec,tSec)}].map(r=>(
                  <div key={r.l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',borderTop:'1px solid #181818'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:8,height:8,borderRadius:2,background:r.c}}/><span style={{fontSize:11,color:'#888'}}>{r.l}</span></div>
                    <div><span style={{fontSize:11,color:'#C0C0C0',fontFamily:'monospace'}}>{toHm(r.s)}</span><span style={{fontSize:10,color:'#444',marginLeft:6}}>{r.p}%</span></div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Time per application</div>
                <BarChart data={appBars(acts)} height={150}/>
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>{analyticsPeriod==='day'?'Activity by hour':'Activity by day'}</div>
              <div style={{fontSize:10,color:'#444',marginBottom:10}}>Minutes tracked · green = mostly billable</div>
              <BarChart data={analyticsPeriod==='day'?hourBars(acts):dayBars(acts)} height={130}/>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── TRUST TAB COMPONENT ───────────────────────────────────────────
  function TrustTab(){
    const total=totalTrustHeld();
    const receiptsTotal=trustTransactions.filter(t=>t.type==='receipt').reduce((s,t)=>s+Number(t.amount),0);
    const paymentsTotal=trustTransactions.filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0);
    const transfersTotal=trustTransactions.filter(t=>t.type==='transfer').reduce((s,t)=>s+Number(t.amount),0);

    const [selectedMatter,setSelectedMatter] = useState('');
    const ledger = selectedMatter ? getMatterLedger(selectedMatter) : [];

    // Bank recon state
    const systemTotal = trustTransactions.reduce((s,t)=>t.type==='receipt'?s+Number(t.amount):s-Number(t.amount),0);
    const bankTotal = bankLines.reduce((s,l)=>l.isCredit?s+Number(l.amount||0):s-Number(l.amount||0),0);
    const diff = Math.abs(systemTotal-bankTotal);

    return(
      <div>
        {/* Trust alert */}
        {trustAlert.msg&&(
          <div style={{background:trustAlert.type==='error'?'rgba(220,80,80,0.1)':'rgba(108,192,74,0.1)',border:`1px solid ${trustAlert.type==='error'?'rgba(220,80,80,0.4)':'rgba(108,192,74,0.3)'}`,borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:trustAlert.type==='error'?'#E05252':'#6CC04A',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>{trustAlert.msg}</span>
            <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:14}} onClick={()=>setTrustAlert({msg:'',type:''})}>✕</button>
          </div>
        )}

        {/* Trust sub-nav */}
        <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
          {[['ledger','📊 Trust Ledger'],['receipt','⬇ Receipt'],['payment','⬆ Payment'],['transfer','↔ Transfer'],['recon','🔁 Reconciliation'],['reports','📋 Reports']].map(([v,l])=>(
            <button key={v} style={C.ttab(trustTab===v)} onClick={()=>setTrustTab(v)}>{l}</button>
          ))}
          {trustLoading&&<span style={{fontSize:11,color:'#555',alignSelf:'center'}}>Loading...</span>}
        </div>

        {/* ── LEDGER ── */}
        {trustTab==='ledger'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {[{l:'Total trust held',v:fmtR(total),a:true},{l:'Total receipts',v:fmtR(receiptsTotal),a:false},{l:'Total payments',v:fmtR(paymentsTotal),a:false},{l:'Total transferred',v:fmtR(transfersTotal),a:false}].map(({l,v,a})=>(
                <div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div></div>
              ))}
            </div>
            {/* All matters trust balances */}
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All matters — trust balances</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Matter ID','Client','Description','Balance','Action'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!matters.length&&<tr><td colSpan={5} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No matters found. Create matters first.</td></tr>}
                    {matters.map(m=>{
                      const bal=getMatterBalance(m.id);
                      return(
                        <tr key={m.id} style={{cursor:'pointer'}} onClick={()=>setSelectedMatter(selectedMatter===m.id?'':m.id)}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td>
                          <td style={{...C.td,fontWeight:500,color:'#C8C8C8'}}>{m.client}</td>
                          <td style={{...C.td,color:'#555',fontSize:10}}>{m.name}</td>
                          <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#6CC04A':bal<0?'#E05252':'#555',textAlign:'right'}}>{fmtR(bal)}</td>
                          <td style={C.td}><button style={{...C.btn('trust'),fontSize:10,padding:'3px 10px'}}>{selectedMatter===m.id?'Hide':'View ledger'}</button></td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#0D0D0D'}}>
                      <td colSpan={3} style={{...C.th,color:'#888',paddingTop:12}}>Grand total</td>
                      <td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Matter ledger drill-down */}
            {selectedMatter&&(
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#4A90D9',marginBottom:12}}>
                  {selectedMatter} — {matters.find(m=>m.id===selectedMatter)?.client} — Running ledger
                </div>
                {!ledger.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>No transactions yet for this matter.</div>:(
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>{['Date','Type','Receipt No','Reference','Narration','Debit','Credit','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {ledger.map((t,i)=>{
                          const isReceipt=t.type==='receipt';
                          const debit = !isReceipt ? Number(t.amount) : null;
                          const credit = isReceipt ? Number(t.amount) : null;
                          return(
                            <tr key={i}>
                              <td style={{...C.td,fontFamily:'monospace',fontSize:10,whiteSpace:'nowrap'}}>{fmtDate(t.date)}</td>
                              <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:isReceipt?'rgba(108,192,74,0.1)':t.type==='payment'?'rgba(220,80,80,0.1)':'rgba(74,144,217,0.1)',color:isReceipt?'#6CC04A':t.type==='payment'?'#E05252':'#4A90D9'}}>{t.type}</span></td>
                              <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555'}}>{t.receipt_no||'—'}</td>
                              <td style={{...C.td,fontSize:10,color:'#555'}}>{t.reference||'—'}</td>
                              <td style={{...C.td,fontSize:11}}>{t.narration}</td>
                              <td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{debit!==null?fmtR(debit):''}</td>
                              <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{credit!==null?fmtR(credit):''}</td>
                              <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:t.runningBalance>=0?'#6CC04A':'#E05252',textAlign:'right'}}>{fmtR(t.runningBalance)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── RECEIPT ── */}
        {trustTab==='receipt'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust receipt</div>
                <span style={{fontSize:10,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'2px 10px',borderRadius:20}}>Next: {nextReceiptNo(trustTransactions)}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={rForm.date} onChange={e=>setRForm(f=>({...f,date:e.target.value}))}/></div>
                  <div><label style={C.lbl}>Amount (ZAR) *</label><input type="number" style={C.tinp} placeholder="0.00" min="0.01" step="0.01" value={rForm.amount} onChange={e=>setRForm(f=>({...f,amount:e.target.value}))}/></div>
                </div>
                <div><label style={C.lbl}>Matter *</label>
                  <select style={C.tinp} value={rForm.matterId} onChange={e=>setRForm(f=>({...f,matterId:e.target.value}))}>
                    <option value="">Select matter...</option>
                    {matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}
                  </select>
                </div>
                <div><label style={C.lbl}>Trust bank account</label>
                  <select style={C.tinp} value={rForm.accountId} onChange={e=>setRForm(f=>({...f,accountId:e.target.value}))}>
                    {trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="EFT ref, cheque no." value={rForm.reference} onChange={e=>setRForm(f=>({...f,reference:e.target.value}))}/></div>
                  <div><label style={C.lbl}>Received from</label><input style={C.tinp} placeholder="Payer name" value={rForm.receivedFrom} onChange={e=>setRForm(f=>({...f,receivedFrom:e.target.value}))}/></div>
                </div>
                <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Description of receipt" value={rForm.narration} onChange={e=>setRForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
                  <button style={C.btn()} onClick={()=>setRForm({date:today,amount:'',matterId:'',accountId:rForm.accountId,reference:'',receivedFrom:'',narration:''})}>Clear</button>
                  <button style={C.btn('p')} onClick={postReceipt} disabled={trustSaving}>{trustSaving?'Posting...':'Post receipt'}</button>
                </div>
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent receipts</div>
              <div style={{overflowY:'auto',maxHeight:420}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Receipt','Date','Matter','Client','Amount','Bank'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!trustTransactions.filter(t=>t.type==='receipt').length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No receipts yet</td></tr>}
                    {trustTransactions.filter(t=>t.type==='receipt').map((t,i)=>{
                      const m=matters.find(x=>x.id===t.matter_id);
                      return(
                        <tr key={i}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td>
                          <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                          <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                          <td style={{...C.td,fontSize:11}}>{m?.client||'—'}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{fmtR(t.amount)}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.trust_accounts?.name||'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT ── */}
        {trustTab==='payment'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust payment</div>
                <span style={{fontSize:10,color:'#E05252',border:'1px solid rgba(220,80,80,0.3)',padding:'2px 10px',borderRadius:20}}>Balance checked before posting</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={pForm.date} onChange={e=>setPForm(f=>({...f,date:e.target.value}))}/></div>
                  <div><label style={C.lbl}>Amount (ZAR) *</label><input type="number" style={C.tinp} placeholder="0.00" min="0.01" step="0.01" value={pForm.amount} onChange={e=>{ setPForm(f=>({...f,amount:e.target.value})); checkPaymentBalance(pForm.matterId,e.target.value); }}/></div>
                </div>
                <div><label style={C.lbl}>Matter *</label>
                  <select style={C.tinp} value={pForm.matterId} onChange={e=>{ setPForm(f=>({...f,matterId:e.target.value})); checkPaymentBalance(e.target.value,pForm.amount); }}>
                    <option value="">Select matter...</option>
                    {matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}
                  </select>
                </div>
                {pBalanceCheck&&(
                  <div style={{background:pBalanceCheck.ok?'rgba(108,192,74,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${pBalanceCheck.ok?'rgba(108,192,74,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:pBalanceCheck.ok?'#6CC04A':'#E05252'}}>
                    {pBalanceCheck.ok?`✓ Sufficient — available: ${fmtR(pBalanceCheck.bal)}, after payment: ${fmtR(pBalanceCheck.bal-pBalanceCheck.amt)}`:`✗ Insufficient — available: ${fmtR(pBalanceCheck.bal)}, shortfall: ${fmtR(pBalanceCheck.amt-pBalanceCheck.bal)}`}
                  </div>
                )}
                <div><label style={C.lbl}>Trust bank account</label>
                  <select style={C.tinp} value={pForm.accountId} onChange={e=>setPForm(f=>({...f,accountId:e.target.value}))}>
                    {trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>Payee *</label><input style={C.tinp} placeholder="Sheriff, advocate, municipality..." value={pForm.payee} onChange={e=>setPForm(f=>({...f,payee:e.target.value}))}/></div>
                  <div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="Cheque or EFT ref" value={pForm.reference} onChange={e=>setPForm(f=>({...f,reference:e.target.value}))}/></div>
                </div>
                <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Payment description" value={pForm.narration} onChange={e=>setPForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
                  <button style={C.btn()} onClick={()=>{ setPForm({date:today,amount:'',matterId:'',accountId:pForm.accountId,payee:'',reference:'',narration:''}); setPBalanceCheck(null); }}>Clear</button>
                  <button style={C.btn('p')} onClick={postPayment} disabled={trustSaving}>{trustSaving?'Posting...':'Post payment'}</button>
                </div>
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent payments</div>
              <div style={{overflowY:'auto',maxHeight:420}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Matter','Payee','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!trustTransactions.filter(t=>t.type==='payment').length&&<tr><td colSpan={5} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No payments yet</td></tr>}
                    {trustTransactions.filter(t=>t.type==='payment').map((t,i)=>(
                      <tr key={i}>
                        <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                        <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                        <td style={{...C.td,fontSize:11}}>{t.payee}</td>
                        <td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSFER ── */}
        {trustTab==='transfer'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>Trust to business transfer</div>
                <span style={{fontSize:10,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'2px 10px',borderRadius:20}}>Both legs post automatically</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={tForm.date} onChange={e=>setTForm(f=>({...f,date:e.target.value}))}/></div>
                  <div><label style={C.lbl}>Amount (ZAR) *</label><input type="number" style={C.tinp} placeholder="0.00" min="0.01" step="0.01" value={tForm.amount} onChange={e=>{ setTForm(f=>({...f,amount:e.target.value})); checkTransferBalance(tForm.matterId,e.target.value); }}/></div>
                </div>
                <div><label style={C.lbl}>Matter *</label>
                  <select style={C.tinp} value={tForm.matterId} onChange={e=>{ setTForm(f=>({...f,matterId:e.target.value})); checkTransferBalance(e.target.value,tForm.amount); }}>
                    <option value="">Select matter...</option>
                    {matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}
                  </select>
                </div>
                {tBalanceCheck&&(
                  <div style={{background:tBalanceCheck.ok?'rgba(108,192,74,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${tBalanceCheck.ok?'rgba(108,192,74,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:tBalanceCheck.ok?'#6CC04A':'#E05252'}}>
                    {tBalanceCheck.ok?`✓ Trust balance after transfer: ${fmtR(tBalanceCheck.bal-tBalanceCheck.amt)}`:`✗ Insufficient — available: ${fmtR(tBalanceCheck.bal)}`}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={C.lbl}>From trust account</label>
                    <select style={C.tinp} value={tForm.fromAccountId} onChange={e=>setTForm(f=>({...f,fromAccountId:e.target.value}))}>
                      {trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div><label style={C.lbl}>To business account</label>
                    <select style={C.tinp} value={tForm.toAccount} onChange={e=>setTForm(f=>({...f,toAccount:e.target.value}))}>
                      <option value="FNB Business">FNB Business Account</option>
                      <option value="ABSA Business">ABSA Business Account</option>
                    </select>
                  </div>
                </div>
                <div><label style={C.lbl}>Linked invoice no.</label><input style={C.tinp} placeholder="INV-XXXX or MB-XXXXXX" value={tForm.invoiceId} onChange={e=>setTForm(f=>({...f,invoiceId:e.target.value}))}/></div>
                <div><label style={C.lbl}>Narration</label><input style={C.tinp} placeholder="e.g. Transfer of professional fees" value={tForm.narration} onChange={e=>setTForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
                  <button style={C.btn()} onClick={()=>{ setTForm({date:today,amount:'',matterId:'',fromAccountId:tForm.fromAccountId,toAccount:'FNB Business',invoiceId:'',narration:''}); setTBalanceCheck(null); }}>Clear</button>
                  <button style={C.btn('p')} onClick={postTransfer} disabled={trustSaving}>{trustSaving?'Posting...':'Post transfer'}</button>
                </div>
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Transfer history</div>
              <div style={{overflowY:'auto',maxHeight:420}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Matter','From','To','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!trustTransactions.filter(t=>t.type==='transfer').length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No transfers yet</td></tr>}
                    {trustTransactions.filter(t=>t.type==='transfer').map((t,i)=>(
                      <tr key={i}>
                        <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                        <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                        <td style={{...C.td,fontSize:10,color:'#555'}}>{t.trust_accounts?.name||'Trust'}</td>
                        <td style={{...C.td,fontSize:10,color:'#6CC04A'}}>{t.to_account}</td>
                        <td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td>
                        <td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RECONCILIATION ── */}
        {trustTab==='recon'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              <div style={C.stat(false)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>System trust balance</div><div style={{fontSize:20,fontWeight:800,color:'#4A90D9'}}>{fmtR(systemTotal)}</div></div>
              <div style={C.stat(false)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>Bank statement total</div><div style={{fontSize:20,fontWeight:800,color:'#F0F0F0'}}>{fmtR(bankTotal)}</div></div>
              <div style={C.stat(diff<0.01)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>Difference</div><div style={{fontSize:20,fontWeight:800,color:diff<0.01?'#6CC04A':'#E05252'}}>{fmtR(diff)}</div><div style={{fontSize:10,color:diff<0.01?'#6CC04A':'#555',marginTop:4}}>{diff<0.01?'✓ Reconciled':'Unreconciled'}</div></div>
            </div>
            {/* Add bank line */}
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Add bank statement line</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 100px 100px',gap:10,alignItems:'flex-end'}}>
                <div><label style={C.lbl}>Date</label><input type="date" style={C.tinp} value={newBankLine.date} onChange={e=>setNewBankLine(f=>({...f,date:e.target.value}))}/></div>
                <div><label style={C.lbl}>Description</label><input style={C.tinp} placeholder="Bank statement description" value={newBankLine.description} onChange={e=>setNewBankLine(f=>({...f,description:e.target.value}))}/></div>
                <div><label style={C.lbl}>Amount</label><input type="number" style={C.tinp} placeholder="0.00" value={newBankLine.amount} onChange={e=>setNewBankLine(f=>({...f,amount:e.target.value}))}/></div>
                <div><label style={C.lbl}>Type</label><select style={C.tinp} value={newBankLine.isCredit?'credit':'debit'} onChange={e=>setNewBankLine(f=>({...f,isCredit:e.target.value==='credit'}))}><option value="credit">Credit</option><option value="debit">Debit</option></select></div>
                <button style={{...C.btn('p'),marginTop:16}} onClick={()=>{
                  if(!newBankLine.description||!newBankLine.amount) return;
                  setBankLines(l=>[...l,{...newBankLine,id:Date.now()}]);
                  setNewBankLine({date:today,description:'',amount:'',isCredit:true});
                }}>Add</button>
              </div>
            </div>
            {/* Side by side */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Bank statement lines</div>
                {!bankLines.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>Add bank statement lines above</div>:(
                  bankLines.map((l,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid #252525',borderRadius:6,marginBottom:6,opacity:matched['b'+l.id]?0.4:1,textDecoration:matched['b'+l.id]?'line-through':'none'}}>
                      <input type="checkbox" checked={!!matched['b'+l.id]} onChange={e=>setMatched(m=>({...m,['b'+l.id]:e.target.checked}))} style={{accentColor:'#6CC04A'}}/>
                      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{l.description}</div><div style={{fontSize:10,color:'#555'}}>{fmtDate(l.date)}</div></div>
                      <div style={{fontFamily:'monospace',fontSize:12,color:l.isCredit?'#6CC04A':'#E05252'}}>{l.isCredit?'+':'-'}{fmtR(Math.abs(l.amount))}</div>
                      <button style={{...C.btn('r'),padding:'2px 8px',fontSize:10}} onClick={()=>setBankLines(ls=>ls.filter((_,j)=>j!==i))}>✕</button>
                    </div>
                  ))
                )}
              </div>
              <div style={C.card}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>System trust transactions</div>
                {!trustTransactions.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>No trust transactions yet</div>:(
                  trustTransactions.filter(t=>t.type!=='transfer').map((t,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid #252525',borderRadius:6,marginBottom:6,opacity:matched['s'+i]?0.4:1,textDecoration:matched['s'+i]?'line-through':'none'}}>
                      <input type="checkbox" checked={!!matched['s'+i]} onChange={e=>setMatched(m=>({...m,['s'+i]:e.target.checked}))} style={{accentColor:'#6CC04A'}}/>
                      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{t.narration}</div><div style={{fontSize:10,color:'#555'}}>{fmtDate(t.date)} · {t.matter_id}</div></div>
                      <div style={{fontFamily:'monospace',fontSize:12,color:t.type==='receipt'?'#6CC04A':'#E05252'}}>{t.type==='receipt'?'+':'-'}{fmtR(t.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Recon certificate */}
            <div style={C.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>Reconciliation certificate</div>
                <button style={C.btn('g')} onClick={()=>{
                  const matched_count=Object.values(matched).filter(Boolean).length;
                  const w=window.open('','_blank','width=700,height:600');
                  const html=`<!DOCTYPE html><html><head><title>Trust Reconciliation Certificate</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #eee;font-size:12px}.sig{margin-top:40px;display:flex;justify-content:space-between}.sig-line{width:200px;border-top:1px solid #111;padding-top:6px;font-size:11px;color:#888}</style></head><body>
                  <h2 style="color:#6CC04A;font-size:20px">Motsoeneng Bill Attorneys</h2>
                  <h3>Trust Account Reconciliation Certificate</h3>
                  <p style="color:#888;font-size:12px">Period: ${reconPeriod} · Generated: ${new Date().toLocaleDateString('en-ZA')}</p>
                  <table><tr><td>Trust bank balance per bank statement</td><td style="text-align:right;font-weight:700">${fmtR(bankTotal)}</td></tr>
                  <tr><td>Trust balance per system</td><td style="text-align:right;font-weight:700">${fmtR(systemTotal)}</td></tr>
                  <tr style="font-weight:700;color:${diff<0.01?'green':'red'}"><td>Difference</td><td style="text-align:right">${fmtR(diff)}</td></tr>
                  <tr><td>Items matched</td><td style="text-align:right">${matched_count}</td></tr></table>
                  <p style="color:${diff<0.01?'green':'red'};font-weight:700">${diff<0.01?'✓ Accounts reconcile':'✗ Accounts do not reconcile — investigate outstanding items'}</p>
                  <div class="sig"><div class="sig-line">Bookkeeper signature</div><div class="sig-line">Partner / Director signature</div></div>
                  </body></html>`;
                  w.document.write(html); w.document.close();
                }}>Print certificate</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12}}>
                <div>
                  {[['Bank statement balance',fmtR(bankTotal)],['System trust balance',fmtR(systemTotal)],['Difference',fmtR(diff)]].map(([l,v],i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1A1A1A'}}>
                      <span style={{color:'#888'}}>{l}</span>
                      <span style={{fontFamily:'monospace',fontWeight:i===2?700:400,color:i===2?(diff<0.01?'#6CC04A':'#E05252'):'#F0F0F0'}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  {[['Items matched',Object.values(matched).filter(Boolean).length],['Bank lines',bankLines.length],['System transactions',trustTransactions.filter(t=>t.type!=='transfer').length]].map(([l,v],i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1A1A1A'}}>
                      <span style={{color:'#888'}}>{l}</span>
                      <span style={{fontFamily:'monospace'}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {trustTab==='reports'&&(
          <div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
              {[['trial','Trial Balance'],['receipts','Receipts Journal'],['payments','Payments Journal'],['transfers','Transfers Journal']].map(([v,l])=>(
                <button key={v} style={{...C.btn(reportType===v?'trust':'s'),fontSize:11}} onClick={()=>setReportType(v)}>{l}</button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
                <input type="date" style={{...C.sel,width:130}} value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/>
                <span style={{fontSize:11,color:'#555'}}>to</span>
                <input type="date" style={{...C.sel,width:130}} value={reportTo} onChange={e=>setReportTo(e.target.value)}/>
              </div>
            </div>

            {/* Trial balance */}
            {reportType==='trial'&&(
              <div style={C.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>Trust trial balance — all matters</div>
                  <span style={{fontSize:10,color:'#555'}}>Grand total must equal trust bank balance</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Matter ID','Client','Description','Fee Earner','Trust Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {matters.map(m=>{
                      const bal=getMatterBalance(m.id);
                      return(
                        <tr key={m.id} style={{opacity:bal===0?0.4:1}}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td>
                          <td style={{...C.td,fontWeight:500}}>{m.client}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{m.name}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{m.description||'—'}</td>
                          <td style={{...C.td,fontFamily:'monospace',fontWeight:700,textAlign:'right',color:bal>0?'#6CC04A':bal<0?'#E05252':'#555'}}>{fmtR(bal)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#0D0D0D'}}>
                      <td colSpan={4} style={{...C.th,color:'#888',paddingTop:12}}>Grand total</td>
                      <td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(totalTrustHeld())}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Receipts journal */}
            {reportType==='receipts'&&(
              <div style={C.card}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Trust receipts journal — {reportFrom} to {reportTo}</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Receipt No','Date','Matter','Client','Received From','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {getReportTransactions().filter(t=>t.type==='receipt').map((t,i)=>{
                      const m=matters.find(x=>x.id===t.matter_id);
                      return(
                        <tr key={i}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td>
                          <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                          <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                          <td style={C.td}>{m?.client||'—'}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.received_from||'—'}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{fmtR(t.amount)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#0D0D0D'}}>
                      <td colSpan={6} style={{...C.th,paddingTop:12}}>Total receipts</td>
                      <td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(getReportTransactions().filter(t=>t.type==='receipt').reduce((s,t)=>s+Number(t.amount),0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Payments journal */}
            {reportType==='payments'&&(
              <div style={C.card}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Trust payments journal — {reportFrom} to {reportTo}</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Matter','Client','Payee','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {getReportTransactions().filter(t=>t.type==='payment').map((t,i)=>{
                      const m=matters.find(x=>x.id===t.matter_id);
                      return(
                        <tr key={i}>
                          <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                          <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                          <td style={C.td}>{m?.client||'—'}</td>
                          <td style={C.td}>{t.payee}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#0D0D0D'}}>
                      <td colSpan={5} style={{...C.th,paddingTop:12}}>Total payments</td>
                      <td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#E05252',textAlign:'right',paddingTop:12}}>{fmtR(getReportTransactions().filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Transfers journal */}
            {reportType==='transfers'&&(
              <div style={C.card}>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Trust transfers journal — {reportFrom} to {reportTo}</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Matter','Client','From','To Business','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {getReportTransactions().filter(t=>t.type==='transfer').map((t,i)=>{
                      const m=matters.find(x=>x.id===t.matter_id);
                      return(
                        <tr key={i}>
                          <td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td>
                          <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td>
                          <td style={C.td}>{m?.client||'—'}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.trust_accounts?.name||'Trust'}</td>
                          <td style={{...C.td,fontSize:10,color:'#6CC04A'}}>{t.to_account}</td>
                          <td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#0D0D0D'}}>
                      <td colSpan={6} style={{...C.th,paddingTop:12}}>Total transfers</td>
                      <td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#4A90D9',textAlign:'right',paddingTop:12}}>{fmtR(getReportTransactions().filter(t=>t.type==='transfer').reduce((s,t)=>s+Number(t.amount),0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════ RENDER ═════════════════════════════════════════
  if(authLoading) return <div style={{background:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',color:'#444',fontSize:13}}>Loading...</div>;

  return(
    <>
      <Head><title>MB SmartTrack</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}
        table tr:hover td{background:rgba(108,192,74,0.025)} button:hover{opacity:.85}
        select option{background:#1A1A1A;color:#F0F0F0} input[type=date]{color-scheme:dark}
        input:focus,select:focus{outline:1px solid rgba(108,192,74,0.4);outline-offset:1px}
      `}</style>
      <div style={C.page}>

        {/* Header */}
        <div style={C.hdr}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {profile?.role==='manager'&&<button style={{background:'transparent',border:'1px solid rgba(108,192,74,0.3)',color:'#6CC04A',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={()=>router.push('/manager')}>Manager View</button>}
            <button style={{background:'transparent',border:'1px solid #252525',color:'#555',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
            <div style={C.mark}>M<span style={{color:'#6CC04A'}}>B</span></div>
            <div><div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack</div><div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill</div></div>
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[['today','Today'],['history','History'],['matters','Matters'],['analytics','Analytics'],['activities','All Activities'],['invoices','Invoice'],['archive','Archive'],['trust','🏦 Trust']].map(([v,l])=>(
              <button key={v} style={{...C.ntab(tab===v),color:v==='trust'?(tab===v?'#4A90D9':'#4A90D9'):tab===v?'#F0F0F0':'#555',border:v==='trust'?`1px solid ${tab===v?'rgba(74,144,217,0.5)':'rgba(74,144,217,0.2)'}`:tab===v?'1px solid #2A2A2A':'1px solid transparent'}} onClick={()=>setTab(v)}>{l}</button>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{position:'relative'}}>
              <input
                ref={searchRef}
                style={{background:'#1A1A1A',border:`1px solid ${searchQuery?'rgba(108,192,74,0.4)':'#252525'}`,color:'#F0F0F0',padding:'5px 12px 5px 32px',borderRadius:20,fontSize:12,fontFamily:'inherit',width:200,outline:'none'}}
                placeholder="Search everything..."
                value={searchQuery}
                onChange={e=>setSearchQuery(e.target.value)}
              />
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,pointerEvents:'none'}}>{searching?'⌛':'🔍'}</span>
              {searchQuery&&<button style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:12,padding:0}} onClick={()=>setSearchQuery('')}>✕</button>}
            </div>
            {online?<div style={C.pill}><div style={C.dot}/>{clock}</div>:<span style={{fontSize:11,color:'#3A3A3A'}}>Backend offline</span>}
          </div>
        </div>

        {/* ══ TODAY ══ */}
        {tab==='today'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>{fdate(selDate)}</div><div style={{fontSize:11,color:'#444'}}>{dayActs.length} sessions · {toHm(daySec)} total</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <select style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}>
                  <option value={today}>Today</option>
                  {dates.filter(d=>d.date!==today).map(d=><option key={d.date} value={d.date}>{fdate(d.date)} ({d.sessions})</option>)}
                </select>
                <button style={C.btn()} onClick={seedDemo} disabled={seeding}>{seeding?'Seeding...':'⚡ Load Demo'}</button>
                <button style={C.btn('pur')} onClick={()=>setShowCall(true)}>📞 Log a Call</button>
                <button style={C.btn('p')} onClick={()=>setTab('invoices')}>Generate Invoice</button>
              </div>
            </div>
            {!liveActs.length&&<div style={{background:'rgba(74,144,217,0.05)',border:'1px solid rgba(74,144,217,0.15)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:11,color:'#666'}}><strong style={{color:'#4A90D9'}}>No live data yet</strong> — Electron agent must be running. Sessions appear within 30 seconds.</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {[{l:'Total Time',v:toHm(daySec),s:`${dayActs.length} sessions`,a:false},{l:'Billable Time',v:toHm(dayBillSec),s:`${pct(dayBillSec,daySec)}% utilisation`,a:true},{l:'Billing Units',v:dayBillU,s:'6-min units',a:false},{l:'Est. Value',v:`R${(dayBillU*invRate).toLocaleString()}`,s:`@ R${invRate}/unit`,a:false}].map(({l,v,s,a})=>(
                <div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:24,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>
              ))}
            </div>
            <div style={C.card}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>Activity Log — {fdate(selDate)}</span>
                <span style={{fontSize:10,color:'#444'}}>{dayActs.length} sessions</span>
              </div>
              {!dayActs.length?(
                <div style={{textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:32,marginBottom:12}}>🖥️</div><div style={{fontSize:14,color:'#444',marginBottom:6}}>No sessions yet</div><div style={{fontSize:11,color:'#2A2A2A'}}>Start the Electron agent or click ⚡ Load Demo</div></div>
              ):(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr>{['Time','Application','Window Title','Matter','Duration','Units','Status','Override'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {dayActs.map(a=>{
                        const am=matters.find(m=>m.id===a.matter);
                        return(
                          <tr key={a.id}>
                            <td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td>
                            <td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8',fontSize:11}}>{a.app_display_name}</span></td>
                            <td style={{...C.td,color:'#666',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td>
                            <td style={{...C.td,minWidth:170}}>
                              <select style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}} value={a.matter||''} onChange={e=>assignMatter(a.id,e.target.value)}>
                                <option value="">— assign matter —</option>
                                {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
                              </select>
                              {am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:3,paddingLeft:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}
                            </td>
                            <td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{toHm(a.duration_seconds)}</td>
                            <td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td>
                            <td style={C.td}><Badge c={a.classification}/></td>
                            <td style={C.td}><select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ SEARCH ══ */}
        {searchQuery&&searchResults&&(
          <div style={{position:'fixed',top:56,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:90,overflowY:'auto'}} onClick={()=>setSearchQuery('')}>
            <div style={{maxWidth:800,margin:'20px auto',background:'#111',border:'1px solid #2A2A2A',borderRadius:10,padding:20}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <span style={{fontSize:14,fontWeight:600}}>Results for <span style={{color:'#6CC04A'}}>"{searchResults.query}"</span></span>
                <span style={{fontSize:11,color:'#555'}}>{searchResults.activities.length} activities · {searchResults.matters.length} matters · {searchResults.invoices.length} invoices</span>
              </div>
              {searchResults.matters.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Matters</div>
                  {searchResults.matters.map(m=>{
                    const mU=allActs.filter(a=>a.matter===m.id&&a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
                    return(<div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:6,cursor:'pointer'}} onClick={()=>{setSearchQuery('');setTab('matters');}}>
                      <div><div style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',marginBottom:2}}>{m.id}</div><div style={{fontSize:13,fontWeight:600,color:'#E0E0E0'}}>{m.name}</div><div style={{fontSize:11,color:'#666'}}>{m.client}</div></div>
                      <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:700,color:'#6CC04A'}}>R{(mU*invRate).toLocaleString()}</div><div style={{fontSize:10,color:'#444'}}>{mU} units</div></div>
                    </div>);
                  })}
                </div>
              )}
              {searchResults.activities.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Activities ({searchResults.activities.length})</div>
                  <div style={{maxHeight:300,overflowY:'auto'}}>
                    {searchResults.activities.map(a=>{
                      const m=matters.find(x=>x.id===a.matter);
                      return(<div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4}}>
                        <div style={{fontSize:16,flexShrink:0}}>{appIcon(a.app_display_name)}</div>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:'#D0D0D0'}}>{a.app_display_name} <Badge c={a.classification}/></div><div style={{fontSize:11,color:'#555',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.window_title}</div>{m&&<div style={{fontSize:10,color:'#A78BFA',marginTop:1}}>{m.id} · {m.client}</div>}</div>
                        <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:11,color:'#888',fontFamily:'monospace'}}>{toHm(a.duration_seconds)}</div><div style={{fontSize:10,color:'#444'}}>{fdate(a.date)}</div></div>
                      </div>);
                    })}
                  </div>
                </div>
              )}
              {searchResults.invoices.length>0&&(
                <div>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Invoices</div>
                  {searchResults.invoices.map(inv=>(
                    <div key={inv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4,cursor:'pointer'}} onClick={()=>{setSearchQuery('');setViewInv(inv);}}>
                      <div><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>{inv.id}</div><div style={{fontSize:11,color:'#666'}}>{inv.client} · {inv.matter_name} · {inv.period_label}</div></div>
                      <div style={{fontSize:14,fontWeight:700,color:'#6CC04A'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
              {!searchResults.activities.length&&!searchResults.matters.length&&!searchResults.invoices.length&&(
                <div style={{textAlign:'center',padding:'40px',color:'#444'}}><div style={{fontSize:28,marginBottom:10}}>🔍</div><div style={{fontSize:14,color:'#555',marginBottom:6}}>No results for "{searchResults.query}"</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {tab==='history'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Work History</div><div style={{fontSize:11,color:'#444'}}>Full record of all tracked time — January to December</div></div>
              <select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);setMonthData(null);}}>
                {histYears.length?histYears.map(y=><option key={y} value={y}>{y}</option>):<option value={histYear}>{histYear}</option>}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {Array.from({length:12},(_,i)=>{
                const monthStr=`${histYear}-${String(i+1).padStart(2,'0')}`;
                const monthName=new Date(histYear,i,1).toLocaleString('en-ZA',{month:'long'});
                const data=histMonths.find(m=>m.month===monthStr);
                const isSelected=selMonth===monthStr;
                const hasFuture=new Date(histYear,i,1)>new Date();
                return(
                  <div key={monthStr} style={{background:isSelected?'rgba(108,192,74,0.08)':data?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(108,192,74,0.4)':data?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:data?'pointer':'default',opacity:hasFuture?0.4:1}} onClick={()=>data&&loadMonth(monthStr)}>
                    <div style={{fontSize:12,fontWeight:600,color:data?'#D0D0D0':'#333',marginBottom:6}}>{monthName}</div>
                    {data?(<><div style={{fontSize:18,fontWeight:800,color:isSelected?'#6CC04A':'#888',marginBottom:2}}>{toHm(data.total_seconds)}</div><div style={{fontSize:10,color:'#555'}}>{data.sessions} sessions</div><div style={{fontSize:11,color:'#6CC04A',marginTop:4,fontWeight:600}}>R{((data.billable_units||0)*invRate).toLocaleString()}</div><div style={{fontSize:9,color:'#444'}}>billable value</div></>):(<div style={{fontSize:11,color:'#2A2A2A',marginTop:8}}>{hasFuture?'Future':'No data'}</div>)}
                  </div>
                );
              })}
            </div>
            {selMonth&&monthData&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                  <div><span style={{fontSize:14,fontWeight:700}}>{new Date(selMonth+'-01T12:00:00').toLocaleString('en-ZA',{month:'long',year:'numeric'})}</span><span style={{fontSize:11,color:'#555',marginLeft:12}}>{monthData.totals?.sessions||0} sessions · {toHm(monthData.totals?.total_seconds)} total · {toHm(monthData.totals?.billable_seconds)} billable</span></div>
                  <div style={{display:'flex',gap:8}}><button style={C.btn()} onClick={()=>{setSelMonth(null);setMonthData(null);}}>✕ Close</button><button style={C.btn('p')} onClick={()=>{setInvMatterId('');setTab('invoices');}}>Invoice for this month</button></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                  {[{l:'Total Time',v:toHm(monthData.totals?.total_seconds),s:`${monthData.totals?.sessions||0} sessions`,a:false},{l:'Billable Time',v:toHm(monthData.totals?.billable_seconds),s:`${pct(monthData.totals?.billable_seconds,monthData.totals?.total_seconds)}% util`,a:true},{l:'Billing Units',v:monthData.totals?.billable_units||0,s:'6-min units',a:false},{l:'Est. Value',v:`R${((monthData.totals?.billable_units||0)*invRate).toLocaleString()}`,s:'excl. VAT',a:false}].map(({l,v,s,a})=>(
                    <div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>
                  ))}
                </div>
                <div style={C.card}>
                  <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All activities — {new Date(selMonth+'-01T12:00:00').toLocaleString('en-ZA',{month:'long',year:'numeric'})}</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>{['Date','Time','App','Description','Matter','Duration','Units','Status'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {!monthData.activities?.length&&<tr><td colSpan={8} style={{padding:'30px',textAlign:'center',color:'#333'}}>No activities this month</td></tr>}
                        {monthData.activities?.map(a=>{
                          const m=matters.find(x=>x.id===a.matter);
                          return(<tr key={a.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555',whiteSpace:'nowrap'}}>{fdate(a.date)}</td><td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td><td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8'}}>{a.app_display_name}</span></td><td style={{...C.td,color:'#555',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{m?`${m.id} · ${m.client}`:''}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td><td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td><td style={C.td}><Badge c={a.classification}/></td></tr>);
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MATTERS ══ */}
        {tab==='matters'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Client Matters</div><div style={{fontSize:11,color:'#444'}}>Create matter files — activities are auto-linked by title matching</div></div>
              <button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ New Matter</button>
            </div>
            {matterMsg&&<div style={{background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.25)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#6CC04A'}}>{matterMsg}</div>}
            <div style={{background:'rgba(167,139,250,0.05)',border:'1px solid rgba(167,139,250,0.15)',borderRadius:6,padding:'12px 16px',marginBottom:14,fontSize:11,color:'#888',lineHeight:1.7}}><strong style={{color:'#A78BFA'}}>How it works:</strong> Create a matter with a name and client. The system immediately scans all tracked activities and links any whose window title mentions the client or matter name.</div>
            {!matters.length?(
              <div style={{...C.card,textAlign:'center',padding:'40px'}}><div style={{fontSize:32,marginBottom:12}}>📁</div><div style={{fontSize:14,color:'#444',marginBottom:8}}>No matters yet</div><button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ Create first matter</button></div>
            ):(
              <div style={{display:'grid',gap:10}}>
                {matters.map(m=>{
                  const mActs=allActs.filter(a=>a.matter===m.id);
                  const mBill=mActs.filter(a=>a.classification==='billable');
                  const mU=mBill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
                  const mSec=mActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
                  const trustBal=getMatterBalance(m.id);
                  return(
                    <div key={m.id} style={C.card}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',fontWeight:600}}>{m.id}</span></div>
                          <div style={{fontSize:14,fontWeight:700,color:'#E0E0E0',marginBottom:2}}>{m.name}</div>
                          <div style={{fontSize:12,color:'#888'}}>Client: <strong style={{color:'#C0C0C0'}}>{m.client}</strong></div>
                          {m.description&&<div style={{fontSize:11,color:'#555',marginTop:4}}>{m.description}</div>}
                        </div>
                        <div style={{display:'flex',gap:16,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                          {[['Activities',mActs.length,'#888'],['Time',toHm(mSec),'#888'],['Units',mU,mU>0?'#6CC04A':'#444'],['Value',`R${(mU*invRate).toLocaleString()}`,mU>0?'#6CC04A':'#444'],['Trust',fmtR(trustBal),trustBal>0?'#4A90D9':'#444']].map(([l,v,c])=>(
                            <div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:2}}>{l}</div><div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div></div>
                          ))}
                          <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            <button style={{...C.btn('p'),fontSize:11,padding:'5px 12px'}} onClick={()=>{setInvMatterId(m.id);setTab('invoices');}}>Invoice</button>
                            <button style={{...C.btn('trust'),fontSize:11,padding:'5px 12px'}} onClick={()=>{setTab('trust');setTrustTab('ledger');}}>Trust</button>
                            <button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={()=>handleDeleteMatter(m.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {tab==='analytics'&&<div style={C.main}><AnalyticsTab/></div>}

        {/* ══ ALL ACTIVITIES ══ */}
        {tab==='activities'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>All Activities</div><div style={{fontSize:11,color:'#444'}}>{filtActs.length} sessions</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <select style={C.sel} value={filterCls} onChange={e=>setFilterCls(e.target.value)}><option value="">All types</option><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select>
                <select style={C.sel} value={filterDate} onChange={e=>setFilterDate(e.target.value)}><option value="">All dates</option>{dates.map(d=><option key={d.date} value={d.date}>{fdate(d.date)}</option>)}</select>
                <select style={C.sel} value={filterApp} onChange={e=>setFilterApp(e.target.value)}><option value="">All apps</option>{allApps.map(n=><option key={n} value={n}>{n}</option>)}</select>
                {(filterCls||filterDate||filterApp)&&<button style={C.btn()} onClick={()=>{setFilterCls('');setFilterDate('');setFilterApp('');}}>✕ Clear</button>}
              </div>
            </div>
            <div style={C.card}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Time','App','Description','Matter','Duration','Units','Status','Override'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {!filtActs.length&&<tr><td colSpan={9} style={{padding:'40px',textAlign:'center',color:'#333',fontSize:13}}>{!allActs.length?'No tracked activities yet.':'No sessions match your filters.'}</td></tr>}
                    {filtActs.map(a=>{
                      const am=matters.find(m=>m.id===a.matter);
                      return(<tr key={a.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555',whiteSpace:'nowrap'}}>{fdate(a.date)}</td><td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td><td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8'}}>{a.app_display_name}</span></td><td style={{...C.td,color:'#555',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td><td style={{...C.td,minWidth:160}}><select style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}} value={a.matter||''} onChange={e=>assignMatter(a.id,e.target.value)}><option value="">— none —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select>{am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td><td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td><td style={C.td}><Badge c={a.classification}/></td><td style={C.td}><select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select></td></tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ INVOICES ══ */}
        {tab==='invoices'&&(
          <div style={C.main}>
            <div style={{marginBottom:14}}><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Generate Invoice</div><div style={{fontSize:11,color:'#444'}}>Select a matter — invoice pulls only activities assigned to it</div></div>
            <div style={C.card}>
              <div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 1 — Select Matter</div>
              {!matters.length?(<div style={{padding:'10px 0',fontSize:12,color:'#555'}}>No matters yet. <button style={{...C.btn('pur'),padding:'4px 12px',fontSize:11,marginLeft:8}} onClick={()=>setTab('matters')}>Go to Matters →</button></div>):(<select style={{...C.inp,maxWidth:500}} value={invMatterId} onChange={e=>{ setInvMatterId(e.target.value); setPreview(null); }}><option value="">— choose a matter —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}</select>)}
              {invMatter&&(<div style={{marginTop:10,display:'flex',gap:20,fontSize:11,flexWrap:'wrap'}}><div><span style={{color:'#555'}}>Client: </span><strong style={{color:'#C0C0C0'}}>{invMatter.client}</strong></div><div><span style={{color:'#555'}}>Activities: </span><strong style={{color:'#6CC04A'}}>{allActs.filter(a=>a.matter===invMatterId).length}</strong></div><div><span style={{color:'#555'}}>Trust balance: </span><strong style={{color:'#4A90D9'}}>{fmtR(getMatterBalance(invMatterId))}</strong></div></div>)}
            </div>
            {invMatterId&&(<div style={C.card}>
              <div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 2 — Configure</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                <div><label style={C.lbl}>Attorney</label><input style={C.inp} value={invAtty} onChange={e=>setInvAtty(e.target.value)}/></div>
                <div><label style={C.lbl}>Rate per unit (R)</label><input style={C.inp} type="number" value={invRate} onChange={e=>setInvRate(parseInt(e.target.value)||150)}/></div>
                <div><label style={C.lbl}>Billing date</label><input style={C.inp} type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}/></div>
              </div>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                {[['day','Day'],['week','Week'],['month','Month']].map(([v,l])=>(<button key={v} style={{...C.btn(invPeriod===v?'p':'s'),padding:'5px 18px'}} onClick={()=>setInvPeriod(v)}>{l}</button>))}
              </div>
              <button style={C.btn('p')} onClick={buildPreview}>Preview Invoice</button>
            </div>)}
            {preview&&(<div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <span style={{fontSize:13,fontWeight:600}}>Preview · {preview.bill.length} billable sessions · {preview.tU} units · R{preview.tAmt.toLocaleString()}</span>
                <div style={{display:'flex',gap:8}}>
                  <button style={C.btn()} onClick={()=>setPreview(null)}>Cancel</button>
                  <button style={C.btn('g')} onClick={()=>downloadPDF({...preview,id:'MB-PREVIEW',client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label},preview.filtered)}>⬇ PDF</button>
                  <button style={C.btn('p')} onClick={handleSaveInvoice}>Save to Archive</button>
                </div>
              </div>
              {!preview.bill.length&&(<div style={{background:'rgba(220,80,80,0.08)',border:'1px solid rgba(220,80,80,0.2)',borderRadius:6,padding:'10px 14px',marginBottom:12,fontSize:11,color:'#E05252'}}>No billable activities for this period. Assign activities to this matter first.</div>)}
              <InvoiceDoc inv={{client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label,id:'MB-PREVIEW'}} acts={preview.filtered}/>
            </div>)}
          </div>
        )}

        {/* ══ ARCHIVE ══ */}
        {tab==='archive'&&(
          <div style={C.main}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14,alignItems:'center',flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Invoice Archive</div><div style={{fontSize:11,color:'#444'}}>{invoices.length} saved invoices</div></div>
              <select style={C.sel} value={archFilter} onChange={e=>setArchFilter(e.target.value)}><option value="">All periods</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select>
            </div>
            {!invoices.filter(i=>!archFilter||i.period===archFilter).length?(
              <div style={{...C.card,textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:32,marginBottom:12}}>🗃️</div><div style={{fontSize:14,color:'#444'}}>No invoices saved yet</div></div>
            ):(
              invoices.filter(i=>!archFilter||i.period===archFilter).map(inv=>{
                const invActs=allActs.filter(a=>(inv.activity_ids||[]).includes(a.id));
                return(<div key={inv.id} style={{...C.card,marginBottom:8,cursor:'pointer'}} onClick={()=>setViewInv(inv)}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:12,fontWeight:700,color:'#D0D0D0'}}>{inv.id}</span><span style={{fontSize:9,color:'#6CC04A',border:'1px solid rgba(108,192,74,0.3)',background:'rgba(108,192,74,0.08)',padding:'1px 8px',borderRadius:20}}>Saved</span></div>
                      <div style={{fontSize:11,color:'#555'}}>{inv.client} · <span style={{color:'#A78BFA'}}>{inv.matter_id||inv.matter_name}</span></div>
                      <div style={{fontSize:10,color:'#333',marginTop:2}}>{inv.period_label} · {inv.total_units} units · {new Date(inv.created_at).toLocaleDateString('en-ZA')}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:800,color:'#6CC04A'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</div><div style={{fontSize:10,color:'#444',marginTop:2}}>{inv.total_units} units · incl. VAT</div></div>
                      <button style={{...C.btn('g'),fontSize:11,padding:'5px 12px'}} onClick={e=>{e.stopPropagation();downloadPDF(inv,invActs);}}>⬇ PDF</button>
                      <button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={async e=>{e.stopPropagation();if(!confirm(`Delete invoice ${inv.id}?`)) return;await deleteInvoice(inv.id);load();}}>Delete</button>
                    </div>
                  </div>
                </div>);
              })
            )}
          </div>
        )}

        {/* ══ TRUST ══ */}
        {tab==='trust'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>🏦 Trust Accounting</div><div style={{fontSize:11,color:'#444'}}>Legal Practice Act compliant · trust balance never goes negative</div></div>
              <button style={C.btn()} onClick={loadTrust}>↻ Refresh</button>
            </div>
            <TrustTab/>
          </div>
        )}

      </div>

      {/* ── Call Logger Modal ── */}
      {showCall&&(
        <div style={C.modal} onClick={()=>setShowCall(false)}>
          <div style={C.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📞 Log a Call</div>
            <div style={{fontSize:11,color:'#555',marginBottom:20}}>Record a client call as a billable activity</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={C.lbl}>Description *</label><input style={C.inp} placeholder="e.g. Smith — settlement discussion" value={callForm.description} onChange={e=>setCallForm(f=>({...f,description:e.target.value}))}/></div>
              <div><label style={C.lbl}>Assign to matter</label><select style={C.inp} value={callForm.matterId} onChange={e=>setCallForm(f=>({...f,matterId:e.target.value}))}><option value="">— select matter (optional) —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} ({m.client})</option>)}</select></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={C.lbl}>Duration (minutes)</label><input style={C.inp} type="number" min="1" value={callForm.durationMins} onChange={e=>setCallForm(f=>({...f,durationMins:parseInt(e.target.value)||6}))}/><div style={{fontSize:10,color:'#6CC04A',marginTop:4}}>{calcUnits(callForm.durationMins*60)} unit(s) · R{calcAmt(callForm.durationMins*60,invRate).toLocaleString()}</div></div>
                <div><label style={C.lbl}>Logged at</label><div style={{...C.inp,display:'flex',alignItems:'center',color:'#888',fontSize:11,cursor:'default'}}>{new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})}</div></div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button style={C.btn()} onClick={()=>setShowCall(false)}>Cancel</button>
              <button style={C.btn('pur')} onClick={logCall} disabled={callSaving||!callForm.description}>{callSaving?'Saving...':'Save as Billable'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Matter Modal ── */}
      {showMatterForm&&(
        <div style={C.modal} onClick={()=>setShowMatterForm(false)}>
          <div style={C.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📁 New Client Matter</div>
            <div style={{fontSize:11,color:'#555',marginBottom:20}}>After creating, existing activities are auto-linked by matching window titles.</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={C.lbl}>Matter ID *</label><input style={C.inp} placeholder="e.g. L2025/042 or MB/JONES/2025" value={matterForm.id} onChange={e=>setMatterForm(f=>({...f,id:e.target.value.toUpperCase()}))}/><div style={{fontSize:10,color:'#555',marginTop:4}}>Enter your existing matter number exactly as in Ghost Practice</div></div>
              <div><label style={C.lbl}>Matter name *</label><input style={C.inp} placeholder="e.g. Smith v Jones — Contract Review" value={matterForm.name} onChange={e=>setMatterForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={C.lbl}>Client name *</label><input style={C.inp} placeholder="e.g. ABC Corporation" value={matterForm.client} onChange={e=>setMatterForm(f=>({...f,client:e.target.value}))}/></div>
              <div><label style={C.lbl}>Description (optional)</label><input style={C.inp} placeholder="e.g. Acquisition agreement drafting" value={matterForm.description} onChange={e=>setMatterForm(f=>({...f,description:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button style={C.btn()} onClick={()=>setShowMatterForm(false)}>Cancel</button>
              <button style={C.btn('p')} onClick={handleCreateMatter} disabled={matterSaving||!matterForm.id||!matterForm.name||!matterForm.client}>{matterSaving?'Creating...':'Create Matter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice view modal ── */}
      {viewInv&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 20px'}} onClick={()=>setViewInv(null)}>
          <div style={{background:'#111',border:'1px solid #252525',borderRadius:12,padding:24,maxWidth:780,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div><div style={{fontSize:14,fontWeight:700}}>{viewInv.id}</div><div style={{fontSize:11,color:'#555'}}>{viewInv.client} · <span style={{color:'#A78BFA'}}>{viewInv.matter_id||viewInv.matter_name}</span> · {viewInv.period_label}</div></div>
              <div style={{display:'flex',gap:8}}>
                <button style={C.btn('g')} onClick={()=>downloadPDF(viewInv,allActs.filter(a=>(viewInv.activity_ids||[]).includes(a.id)))}>⬇ PDF</button>
                <button style={C.btn('r')} onClick={async()=>{if(!confirm(`Delete invoice ${viewInv.id}?`)) return;await deleteInvoice(viewInv.id);setViewInv(null);load();}}>Delete</button>
                <button style={C.btn()} onClick={()=>setViewInv(null)}>Close</button>
              </div>
            </div>
            <InvoiceDoc inv={viewInv} acts={allActs.filter(a=>(viewInv.activity_ids||[]).includes(a.id))}/>
          </div>
        </div>
      )}
    </>
  );
}
