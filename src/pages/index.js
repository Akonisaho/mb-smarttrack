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

function printTrustStatement(matter, transactions) {
  let running=0;
  const rows=transactions.map(t=>{
    const isR=t.type==='receipt';
    if(isR) running+=Number(t.amount); else running-=Number(t.amount);
    return `<tr><td>${fmtDate(t.date)}</td><td style="text-transform:capitalize">${t.type}</td><td>${t.receipt_no||t.reference||'—'}</td><td>${t.narration||''}</td><td align="right" style="color:#dc2626">${!isR?fmtR(t.amount):''}</td><td align="right" style="color:#16a34a">${isR?fmtR(t.amount):''}</td><td align="right" style="font-weight:700;color:${running>=0?'#16a34a':'#dc2626'}">${fmtR(running)}</td></tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trust Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6CC04A;padding-bottom:16px;margin-bottom:20px}.logo{font-size:26px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#6CC04A}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;border-bottom:2px solid #eee;text-align:left}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3}.info{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px}.lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#aaa;margin-bottom:3px}.val{font-size:13px;font-weight:600}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center;line-height:1.8}@media print{body{padding:20px}}</style></head><body>
  <div class="top"><div><div class="logo">M<span>B</span></div><div style="font-size:11px;color:#999;margin-top:2px">Motsoeneng Bill Attorneys</div></div><div style="text-align:right"><h2>TRUST ACCOUNT STATEMENT</h2><div style="font-size:11px;color:#999">Matter: ${matter?.id} · Generated: ${fdate(new Date().toISOString().split('T')[0])}</div></div></div>
  <div class="info"><div><div class="lbl">Client</div><div class="val">${matter?.client||'—'}</div></div><div><div class="lbl">Matter</div><div class="val">${matter?.name||'—'}</div></div><div><div class="lbl">Current trust balance</div><div class="val" style="color:#16a34a">${fmtR(running)}</div></div><div><div class="lbl">Total transactions</div><div class="val">${transactions.length}</div></div></div>
  <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th align="right">Debit</th><th align="right">Credit</th><th align="right">Balance</th></tr></thead><tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:#ccc;padding:20px">No transactions</td></tr>'}</tbody></table>
  <div class="foot">Motsoeneng Bill Attorneys · VAT: 4100000000 · FNB 62000000000 · Branch: 250655 · accounts@mb.co.za</div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w=window.open('','_blank','width=920,height=720'); w.document.write(html); w.document.close();
}

function downloadPDF(inv, acts) {
  const bill=(acts||[]).filter(a=>a.classification==='billable');
  const rate=Number(inv.rate)||150;
  const tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
  const tAmt=tU*rate;
  const tSec=(acts||[]).reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const bSec=bill.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
  const rows=bill.map(a=>`<tr><td>${fdate(a.date)} ${ftime(a.start_time)}</td><td>${a.app_display_name||''}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.window_title||''}</td><td align="right">${toHm(a.duration_seconds)}</td><td align="right">${calcUnits(a.duration_seconds)}</td><td align="right"><strong>R${calcAmt(a.duration_seconds,rate).toLocaleString()}</strong></td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.id}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6CC04A;padding-bottom:18px;margin-bottom:24px}.logo{font-size:28px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#6CC04A}.logo-sub{font-size:11px;color:#999;margin-top:3px}.right{text-align:right}.right h1{font-size:22px;font-weight:900}.right p{font-size:11px;color:#999;margin-top:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}.lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#aaa;margin-bottom:3px}.val{font-size:14px;font-weight:700}.sub{font-size:11px;color:#888;margin-top:2px}.sumbar{display:flex;border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px}.sb{flex:1;padding:12px;text-align:center;border-right:1px solid #eee}.sb:last-child{border:none}.slbl{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa}.sval{font-size:17px;font-weight:800;margin-top:3px}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;border-bottom:2px solid #eee}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3;color:#444}.foot{margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center;line-height:1.8}@media print{body{padding:20px}@page{margin:15mm}}</style></head><body>
  <div class="top"><div><div class="logo">M<span>B</span></div><div class="logo-sub">Motsoeneng Bill Attorneys</div><div class="logo-sub">The Quality of Now</div></div><div class="right"><h1>TAX INVOICE</h1><p>${inv.id}</p><p>Issued: ${fdate(new Date().toISOString().split('T')[0])}</p></div></div>
  <div class="grid"><div><div class="lbl">Billed To</div><div class="val">${inv.client||''}</div><div class="sub">Matter: ${inv.matter_name||inv.matter||''}</div><div class="sub">Ref: ${inv.matter_id||''}</div></div><div><div class="lbl">Attorney</div><div class="val">${inv.attorney||''}</div><div class="sub">Period: ${inv.period_label||''}</div><div class="sub">Total: ${toHm(tSec)} | Billable: ${toHm(bSec)}</div></div></div>
  <div class="sumbar"><div class="sb"><div class="slbl">Sessions</div><div class="sval">${bill.length}</div></div><div class="sb"><div class="slbl">Total Time</div><div class="sval">${toHm(tSec)}</div></div><div class="sb"><div class="slbl">Billable</div><div class="sval">${toHm(bSec)}</div></div><div class="sb"><div class="slbl">Units</div><div class="sval">${tU}</div></div><div class="sb"><div class="slbl">Rate/Unit</div><div class="sval">R${rate}</div></div></div>
  <table><thead><tr><th align="left">Date/Time</th><th align="left">Application</th><th align="left">Description</th><th align="right">Time</th><th align="right">Units</th><th align="right">Amount</th></tr></thead><tbody>${rows||'<tr><td colspan="6" align="center" style="color:#ccc;padding:16px">No billable activities.</td></tr>'}</tbody></table>
  <div style="background:#f8f8f8;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:12px;color:#555"><strong>${tU} units</strong> x R${rate}/unit</div><div style="font-size:10px;color:#bbb;margin-top:3px">1 billing unit = 6 minutes (standard SA legal billing)</div></div><div style="text-align:right;min-width:240px"><table style="width:100%;border-collapse:collapse;margin-bottom:0"><tr><td style="padding:4px 8px;font-size:12px;color:#888;border:none;text-align:left">Subtotal (excl. VAT)</td><td style="padding:4px 8px;font-size:12px;color:#555;border:none;text-align:right;font-family:monospace">R${tAmt.toLocaleString()}</td></tr><tr><td style="padding:4px 8px;font-size:12px;color:#888;border:none;text-align:left">VAT @ 15%</td><td style="padding:4px 8px;font-size:12px;color:#555;border:none;text-align:right;font-family:monospace">R${(tAmt*0.15).toFixed(2)}</td></tr><tr style="border-top:2px solid #ddd"><td style="padding:6px 8px;font-size:13px;font-weight:700;color:#111;border:none;text-align:left">Total Due (incl. VAT)</td><td style="padding:6px 8px;font-size:22px;font-weight:900;color:#111;border:none;text-align:right">R${(tAmt*1.15).toFixed(2)}</td></tr></table></div></div>
  <div class="foot">Motsoeneng Bill Attorneys | VAT Reg No: 4100000000<br>FNB Account: 62000000000 | Branch: 250655<br>accounts@mb.co.za | www.mb.co.za<br><em>This invoice is computer generated and valid without a signature.</em></div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w=window.open('','_blank','width=920,height=720'); w.document.write(html); w.document.close();
}

function BarChart({data,height=120}){
  if(!data||!data.length) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:12}}>No data</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  return(<div style={{display:'flex',alignItems:'flex-end',gap:6,height,paddingBottom:20}}>{data.map((d,i)=>(<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',height:'100%',justifyContent:'flex-end'}}><div style={{fontSize:9,color:d.color||'#6CC04A',fontWeight:600,marginBottom:2}}>{d.label2||''}</div><div style={{width:'100%',background:d.color||'#6CC04A',borderRadius:'3px 3px 0 0',height:`${Math.max((d.value/max)*80,2)}%`,opacity:0.85,minHeight:d.value>0?4:0}}/><div style={{fontSize:9,color:'#555',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',textAlign:'center',marginTop:4,whiteSpace:'nowrap'}}>{d.label}</div></div>))}</div>);
}

function DonutChart({segments,size=140}){
  const total=segments.reduce((s,d)=>s+d.value,0);
  if(!total) return <div style={{width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontSize:11}}>No data</div>;
  const r=45,cx=size/2,cy=size/2,sw=18; let angle=-90;
  const arcs=segments.filter(s=>s.value>0).map(seg=>{ const p=seg.value/total,a1=angle,a2=angle+p*360; angle=a2; return{...seg,pct:Math.round(p*100)}; });
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A1A" strokeWidth={sw}/>{arcs.map((a,i)=>(<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={`${a.pct*2.827} 282.7`} strokeDashoffset={`${282.7*(1-arcs.slice(0,i).reduce((s,x)=>s+x.pct,0)/100)}`} strokeLinecap="butt"/>))}<text x={cx} y={cy-5} textAnchor="middle" fill="#F0F0F0" fontSize="13" fontWeight="700">{arcs[0]?.pct||0}%</text><text x={cx} y={cy+10} textAnchor="middle" fill="#555" fontSize="9">billable</text></svg>);
}

export default function App() {
  const today=new Date().toISOString().split('T')[0];
  const router=useRouter();
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [tab,setTab]=useState('today');
  const [online,setOnline]=useState(false);
  const [clock,setClock]=useState('');
  const [liveActs,setLiveActs]=useState([]);
  const [allActs,setAllActs]=useState([]);
  const [dates,setDates]=useState([]);
  const [selDate,setSelDate]=useState(today);
  const [analyticsPeriod,setAP]=useState('day');
  const [invoices,setInvoices]=useState([]);
  const [matters,setMatters]=useState([]);
  const [viewInv,setViewInv]=useState(null);
  const [invMatterId,setInvMatterId]=useState('');
  const [invAtty,setInvAtty]=useState('Adv. T. Motsoeneng');
  const [invRate,setInvRate]=useState(150);
  const [invPeriod,setInvPeriod]=useState('day');
  const [preview,setPreview]=useState(null);
  const [seeding,setSeeding]=useState(false);
  const [filterCls,setFilterCls]=useState('');
  const [filterDate,setFilterDate]=useState('');
  const [filterApp,setFilterApp]=useState('');
  const [archFilter,setArchFilter]=useState('');
  const searchRef=useRef(null);
  const [searchQuery,setSearchQuery]=useState('');
  const [searchResults,setSearchResults]=useState(null);
  const [searching,setSearching]=useState(false);
  const [histYear,setHistYear]=useState(new Date().getFullYear());
  const [histMonths,setHistMonths]=useState([]);
  const [histYears,setHistYears]=useState([]);
  const [selMonth,setSelMonth]=useState(null);
  const [monthData,setMonthData]=useState(null);
  const [showCall,setShowCall]=useState(false);
  const [callForm,setCallForm]=useState({description:'',matterId:'',durationMins:6,date:today});
  const [callSaving,setCallSaving]=useState(false);
  const [showMatterForm,setShowMatterForm]=useState(false);
  const [matterForm,setMatterForm]=useState({id:'',name:'',client:'',description:''});
  const [matterSaving,setMatterSaving]=useState(false);
  const [matterMsg,setMatterMsg]=useState('');
const [showPwdForm,setShowPwdForm]=useState(false);
const [pwdForm,setPwdForm]=useState({current:'',newPwd:'',confirm:''});
const [pwdMsg,setPwdMsg]=useState({msg:'',type:''});
const [pwdSaving,setPwdSaving]=useState(false);

  const APPROVAL_THRESHOLD=50000;
  const [trustTransactions,setTrustTransactions]=useState([]);
  const [trustAccounts,setTrustAccounts]=useState([]);
  const [trustBalances,setTrustBalances]=useState({});
  const [trustLoading,setTrustLoading]=useState(false);
  const [trustTab,setTrustTab]=useState('ledger');
  const [trustAlert,setTrustAlert]=useState({msg:'',type:''});
  const [trustSaving,setTrustSaving]=useState(false);
  const [branches,setBranches]=useState([]);
  const [lockedPeriods,setLockedPeriods]=useState([]);
  const [balanceAlerts,setBalanceAlerts]=useState([]);
  const [pendingPayments,setPendingPayments]=useState([]);
  const [selectedTrustMatter,setSelectedTrustMatter]=useState('');
  const [rForm,setRForm]=useState({date:today,amount:'',matterId:'',accountId:'',reference:'',receivedFrom:'',narration:'',branchId:''});
const rFormDirty=useRef(false);
  const [pForm,setPForm]=useState({date:today,amount:'',matterId:'',accountId:'',payee:'',reference:'',narration:'',branchId:''});
  const [pBalanceCheck,setPBalanceCheck]=useState(null);
  const [tForm,setTForm]=useState({date:today,amount:'',matterId:'',fromAccountId:'',toAccount:'FNB Business',invoiceId:'',narration:'',branchId:''});
  const [tBalanceCheck,setTBalanceCheck]=useState(null);
  const [bankLines,setBankLines]=useState([]);
  const [newBankLine,setNewBankLine]=useState({date:today,description:'',amount:'',isCredit:true});
  const [matched,setMatched]=useState({});
  const [csvError,setCsvError]=useState('');
  const [reconPeriod,setReconPeriod]=useState(today.substring(0,7));
  const [reportType,setReportType]=useState('trial');
  const [reportFrom,setReportFrom]=useState(today.substring(0,7)+'-01');
  const [reportTo,setReportTo]=useState(today);
  const [reportBranch,setReportBranch]=useState('');
  const [alertMatterId,setAlertMatterId]=useState('');
  const [alertMinBal,setAlertMinBal]=useState(5000);

  useEffect(()=>{ const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000); return()=>clearInterval(t); },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const u=data.session.user; setUser(u);
      const p=await getProfile(u.id); setProfile(p);
      if(p?.role==='manager'||u.email==='livhuwaningwn@gmail.com'){ router.replace('/manager'); return; }
      setAuthLoading(false);
    });
  },[]);

  const userId=user?.id||null;

  useEffect(()=>{
    if(authLoading||!userId) return;
    let cancelled=false;
    const doLoad=async()=>{
      const [liveRes,allRes,invRes,matRes]=await Promise.all([fetchActivities({date:selDate,userId}),fetchAllActivities({userId}),fetchInvoices(userId),fetchMatters(userId)]);
      if(cancelled) return;
      setOnline(true);
      setLiveActs((liveRes.activities||[]).sort((a,b)=>a.start_time-b.start_time));
      setAllActs(allRes.activities||[]);
      setInvoices(invRes.invoices||[]);
      setMatters(matRes.matters||[]);
      const dmap={}; (allRes.activities||[]).forEach(a=>{ if(!dmap[a.date]) dmap[a.date]={date:a.date,sessions:0}; dmap[a.date].sessions++; });
      setDates(Object.values(dmap).sort((a,b)=>b.date.localeCompare(a.date)));
    };
    doLoad();
    const t=setInterval(doLoad,120000);
    return()=>{ cancelled=true; clearInterval(t); };
  },[authLoading,userId,selDate]);

  const load=useCallback(async()=>{
    if(!userId) return;
    const [liveRes,allRes,invRes,matRes]=await Promise.all([fetchActivities({date:selDate,userId}),fetchAllActivities({userId}),fetchInvoices(userId),fetchMatters(userId)]);
    setOnline(true);
    setLiveActs((liveRes.activities||[]).sort((a,b)=>a.start_time-b.start_time));
    setAllActs(allRes.activities||[]);
    setInvoices(invRes.invoices||[]);
    setMatters(matRes.matters||[]);
    const dmap={}; (allRes.activities||[]).forEach(a=>{ if(!dmap[a.date]) dmap[a.date]={date:a.date,sessions:0}; dmap[a.date].sessions++; });
    setDates(Object.values(dmap).sort((a,b)=>b.date.localeCompare(a.date)));
  },[userId,selDate]);

  const loadTrust=useCallback(async()=>{
    if(!userId) return;
    setTrustLoading(true);
    try{
      const [accsRes,txnsRes,branchRes,locksRes,alertsRes]=await Promise.all([
        supabase.from('trust_accounts').select('*').eq('is_active',true).order('name'),
        supabase.from('trust_transactions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('branches').select('*').eq('is_active',true).order('name'),
        supabase.from('trust_period_locks').select('*').order('period',{ascending:false}),
        supabase.from('trust_balance_alerts').select('*'),
      ]);
      const accs=accsRes.data||[],txns=txnsRes.data||[];
      setTrustAccounts(accs);
      setBranches(branchRes.data||[]);
      setLockedPeriods((locksRes.data||[]).map(l=>l.period));
      setBalanceAlerts(alertsRes.data||[]);
  if(accs.length&&!rForm.amount&&!rForm.matterId){
  setRForm(f=>f.accountId?f:{...f,accountId:accs[0].id});
  setPForm(f=>f.accountId?f:{...f,accountId:accs[0].id});
  setTForm(f=>f.fromAccountId?f:{...f,fromAccountId:accs[0].id});
}
      setTrustTransactions(txns);
      setPendingPayments(txns.filter(t=>t.status==='pending'));
      const bals={};
      txns.filter(t=>t.status==='posted').forEach(t=>{
        if(!bals[t.matter_id]) bals[t.matter_id]=0;
        if(t.type==='receipt') bals[t.matter_id]+=Number(t.amount);
        else bals[t.matter_id]-=Number(t.amount);
      });
      setTrustBalances(bals);
    }catch(e){ console.error('loadTrust:',e.message); }
    setTrustLoading(false);
  },[userId]);

  useEffect(()=>{ 
  if(tab==='trust'&&userId){ 
    loadTrust(); 
    const t=setInterval(loadTrust,300000);
    return()=>clearInterval(t);
  } 
},[tab,userId]);

  useEffect(()=>{
    if(!searchQuery.trim()){ setSearchResults(null); return; }
    const t=setTimeout(async()=>{
      if(!userId) return;
      setSearching(true);
      const res=await searchAll(searchQuery.trim(),userId);
      const fuseA=new Fuse(res.activities||[],{keys:['window_title','app_display_name','matter'],threshold:0.4});
      const fuseM=new Fuse(res.matters||[],{keys:['name','client','id'],threshold:0.3});
      const fuseI=new Fuse(res.invoices||[],{keys:['client','matter_name','id'],threshold:0.3});
      const q=searchQuery.toLowerCase();
      const fA=fuseA.search(q).map(r=>r.item),fM=fuseM.search(q).map(r=>r.item),fI=fuseI.search(q).map(r=>r.item);
      const aS=new Set(fA.map(a=>a.id)),mS=new Set(fM.map(m=>m.id)),iS=new Set(fI.map(i=>i.id));
      setSearchResults({activities:[...fA,...(res.activities||[]).filter(a=>!aS.has(a.id))].slice(0,40),matters:[...fM,...(res.matters||[]).filter(m=>!mS.has(m.id))],invoices:[...fI,...(res.invoices||[]).filter(i=>!iS.has(i.id))],query:searchQuery});
      setSearching(false);
    },350);
    return()=>clearTimeout(t);
  },[searchQuery,userId]);

  useEffect(()=>{
    if(tab!=='history'||!userId) return;
    fetchHistory(histYear,userId).then(res=>{ if(res.months) setHistMonths(res.months); setHistYears([...new Set(allActs.map(a=>a.date?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a)); });
  },[tab,histYear,userId]);

  const loadMonth=(month)=>{
    if(!userId) return;
    setSelMonth(month);
    fetchMonthActivities(month,userId).then(res=>{
      if(!res.activities) return;
      const acts=res.activities,tSec=acts.reduce((s,a)=>s+Number(a.duration_seconds||0),0),bSec=acts.filter(a=>a.is_billable).reduce((s,a)=>s+Number(a.duration_seconds||0),0),bU=acts.filter(a=>a.is_billable).reduce((s,a)=>s+Number(a.billing_units||0),0);
      setMonthData({activities:acts,totals:{sessions:acts.length,total_seconds:tSec,billable_seconds:bSec,billable_units:bU}});
    });
  };

  function showTrustAlert(msg,type='success'){ setTrustAlert({msg,type}); setTimeout(()=>setTrustAlert({msg:'',type:''}),6000); }
  function getMatterBalance(id){ return trustBalances[id]||0; }
  function isLocked(date){ return date&&lockedPeriods.includes(date.substring(0,7)); }
  function isPeriodLocked(p){ return lockedPeriods.includes(p); }
  function totalTrustHeld(){ return Object.values(trustBalances).reduce((s,v)=>s+v,0); }
  function getMatterLedger(matterId){
    let run=0;
    return trustTransactions.filter(t=>t.matter_id===matterId&&t.status==='posted').sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{ if(t.type==='receipt') run+=Number(t.amount); else run-=Number(t.amount); return{...t,runningBalance:run}; });
  }
  function getMatterInvoices(matterId){ return invoices.filter(i=>i.matter_id===matterId); }
  function getReportTxns(){ let t=trustTransactions.filter(x=>x.date>=reportFrom&&x.date<=reportTo&&x.status==='posted'); if(reportBranch) t=t.filter(x=>x.branch_id===reportBranch); return t; }

  function handleCSVImport(e){
    const file=e.target.files[0]; if(!file) return;
    setCsvError('');
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const lines=ev.target.result.split('\n').filter(l=>l.trim());
        const parsed=[];
        lines.forEach((line,i)=>{
          if(i===0&&(line.toLowerCase().includes('date')||line.toLowerCase().includes('description'))) return;
          const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
          if(cols.length<3) return;
          const date=cols[0],desc=cols[1]||cols[2]||'',amtRaw=cols[2]||cols[3]||'0';
          const amt=parseFloat(amtRaw.replace(/[^0-9.-]/g,''));
          if(isNaN(amt)||!date) return;
          parsed.push({id:Date.now()+i,date:date.includes('/')?date.split('/').reverse().join('-'):date,description:desc,amount:Math.abs(amt),isCredit:amt>0});
        });
        if(!parsed.length){ setCsvError('No valid rows found. Check your CSV format.'); return; }
        setBankLines(l=>[...l,...parsed]);
        showTrustAlert(`✓ Imported ${parsed.length} bank statement lines`,'success');
      }catch(err){ setCsvError('Failed to parse CSV: '+err.message); }
    };
    reader.readAsText(file);
    e.target.value='';
  }

  async function postReceipt(){
    if(!rForm.date||!rForm.amount||!rForm.matterId||!rForm.narration){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(rForm.date)){ showTrustAlert(`Period ${rForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amount=parseFloat(rForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    setTrustSaving(true);
    const receiptNo=nextReceiptNo(trustTransactions);
    const {error}=await supabase.from('trust_transactions').insert([{type:'receipt',matter_id:rForm.matterId,user_id:userId,date:rForm.date,amount,receipt_no:receiptNo,received_from:rForm.receivedFrom,trust_account_id:rForm.accountId||null,reference:rForm.reference,narration:rForm.narration,captured_by:userId,branch_id:rForm.branchId||profile?.branch_id||null,status:'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Receipt ${receiptNo} posted — ${fmtR(amount)} credited to ${matters.find(m=>m.id===rForm.matterId)?.client||rForm.matterId}`,'success');
    setRForm(f=>({...f,amount:'',matterId:'',reference:'',receivedFrom:'',narration:''}));
    setTrustSaving(false); loadTrust();
  }

  async function postPayment(){
    if(!pForm.date||!pForm.amount||!pForm.matterId||!pForm.payee||!pForm.narration){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(pForm.date)){ showTrustAlert(`Period ${pForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amount=parseFloat(pForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const bal=getMatterBalance(pForm.matterId);
    if(amount>bal){ showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)} — Requested: ${fmtR(amount)}. Payment blocked.`,'error'); return; }
    setTrustSaving(true);
    const needsApproval=amount>=APPROVAL_THRESHOLD;
    const {error}=await supabase.from('trust_transactions').insert([{type:'payment',matter_id:pForm.matterId,user_id:userId,date:pForm.date,amount,payee:pForm.payee,trust_account_id:pForm.accountId||null,reference:pForm.reference,narration:pForm.narration,captured_by:userId,branch_id:pForm.branchId||null,status:needsApproval?'pending':'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(needsApproval?`⏳ Payment of ${fmtR(amount)} submitted for partner approval.`:`✓ Payment of ${fmtR(amount)} to ${pForm.payee} posted.`,'success');
    setPForm(f=>({...f,amount:'',matterId:'',payee:'',reference:'',narration:''}));
    setPBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  async function approvePayment(id){ const {error}=await supabase.from('trust_transactions').update({status:'posted',approved_by:userId,approved_at:new Date().toISOString()}).eq('id',id); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert('✓ Payment approved and posted.','success'); loadTrust(); }
  async function rejectPayment(id,reason){ const {error}=await supabase.from('trust_transactions').update({status:'rejected',rejection_reason:reason||'Rejected'}).eq('id',id); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert('Payment rejected.','success'); loadTrust(); }

  async function postTransfer(){
    if(!tForm.date||!tForm.amount||!tForm.matterId){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(tForm.date)){ showTrustAlert(`Period ${tForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amount=parseFloat(tForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const bal=getMatterBalance(tForm.matterId);
    if(amount>bal){ showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)}.`,'error'); return; }
    setTrustSaving(true);
    const {error}=await supabase.from('trust_transactions').insert([{type:'transfer',matter_id:tForm.matterId,user_id:userId,date:tForm.date,amount,trust_account_id:tForm.fromAccountId||null,to_account:tForm.toAccount,invoice_id:tForm.invoiceId,narration:tForm.narration||`Transfer of fees — ${tForm.matterId}`,captured_by:userId,branch_id:tForm.branchId||null,status:'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Transfer of ${fmtR(amount)} posted. Both legs recorded.`,'success');
    setTForm(f=>({...f,amount:'',matterId:'',invoiceId:'',narration:''}));
    setTBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  function checkPaymentBalance(matterId,amount){ if(!matterId||!amount){setPBalanceCheck(null);return;} const bal=getMatterBalance(matterId),amt=parseFloat(amount); if(isNaN(amt)||amt<=0){setPBalanceCheck(null);return;} setPBalanceCheck({bal,amt,ok:amt<=bal,needsApproval:amt>=APPROVAL_THRESHOLD}); }
  function checkTransferBalance(matterId,amount){ if(!matterId||!amount){setTBalanceCheck(null);return;} const bal=getMatterBalance(matterId),amt=parseFloat(amount); if(isNaN(amt)||amt<=0){setTBalanceCheck(null);return;} setTBalanceCheck({bal,amt,ok:amt<=bal}); }
  async function lockPeriod(period){ if(!confirm(`Lock period ${period}? No transactions can be posted after locking.`)) return; const {error}=await supabase.from('trust_period_locks').insert([{period,locked_by:userId}]); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert(`✓ Period ${period} locked.`,'success'); loadTrust(); }
  async function unlockPeriod(period){ if(!confirm(`Unlock period ${period}? Only do this with partner authorisation.`)) return; const {error}=await supabase.from('trust_period_locks').delete().eq('period',period); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert(`Period ${period} unlocked.`,'success'); loadTrust(); }
  async function saveBalanceAlert(){ if(!alertMatterId){ showTrustAlert('Select a matter.','error'); return; } const {error}=await supabase.from('trust_balance_alerts').upsert([{matter_id:alertMatterId,minimum_balance:alertMinBal,is_active:true,created_by:userId}],{onConflict:'matter_id'}); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert('✓ Balance alert saved.','success'); loadTrust(); }

  async async function handleChangePassword(){
  if(!pwdForm.newPwd||!pwdForm.confirm){ setPwdMsg({msg:'Please fill in all fields.',type:'error'}); return; }
  if(pwdForm.newPwd!==pwdForm.confirm){ setPwdMsg({msg:'New passwords do not match.',type:'error'}); return; }
  if(pwdForm.newPwd.length<6){ setPwdMsg({msg:'Password must be at least 6 characters.',type:'error'}); return; }
  setPwdSaving(true);
  const {error}=await supabase.auth.updateUser({password:pwdForm.newPwd});
  if(error){ setPwdMsg({msg:'Error: '+error.message,type:'error'}); setPwdSaving(false); return; }
  setPwdMsg({msg:'✓ Password changed successfully!',type:'success'});
  setPwdSaving(false);
  setTimeout(()=>{ setShowPwdForm(false); setPwdForm({current:'',newPwd:'',confirm:''}); setPwdMsg({msg:'',type:''}); },2000);
} const act=[...allActs,...liveActs].find(a=>a.id===id); const units=cls==='billable'?Math.max(1,Math.ceil((act?.duration_seconds||0)/360)):0; await patchActivity(id,{classification:cls,billing_units:units,is_billable:cls==='billable'}); load(); }
  async function assignMatter(actId,matterId){ await patchActivityMatter(actId,matterId); load(); }

  async function seedDemo(){
    if(!user) return; setSeeding(true);
    const dayStart=new Date(selDate+'T08:00:00').getTime();
    const LEGAL_KW=['contract','client','case','matter','settlement','litigation','counsel','court','deed','agreement'];
    const demos=[{app:'WINWORD.EXE',disp:'Microsoft Word',title:'Smith v Jones - Settlement Agreement Draft.docx',dur:2400},{app:'Teams.exe',disp:'Microsoft Teams',title:'Client Consultation Call - ABC Corp Matter',dur:3600},{app:'OUTLOOK.EXE',disp:'Microsoft Outlook',title:'RE: Case Update - Litigation Matter 2025',dur:720},{app:'chrome.exe',disp:'Google Chrome',title:'LexisNexis - Case Law Research - Contract Law',dur:1800},{app:'EXCEL.EXE',disp:'Microsoft Excel',title:'Client Billing Summary Q1 2025.xlsx',dur:1200},{app:'Acrobat.exe',disp:'Adobe Acrobat',title:'Pleadings - Motion to Dismiss - Client Matter.pdf',dur:2100},{app:'WINWORD.EXE',disp:'Microsoft Word',title:'Contract Draft - XYZ Acquisition Agreement.docx',dur:1800},{app:'chrome.exe',disp:'Google Chrome',title:'YouTube - Music Mix',dur:600},{app:'OUTLOOK.EXE',disp:'Microsoft Outlook',title:'FWD: Trust Deed Amendment - Estate Matter',dur:540}];
    const rows=demos.map((d,i)=>{ const st=dayStart+i*(d.dur*1000+60000),t=d.title.toLowerCase(),isBrowser=['chrome','edge'].some(b=>d.app.toLowerCase().includes(b)),hasLegal=LEGAL_KW.some(k=>t.includes(k)),cls=isBrowser?(hasLegal?'work':'non-billable'):(hasLegal?'billable':'work'),units=cls==='billable'?Math.max(1,Math.ceil(d.dur/360)):0; return{user_id:user.id,agent_id:'demo',app_name:d.app,app_display_name:d.disp,window_title:d.title,start_time:st,end_time:st+d.dur*1000,duration_seconds:d.dur,classification:cls,billing_units:units,is_billable:cls==='billable',matter:'',date:selDate}; });
    await supabase.from('activities').upsert(rows,{onConflict:'user_id,agent_id,start_time',ignoreDuplicates:true});
    await load(); setSeeding(false);
  }

  async function logCall(){
    if(!callForm.description) return; setCallSaving(true);
    const durSec=Math.max(6,Number(callForm.durationMins)||6)*60,m=matters.find(x=>x.id===callForm.matterId),title=`📞 Call: ${callForm.description}${m?' ['+m.id+']':''}`,now=Date.now(),units=Math.max(1,Math.ceil(durSec/360));
    await supabase.from('activities').insert({user_id:user.id,agent_id:`manual-call-${now}`,app_name:'Phone Call',app_display_name:'Phone Call',window_title:title,start_time:now,end_time:now+durSec*1000,duration_seconds:durSec,classification:'billable',billing_units:units,is_billable:true,matter:callForm.matterId||'',date:new Date().toISOString().split('T')[0]});
    await load(); setCallSaving(false); setShowCall(false);
    setCallForm({description:'',matterId:'',durationMins:6,date:today});
  }

  async function handleCreateMatter(){
    if(!matterForm.name||!matterForm.client) return; setMatterSaving(true);
    const res=await createMatter({...matterForm,userId:user.id,branchId:profile?.branch_id||null});
    if(res.error){ alert(res.error.message); setMatterSaving(false); return; }
    const savedId=(res.data?.id||matterForm.id).toUpperCase();
    const words=[...matterForm.name.toLowerCase().split(/[\s\-\/,.()]+/),...matterForm.client.toLowerCase().split(/[\s\-\/,.()]+/)].filter(w=>w.length>2);
    const toLink=allActs.filter(a=>!a.matter&&words.some(w=>(a.window_title||'').toLowerCase().includes(w)));
    if(toLink.length>0) await Promise.all(toLink.map(a=>patchActivityMatter(a.id,savedId)));
    setMatterSaving(false); setShowMatterForm(false); setMatterForm({id:'',name:'',client:'',description:''});
    setMatterMsg(`Matter ${savedId} created — ${toLink.length} activit${toLink.length===1?'y':'ies'} linked.`);
    setTimeout(()=>setMatterMsg(''),4000); load();
  }

  async function handleDeleteMatter(id){ if(!confirm(`Delete matter ${id}?`)) return; await deleteMatter(id); load(); }

  const invMatter=matters.find(m=>m.id===invMatterId)||null;
  function buildPreview(){
    if(!invMatterId) return;
    const mActs=allActs.filter(a=>a.matter===invMatterId);
    let filtered;
    if(invPeriod==='day') filtered=mActs.filter(a=>a.date===selDate);
    else if(invPeriod==='week'){ const d=new Date(selDate+'T12:00:00'); d.setDate(d.getDate()-d.getDay()+1); const s=d.toISOString().split('T')[0]; const e=new Date(d); e.setDate(d.getDate()+6); filtered=mActs.filter(a=>a.date>=s&&a.date<=e.toISOString().split('T')[0]); }
    else filtered=mActs.filter(a=>a.date.startsWith(selDate.substring(0,7)));
    const label=invPeriod==='day'?fdate(selDate):invPeriod==='week'?'This week':fmonth(selDate);
    const bill=filtered.filter(a=>a.classification==='billable'),tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    setPreview({label,filtered,bill,tU,tAmt:tU*invRate});
  }
  async function handleSaveInvoice(){
    if(!preview||!invMatter) return;
    const res=await saveInvoice({client:invMatter.client,matter_id:invMatter.id,matter_name:invMatter.name,attorney:invAtty,period:invPeriod,period_label:preview.label,rate:invRate,total_units:preview.tU,total_amount:preview.tAmt,activity_ids:preview.bill.map(a=>a.id)},user.id);
    if(res.error){ alert('Error: '+res.error.message); return; }
    setPreview(null); await load(); setTab('archive');
  }

  function getAnalyticsActs(p){ if(p==='day') return allActs.filter(a=>a.date===selDate); if(p==='week'){ const d=new Date(selDate+'T12:00:00'); d.setDate(d.getDate()-d.getDay()+1); const s=d.toISOString().split('T')[0]; const e=new Date(d); e.setDate(d.getDate()+6); return allActs.filter(a=>a.date>=s&&a.date<=e.toISOString().split('T')[0]); } return allActs.filter(a=>a.date.startsWith(selDate.substring(0,7))); }
  function appBars(acts){ const m={}; acts.forEach(a=>{ const k=a.app_display_name||'Unknown'; if(!m[k]) m[k]={label:k.replace('Microsoft ','').substring(0,10),value:0,bill:0}; m[k].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[k].bill+=Number(a.duration_seconds||0); }); return Object.values(m).sort((a,b)=>b.value-a.value).slice(0,8).map(d=>({...d,label2:toHm(d.value),color:d.bill>d.value*0.5?'#6CC04A':'#2E4A6E'})); }
  function dayBars(acts){ const m={}; acts.forEach(a=>{ if(!m[a.date]) m[a.date]={label:new Date(a.date+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short'}),value:0,bill:0}; m[a.date].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[a.date].bill+=Number(a.duration_seconds||0); }); return Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).map(([,d])=>({...d,label2:`${Math.round(d.value/60)}m`,value:Math.round(d.value/60),color:d.bill/Math.max(d.value,1)>0.5?'#6CC04A':'#2E4A6E'})); }
  function hourBars(acts){ const m={}; acts.forEach(a=>{ const hr=new Date(Number(a.start_time)).getHours(); if(!m[hr]) m[hr]={value:0,bill:0}; m[hr].value+=Number(a.duration_seconds||0); if(a.classification==='billable') m[hr].bill+=Number(a.duration_seconds||0); }); return Array.from({length:13},(_,i)=>i+7).map(h=>({label:`${String(h).padStart(2,'0')}h`,value:Math.round((m[h]?.value||0)/60),label2:m[h]?.value>0?`${Math.round(m[h].value/60)}m`:'',color:(m[h]?.bill||0)>(m[h]?.value||0)*0.5?'#6CC04A':'#2E4A6E'})); }

  const dayActs=liveActs,daySec=dayActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0),dayBillSec=dayActs.filter(a=>a.classification==='billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0),dayBillU=dayActs.filter(a=>a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
  const allApps=[...new Set(allActs.map(a=>a.app_display_name))].sort();
  const filtActs=allActs.filter(a=>{ if(filterCls&&a.classification!==filterCls) return false; if(filterDate&&a.date!==filterDate) return false; if(filterApp&&a.app_display_name!==filterApp) return false; return true; }).sort((a,b)=>b.start_time-a.start_time);

  const C={
    page:{background:'#0A0A0A',minHeight:'100vh',fontFamily:'system-ui,sans-serif',color:'#F0F0F0'},
    hdr:{background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    mark:{background:'#000',border:'1px solid #252525',borderRadius:7,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,letterSpacing:'-0.06em'},
    ntab:(on)=>({background:'transparent',border:`1px solid ${on?'#2A2A2A':'transparent'}`,color:on?'#F0F0F0':'#555',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
    pill:{display:'flex',alignItems:'center',gap:6,background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#6CC04A'},
    dot:{width:7,height:7,borderRadius:'50%',background:'#6CC04A',boxShadow:'0 0 6px rgba(108,192,74,0.8)'},
    main:{maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card:{background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat:(acc)=>({background:acc?'rgba(108,192,74,0.05)':'#111',border:`1px solid ${acc?'rgba(108,192,74,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    btn:(v='s')=>({background:v==='p'?'#6CC04A':v==='pur'?'#A78BFA':v==='r'?'rgba(220,80,80,0.15)':v==='trust'?'rgba(74,144,217,0.15)':v==='warn'?'rgba(234,179,8,0.15)':'transparent',border:v==='p'?'none':v==='pur'?'none':v==='g'?'1px solid rgba(108,192,74,0.35)':v==='r'?'1px solid rgba(220,80,80,0.4)':v==='trust'?'1px solid rgba(74,144,217,0.4)':v==='warn'?'1px solid rgba(234,179,8,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='pur'?'#0A0A0A':v==='g'?'#6CC04A':v==='r'?'#E05252':v==='trust'?'#4A90D9':v==='warn'?'#EAB308':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'||v==='pur'?700:500,whiteSpace:'nowrap'}),
    sel:{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:{fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:{padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    inp:{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%'},
    asel:{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'3px 7px',borderRadius:4,fontSize:10,fontFamily:'inherit'},
    ptab:(on)=>({background:on?'#2A2A2A':'transparent',border:'none',color:on?'#F0F0F0':'#555',padding:'5px 14px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:on?600:400}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20},
    mbox:{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:480},
    lbl:{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'},
    tinp:{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',marginTop:4},
    ttab:(on)=>({background:on?'rgba(74,144,217,0.15)':'transparent',border:`1px solid ${on?'rgba(74,144,217,0.4)':'#252525'}`,color:on?'#4A90D9':'#555',padding:'6px 16px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
  };

  function InvoiceDoc({inv,acts}){
    const bill=(acts||[]).filter(a=>a.classification==='billable'),rate=Number(inv.rate)||150,tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0),tAmt=tU*rate,tSec=(acts||[]).reduce((s,a)=>s+Number(a.duration_seconds||0),0),bSec=bill.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
    return(<div style={{background:'#fff',color:'#111',borderRadius:8,padding:28,fontFamily:'system-ui'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'2px solid #6CC04A',paddingBottom:16,marginBottom:20}}><div><div style={{fontWeight:900,fontSize:24,letterSpacing:'-0.04em'}}>M<span style={{color:'#6CC04A'}}>B</span></div><div style={{fontSize:11,color:'#999',marginTop:2}}>Motsoeneng Bill Attorneys</div></div><div style={{textAlign:'right'}}><div style={{fontWeight:800,fontSize:20}}>TAX INVOICE</div><div style={{fontSize:12,color:'#888',marginTop:3}}>{inv.id}</div></div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:14}}><div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Billed To</div><div style={{fontWeight:700,fontSize:14}}>{inv.client}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{inv.matter_name}</div><div style={{fontSize:11,color:'#bbb'}}>Ref: {inv.matter_id}</div></div><div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Attorney</div><div style={{fontWeight:600,fontSize:13}}>{inv.attorney}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>Period: {inv.period_label}</div></div></div>
      <div style={{display:'flex',border:'1px solid #eee',borderRadius:7,overflow:'hidden',marginBottom:16}}>{[['Sessions',bill.length],['Units',tU],['Rate',`R${rate}/unit`],['Total Due',`R${tAmt.toLocaleString()}`]].map(([l,v],i,arr)=>(<div key={l} style={{flex:1,padding:12,textAlign:'center',borderRight:i<arr.length-1?'1px solid #eee':'none'}}><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.06em',color:'#aaa'}}>{l}</div><div style={{fontWeight:800,fontSize:17,marginTop:3}}>{v}</div></div>))}</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:'#f9f9f9'}}>{['Date/Time','Application','Description','Time','Units','Amount'].map(h=><th key={h} style={{padding:'8px',fontSize:9,textTransform:'uppercase',letterSpacing:'.06em',color:'#aaa',textAlign:['Time','Units','Amount'].includes(h)?'right':'left',borderBottom:'2px solid #eee'}}>{h}</th>)}</tr></thead><tbody>{!bill.length&&<tr><td colSpan={6} style={{padding:16,textAlign:'center',color:'#ccc',fontSize:11}}>No billable activities.</td></tr>}{bill.map((a,i)=>(<tr key={i}><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,color:'#666',whiteSpace:'nowrap'}}>{fdate(a.date)} {ftime(a.start_time)}</td><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11}}>{a.app_display_name}</td><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,color:'#777',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.window_title}</td><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace'}}>{toHm(a.duration_seconds)}</td><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace'}}>{calcUnits(a.duration_seconds)}</td><td style={{padding:'6px 8px',borderBottom:'1px solid #f3f3f3',fontSize:11,textAlign:'right',fontFamily:'monospace',fontWeight:600}}>R{calcAmt(a.duration_seconds,rate).toLocaleString()}</td></tr>))}</tbody></table>
      <div style={{background:'#f7f7f7',borderRadius:7,padding:'14px 18px',marginTop:14,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}><div><div style={{fontSize:12,color:'#555'}}><strong>{tU} units</strong> x R{rate} per unit</div><div style={{fontSize:10,color:'#bbb',marginTop:3}}>1 billing unit = 6 minutes</div></div><div style={{textAlign:'right',minWidth:220}}><div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:12,color:'#888',marginBottom:3}}><span>Subtotal (excl. VAT)</span><span style={{fontFamily:'monospace',color:'#555'}}>R{tAmt.toLocaleString()}</span></div><div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:12,color:'#888',marginBottom:8,paddingBottom:8,borderBottom:'1px solid #ddd'}}><span>VAT @ 15%</span><span style={{fontFamily:'monospace',color:'#555'}}>R{(tAmt*0.15).toFixed(2)}</span></div><div style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'baseline'}}><span style={{fontSize:12,fontWeight:600,color:'#111'}}>Total Due (incl. VAT)</span><span style={{fontSize:22,fontWeight:900,color:'#111'}}>R{(tAmt*1.15).toFixed(2)}</span></div></div></div>
      <div style={{marginTop:14,fontSize:10,color:'#ccc',textAlign:'center',lineHeight:1.8}}>Motsoeneng Bill Attorneys · VAT: 4100000000 · FNB 62000000000 · Branch: 250655<br/>accounts@mb.co.za · Computer generated invoice.</div>
    </div>);
  }

  function AnalyticsTab(){
    const acts=getAnalyticsActs(analyticsPeriod),tSec=acts.reduce((s,a)=>s+Number(a.duration_seconds||0),0),bSec=acts.filter(a=>a.classification==='billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0),wSec=acts.filter(a=>a.classification==='work').reduce((s,a)=>s+Number(a.duration_seconds||0),0),nbSec=acts.filter(a=>a.classification==='non-billable').reduce((s,a)=>s+Number(a.duration_seconds||0),0),bU=acts.filter(a=>a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    const label=analyticsPeriod==='day'?fdate(selDate):analyticsPeriod==='week'?'This week':fmonth(selDate);
    return(<div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Analytics</div><div style={{fontSize:11,color:'#444'}}>{label} · {acts.length} sessions</div></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><select style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}><option value={today}>Today</option>{dates.filter(d=>d.date!==today).map(d=><option key={d.date} value={d.date}>{fdate(d.date)}</option>)}</select><div style={{display:'flex',background:'#1A1A1A',border:'1px solid #252525',borderRadius:6,padding:2}}>{[['day','Day'],['week','Week'],['month','Month']].map(([v,l])=>(<button key={v} style={C.ptab(analyticsPeriod===v)} onClick={()=>setAP(v)}>{l}</button>))}</div></div></div>
      {!acts.length?<div style={{...C.card,textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:28,marginBottom:10}}>📊</div><div>No data for this period</div></div>:(
        <><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>{[{l:'Total Time',v:toHm(tSec),s:`${acts.length} sessions`,a:false},{l:'Billable Time',v:toHm(bSec),s:`${pct(bSec,tSec)}% of total`,a:true},{l:'Billing Units',v:bU,s:`@ R${invRate}/unit`,a:false},{l:'Est. Revenue',v:`R${(bU*invRate).toLocaleString()}`,s:`${bU} units`,a:false}].map(({l,v,s,a})=>(<div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}</div>
        <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:14,marginBottom:14}}><div style={C.card}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:14}}>Time breakdown</div><div style={{display:'flex',justifyContent:'center',marginBottom:14}}><DonutChart segments={[{color:'#6CC04A',value:pct(bSec,tSec)},{color:'#4A90D9',value:pct(wSec,tSec)},{color:'#333',value:pct(nbSec,tSec)}]} size={140}/></div>{[{l:'Billable',c:'#6CC04A',s:bSec,p:pct(bSec,tSec)},{l:'Work',c:'#4A90D9',s:wSec,p:pct(wSec,tSec)},{l:'Non-Billable',c:'#444',s:nbSec,p:pct(nbSec,tSec)}].map(r=>(<div key={r.l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',borderTop:'1px solid #181818'}}><div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:8,height:8,borderRadius:2,background:r.c}}/><span style={{fontSize:11,color:'#888'}}>{r.l}</span></div><div><span style={{fontSize:11,color:'#C0C0C0',fontFamily:'monospace'}}>{toHm(r.s)}</span><span style={{fontSize:10,color:'#444',marginLeft:6}}>{r.p}%</span></div></div>))}</div><div style={C.card}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Time per application</div><BarChart data={appBars(acts)} height={150}/></div></div>
        <div style={C.card}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>{analyticsPeriod==='day'?'Activity by hour':'Activity by day'}</div><div style={{fontSize:10,color:'#444',marginBottom:10}}>Minutes tracked · green = mostly billable</div><BarChart data={analyticsPeriod==='day'?hourBars(acts):dayBars(acts)} height={130}/></div></>
      )}
    </div>);
  }

  const TrustTab=useCallback(()=>{
    const total=totalTrustHeld();
    const ledger=selectedTrustMatter?getMatterLedger(selectedTrustMatter):[];
    const systemTotal=trustTransactions.filter(t=>t.status==='posted').reduce((s,t)=>t.type==='receipt'?s+Number(t.amount):s-Number(t.amount),0);
    const bankTotal=bankLines.reduce((s,l)=>l.isCredit?s+Number(l.amount||0):s-Number(l.amount||0),0);
    const diff=Math.abs(systemTotal-bankTotal);
    return(<div>
      {trustAlert.msg&&(<div style={{background:trustAlert.type==='error'?'rgba(220,80,80,0.1)':'rgba(108,192,74,0.1)',border:`1px solid ${trustAlert.type==='error'?'rgba(220,80,80,0.4)':'rgba(108,192,74,0.3)'}`,borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:trustAlert.type==='error'?'#E05252':'#6CC04A',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{trustAlert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:14}} onClick={()=>setTrustAlert({msg:'',type:''})}>✕</button></div>)}
      {pendingPayments.length>0&&(<div style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#EAB308',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>⏳ {pendingPayments.length} payment{pendingPayments.length>1?'s':''} pending approval — {fmtR(pendingPayments.reduce((s,t)=>s+Number(t.amount),0))}</span><button style={{...C.btn('warn'),fontSize:11}} onClick={()=>setTrustTab('approvals')}>Review →</button></div>)}
      {balanceAlerts.filter(a=>a.is_active&&getMatterBalance(a.matter_id)<Number(a.minimum_balance)).map(a=>{ const m=matters.find(x=>x.id===a.matter_id); return(<div key={a.matter_id} style={{background:'rgba(220,80,80,0.08)',border:'1px solid rgba(220,80,80,0.3)',borderRadius:6,padding:'8px 14px',marginBottom:8,fontSize:12,color:'#E05252'}}>⚠ Low balance: {m?.client||a.matter_id} — {fmtR(getMatterBalance(a.matter_id))} below minimum {fmtR(a.minimum_balance)}</div>); })}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[['ledger','📊 Ledger'],['receipt','⬇ Receipt'],['payment','⬆ Payment'],['transfer','↔ Transfer'],['recon','🔁 Reconciliation'],['reports','📋 Reports'],['approvals','✅ Approvals'],['settings','⚙ Settings']].map(([v,l])=>(
          <button key={v} style={{...C.ttab(trustTab===v),position:'relative'}} onClick={()=>setTrustTab(v)}>
            {l}{v==='approvals'&&pendingPayments.length>0&&<span style={{position:'absolute',top:-4,right:-4,background:'#EAB308',color:'#000',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingPayments.length}</span>}
          </button>
        ))}
        {trustLoading&&<span style={{fontSize:11,color:'#555',alignSelf:'center'}}>Loading...</span>}
      </div>

      {trustTab==='ledger'&&(<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>{[{l:'Total trust held',v:fmtR(total),a:true},{l:'Receipts',v:fmtR(trustTransactions.filter(t=>t.type==='receipt'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false},{l:'Payments',v:fmtR(trustTransactions.filter(t=>t.type==='payment'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false},{l:'Transferred',v:fmtR(trustTransactions.filter(t=>t.type==='transfer'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false}].map(({l,v,a})=>(<div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div></div>))}</div>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}><span style={{fontSize:11,color:'#555'}}>Branch:</span>{[{id:'',name:'All branches'},...branches].map(b=>(<button key={b.id} style={{...C.btn(reportBranch===b.id?'trust':'s'),fontSize:11,padding:'4px 12px'}} onClick={()=>setReportBranch(b.id)}>{b.name}</button>))}</div>
        <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All matters — trust balances</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Description','Branch','Balance','Alert','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!matters.length&&<tr><td colSpan={7} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No matters found.</td></tr>}{matters.map(m=>{ const bal=getMatterBalance(m.id),alert=balanceAlerts.find(a=>a.matter_id===m.id&&a.is_active),isLow=alert&&bal<Number(alert.minimum_balance),br=branches.find(b=>b.id===m.branch_id); return(<tr key={m.id} style={{background:isLow?'rgba(220,80,80,0.03)':''}}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td><td style={{...C.td,fontWeight:500,color:'#C8C8C8'}}>{m.client}</td><td style={{...C.td,color:'#555',fontSize:10}}>{m.name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#6CC04A':bal<0?'#E05252':'#555',textAlign:'right'}}>{fmtR(bal)}</td><td style={C.td}>{isLow?<span style={{fontSize:9,color:'#E05252',border:'1px solid rgba(220,80,80,0.4)',padding:'2px 8px',borderRadius:20}}>⚠ Low</span>:alert?<span style={{fontSize:9,color:'#555',border:'1px solid #252525',padding:'2px 8px',borderRadius:20}}>Monitored</span>:'—'}</td><td style={C.td}><div style={{display:'flex',gap:4}}><button style={{...C.btn('trust'),fontSize:10,padding:'3px 8px'}} onClick={()=>setSelectedTrustMatter(selectedTrustMatter===m.id?'':m.id)}>{selectedTrustMatter===m.id?'Hide':'Ledger'}</button><button style={{...C.btn('g'),fontSize:10,padding:'3px 8px'}} onClick={()=>printTrustStatement(m,getMatterLedger(m.id))}>Statement</button></div></td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={4} style={{...C.th,paddingTop:12}}>Grand total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(total)}</td><td colSpan={2}></td></tr></tbody></table></div></div>
        {selectedTrustMatter&&(<div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:'#4A90D9'}}>{selectedTrustMatter} — {matters.find(m=>m.id===selectedTrustMatter)?.client} — Running ledger</div><button style={{...C.btn('g'),fontSize:11}} onClick={()=>printTrustStatement(matters.find(m=>m.id===selectedTrustMatter),ledger)}>Print statement</button></div>{!ledger.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>No transactions yet.</div>:(<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Type','Receipt No','Reference','Narration','Debit','Credit','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{ledger.map((t,i)=>{ const isR=t.type==='receipt'; return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,whiteSpace:'nowrap'}}>{fmtDate(t.date)}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:isR?'rgba(108,192,74,0.1)':t.type==='payment'?'rgba(220,80,80,0.1)':'rgba(74,144,217,0.1)',color:isR?'#6CC04A':t.type==='payment'?'#E05252':'#4A90D9'}}>{t.type}</span></td><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555'}}>{t.receipt_no||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.reference||'—'}</td><td style={{...C.td,fontSize:11}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{!isR?fmtR(t.amount):''}</td><td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{isR?fmtR(t.amount):''}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:t.runningBalance>=0?'#6CC04A':'#E05252',textAlign:'right'}}>{fmtR(t.runningBalance)}</td></tr>); })}</tbody></table></div>)}</div>)}
      </div>)}

{trustTab==='receipt'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
  <div style={C.card}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust receipt</div>
      <span style={{fontSize:10,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'2px 10px',borderRadius:20}}>Next: {nextReceiptNo(trustTransactions)}</span>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div>
          <label style={C.lbl}>Date *</label>
          <input type="date" style={C.tinp} value={rForm.date} onChange={e=>setRForm(f=>({...f,date:e.target.value}))}/>
          {isLocked(rForm.date)&&<div style={{fontSize:10,color:'#E05252',marginTop:4}}>⚠ Period locked</div>}
        </div>
        <div>
          <label style={C.lbl}>Amount (ZAR) *</label>
          <input type="text" inputMode="decimal" style={C.tinp} placeholder="e.g. 10000.00" defaultValue={rForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setRForm(f=>({...f,amount:v})); }}/>
        </div>
      </div>
      <div>
        <label style={C.lbl}>Matter *</label>
        <select style={C.tinp} value={rForm.matterId} onChange={e=>setRForm(f=>({...f,matterId:e.target.value}))}>
          <option value="">Select matter...</option>
          {matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}
        </select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div>
          <label style={C.lbl}>Trust bank account</label>
          <select style={C.tinp} value={rForm.accountId} onChange={e=>setRForm(f=>({...f,accountId:e.target.value}))}>
            {trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label style={C.lbl}>Branch</label>
          <div style={{...C.tinp,color:'#4A90D9',display:'flex',alignItems:'center'}}>
            {branches.find(b=>b.id===profile?.branch_id)?.name||'Not assigned'}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div>
          <label style={C.lbl}>Reference</label>
          <input style={C.tinp} placeholder="EFT ref, cheque no." defaultValue={rForm.reference} onBlur={e=>setRForm(f=>({...f,reference:e.target.value}))}/>
        </div>
        <div>
          <label style={C.lbl}>Received from</label>
          <input style={C.tinp} placeholder="Payer name" defaultValue={rForm.receivedFrom} onBlur={e=>setRForm(f=>({...f,receivedFrom:e.target.value}))}/>
        </div>
      </div>
      <div>
        <label style={C.lbl}>Narration *</label>
        <input style={C.tinp} placeholder="Description of receipt" defaultValue={rForm.narration} onBlur={e=>setRForm(f=>({...f,narration:e.target.value}))}/>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
        <button style={C.btn()} onClick={()=>setRForm(f=>({...f,amount:'',matterId:'',reference:'',receivedFrom:'',narration:''}))}>Clear</button>
        <button style={C.btn('p')} onClick={()=>{ setRForm(f=>({...f,branchId:profile?.branch_id||''})); postReceipt(); }} disabled={trustSaving||isLocked(rForm.date)}>{trustSaving?'Posting...':'Post receipt'}</button>
      </div>
    </div>
  </div>
  <div style={C.card}>
    <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent receipts</div>
    <div style={{overflowY:'auto',maxHeight:420}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr>{['Receipt','Date','Matter','Client','Amount','Branch'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>
          {!trustTransactions.filter(t=>t.type==='receipt').length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No receipts yet</td></tr>}
          {trustTransactions.filter(t=>t.type==='receipt').map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id),br=branches.find(b=>b.id===t.branch_id); return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{fmtR(t.amount)}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td></tr>); })}
        </tbody>
      </table>
    </div>
  </div>
</div>)}
      {trustTab==='payment'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust payment</div><span style={{fontSize:10,color:'#EAB308',border:'1px solid rgba(234,179,8,0.3)',padding:'2px 10px',borderRadius:20}}>≥ {fmtR(APPROVAL_THRESHOLD)} needs approval</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={pForm.date} onChange={e=>setPForm(f=>({...f,date:e.target.value}))}/>{isLocked(pForm.date)&&<div style={{fontSize:10,color:'#E05252',marginTop:4}}>⚠ Period locked</div>}</div><div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={pForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setPForm(f=>({...f,amount:v})); checkPaymentBalance(pForm.matterId,v); }}/></div></div>
            <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={pForm.matterId} onChange={e=>{ setPForm(f=>({...f,matterId:e.target.value})); checkPaymentBalance(e.target.value,pForm.amount); }}><option value="">Select matter...</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
            {pBalanceCheck&&(<div style={{background:pBalanceCheck.ok?'rgba(108,192,74,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${pBalanceCheck.ok?'rgba(108,192,74,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:pBalanceCheck.ok?'#6CC04A':'#E05252'}}>{pBalanceCheck.ok?`✓ Available: ${fmtR(pBalanceCheck.bal)} · After: ${fmtR(pBalanceCheck.bal-pBalanceCheck.amt)}${pBalanceCheck.needsApproval?' · ⏳ Needs partner approval':''}`:`✗ Insufficient — available: ${fmtR(pBalanceCheck.bal)}, shortfall: ${fmtR(pBalanceCheck.amt-pBalanceCheck.bal)}`}</div>)}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Trust bank account</label><select style={C.tinp} value={pForm.accountId} onChange={e=>setPForm(f=>({...f,accountId:e.target.value}))}>{trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div><label style={C.lbl}>Branch</label><div style={{...C.tinp,color:'#4A90D9',display:'flex',alignItems:'center'}}>{branches.find(b=>b.id===profile?.branch_id)?.name||'Not assigned'}</div></div></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Payee *</label><input style={C.tinp} placeholder="Sheriff, advocate, municipality..." defaultValue={pForm.payee} onBlur={e=>setPForm(f=>({...f,payee:e.target.value}))}/></div><div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="Cheque or EFT ref" defaultValue={pForm.reference} onBlur={e=>setPForm(f=>({...f,reference:e.target.value}))}/></div></div>
            <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Payment description" defaultValue={pForm.narration} onBlur={e=>setPForm(f=>({...f,narration:e.target.value}))}/></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}><button style={C.btn()} onClick={()=>{ setPForm(f=>({...f,amount:'',matterId:'',payee:'',reference:'',narration:''})); setPBalanceCheck(null); }}>Clear</button><button style={C.btn('p')} onClick={postPayment} disabled={trustSaving||isLocked(pForm.date)}>{trustSaving?'Posting...':pBalanceCheck?.needsApproval?'Submit for approval':'Post payment'}</button></div>
          </div>
        </div>
        <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent payments</div><div style={{overflowY:'auto',maxHeight:420}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Payee','Amount','Status','Branch'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!trustTransactions.filter(t=>t.type==='payment').length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No payments yet</td></tr>}{trustTransactions.filter(t=>t.type==='payment').map((t,i)=>{ const br=branches.find(b=>b.id===t.branch_id); return(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{t.payee}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:t.status==='posted'?'rgba(108,192,74,0.1)':t.status==='pending'?'rgba(234,179,8,0.1)':'rgba(220,80,80,0.1)',color:t.status==='posted'?'#6CC04A':t.status==='pending'?'#EAB308':'#E05252'}}>{t.status}</span></td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td></tr>); })}</tbody></table></div></div>
      </div>)}

      {trustTab==='transfer'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>Trust to business transfer</div><span style={{fontSize:10,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'2px 10px',borderRadius:20}}>Both legs auto-posted</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={tForm.date} onChange={e=>setTForm(f=>({...f,date:e.target.value}))}/>{isLocked(tForm.date)&&<div style={{fontSize:10,color:'#E05252',marginTop:4}}>⚠ Period locked</div>}</div><div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={tForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setTForm(f=>({...f,amount:v})); checkTransferBalance(tForm.matterId,v); }}/></div></div>
            <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={tForm.matterId} onChange={e=>{ setTForm(f=>({...f,matterId:e.target.value,invoiceId:'',amount:''})); checkTransferBalance(e.target.value,tForm.amount); }}><option value="">Select matter...</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
            {tBalanceCheck&&(<div style={{background:tBalanceCheck.ok?'rgba(108,192,74,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${tBalanceCheck.ok?'rgba(108,192,74,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:tBalanceCheck.ok?'#6CC04A':'#E05252'}}>{tBalanceCheck.ok?`✓ After transfer: ${fmtR(tBalanceCheck.bal-tBalanceCheck.amt)}`:`✗ Insufficient — available: ${fmtR(tBalanceCheck.bal)}`}</div>)}
            {tForm.matterId&&getMatterInvoices(tForm.matterId).length>0&&(<div><label style={C.lbl}>Link to invoice (auto-fills amount)</label><select style={C.tinp} value={tForm.invoiceId} onChange={e=>{ const inv=invoices.find(i=>i.id===e.target.value); const amt=inv?String(((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)):''; setTForm(f=>({...f,invoiceId:e.target.value,amount:amt,narration:inv?`Transfer of fees — ${inv.matter_name} — ${inv.id}`:''})); if(inv) checkTransferBalance(tForm.matterId,amt); }}><option value="">Select invoice (optional)...</option>{getMatterInvoices(tForm.matterId).map(i=><option key={i.id} value={i.id}>{i.id} — R{((i.total_units||0)*(i.rate||150)*1.15).toFixed(2)} incl. VAT</option>)}</select><div style={{fontSize:10,color:'#555',marginTop:4}}>Selecting an invoice auto-fills the amount</div></div>)}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>From trust account</label><select style={C.tinp} value={tForm.fromAccountId} onChange={e=>setTForm(f=>({...f,fromAccountId:e.target.value}))}>{trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div><label style={C.lbl}>To business account</label><select style={C.tinp} value={tForm.toAccount} onChange={e=>setTForm(f=>({...f,toAccount:e.target.value}))}><option value="FNB Business">FNB Business Account</option><option value="ABSA Business">ABSA Business Account</option></select></div></div>
            <div><label style={C.lbl}>Narration</label><input style={C.tinp} placeholder="e.g. Transfer of professional fees" defaultValue={tForm.narration} onBlur={e=>setTForm(f=>({...f,narration:e.target.value}))}/></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}><button style={C.btn()} onClick={()=>{ setTForm(f=>({...f,amount:'',matterId:'',invoiceId:'',narration:''})); setTBalanceCheck(null); }}>Clear</button><button style={C.btn('p')} onClick={postTransfer} disabled={trustSaving||isLocked(tForm.date)}>{trustSaving?'Posting...':'Post transfer'}</button></div>
          </div>
        </div>
        <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Transfer history</div><div style={{overflowY:'auto',maxHeight:420}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','From','To','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!trustTransactions.filter(t=>t.type==='transfer').length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:20}}>No transfers yet</td></tr>}{trustTransactions.filter(t=>t.type==='transfer').map((t,i)=>(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{trustAccounts.find(a=>a.id===t.trust_account_id)?.name||'Trust'}</td><td style={{...C.td,fontSize:10,color:'#6CC04A'}}>{t.to_account}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>))}</tbody></table></div></div>
      </div>)}

      {trustTab==='recon'&&(<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>{[{l:'System trust balance',v:fmtR(systemTotal),c:'#4A90D9'},{l:'Bank statement total',v:fmtR(bankTotal),c:'#F0F0F0'},{l:'Difference',v:fmtR(diff),c:diff<0.01?'#6CC04A':'#E05252',sub:diff<0.01?'✓ Reconciled':'Unreconciled'}].map(({l,v,c,sub})=>(<div key={l} style={C.stat(diff<0.01&&l==='Difference')}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>{sub&&<div style={{fontSize:10,color:c,marginTop:4}}>{sub}</div>}</div>))}</div>
        <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Period management — month-end lock</div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><input type="month" style={{...C.sel,width:150}} value={reconPeriod} onChange={e=>setReconPeriod(e.target.value)}/>{isPeriodLocked(reconPeriod)?(<><span style={{fontSize:11,color:'#E05252',border:'1px solid rgba(220,80,80,0.3)',padding:'4px 12px',borderRadius:6}}>🔒 Period {reconPeriod} is LOCKED</span><button style={C.btn('r')} onClick={()=>unlockPeriod(reconPeriod)}>Unlock</button></>):(<><span style={{fontSize:11,color:'#555'}}>Period {reconPeriod} is open</span><button style={C.btn('warn')} onClick={()=>lockPeriod(reconPeriod)}>🔒 Lock period</button></>)}{lockedPeriods.length>0&&<div style={{marginLeft:'auto',fontSize:11,color:'#555'}}>Locked: {lockedPeriods.join(', ')}</div>}</div></div>
        <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Import bank statement — CSV</div><div style={{fontSize:11,color:'#555',marginBottom:10}}>Import directly from FNB, ABSA, Standard Bank, Nedbank — or add lines manually.</div><div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}><label style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(74,144,217,0.1)',border:'1px solid rgba(74,144,217,0.3)',color:'#4A90D9',padding:'7px 16px',borderRadius:6,cursor:'pointer',fontSize:12}}>📂 Import CSV<input type="file" accept=".csv,.txt" style={{display:'none'}} onChange={handleCSVImport}/></label>{bankLines.length>0&&<span style={{fontSize:11,color:'#555'}}>{bankLines.length} lines · <button style={{background:'none',border:'none',color:'#E05252',cursor:'pointer',fontSize:11}} onClick={()=>{ if(confirm('Clear all bank lines?')){setBankLines([]);setMatched({});} }}>Clear all</button></span>}{csvError&&<span style={{fontSize:11,color:'#E05252'}}>{csvError}</span>}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 90px 80px',gap:8,alignItems:'flex-end'}}><div><label style={C.lbl}>Date</label><input type="date" style={C.tinp} value={newBankLine.date} onChange={e=>setNewBankLine(f=>({...f,date:e.target.value}))}/></div><div><label style={C.lbl}>Description</label><input style={C.tinp} placeholder="Bank line description" defaultValue={newBankLine.description} onBlur={e=>setNewBankLine(f=>({...f,description:e.target.value}))}/></div><div><label style={C.lbl}>Amount</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={newBankLine.amount} onBlur={e=>setNewBankLine(f=>({...f,amount:e.target.value}))}/></div><div><label style={C.lbl}>Type</label><select style={C.tinp} value={newBankLine.isCredit?'credit':'debit'} onChange={e=>setNewBankLine(f=>({...f,isCredit:e.target.value==='credit'}))}><option value="credit">Credit</option><option value="debit">Debit</option></select></div><button style={{...C.btn('p'),marginTop:16}} onClick={()=>{ if(!newBankLine.description||!newBankLine.amount) return; setBankLines(l=>[...l,{...newBankLine,id:Date.now()}]); setNewBankLine({date:today,description:'',amount:'',isCredit:true}); }}>Add</button></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Bank statement ({bankLines.length} lines)</div>{!bankLines.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>Import CSV or add lines above</div>:bankLines.map((l,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid #252525',borderRadius:6,marginBottom:6,opacity:matched['b'+l.id]?0.4:1,textDecoration:matched['b'+l.id]?'line-through':'none'}}><input type="checkbox" checked={!!matched['b'+l.id]} onChange={e=>setMatched(m=>({...m,['b'+l.id]:e.target.checked}))} style={{accentColor:'#6CC04A'}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{l.description}</div><div style={{fontSize:10,color:'#555'}}>{fmtDate(l.date)}</div></div><div style={{fontFamily:'monospace',fontSize:12,color:l.isCredit?'#6CC04A':'#E05252'}}>{l.isCredit?'+':'-'}{fmtR(Math.abs(l.amount))}</div><button style={{...C.btn('r'),padding:'2px 8px',fontSize:10}} onClick={()=>setBankLines(ls=>ls.filter((_,j)=>j!==i))}>✕</button></div>))}</div><div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>System transactions</div>{!trustTransactions.filter(t=>t.status==='posted').length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>No transactions yet</div>:trustTransactions.filter(t=>t.status==='posted'&&t.type!=='transfer').map((t,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid #252525',borderRadius:6,marginBottom:6,opacity:matched['s'+i]?0.4:1,textDecoration:matched['s'+i]?'line-through':'none'}}><input type="checkbox" checked={!!matched['s'+i]} onChange={e=>setMatched(m=>({...m,['s'+i]:e.target.checked}))} style={{accentColor:'#6CC04A'}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{t.narration}</div><div style={{fontSize:10,color:'#555'}}>{fmtDate(t.date)} · {t.matter_id}</div></div><div style={{fontFamily:'monospace',fontSize:12,color:t.type==='receipt'?'#6CC04A':'#E05252'}}>{t.type==='receipt'?'+':'-'}{fmtR(t.amount)}</div></div>))}</div></div>
        <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>Reconciliation certificate — {reconPeriod}</div><button style={C.btn('g')} onClick={()=>{ const mc=Object.values(matched).filter(Boolean).length; const w=window.open('','_blank','width=700,height:600'); w.document.write(`<!DOCTYPE html><html><head><title>Trust Reconciliation Certificate</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #eee;font-size:12px}.sig{margin-top:40px;display:flex;justify-content:space-between}.sig-line{width:200px;border-top:1px solid #111;padding-top:6px;font-size:11px;color:#888}</style></head><body><h2 style="color:#6CC04A">Motsoeneng Bill Attorneys</h2><h3>Trust Account Reconciliation Certificate</h3><p style="color:#888;font-size:12px">Period: ${reconPeriod} · Generated: ${new Date().toLocaleDateString('en-ZA')}</p><table><tr><td>Trust bank balance per bank statement</td><td style="text-align:right;font-weight:700">${fmtR(bankTotal)}</td></tr><tr><td>Trust balance per system</td><td style="text-align:right;font-weight:700">${fmtR(systemTotal)}</td></tr><tr style="font-weight:700;color:${diff<0.01?'green':'red'}"><td>Difference</td><td style="text-align:right">${fmtR(diff)}</td></tr><tr><td>Items matched</td><td style="text-align:right">${mc}</td></tr><tr><td>Period status</td><td style="text-align:right">${isPeriodLocked(reconPeriod)?'LOCKED':'Open'}</td></tr></table><p style="color:${diff<0.01?'green':'red'};font-weight:700">${diff<0.01?'✓ Accounts reconcile':'✗ Investigate outstanding items'}</p><div class="sig"><div class="sig-line">Bookkeeper signature</div><div class="sig-line">Partner / Director signature</div></div></body></html>`); w.document.close(); }}>Print certificate</button></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12}}><div>{[['Bank statement balance',fmtR(bankTotal)],['System trust balance',fmtR(systemTotal)],['Difference',fmtR(diff)]].map(([l,v],i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1A1A1A'}}><span style={{color:'#888'}}>{l}</span><span style={{fontFamily:'monospace',fontWeight:i===2?700:400,color:i===2?(diff<0.01?'#6CC04A':'#E05252'):'#F0F0F0'}}>{v}</span></div>))}</div><div>{[['Items matched',Object.values(matched).filter(Boolean).length],['Bank lines',bankLines.length],['System transactions',trustTransactions.filter(t=>t.status==='posted'&&t.type!=='transfer').length],['Period status',isPeriodLocked(reconPeriod)?'🔒 Locked':'Open']].map(([l,v],i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1A1A1A'}}><span style={{color:'#888'}}>{l}</span><span style={{fontFamily:'monospace'}}>{v}</span></div>))}</div></div>
        </div>
      </div>)}

      {trustTab==='approvals'&&(<div>
        <div style={{fontSize:14,fontWeight:600,color:'#D0D0D0',marginBottom:16}}>Payment approvals — partner review</div>
        {!pendingPayments.length?(<div style={{...C.card,textAlign:'center',padding:'40px',color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>✅</div><div>No payments pending approval</div></div>):pendingPayments.map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id),br=branches.find(b=>b.id===t.branch_id); return(<div key={i} style={{...C.card,border:'1px solid rgba(234,179,8,0.3)'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{fontSize:9,background:'rgba(234,179,8,0.1)',color:'#EAB308',border:'1px solid rgba(234,179,8,0.3)',padding:'2px 10px',borderRadius:20,fontWeight:600}}>PENDING APPROVAL</span><span style={{fontSize:10,color:'#555'}}>{fmtDate(t.date)}</span>{br&&<span style={{fontSize:10,color:'#555',border:'1px solid #252525',padding:'1px 8px',borderRadius:20}}>{br.name}</span>}</div><div style={{fontSize:18,fontWeight:700,color:'#EAB308',marginBottom:6}}>{fmtR(t.amount)}</div><div style={{fontSize:12,color:'#D0D0D0',marginBottom:2}}>Payee: <strong>{t.payee}</strong></div><div style={{fontSize:12,color:'#D0D0D0',marginBottom:2}}>Matter: <span style={{color:'#A78BFA'}}>{t.matter_id}</span> — {m?.client||'—'}</div><div style={{fontSize:11,color:'#555',marginBottom:6}}>{t.narration}</div><div style={{padding:'8px 12px',background:'rgba(234,179,8,0.05)',borderRadius:6,fontSize:11,color:'#888'}}>Balance available: <strong style={{color:'#6CC04A'}}>{fmtR(getMatterBalance(t.matter_id))}</strong> · After approval: <strong style={{color:getMatterBalance(t.matter_id)-Number(t.amount)>=0?'#6CC04A':'#E05252'}}>{fmtR(getMatterBalance(t.matter_id)-Number(t.amount))}</strong></div></div><div style={{display:'flex',flexDirection:'column',gap:8,minWidth:150}}><button style={C.btn('p')} onClick={()=>{ if(confirm(`Approve payment of ${fmtR(t.amount)} to ${t.payee}?`)) approvePayment(t.id); }}>✓ Approve</button><button style={C.btn('r')} onClick={()=>{ const r=prompt('Reason for rejection:'); if(r!==null) rejectPayment(t.id,r); }}>✗ Reject</button></div></div></div>); })}
      </div>)}

      {trustTab==='reports'&&(<div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>{[['trial','Trial Balance'],['receipts','Receipts Journal'],['payments','Payments Journal'],['transfers','Transfers Journal']].map(([v,l])=>(<button key={v} style={{...C.btn(reportType===v?'trust':'s'),fontSize:11}} onClick={()=>setReportType(v)}>{l}</button>))}<div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><select style={{...C.sel,width:130}} value={reportBranch} onChange={e=>setReportBranch(e.target.value)}><option value="">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><input type="date" style={{...C.sel,width:130}} value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/><span style={{fontSize:11,color:'#555'}}>to</span><input type="date" style={{...C.sel,width:130}} value={reportTo} onChange={e=>setReportTo(e.target.value)}/></div></div>
        {reportType==='trial'&&(<div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>Trust trial balance{reportBranch?' — '+branches.find(b=>b.id===reportBranch)?.name:' — all branches'}</div><span style={{fontSize:10,color:'#555'}}>Grand total must equal trust bank balance</span></div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Description','Branch','Trust Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{matters.map(m=>{ const bal=getMatterBalance(m.id),br=branches.find(b=>b.id===m.branch_id); return(<tr key={m.id} style={{opacity:bal===0?0.4:1}}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td><td style={{...C.td,fontWeight:500}}>{m.client}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{m.name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,textAlign:'right',color:bal>0?'#6CC04A':bal<0?'#E05252':'#555'}}>{fmtR(bal)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={4} style={{...C.th,paddingTop:12}}>Grand total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(totalTrustHeld())}</td></tr></tbody></table></div>)}
        {reportType==='receipts'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Receipts journal — {reportFrom} to {reportTo}</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Receipt No','Date','Matter','Client','Received From','Branch','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='receipt').map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id),br=branches.find(b=>b.id===t.branch_id); return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.received_from||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#6CC04A',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={7} style={{...C.th,paddingTop:12}}>Total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#6CC04A',textAlign:'right',paddingTop:12}}>{fmtR(getReportTxns().filter(t=>t.type==='receipt').reduce((s,t)=>s+Number(t.amount),0))}</td></tr></tbody></table></div>)}
        {reportType==='payments'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Payments journal — {reportFrom} to {reportTo}</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Client','Payee','Branch','Status','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='payment').map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id),br=branches.find(b=>b.id===t.branch_id); return(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={C.td}>{t.payee}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:t.status==='posted'?'rgba(108,192,74,0.1)':'rgba(234,179,8,0.1)',color:t.status==='posted'?'#6CC04A':'#EAB308'}}>{t.status}</span></td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={7} style={{...C.th,paddingTop:12}}>Total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#E05252',textAlign:'right',paddingTop:12}}>{fmtR(getReportTxns().filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0))}</td></tr></tbody></table></div>)}
        {reportType==='transfers'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Transfers journal — {reportFrom} to {reportTo}</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Client','From','To Business','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='transfer').map((t,i)=>{ const m=matters.find(x=>x.id===t.matter_id); return(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{trustAccounts.find(a=>a.id===t.trust_account_id)?.name||'Trust'}</td><td style={{...C.td,fontSize:10,color:'#6CC04A'}}>{t.to_account}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={6} style={{...C.th,paddingTop:12}}>Total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#4A90D9',textAlign:'right',paddingTop:12}}>{fmtR(getReportTxns().filter(t=>t.type==='transfer').reduce((s,t)=>s+Number(t.amount),0))}</td></tr></tbody></table></div>)}
      </div>)}

      {trustTab==='settings'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:16}}>Low balance alerts</div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
            <div><label style={C.lbl}>Matter</label><select style={C.tinp} value={alertMatterId} onChange={e=>setAlertMatterId(e.target.value)}><option value="">Select matter...</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}</select></div>
            <div><label style={C.lbl}>Minimum balance threshold (ZAR)</label><input type="number" style={C.tinp} value={alertMinBal} onChange={e=>setAlertMinBal(parseFloat(e.target.value)||5000)}/><div style={{fontSize:10,color:'#555',marginTop:4}}>Alert shows when balance drops below this</div></div>
            <button style={C.btn('p')} onClick={saveBalanceAlert}>Save alert</button>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:8}}>Active alerts</div>
          {!balanceAlerts.length?<div style={{fontSize:11,color:'#333'}}>No alerts configured</div>:balanceAlerts.map((a,i)=>{ const m=matters.find(x=>x.id===a.matter_id),bal=getMatterBalance(a.matter_id); return(<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#0D0D0D',borderRadius:6,marginBottom:6}}><div><div style={{fontSize:12,fontWeight:500,color:bal<Number(a.minimum_balance)?'#E05252':'#D0D0D0'}}>{m?.client||a.matter_id}</div><div style={{fontSize:10,color:'#555'}}>Min: {fmtR(a.minimum_balance)} · Now: <span style={{color:bal<Number(a.minimum_balance)?'#E05252':'#6CC04A'}}>{fmtR(bal)}</span></div></div><button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{ await supabase.from('trust_balance_alerts').delete().eq('id',a.id); loadTrust(); }}>Remove</button></div>); })}
        </div>
        <div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:16}}>Branch trust overview — {branches.length} branches</div>
          {branches.map(b=>{ const bT=trustTransactions.filter(t=>t.branch_id===b.id&&t.status==='posted'),bBal=bT.reduce((s,t)=>t.type==='receipt'?s+Number(t.amount):s-Number(t.amount),0),bR=bT.filter(t=>t.type==='receipt').reduce((s,t)=>s+Number(t.amount),0),bP=bT.filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0); return(<div key={b.id} style={{padding:'12px 14px',background:'#0D0D0D',borderRadius:8,marginBottom:10,border:'1px solid #1A1A1A'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{b.name}</div><div style={{fontSize:16,fontWeight:700,color:'#4A90D9'}}>{fmtR(bBal)}</div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11}}>{[['Receipts',fmtR(bR),'#6CC04A'],['Payments',fmtR(bP),'#E05252'],['Transactions',bT.length,'#888']].map(([l,v,c])=>(<div key={l}><div style={{color:'#555',fontSize:9,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>{l}</div><div style={{color:c,fontWeight:600}}>{v}</div></div>))}</div></div>); })}
        </div>
      </div>)}
    </div>);
  },[trustTab,trustTransactions,trustAccounts,branches,matters,rForm,pForm,tForm,trustAlert,pendingPayments,balanceAlerts,trustBalances,trustSaving,trustLoading,bankLines,matched,reconPeriod,reportType,reportFrom,reportTo,reportBranch,alertMatterId,alertMinBal,selectedTrustMatter,lockedPeriods,invoices]);

  if(authLoading) return <div style={{background:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',color:'#444',fontSize:13}}>Loading...</div>;

  return(<>
    <Head><title>MB SmartTrack</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(108,192,74,0.025)}button:hover{opacity:.85}select option{background:#1A1A1A;color:#F0F0F0}input[type=date],input[type=month]{color-scheme:dark}input:focus,select:focus{outline:1px solid rgba(108,192,74,0.4);outline-offset:1px}`}</style>
    <div style={C.page}>
      <div style={C.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {profile?.role==='manager'&&<button style={{background:'transparent',border:'1px solid rgba(108,192,74,0.3)',color:'#6CC04A',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={()=>router.push('/manager')}>Manager View</button>}
          <button style={{background:'transparent',border:'1px solid #252525',color:'#555',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={()=>setShowPwdForm(true)}>🔒 Password</button>
<button style={{background:'transparent',border:'1px solid #252525',color:'#555',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
          <div style={C.mark}>M<span style={{color:'#6CC04A'}}>B</span></div>
          <div><div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack</div><div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill</div></div>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {[['today','Today'],['history','History'],['matters','Matters'],['analytics','Analytics'],['activities','All Activities'],['invoices','Invoice'],['archive','Archive'],['trust','🏦 Trust']].map(([v,l])=>(
            <button key={v} style={{...C.ntab(tab===v),color:v==='trust'?'#4A90D9':tab===v?'#F0F0F0':'#555',border:v==='trust'?`1px solid ${tab===v?'rgba(74,144,217,0.5)':'rgba(74,144,217,0.2)'}`:tab===v?'1px solid #2A2A2A':'1px solid transparent',position:'relative'}} onClick={()=>setTab(v)}>
              {l}{v==='trust'&&pendingPayments.length>0&&<span style={{position:'absolute',top:-4,right:-4,background:'#EAB308',color:'#000',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingPayments.length}</span>}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{position:'relative'}}><input ref={searchRef} style={{background:'#1A1A1A',border:`1px solid ${searchQuery?'rgba(108,192,74,0.4)':'#252525'}`,color:'#F0F0F0',padding:'5px 12px 5px 32px',borderRadius:20,fontSize:12,fontFamily:'inherit',width:200,outline:'none'}} placeholder="Search everything..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/><span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,pointerEvents:'none'}}>{searching?'⌛':'🔍'}</span>{searchQuery&&<button style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:12,padding:0}} onClick={()=>setSearchQuery('')}>✕</button>}</div>
          {online?<div style={C.pill}><div style={C.dot}/>{clock}</div>:<span style={{fontSize:11,color:'#3A3A3A'}}>Backend offline</span>}
        </div>
      </div>

      {tab==='today'&&(<div style={C.main}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>{fdate(selDate)}</div><div style={{fontSize:11,color:'#444'}}>{dayActs.length} sessions · {toHm(daySec)} total</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><select style={C.sel} value={selDate} onChange={e=>setSelDate(e.target.value)}><option value={today}>Today</option>{dates.filter(d=>d.date!==today).map(d=><option key={d.date} value={d.date}>{fdate(d.date)} ({d.sessions})</option>)}</select><button style={C.btn()} onClick={seedDemo} disabled={seeding}>{seeding?'Seeding...':'⚡ Load Demo'}</button><button style={C.btn('pur')} onClick={()=>setShowCall(true)}>📞 Log a Call</button><button style={C.btn('p')} onClick={()=>setTab('invoices')}>Generate Invoice</button></div></div>
        {!liveActs.length&&<div style={{background:'rgba(74,144,217,0.05)',border:'1px solid rgba(74,144,217,0.15)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:11,color:'#666'}}><strong style={{color:'#4A90D9'}}>No live data yet</strong> — Electron agent must be running.</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>{[{l:'Total Time',v:toHm(daySec),s:`${dayActs.length} sessions`,a:false},{l:'Billable Time',v:toHm(dayBillSec),s:`${pct(dayBillSec,daySec)}% utilisation`,a:true},{l:'Billing Units',v:dayBillU,s:'6-min units',a:false},{l:'Est. Value',v:`R${(dayBillU*invRate).toLocaleString()}`,s:`@ R${invRate}/unit`,a:false}].map(({l,v,s,a})=>(<div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:24,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}</div>
        <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><span style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>Activity Log — {fdate(selDate)}</span><span style={{fontSize:10,color:'#444'}}>{dayActs.length} sessions</span></div>{!dayActs.length?(<div style={{textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:32,marginBottom:12}}>🖥️</div><div style={{fontSize:14,color:'#444',marginBottom:6}}>No sessions yet</div><div style={{fontSize:11,color:'#2A2A2A'}}>Start the Electron agent or click ⚡ Load Demo</div></div>):(<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Time','Application','Window Title','Matter','Duration','Units','Status','Override'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{dayActs.map(a=>{ const am=matters.find(m=>m.id===a.matter); return(<tr key={a.id}><td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td><td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8',fontSize:11}}>{a.app_display_name}</span></td><td style={{...C.td,color:'#666',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td><td style={{...C.td,minWidth:170}}><select style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}} value={a.matter||''} onChange={e=>assignMatter(a.id,e.target.value)}><option value="">— assign matter —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select>{am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}</td><td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{toHm(a.duration_seconds)}</td><td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td><td style={C.td}><Badge c={a.classification}/></td><td style={C.td}><select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select></td></tr>); })}</tbody></table></div>)}</div>
      </div>)}

      {searchQuery&&searchResults&&(<div style={{position:'fixed',top:56,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:90,overflowY:'auto'}} onClick={()=>setSearchQuery('')}><div style={{maxWidth:800,margin:'20px auto',background:'#111',border:'1px solid #2A2A2A',borderRadius:10,padding:20}} onClick={e=>e.stopPropagation()}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><span style={{fontSize:14,fontWeight:600}}>Results for <span style={{color:'#6CC04A'}}>"{searchResults.query}"</span></span><span style={{fontSize:11,color:'#555'}}>{searchResults.activities.length} activities · {searchResults.matters.length} matters · {searchResults.invoices.length} invoices</span></div>{searchResults.matters.length>0&&(<div style={{marginBottom:16}}><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Matters</div>{searchResults.matters.map(m=>{ const mU=allActs.filter(a=>a.matter===m.id&&a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0); return(<div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:6,cursor:'pointer'}} onClick={()=>{setSearchQuery('');setTab('matters');}}><div><div style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',marginBottom:2}}>{m.id}</div><div style={{fontSize:13,fontWeight:600,color:'#E0E0E0'}}>{m.name}</div><div style={{fontSize:11,color:'#666'}}>{m.client}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:700,color:'#6CC04A'}}>R{(mU*invRate).toLocaleString()}</div><div style={{fontSize:10,color:'#444'}}>{mU} units</div></div></div>); })}</div>)}{searchResults.activities.length>0&&(<div style={{marginBottom:16}}><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Activities</div><div style={{maxHeight:300,overflowY:'auto'}}>{searchResults.activities.map(a=>{ const m=matters.find(x=>x.id===a.matter); return(<div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4}}><div style={{fontSize:16,flexShrink:0}}>{appIcon(a.app_display_name)}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:'#D0D0D0'}}>{a.app_display_name} <Badge c={a.classification}/></div><div style={{fontSize:11,color:'#555',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.window_title}</div>{m&&<div style={{fontSize:10,color:'#A78BFA',marginTop:1}}>{m.id} · {m.client}</div>}</div><div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:11,color:'#888',fontFamily:'monospace'}}>{toHm(a.duration_seconds)}</div><div style={{fontSize:10,color:'#444'}}>{fdate(a.date)}</div></div></div>); })}</div></div>)}{searchResults.invoices.length>0&&(<div><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Invoices</div>{searchResults.invoices.map(inv=>(<div key={inv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4,cursor:'pointer'}} onClick={()=>{setSearchQuery('');setViewInv(inv);}}><div><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>{inv.id}</div><div style={{fontSize:11,color:'#666'}}>{inv.client} · {inv.matter_name}</div></div><div style={{fontSize:14,fontWeight:700,color:'#6CC04A'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</div></div>))}</div>)}{!searchResults.activities.length&&!searchResults.matters.length&&!searchResults.invoices.length&&(<div style={{textAlign:'center',padding:'40px',color:'#444'}}><div style={{fontSize:28,marginBottom:10}}>🔍</div><div style={{fontSize:14,color:'#555'}}>No results for "{searchResults.query}"</div></div>)}</div></div>)}

      {tab==='history'&&(<div style={C.main}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Work History</div><div style={{fontSize:11,color:'#444'}}>Full record of all tracked time</div></div><select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);setMonthData(null);}}>{histYears.length?histYears.map(y=><option key={y} value={y}>{y}</option>):<option value={histYear}>{histYear}</option>}</select></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>{Array.from({length:12},(_,i)=>{ const monthStr=`${histYear}-${String(i+1).padStart(2,'0')}`,monthName=new Date(histYear,i,1).toLocaleString('en-ZA',{month:'long'}),data=histMonths.find(m=>m.month===monthStr),isSelected=selMonth===monthStr,hasFuture=new Date(histYear,i,1)>new Date(); return(<div key={monthStr} style={{background:isSelected?'rgba(108,192,74,0.08)':data?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(108,192,74,0.4)':data?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:data?'pointer':'default',opacity:hasFuture?0.4:1}} onClick={()=>data&&loadMonth(monthStr)}><div style={{fontSize:12,fontWeight:600,color:data?'#D0D0D0':'#333',marginBottom:6}}>{monthName}</div>{data?(<><div style={{fontSize:18,fontWeight:800,color:isSelected?'#6CC04A':'#888',marginBottom:2}}>{toHm(data.total_seconds)}</div><div style={{fontSize:10,color:'#555'}}>{data.sessions} sessions</div><div style={{fontSize:11,color:'#6CC04A',marginTop:4,fontWeight:600}}>R{((data.billable_units||0)*invRate).toLocaleString()}</div></>):(<div style={{fontSize:11,color:'#2A2A2A',marginTop:8}}>{hasFuture?'Future':'No data'}</div>)}</div>); })}</div>{selMonth&&monthData&&(<div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}><div><span style={{fontSize:14,fontWeight:700}}>{new Date(selMonth+'-01T12:00:00').toLocaleString('en-ZA',{month:'long',year:'numeric'})}</span><span style={{fontSize:11,color:'#555',marginLeft:12}}>{monthData.totals?.sessions||0} sessions</span></div><div style={{display:'flex',gap:8}}><button style={C.btn()} onClick={()=>{setSelMonth(null);setMonthData(null);}}>✕ Close</button><button style={C.btn('p')} onClick={()=>{setInvMatterId('');setTab('invoices');}}>Invoice for this month</button></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>{[{l:'Total Time',v:toHm(monthData.totals?.total_seconds),s:`${monthData.totals?.sessions||0} sessions`,a:false},{l:'Billable Time',v:toHm(monthData.totals?.billable_seconds),s:`${pct(monthData.totals?.billable_seconds,monthData.totals?.total_seconds)}% util`,a:true},{l:'Billing Units',v:monthData.totals?.billable_units||0,s:'6-min units',a:false},{l:'Est. Value',v:`R${((monthData.totals?.billable_units||0)*invRate).toLocaleString()}`,s:'excl. VAT',a:false}].map(({l,v,s,a})=>(<div key={l} style={C.stat(a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}</div></div>)}</div>)}

      {tab==='matters'&&(<div style={C.main}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Client Matters</div><div style={{fontSize:11,color:'#444'}}>Activities auto-linked by title matching</div></div><button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ New Matter</button></div>{matterMsg&&<div style={{background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.25)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#6CC04A'}}>{matterMsg}</div>}{!matters.length?(<div style={{...C.card,textAlign:'center',padding:'40px'}}><div style={{fontSize:32,marginBottom:12}}>📁</div><div style={{fontSize:14,color:'#444',marginBottom:8}}>No matters yet</div><button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ Create first matter</button></div>):(<div style={{display:'grid',gap:10}}>{matters.map(m=>{ const mActs=allActs.filter(a=>a.matter===m.id),mBill=mActs.filter(a=>a.classification==='billable'),mU=mBill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0),mSec=mActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0),trustBal=getMatterBalance(m.id),alert=balanceAlerts.find(a=>a.matter_id===m.id&&a.is_active),isLow=alert&&trustBal<Number(alert.minimum_balance); return(<div key={m.id} style={{...C.card,border:isLow?'1px solid rgba(220,80,80,0.3)':'1px solid #1A1A1A'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',fontWeight:600}}>{m.id}</span>{isLow&&<span style={{fontSize:9,color:'#E05252',border:'1px solid rgba(220,80,80,0.4)',padding:'1px 8px',borderRadius:20}}>⚠ Low trust balance</span>}</div><div style={{fontSize:14,fontWeight:700,color:'#E0E0E0',marginBottom:2}}>{m.name}</div><div style={{fontSize:12,color:'#888'}}>Client: <strong style={{color:'#C0C0C0'}}>{m.client}</strong></div></div><div style={{display:'flex',gap:16,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>{[['Activities',mActs.length,'#888'],['Time',toHm(mSec),'#888'],['Units',mU,mU>0?'#6CC04A':'#444'],['Value',`R${(mU*invRate).toLocaleString()}`,mU>0?'#6CC04A':'#444'],['Trust',fmtR(trustBal),isLow?'#E05252':trustBal>0?'#4A90D9':'#444']].map(([l,v,c])=>(<div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:2}}>{l}</div><div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div></div>))}<div style={{display:'flex',flexDirection:'column',gap:6}}><button style={{...C.btn('p'),fontSize:11,padding:'5px 12px'}} onClick={()=>{setInvMatterId(m.id);setTab('invoices');}}>Invoice</button><button style={{...C.btn('trust'),fontSize:11,padding:'5px 12px'}} onClick={()=>{setTab('trust');setTrustTab('ledger');}}>Trust</button><button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={()=>handleDeleteMatter(m.id)}>Delete</button></div></div></div></div>); })}</div>)}</div>)}

      {tab==='analytics'&&<div style={C.main}><AnalyticsTab/></div>}

      {tab==='activities'&&(<div style={C.main}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>All Activities</div><div style={{fontSize:11,color:'#444'}}>{filtActs.length} sessions</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><select style={C.sel} value={filterCls} onChange={e=>setFilterCls(e.target.value)}><option value="">All types</option><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select><select style={C.sel} value={filterDate} onChange={e=>setFilterDate(e.target.value)}><option value="">All dates</option>{dates.map(d=><option key={d.date} value={d.date}>{fdate(d.date)}</option>)}</select><select style={C.sel} value={filterApp} onChange={e=>setFilterApp(e.target.value)}><option value="">All apps</option>{allApps.map(n=><option key={n} value={n}>{n}</option>)}</select>{(filterCls||filterDate||filterApp)&&<button style={C.btn()} onClick={()=>{setFilterCls('');setFilterDate('');setFilterApp('');}}>✕ Clear</button>}</div></div><div style={C.card}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Time','App','Description','Matter','Duration','Units','Status','Override'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!filtActs.length&&<tr><td colSpan={9} style={{padding:'40px',textAlign:'center',color:'#333',fontSize:13}}>{!allActs.length?'No tracked activities yet.':'No sessions match your filters.'}</td></tr>}{filtActs.map(a=>{ const am=matters.find(m=>m.id===a.matter); return(<tr key={a.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555',whiteSpace:'nowrap'}}>{fdate(a.date)}</td><td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td><td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8'}}>{a.app_display_name}</span></td><td style={{...C.td,color:'#555',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td><td style={{...C.td,minWidth:160}}><select style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}} value={a.matter||''} onChange={e=>assignMatter(a.id,e.target.value)}><option value="">— none —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select>{am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td><td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td><td style={C.td}><Badge c={a.classification}/></td><td style={C.td}><select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select></td></tr>); })}</tbody></table></div></div></div>)}

      {tab==='invoices'&&(<div style={C.main}><div style={{marginBottom:14}}><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Generate Invoice</div><div style={{fontSize:11,color:'#444'}}>Select a matter — pulls only activities assigned to it</div></div><div style={C.card}><div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 1 — Select Matter</div>{!matters.length?(<div style={{padding:'10px 0',fontSize:12,color:'#555'}}>No matters yet. <button style={{...C.btn('pur'),padding:'4px 12px',fontSize:11,marginLeft:8}} onClick={()=>setTab('matters')}>Go to Matters →</button></div>):(<select style={{...C.inp,maxWidth:500}} value={invMatterId} onChange={e=>{ setInvMatterId(e.target.value); setPreview(null); }}><option value="">— choose a matter —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}</select>)}{invMatter&&(<div style={{marginTop:10,display:'flex',gap:20,fontSize:11,flexWrap:'wrap'}}><div><span style={{color:'#555'}}>Client: </span><strong style={{color:'#C0C0C0'}}>{invMatter.client}</strong></div><div><span style={{color:'#555'}}>Activities: </span><strong style={{color:'#6CC04A'}}>{allActs.filter(a=>a.matter===invMatterId).length}</strong></div><div><span style={{color:'#555'}}>Trust balance: </span><strong style={{color:'#4A90D9'}}>{fmtR(getMatterBalance(invMatterId))}</strong></div></div>)}</div>{invMatterId&&(<div style={C.card}><div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 2 — Configure</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}><div><label style={C.lbl}>Attorney</label><input style={C.inp} value={invAtty} onChange={e=>setInvAtty(e.target.value)}/></div><div><label style={C.lbl}>Rate per unit (R)</label><input style={C.inp} type="number" value={invRate} onChange={e=>setInvRate(parseInt(e.target.value)||150)}/></div><div><label style={C.lbl}>Billing date</label><input style={C.inp} type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}/></div></div><div style={{display:'flex',gap:8,marginBottom:14}}>{[['day','Day'],['week','Week'],['month','Month']].map(([v,l])=>(<button key={v} style={{...C.btn(invPeriod===v?'p':'s'),padding:'5px 18px'}} onClick={()=>setInvPeriod(v)}>{l}</button>))}</div><button style={C.btn('p')} onClick={buildPreview}>Preview Invoice</button></div>)}{preview&&(<div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}><span style={{fontSize:13,fontWeight:600}}>Preview · {preview.bill.length} billable sessions · {preview.tU} units</span><div style={{display:'flex',gap:8}}><button style={C.btn()} onClick={()=>setPreview(null)}>Cancel</button><button style={C.btn('g')} onClick={()=>downloadPDF({...preview,id:'MB-PREVIEW',client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label},preview.filtered)}>⬇ PDF</button><button style={C.btn('p')} onClick={handleSaveInvoice}>Save to Archive</button></div></div><InvoiceDoc inv={{client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label,id:'MB-PREVIEW'}} acts={preview.filtered}/></div>)}</div>)}

      {tab==='archive'&&(<div style={C.main}><div style={{display:'flex',justifyContent:'space-between',marginBottom:14,alignItems:'center',flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Invoice Archive</div><div style={{fontSize:11,color:'#444'}}>{invoices.length} saved invoices</div></div><select style={C.sel} value={archFilter} onChange={e=>setArchFilter(e.target.value)}><option value="">All periods</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></div>{!invoices.filter(i=>!archFilter||i.period===archFilter).length?(<div style={{...C.card,textAlign:'center',padding:'40px',color:'#333'}}><div style={{fontSize:32,marginBottom:12}}>🗃️</div><div style={{fontSize:14,color:'#444'}}>No invoices saved yet</div></div>):invoices.filter(i=>!archFilter||i.period===archFilter).map(inv=>{ const invActs=allActs.filter(a=>(inv.activity_ids||[]).includes(a.id)); return(<div key={inv.id} style={{...C.card,marginBottom:8,cursor:'pointer'}} onClick={()=>setViewInv(inv)}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}><div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:12,fontWeight:700,color:'#D0D0D0'}}>{inv.id}</span><span style={{fontSize:9,color:'#6CC04A',border:'1px solid rgba(108,192,74,0.3)',background:'rgba(108,192,74,0.08)',padding:'1px 8px',borderRadius:20}}>Saved</span></div><div style={{fontSize:11,color:'#555'}}>{inv.client} · <span style={{color:'#A78BFA'}}>{inv.matter_id||inv.matter_name}</span></div><div style={{fontSize:10,color:'#333',marginTop:2}}>{inv.period_label} · {inv.total_units} units</div></div><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:800,color:'#6CC04A'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</div><div style={{fontSize:10,color:'#444',marginTop:2}}>incl. VAT</div></div><button style={{...C.btn('g'),fontSize:11,padding:'5px 12px'}} onClick={e=>{e.stopPropagation();downloadPDF(inv,invActs);}}>⬇ PDF</button><button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={async e=>{e.stopPropagation();if(!confirm(`Delete ${inv.id}?`)) return;await deleteInvoice(inv.id);load();}}>Delete</button></div></div></div>); })}</div>)}

      {tab==='trust'&&(<div style={C.main}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}><div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>🏦 Trust Accounting</div><div style={{fontSize:11,color:'#444'}}>Legal Practice Act compliant · 3 branches · balance never goes negative · payments ≥ {fmtR(APPROVAL_THRESHOLD)} require approval</div></div><button style={C.btn()} onClick={loadTrust}>↻ Refresh</button></div><TrustTab/></div>)}
    </div>

    {showCall&&(<div style={C.modal} onClick={()=>setShowCall(false)}><div style={C.mbox} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📞 Log a Call</div><div style={{fontSize:11,color:'#555',marginBottom:20}}>Record a client call as a billable activity</div><div style={{display:'flex',flexDirection:'column',gap:12}}><div><label style={C.lbl}>Description *</label><input style={C.inp} placeholder="e.g. Smith — settlement discussion" value={callForm.description} onChange={e=>setCallForm(f=>({...f,description:e.target.value}))}/></div><div><label style={C.lbl}>Assign to matter</label><select style={C.inp} value={callForm.matterId} onChange={e=>setCallForm(f=>({...f,matterId:e.target.value}))}><option value="">— optional —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} ({m.client})</option>)}</select></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Duration (minutes)</label><input style={C.inp} type="number" min="1" value={callForm.durationMins} onChange={e=>setCallForm(f=>({...f,durationMins:parseInt(e.target.value)||6}))}/><div style={{fontSize:10,color:'#6CC04A',marginTop:4}}>{calcUnits(callForm.durationMins*60)} unit(s) · R{calcAmt(callForm.durationMins*60,invRate).toLocaleString()}</div></div><div><label style={C.lbl}>Logged at</label><div style={{...C.inp,display:'flex',alignItems:'center',color:'#888',fontSize:11}}>{new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})}</div></div></div></div><div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setShowCall(false)}>Cancel</button><button style={C.btn('pur')} onClick={logCall} disabled={callSaving||!callForm.description}>{callSaving?'Saving...':'Save as Billable'}</button></div></div></div>)}

    {showMatterForm&&(<div style={C.modal} onClick={()=>setShowMatterForm(false)}><div style={C.mbox} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📁 New Client Matter</div><div style={{fontSize:11,color:'#555',marginBottom:20}}>Activities auto-linked by matching window titles.</div><div style={{display:'flex',flexDirection:'column',gap:12}}><div><label style={C.lbl}>Matter ID *</label><input style={C.inp} placeholder="e.g. L2025/042" value={matterForm.id} onChange={e=>setMatterForm(f=>({...f,id:e.target.value.toUpperCase()}))}/></div><div><label style={C.lbl}>Matter name *</label><input style={C.inp} placeholder="e.g. Smith v Jones — Contract Review" value={matterForm.name} onChange={e=>setMatterForm(f=>({...f,name:e.target.value}))}/></div><div><label style={C.lbl}>Client name *</label><input style={C.inp} placeholder="e.g. ABC Corporation" value={matterForm.client} onChange={e=>setMatterForm(f=>({...f,client:e.target.value}))}/></div><div><label style={C.lbl}>Description</label><input style={C.inp} placeholder="Optional" value={matterForm.description} onChange={e=>setMatterForm(f=>({...f,description:e.target.value}))}/></div></div><div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setShowMatterForm(false)}>Cancel</button><button style={C.btn('p')} onClick={handleCreateMatter} disabled={matterSaving||!matterForm.id||!matterForm.name||!matterForm.client}>{matterSaving?'Creating...':'Create Matter'}</button></div></div></div>)}

    {showPwdForm&&(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowPwdForm(false)}>
    <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:32,width:'100%',maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0',marginBottom:4}}>🔒 Change Password</div>
      <div style={{fontSize:11,color:'#555',marginBottom:20}}>Choose a strong password you'll remember</div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div>
          <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'}}>New password *</label>
          <input type="password" style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'10px 14px',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%'}} placeholder="Minimum 6 characters" value={pwdForm.newPwd} onChange={e=>setPwdForm(f=>({...f,newPwd:e.target.value}))}/>
        </div>
        <div>
          <label style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'}}>Confirm new password *</label>
          <input type="password" style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'10px 14px',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%'}} placeholder="Repeat new password" value={pwdForm.confirm} onChange={e=>setPwdForm(f=>({...f,confirm:e.target.value}))}/>
        </div>
        {pwdMsg.msg&&(<div style={{background:pwdMsg.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${pwdMsg.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,borderRadius:6,padding:'10px 12px',fontSize:12,color:pwdMsg.type==='error'?'#E05252':'#8DC63F'}}>{pwdMsg.msg}</div>)}
        <div style={{display:'flex',gap:10,marginTop:8,justifyContent:'flex-end'}}>
          <button style={{background:'transparent',border:'1px solid #252525',color:'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'}} onClick={()=>setShowPwdForm(false)}>Cancel</button>
          <button style={{background:'#8DC63F',border:'none',color:'#0A0A0A',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:700}} disabled={pwdSaving} onClick={handleChangePassword}>{pwdSaving?'Saving...':'Change Password'}</button>
        </div>
      </div>
    </div>
  </div>
)}{viewInv&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 20px'}} onClick={()=>setViewInv(null)}><div style={{background:'#111',border:'1px solid #252525',borderRadius:12,padding:24,maxWidth:780,width:'100%'}} onClick={e=>e.stopPropagation()}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}><div><div style={{fontSize:14,fontWeight:700}}>{viewInv.id}</div><div style={{fontSize:11,color:'#555'}}>{viewInv.client} · <span style={{color:'#A78BFA'}}>{viewInv.matter_id||viewInv.matter_name}</span></div></div><div style={{display:'flex',gap:8}}><button style={C.btn('g')} onClick={()=>downloadPDF(viewInv,allActs.filter(a=>(viewInv.activity_ids||[]).includes(a.id)))}>⬇ PDF</button><button style={C.btn('r')} onClick={async()=>{if(!confirm(`Delete ${viewInv.id}?`)) return;await deleteInvoice(viewInv.id);setViewInv(null);load();}}>Delete</button><button style={C.btn()} onClick={()=>setViewInv(null)}>Close</button></div></div><InvoiceDoc inv={viewInv} acts={allActs.filter(a=>(viewInv.activity_ids||[]).includes(a.id))}/></div></div>)}
  </>);
