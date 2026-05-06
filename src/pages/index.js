import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Fuse from 'fuse.js';
import {
  supabase, signOut, getProfile,
  fetchActivities, fetchAllActivities, patchActivity, patchActivityMatter,
  fetchMatters, createMatter, deleteMatter,
  fetchInvoices, saveInvoice, deleteInvoice,
  fetchHistory, fetchMonthActivities,
  searchAll, upsertActivity
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

function Badge({c}){
  const s=c==='billable'?{color:'#6CC04A',border:'1px solid rgba(108,192,74,0.35)',bg:'rgba(108,192,74,0.1)'}:c==='work'?{color:'#4A90D9',border:'1px solid rgba(74,144,217,0.35)',bg:'rgba(74,144,217,0.1)'}:{color:'#666',border:'1px solid #2A2A2A',bg:'rgba(42,42,42,0.4)'};
  return <span style={{color:s.color,border:s.border,background:s.bg,fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,textTransform:'capitalize',display:'inline-block'}}>{c}</span>;
}

// API calls handled by Supabase client in lib/supabase.js

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
        <tr><td style="padding:4px 8px;font-size:12px;color:#888;border:none;text-align:left">VAT @ 15%</td><td style="padding:4px 8px;font-size:12px;color:#555;border:none;text-align:right;font-family:monospace">R${Math.round(tAmt*0.15).toLocaleString()}</td></tr>
        <tr style="border-top:2px solid #ddd"><td style="padding:6px 8px;font-size:13px;font-weight:700;color:#111;border:none;text-align:left">Total Due (incl. VAT)</td><td style="padding:6px 8px;font-size:22px;font-weight:900;color:#111;border:none;text-align:right">R${Math.round(tAmt*1.15).toLocaleString()}</td></tr>
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
  // Search
  const [searchQuery,setSearchQuery]   = useState('');
  const [searchResults,setSearchResults] = useState(null);
  const [searching,setSearching]       = useState(false);
  const searchRef                      = useRef(null);
  // History
  const [histYear,setHistYear]         = useState(new Date().getFullYear());
  const [histMonths,setHistMonths]     = useState([]);
  const [histYears,setHistYears]       = useState([]);
  const [selMonth,setSelMonth]         = useState(null);  // 'YYYY-MM'
  const [monthData,setMonthData]       = useState(null);

  // Call log
  const [showCall,setShowCall]     = useState(false);
  const [callForm,setCallForm]     = useState({description:'',matterId:'',durationMins:6,date:today});
  const [callSaving,setCallSaving] = useState(false);
  // Matter form
  const [showMatterForm,setShowMatterForm] = useState(false);
  const [matterForm,setMatterForm] = useState({id:'',name:'',client:'',description:''});
  const [matterSaving,setMatterSaving] = useState(false);
  const [matterMsg,setMatterMsg]   = useState('');

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000);
    return()=>clearInterval(t);
  },[]);

  const load=useCallback(async()=>{
    if(!user) return;
    const uid = user.id;
    const [liveRes, allRes, invRes, matRes] = await Promise.all([
      fetchActivities({ date: selDate, userId: uid }),
      fetchAllActivities({ userId: uid }),
      fetchInvoices(uid),
      fetchMatters(uid),
    ]);
    setOnline(true);
    if(liveRes.activities) setLiveActs(liveRes.activities.sort((a,b)=>a.start_time-b.start_time));
    if(allRes.activities)  setAllActs(allRes.activities);
    if(invRes.invoices)    setInvoices(invRes.invoices);
    if(matRes.matters)     setMatters(matRes.matters);
    // Build dates from allActs
    const dmap = {};
    (allRes.activities||[]).forEach(a=>{ if(!dmap[a.date]) dmap[a.date]={date:a.date,sessions:0}; dmap[a.date].sessions++; });
    setDates(Object.values(dmap).sort((a,b)=>b.date.localeCompare(a.date)));
  },[selDate, user]);

  // Auth check on mount
  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const currentUser = data.session.user;
      setUser(currentUser);
      const p = await getProfile(currentUser.id);
      setProfile(p);
      // Check role from profile OR check email directly as fallback
      const isManager = p?.role === 'manager' || currentUser.email === 'livhuwaningwn@gmail.com';
      if(isManager){
        router.replace('/manager');
        return;
      }
      setAuthLoading(false);
    });
  },[]);

  useEffect(()=>{
    if(!authLoading && user){ load(); const t=setInterval(load,15000); return()=>clearInterval(t); }
  },[load, authLoading, user]);

  // ── Fuzzy search across all data ────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) { setSearchResults(null); return; }
    setSearching(true);
    // Search via Supabase
    const res = await searchAll(q.trim(), user?.id);
    if (!res) { setSearchResults({ activities:[], matters:[], invoices:[], query:q }); setSearching(false); return; }

    // Client-side fuzzy on top with Fuse.js — handles typos like "takalni"
    const fuseActs = new Fuse(res.activities, {
      keys: ['window_title','app_display_name','matter'],
      threshold: 0.4, includeScore: true
    });
    const fuseMatters = new Fuse(res.matters, {
      keys: ['name','client','id','description'],
      threshold: 0.3, includeScore: true
    });
    const fuseInvoices = new Fuse(res.invoices, {
      keys: ['client','matter_name','id','attorney'],
      threshold: 0.3, includeScore: true
    });

    // If query is short, use SQL results; if has typos use fuzzy
    const qLower = q.toLowerCase();
    const acts    = fuseActs.search(qLower).map(r=>r.item).slice(0,30);
    const matters = fuseMatters.search(qLower).map(r=>r.item);
    const invoices= fuseInvoices.search(qLower).map(r=>r.item);

    // Merge: SQL results + fuzzy results deduplicated
    const actIds = new Set(acts.map(a=>a.id));
    const allActs= [...acts, ...res.activities.filter(a=>!actIds.has(a.id))].slice(0,40);
    const mIds   = new Set(matters.map(m=>m.id));
    const allMat = [...matters, ...res.matters.filter(m=>!mIds.has(m.id))];
    const iIds   = new Set(invoices.map(i=>i.id));
    const allInv = [...invoices, ...res.invoices.filter(i=>!iIds.has(i.id))];

    setSearchResults({ activities: allActs, matters: allMat, invoices: allInv, query: q });
    setSearching(false);
  }, []);

  // Debounced search as user types
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  // ── Load history for selected year ───────────────────────────────────
  const loadHistory = useCallback(async (year) => {
    const res = await fetchHistory(year, user?.id);
    if (res.months) setHistMonths(res.months);
    // Build years from allActs
    const yrs = [...new Set(allActs.map(a=>a.date?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    if(!yrs.includes(String(year))) yrs.unshift(String(year));
    setHistYears(yrs);
  }, [user, allActs]);

  useEffect(() => {
    if (tab === 'history') loadHistory(histYear);
  }, [tab, histYear, loadHistory]);

  const loadMonth = useCallback(async (month) => {
    setSelMonth(month);
    const res = await fetchMonthActivities(month, user?.id);
    if (res.activities) {
      const acts = res.activities;
      const tSec  = acts.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
      const bSec  = acts.filter(a=>a.is_billable).reduce((s,a)=>s+Number(a.duration_seconds||0),0);
      const bU    = acts.filter(a=>a.is_billable).reduce((s,a)=>s+(a.billing_units||0),0);
      setMonthData({ activities:acts, totals:{ sessions:acts.length, total_seconds:tSec, billable_seconds:bSec, billable_units:bU }});
    }
  }, [user]);

  // ── Reclassify
  async function reclassify(id,cls){
    const act = [...allActs,...liveActs].find(a=>a.id===id);
    const units = cls==='billable' ? Math.max(1,Math.ceil((act?.duration_seconds||0)/360)) : 0;
    await patchActivity(id, {classification:cls,billing_units:units,is_billable:cls==='billable'});
    load();
  }

  // Assign matter to activity
  async function assignMatter(actId,matterId){
    await patchActivityMatter(actId, matterId);
    load();
  }

  // Seed demo — insert sample activities directly via Supabase
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
      const browsers = ['chrome','edge'];
      const isBrowser = browsers.some(b=>d.app.toLowerCase().includes(b));
      const hasLegal  = LEGAL_KW.some(k=>t.includes(k));
      const cls = isBrowser?(hasLegal?'work':'non-billable'):(hasLegal?'billable':'work');
      const units = cls==='billable'?Math.max(1,Math.ceil(d.dur/360)):0;
      return {
        user_id:user.id, agent_id:'demo',
        app_name:d.app, app_display_name:d.disp, window_title:d.title,
        start_time:st, end_time:st+d.dur*1000, duration_seconds:d.dur,
        classification:cls, billing_units:units, is_billable:cls==='billable',
        matter:'', date:selDate
      };
    });
    await supabase.from('activities').upsert(rows, {onConflict:'user_id,agent_id,start_time',ignoreDuplicates:true});
    await load(); setSeeding(false);
  }

  // Log a call
  async function logCall(){
    if(!callForm.description) return;
    setCallSaving(true);
    const durSec=Math.max(6,Number(callForm.durationMins)||6)*60;
    const m=matters.find(x=>x.id===callForm.matterId);
    const title=`📞 Call: ${callForm.description}${m?' ['+m.id+']':''}`;
    // Use actual current time — and a unique agentId per call so the
    // UNIQUE(user, agent_id, start_time) constraint never causes overwrites
    const now=Date.now();
    const uniqueAgent=`manual-call-${now}`;
    const units = Math.max(1,Math.ceil(durSec/360));
    await supabase.from('activities').insert({
      user_id:user.id, agent_id:uniqueAgent,
      app_name:'Phone Call', app_display_name:'Phone Call',
      window_title:title, start_time:now, end_time:now+durSec*1000,
      duration_seconds:durSec, classification:'billable',
      billing_units:units, is_billable:true,
      matter:callForm.matterId||'', date:new Date().toISOString().split('T')[0]
    });
    await load();
    setCallSaving(false); setShowCall(false);
    setCallForm({description:'',matterId:'',durationMins:6,date:today});
  }

  // Create matter
  async function createMatter(){
    if(!matterForm.name||!matterForm.client) return;
    setMatterSaving(true);
    const res = await createMatter({...matterForm, userId:user.id});
    if(res.error){ alert(res.error.message); setMatterSaving(false); return; }
    // Close modal immediately — auto-link in background
    const savedId = matterForm.id.toUpperCase();
    setMatterSaving(false); setShowMatterForm(false);
    setMatterForm({id:'',name:'',client:'',description:''});
    setMatterMsg(`Matter ${savedId} created successfully.`);
    setTimeout(()=>setMatterMsg(''),4000);
    // Auto-link activities in background without blocking UI
    const words = [...matterForm.name.toLowerCase().split(/[\s\-\/,.()]+/),...matterForm.client.toLowerCase().split(/[\s\-\/,.()]+/)].filter(w=>w.length>2);
    const toLink = allActs.filter(a=>!a.matter && words.some(w=>(a.window_title||'').toLowerCase().includes(w)));
    Promise.all(toLink.map(a=>patchActivityMatter(a.id, savedId))).then(()=>load());
  }

  async function deleteMatter(id){
    if(!confirm(`Delete matter ${id}? Activities will be unlinked.`)) return;
    await deleteMatter(id);
    load();
  }

  // Invoice preview — built from activities assigned to selected matter
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
    } else {
      filtered=mActs.filter(a=>a.date.startsWith(selDate.substring(0,7)));
    }
    const label=invPeriod==='day'?fdate(selDate):invPeriod==='week'?'This week':fmonth(selDate);
    const bill=filtered.filter(a=>a.classification==='billable');
    const tU=bill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
    setPreview({label,filtered,bill,tU,tAmt:tU*invRate});
  }

  async function saveInvoice(){
    if(!preview||!invMatter) return;
    const res=await saveInvoice({
      client:invMatter.client, matter_id:invMatter.id, matter_name:invMatter.name,
      attorney:invAtty, period:invPeriod, period_label:preview.label, rate:invRate,
      total_units:preview.tU, total_amount:preview.tAmt,
      activity_ids:preview.bill.map(a=>a.id)
    }, user.id);
    if(!res.error){setPreview(null);await load();setTab('archive');}
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

  // Derived stats
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
    btn:   (v='s')=>({background:v==='p'?'#6CC04A':v==='pur'?'#A78BFA':v==='r'?'rgba(220,80,80,0.15)':'transparent',border:v==='p'?'none':v==='pur'?'none':v==='g'?'1px solid rgba(108,192,74,0.35)':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='pur'?'#0A0A0A':v==='g'?'#6CC04A':v==='r'?'#E05252':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'||v==='pur'?700:500,whiteSpace:'nowrap'}),
    sel:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th:    {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td:    {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    inp:   {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%'},
    asel:  {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'3px 7px',borderRadius:4,fontSize:10,fontFamily:'inherit'},
    ptab:  (on)=>({background:on?'#2A2A2A':'transparent',border:'none',color:on?'#F0F0F0':'#555',padding:'5px 14px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:on?600:400}),
    modal: {position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20},
    mbox:  {background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:480},
    lbl:   {fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'},
  };

  // Invoice doc
  function InvoiceDoc({inv,acts}){
    const bill=(acts||[]).filter(a=>a.classification==='billable');
    const rate=Number(inv.rate)||150; // always use the rate that was set when the invoice was created
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
          <div>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Billed To</div>
            <div style={{fontWeight:700,fontSize:14}}>{inv.client}</div>
            <div style={{fontSize:11,color:'#888',marginTop:2}}>{inv.matter_name||inv.matter}</div>
            <div style={{fontSize:11,color:'#bbb'}}>Ref: {inv.matter_id||''}</div>
          </div>
          <div>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'#aaa',marginBottom:3}}>Attorney</div>
            <div style={{fontWeight:600,fontSize:13}}>{inv.attorney}</div>
            <div style={{fontSize:11,color:'#888',marginTop:2}}>Period: {inv.period_label}</div>
            <div style={{fontSize:11,color:'#888'}}>Total: {toHm(tSec)} · Billable: {toHm(bSec)}</div>
          </div>
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
            <div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:12,color:'#888',marginBottom:8,paddingBottom:8,borderBottom:'1px solid #ddd'}}><span>VAT @ 15%</span><span style={{fontFamily:'monospace',color:'#555'}}>R{Math.round(tAmt*0.15).toLocaleString()}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'baseline'}}><span style={{fontSize:12,fontWeight:600,color:'#111'}}>Total Due (incl. VAT)</span><span style={{fontSize:22,fontWeight:900,color:'#111'}}>R{Math.round(tAmt*1.15).toLocaleString()}</span></div>
          </div>
        </div>
        <div style={{marginTop:14,fontSize:10,color:'#ccc',textAlign:'center',lineHeight:1.8}}>Motsoeneng Bill Attorneys · VAT: 4100000000 · FNB 62000000000 · Branch: 250655<br/>accounts@motsoenengbill.co.za · Computer generated invoice.</div>
      </div>
    );
  }

  // Analytics tab
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
            {/* Top clients by billable time */}
            {matters.length>0&&(
              <div style={C.card}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Top clients by billable time</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr>{['Client','Matter','Sessions','Total Time','Billable','Units','Est. Value (excl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {matters.map(m=>{
                        const mActs=acts.filter(a=>a.matter===m.id);
                        const mBill=mActs.filter(a=>a.classification==='billable');
                        const mSec=mActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
                        const mBSec=mBill.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
                        const mU=mBill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
                        if(!mActs.length) return null;
                        const barW=mSec>0?Math.round((mBSec/mSec)*100):0;
                        return(
                          <tr key={m.id}>
                            <td style={{...C.td,fontWeight:500,color:'#C8C8C8'}}>{m.client}</td>
                            <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{m.id}<div style={{fontSize:10,color:'#555'}}>{m.name}</div></td>
                            <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{mActs.length}</td>
                            <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(mSec)}</td>
                            <td style={{...C.td}}>
                              <div style={{fontFamily:'monospace',color:'#6CC04A',marginBottom:3}}>{toHm(mBSec)}</div>
                              <div style={{background:'#1A1A1A',borderRadius:2,height:4,width:80}}>
                                <div style={{background:'#6CC04A',borderRadius:2,height:4,width:`${barW}%`}}/>
                              </div>
                              <div style={{fontSize:9,color:'#444',marginTop:2}}>{barW}% of total</div>
                            </td>
                            <td style={{...C.td,fontFamily:'monospace',color:mU>0?'#6CC04A':'#444',fontWeight:600}}>{mU||'—'}</td>
                            <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:mU>0?'#6CC04A':'#444'}}>{mU>0?`R${(mU*invRate).toLocaleString()}`:'—'}</td>
                          </tr>
                        );
                      }).filter(Boolean).sort((a,b)=>0)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={C.card}>
              <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Application breakdown</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Application','Total','Billable','Work','Non-Bill','Units','Est. Value'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(acts.reduce((m,a)=>{const k=a.app_display_name||'?';if(!m[k])m[k]={app:k,total:0,bill:0,work:0,nb:0,u:0};m[k].total+=Number(a.duration_seconds||0);if(a.classification==='billable'){m[k].bill+=Number(a.duration_seconds||0);m[k].u+=calcUnits(a.duration_seconds);}else if(a.classification==='work')m[k].work+=Number(a.duration_seconds||0);else m[k].nb+=Number(a.duration_seconds||0);return m;},{})).sort(([,a],[,b])=>b.total-a.total).map(([k,d])=>(
                    <tr key={k}>
                      <td style={C.td}>{appIcon(k)} <span style={{color:'#C8C8C8'}}>{k}</span></td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{toHm(d.total)}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#6CC04A'}}>{toHm(d.bill)} <span style={{color:'#3A5A2A',fontSize:10}}>({pct(d.bill,d.total)}%)</span></td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#4A90D9'}}>{toHm(d.work)} <span style={{color:'#2A3A5A',fontSize:10}}>({pct(d.work,d.total)}%)</span></td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#555'}}>{toHm(d.nb)} <span style={{fontSize:10}}>({pct(d.nb,d.total)}%)</span></td>
                      <td style={{...C.td,fontFamily:'monospace',color:d.u>0?'#6CC04A':'#444',fontWeight:600}}>{d.u||'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:d.u>0?'#6CC04A':'#444',fontWeight:600}}>{d.u>0?`R${(d.u*invRate).toLocaleString()}`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
          <div style={{display:'flex',gap:4}}>
            {[['today','Today'],['history','History'],['matters','Matters'],['analytics','Analytics'],['activities','All Activities'],['invoices','Invoice'],['archive','Archive']].map(([v,l])=>(
              <button key={v} style={C.ntab(tab===v)} onClick={()=>setTab(v)}>{l}</button>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Search bar */}
            <div style={{position:'relative'}}>
              <input
                ref={searchRef}
                style={{background:'#1A1A1A',border:`1px solid ${searchQuery?'rgba(108,192,74,0.4)':'#252525'}`,color:'#F0F0F0',padding:'5px 12px 5px 32px',borderRadius:20,fontSize:12,fontFamily:'inherit',width:200,outline:'none',transition:'border-color 0.2s'}}
                placeholder="Search everything..."
                value={searchQuery}
                onChange={e=>setSearchQuery(e.target.value)}
                onFocus={()=>{if(tab!=='search') {} }}
              />
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,pointerEvents:'none'}}>{searching?'⌛':'🔍'}</span>
              {searchQuery&&<button style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:12,padding:0}} onClick={()=>setSearchQuery('')}>✕</button>}
            </div>
            {online?<div style={C.pill}><div style={C.dot}/>{clock}</div>:<span style={{fontSize:11,color:'#3A3A3A'}}>Backend offline</span>}
          </div>
        </div>

        {/* ══ TODAY ══════════════════════════════════════════════ */}
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
                              <select
                                style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}}
                                value={a.matter||''}
                                onChange={e=>assignMatter(a.id,e.target.value)}
                              >
                                <option value="">— assign matter —</option>
                                {matters.map(m=>(
                                  <option key={m.id} value={m.id}>{m.id} · {m.client}</option>
                                ))}
                              </select>
                              {am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:3,paddingLeft:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}
                            </td>
                            <td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{toHm(a.duration_seconds)}</td>
                            <td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td>
                            <td style={C.td}><Badge c={a.classification}/></td>
                            <td style={C.td}>
                              <select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}>
                                <option value="billable">Billable</option>
                                <option value="work">Work</option>
                                <option value="non-billable">Non-Billable</option>
                              </select>
                            </td>
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


        {/* ══ SEARCH RESULTS OVERLAY ══════════════════════════════════ */}
        {searchQuery&&searchResults&&(
          <div style={{position:'fixed',top:56,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:90,overflowY:'auto'}} onClick={()=>setSearchQuery('')}>
            <div style={{maxWidth:800,margin:'20px auto',background:'#111',border:'1px solid #2A2A2A',borderRadius:10,padding:20}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div><span style={{fontSize:14,fontWeight:600}}>Results for </span><span style={{color:'#6CC04A',fontSize:14,fontWeight:600}}>"{searchResults.query}"</span></div>
                <div style={{fontSize:11,color:'#555'}}>{searchResults.activities.length} activities · {searchResults.matters.length} matters · {searchResults.invoices.length} invoices</div>
              </div>

              {/* Matters results */}
              {searchResults.matters.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Matters</div>
                  {searchResults.matters.map(m=>{
                    const mActs=allActs.filter(a=>a.matter===m.id);
                    const mU=mActs.filter(a=>a.classification==='billable').reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
                    return(
                      <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:6,cursor:'pointer'}}
                        onClick={()=>{setSearchQuery('');setTab('matters');}}>
                        <div>
                          <div style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',marginBottom:2}}>{m.id}</div>
                          <div style={{fontSize:13,fontWeight:600,color:'#E0E0E0'}}>{m.name}</div>
                          <div style={{fontSize:11,color:'#666'}}>{m.client}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#6CC04A'}}>R{(mU*invRate).toLocaleString()}</div>
                          <div style={{fontSize:10,color:'#444'}}>{mU} units</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Activity results */}
              {searchResults.activities.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Activities ({searchResults.activities.length})</div>
                  <div style={{maxHeight:300,overflowY:'auto'}}>
                    {searchResults.activities.map(a=>{
                      const m=matters.find(x=>x.id===a.matter);
                      return(
                        <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4}}>
                          <div style={{fontSize:16,flexShrink:0}}>{appIcon(a.app_display_name)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,color:'#D0D0D0'}}>{a.app_display_name} <Badge c={a.classification}/></div>
                            <div style={{fontSize:11,color:'#555',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.window_title}</div>
                            {m&&<div style={{fontSize:10,color:'#A78BFA',marginTop:1}}>{m.id} · {m.client}</div>}
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:11,color:'#888',fontFamily:'monospace'}}>{toHm(a.duration_seconds)}</div>
                            <div style={{fontSize:10,color:'#444'}}>{fdate(a.date)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Invoice results */}
              {searchResults.invoices.length>0&&(
                <div>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Invoices</div>
                  {searchResults.invoices.map(inv=>(
                    <div key={inv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#0D0D0D',borderRadius:6,marginBottom:4,cursor:'pointer'}}
                      onClick={()=>{setSearchQuery('');setViewInv(inv);}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>{inv.id}</div>
                        <div style={{fontSize:11,color:'#666'}}>{inv.client} · {inv.matter_name} · {inv.period_label}</div>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:'#6CC04A'}}>R{Math.round((inv.total_units||0)*(inv.rate||150)*1.15).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {!searchResults.activities.length&&!searchResults.matters.length&&!searchResults.invoices.length&&(
                <div style={{textAlign:'center',padding:'40px',color:'#444'}}>
                  <div style={{fontSize:28,marginBottom:10}}>🔍</div>
                  <div style={{fontSize:14,color:'#555',marginBottom:6}}>No results found for "{searchResults.query}"</div>
                  <div style={{fontSize:11,color:'#333'}}>Try a different spelling — fuzzy search will find close matches</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ HISTORY TAB ═════════════════════════════════════════════ */}
        {tab==='history'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Work History</div>
                <div style={{fontSize:11,color:'#444'}}>Full record of all tracked time — January to December</div>
              </div>
              <select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);setMonthData(null);}}>
                {histYears.length?histYears.map(y=><option key={y} value={y}>{y}</option>):<option value={histYear}>{histYear}</option>}
              </select>
            </div>

            {/* Year grid — Jan to Dec */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {Array.from({length:12},(_,i)=>{
                const monthStr=`${histYear}-${String(i+1).padStart(2,'0')}`;
                const monthName=new Date(histYear,i,1).toLocaleString('en-ZA',{month:'long'});
                const data=histMonths.find(m=>m.month===monthStr);
                const isSelected=selMonth===monthStr;
                const hasFuture=new Date(histYear,i,1)>new Date();
                return(
                  <div key={monthStr}
                    style={{background:isSelected?'rgba(108,192,74,0.08)':data?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(108,192,74,0.4)':data?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:data?'pointer':'default',opacity:hasFuture?0.4:1,transition:'all 0.15s'}}
                    onClick={()=>data&&loadMonth(monthStr)}>
                    <div style={{fontSize:12,fontWeight:600,color:data?'#D0D0D0':'#333',marginBottom:6}}>{monthName}</div>
                    {data?(
                      <>
                        <div style={{fontSize:18,fontWeight:800,color:isSelected?'#6CC04A':'#888',marginBottom:2}}>{toHm(data.total_seconds)}</div>
                        <div style={{fontSize:10,color:'#555'}}>{data.sessions} sessions</div>
                        <div style={{fontSize:11,color:'#6CC04A',marginTop:4,fontWeight:600}}>R{((data.billable_units||0)*invRate).toLocaleString()}</div>
                        <div style={{fontSize:9,color:'#444'}}>billable value</div>
                      </>
                    ):(
                      <div style={{fontSize:11,color:'#2A2A2A',marginTop:8}}>{hasFuture?'Future':'No data'}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected month drill-down */}
            {selMonth&&monthData&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                  <div>
                    <span style={{fontSize:14,fontWeight:700}}>{new Date(selMonth+'-01T12:00:00').toLocaleString('en-ZA',{month:'long',year:'numeric'})}</span>
                    <span style={{fontSize:11,color:'#555',marginLeft:12}}>{monthData.totals?.sessions||0} sessions · {toHm(monthData.totals?.total_seconds)} total · {toHm(monthData.totals?.billable_seconds)} billable</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={C.btn()} onClick={()=>{setSelMonth(null);setMonthData(null);}}>✕ Close</button>
                    <button style={C.btn('p')} onClick={()=>{setInvMatterId('');setTab('invoices');}}>Generate Invoice for this month</button>
                  </div>
                </div>

                {/* Month stat cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                  {[
                    {l:'Total Time',v:toHm(monthData.totals?.total_seconds),s:`${monthData.totals?.sessions||0} sessions`,a:false},
                    {l:'Billable Time',v:toHm(monthData.totals?.billable_seconds),s:`${pct(monthData.totals?.billable_seconds,monthData.totals?.total_seconds)}% util`,a:true},
                    {l:'Billing Units',v:monthData.totals?.billable_units||0,s:'6-min units',a:false},
                    {l:'Est. Value',v:`R${((monthData.totals?.billable_units||0)*invRate).toLocaleString()}`,s:'excl. VAT',a:false},
                  ].map(({l,v,s,a})=>(
                    <div key={l} style={C.stat(a)}>
                      <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div>
                      <div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#6CC04A':'#F0F0F0'}}>{v}</div>
                      <div style={{fontSize:10,color:'#444'}}>{s}</div>
                    </div>
                  ))}
                </div>

                {/* Activities table for the month */}
                <div style={C.card}>
                  <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All activities — {new Date(selMonth+'-01T12:00:00').toLocaleString('en-ZA',{month:'long',year:'numeric'})}</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>{['Date','Time','App','Description','Matter','Duration','Units','Status'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {!monthData.activities?.length&&<tr><td colSpan={8} style={{padding:'30px',textAlign:'center',color:'#333'}}>No activities this month</td></tr>}
                        {monthData.activities?.map(a=>{
                          const m=matters.find(x=>x.id===a.matter);
                          return(
                            <tr key={a.id}>
                              <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555',whiteSpace:'nowrap'}}>{fdate(a.date)}</td>
                              <td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td>
                              <td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8'}}>{a.app_display_name}</span></td>
                              <td style={{...C.td,color:'#555',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td>
                              <td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{m?`${m.id} · ${m.client}`:''}</td>
                              <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td>
                              <td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td>
                              <td style={C.td}><Badge c={a.classification}/></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MATTERS ════════════════════════════════════════════ */}
        {tab==='matters'&&(
          <div style={C.main}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Client Matters</div><div style={{fontSize:11,color:'#444'}}>Create matter files — activities are auto-linked by title matching</div></div>
              <button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ New Matter</button>
            </div>
            {matterMsg&&<div style={{background:'rgba(108,192,74,0.08)',border:'1px solid rgba(108,192,74,0.25)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#6CC04A'}}>{matterMsg}</div>}
            <div style={{background:'rgba(167,139,250,0.05)',border:'1px solid rgba(167,139,250,0.15)',borderRadius:6,padding:'12px 16px',marginBottom:14,fontSize:11,color:'#888',lineHeight:1.7}}>
              <strong style={{color:'#A78BFA'}}>How it works:</strong> Create a matter with a name and client. The system immediately scans all tracked activities and links any whose window title mentions the client or matter name. New activities are also auto-linked as they arrive. If an activity is linked to the wrong matter, fix it using the dropdown on the Today or All Activities tab.
            </div>
            {!matters.length?(
              <div style={{...C.card,textAlign:'center',padding:'40px'}}>
                <div style={{fontSize:32,marginBottom:12}}>📁</div>
                <div style={{fontSize:14,color:'#444',marginBottom:8}}>No matters yet</div>
                <div style={{fontSize:11,color:'#2A2A2A',marginBottom:16}}>Create your first matter to start linking time to clients</div>
                <button style={C.btn('p')} onClick={()=>setShowMatterForm(true)}>+ Create first matter</button>
              </div>
            ):(
              <div style={{display:'grid',gap:10}}>
                {matters.map(m=>{
                  const mActs=allActs.filter(a=>a.matter===m.id);
                  const mBill=mActs.filter(a=>a.classification==='billable');
                  const mU=mBill.reduce((s,a)=>s+calcUnits(a.duration_seconds),0);
                  const mSec=mActs.reduce((s,a)=>s+Number(a.duration_seconds||0),0);
                  return(
                    <div key={m.id} style={C.card}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',fontWeight:600}}>{m.id}</span>
                          </div>
                          <div style={{fontSize:14,fontWeight:700,color:'#E0E0E0',marginBottom:2}}>{m.name}</div>
                          <div style={{fontSize:12,color:'#888'}}>Client: <strong style={{color:'#C0C0C0'}}>{m.client}</strong></div>
                          {m.description&&<div style={{fontSize:11,color:'#555',marginTop:4}}>{m.description}</div>}
                        </div>
                        <div style={{display:'flex',gap:16,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                          {[['Activities',mActs.length,'#888'],['Time',toHm(mSec),'#888'],['Units',mU,mU>0?'#6CC04A':'#444'],['Value',`R${(mU*invRate).toLocaleString()}`,mU>0?'#6CC04A':'#444']].map(([l,v,c])=>(
                            <div key={l} style={{textAlign:'center'}}>
                              <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:2}}>{l}</div>
                              <div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
                            </div>
                          ))}
                          <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            <button style={{...C.btn('p'),fontSize:11,padding:'5px 12px'}} onClick={()=>{setInvMatterId(m.id);setTab('invoices');}}>Invoice</button>
                            <button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={()=>deleteMatter(m.id)}>Delete</button>
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

        {/* ══ ANALYTICS ══════════════════════════════════════════ */}
        {tab==='analytics'&&<div style={C.main}><AnalyticsTab/></div>}

        {/* ══ ALL ACTIVITIES ══════════════════════════════════════ */}
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
                      return(
                        <tr key={a.id}>
                          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555',whiteSpace:'nowrap'}}>{fdate(a.date)}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#555',whiteSpace:'nowrap'}}>{ftime(a.start_time)}</td>
                          <td style={{...C.td,whiteSpace:'nowrap'}}>{appIcon(a.app_display_name)} <span style={{color:'#C8C8C8'}}>{a.app_display_name}</span></td>
                          <td style={{...C.td,color:'#555',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={a.window_title}>{a.window_title}</td>
                          <td style={{...C.td,minWidth:160}}>
                            <select style={{...C.asel,width:'100%',color:am?'#A78BFA':'#555',borderColor:am?'rgba(167,139,250,0.5)':'#252525'}}
                              value={a.matter||''} onChange={e=>assignMatter(a.id,e.target.value)}>
                              <option value="">— none —</option>
                              {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
                            </select>
                            {am&&<div style={{fontSize:9,color:'#A78BFA',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{am.name}</div>}
                          </td>
                          <td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{toHm(a.duration_seconds)}</td>
                          <td style={{...C.td,fontFamily:'monospace',color:a.classification==='billable'?'#6CC04A':'#444',fontWeight:600}}>{a.classification==='billable'?calcUnits(a.duration_seconds):'—'}</td>
                          <td style={C.td}><Badge c={a.classification}/></td>
                          <td style={C.td}><select style={C.asel} value={a.classification} onChange={e=>reclassify(a.id,e.target.value)}><option value="billable">Billable</option><option value="work">Work</option><option value="non-billable">Non-Billable</option></select></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ INVOICES ════════════════════════════════════════════ */}
        {tab==='invoices'&&(
          <div style={C.main}>
            <div style={{marginBottom:14}}><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Generate Invoice</div><div style={{fontSize:11,color:'#444'}}>Select a matter — invoice pulls only activities assigned to it</div></div>

            {/* Step 1: pick matter */}
            <div style={C.card}>
              <div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 1 — Select Matter</div>
              {!matters.length?(
                <div style={{padding:'10px 0',fontSize:12,color:'#555'}}>
                  No matters yet. <button style={{...C.btn('pur'),padding:'4px 12px',fontSize:11,marginLeft:8}} onClick={()=>setTab('matters')}>Go to Matters →</button>
                </div>
              ):(
                <select style={{...C.inp,maxWidth:500}} value={invMatterId} onChange={e=>{ setInvMatterId(e.target.value); setPreview(null); }}>
                  <option value="">— choose a matter —</option>
                  {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}
                </select>
              )}
              {invMatter&&(
                <div style={{marginTop:10,display:'flex',gap:20,fontSize:11,flexWrap:'wrap'}}>
                  <div><span style={{color:'#555'}}>Client: </span><strong style={{color:'#C0C0C0'}}>{invMatter.client}</strong></div>
                  <div><span style={{color:'#555'}}>Activities assigned: </span><strong style={{color:allActs.filter(a=>a.matter===invMatterId).length?'#6CC04A':'#888'}}>{allActs.filter(a=>a.matter===invMatterId).length}</strong></div>
                  <div><span style={{color:'#555'}}>Billable sessions: </span><strong style={{color:'#6CC04A'}}>{allActs.filter(a=>a.matter===invMatterId&&a.classification==='billable').length}</strong></div>
                </div>
              )}
            </div>

            {/* Step 2: configure */}
            {invMatterId&&(
              <div style={C.card}>
                <div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Step 2 — Configure</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                  <div><label style={C.lbl}>Attorney</label><input style={C.inp} value={invAtty} onChange={e=>setInvAtty(e.target.value)}/></div>
                  <div><label style={C.lbl}>Rate per unit (R)</label><input style={C.inp} type="number" value={invRate} onChange={e=>setInvRate(parseInt(e.target.value)||150)}/></div>
                  <div><label style={C.lbl}>Billing date</label><input style={C.inp} type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}/></div>
                </div>
                <div style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8,marginTop:4}}>Period</div>
                <div style={{display:'flex',gap:8,marginBottom:14}}>
                  {[['day','Day'],['week','Week'],['month','Month']].map(([v,l])=>(
                    <button key={v} style={{...C.btn(invPeriod===v?'p':'s'),padding:'5px 18px'}} onClick={()=>setInvPeriod(v)}>{l}</button>
                  ))}
                </div>
                <button style={C.btn('p')} onClick={buildPreview}>Preview Invoice</button>
              </div>
            )}

            {/* Step 3: preview */}
            {preview&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                  <div>
                    <span style={{fontSize:13,fontWeight:600}}>Invoice Preview</span>
                    <span style={{fontSize:11,color:'#555',marginLeft:10}}>{preview.label} · {invMatter?.client} · {preview.bill.length} billable sessions · {preview.tU} units · R{preview.tAmt.toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={C.btn()} onClick={()=>setPreview(null)}>Cancel</button>
                    <button style={C.btn('g')} onClick={()=>downloadPDF({...preview,id:'MB-PREVIEW',client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label},preview.filtered)}>⬇ PDF</button>
                    <button style={C.btn('p')} onClick={saveInvoice}>Save to Archive</button>
                  </div>
                </div>
                {!preview.bill.length&&(
                  <div style={{background:'rgba(220,80,80,0.08)',border:'1px solid rgba(220,80,80,0.2)',borderRadius:6,padding:'10px 14px',marginBottom:12,fontSize:11,color:'#E05252'}}>
                    No billable activities assigned to <strong>{invMatter?.name}</strong> for this period. Go to <strong>Today</strong> or <strong>All Activities</strong> and assign activities to this matter using the Matter dropdown.
                  </div>
                )}
                <InvoiceDoc inv={{client:invMatter?.client,matter_id:invMatter?.id,matter_name:invMatter?.name,attorney:invAtty,rate:invRate,period_label:preview.label,id:'MB-PREVIEW'}} acts={preview.filtered}/>
              </div>
            )}
          </div>
        )}

        {/* ══ ARCHIVE ════════════════════════════════════════════ */}
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
                return(
                  <div key={inv.id} style={{...C.card,marginBottom:8,cursor:'pointer'}} onClick={()=>setViewInv(inv)}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#D0D0D0'}}>{inv.id}</span>
                          <span style={{fontSize:9,color:'#6CC04A',border:'1px solid rgba(108,192,74,0.3)',background:'rgba(108,192,74,0.08)',padding:'1px 8px',borderRadius:20}}>Saved</span>
                        </div>
                        <div style={{fontSize:11,color:'#555'}}>{inv.client} · {inv.matter_name||inv.matter}</div>
                        <div style={{fontSize:10,color:'#333',marginTop:2}}>{inv.period_label} · {inv.total_units} units · {new Date(inv.created_at).toLocaleDateString('en-ZA')}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{textAlign:'right'}}>
                          {/* Recalculate from units × rate, show VAT inclusive */}
                          <div style={{fontSize:22,fontWeight:800,color:'#6CC04A'}}>R{Math.round((inv.total_units||0)*(inv.rate||150)*1.15).toLocaleString()}</div>
                          <div style={{fontSize:10,color:'#444',marginTop:2}}>{inv.total_units} units · incl. VAT 15%</div>
                        </div>
                        <button style={{...C.btn('g'),fontSize:11,padding:'5px 12px'}} onClick={e=>{e.stopPropagation();downloadPDF(inv,invActs);}}>⬇ PDF</button>
                        <button style={{...C.btn('r'),fontSize:11,padding:'5px 12px'}} onClick={async e=>{
                          e.stopPropagation();
                          if(!confirm(`Delete invoice ${inv.id}? This cannot be undone.`)) return;
                          await deleteInvoice(inv.id);
                          load();
                        }}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Call Logger Modal ────────────────────────────────── */}
      {showCall&&(
        <div style={C.modal} onClick={()=>setShowCall(false)}>
          <div style={C.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📞 Log a Call</div>
            <div style={{fontSize:11,color:'#555',marginBottom:20}}>Record a client call as a billable activity</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={C.lbl}>Description <span style={{color:'#E05252'}}>*</span></label><input style={C.inp} placeholder="e.g. Smith — settlement discussion" value={callForm.description} onChange={e=>setCallForm(f=>({...f,description:e.target.value}))}/></div>
              <div>
                <label style={C.lbl}>Assign to matter</label>
                <select style={C.inp} value={callForm.matterId} onChange={e=>setCallForm(f=>({...f,matterId:e.target.value}))}>
                  <option value="">— select matter (optional) —</option>
                  {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} ({m.client})</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={C.lbl}>Duration (minutes)</label>
                  <input style={C.inp} type="number" min="1" value={callForm.durationMins} onChange={e=>setCallForm(f=>({...f,durationMins:parseInt(e.target.value)||6}))}/>
                  <div style={{fontSize:10,color:'#6CC04A',marginTop:4}}>{calcUnits(callForm.durationMins*60)} unit(s) · R{calcAmt(callForm.durationMins*60,invRate).toLocaleString()}</div>
                </div>
                <div>
                  <label style={C.lbl}>Logged at</label>
                  <div style={{...C.inp,display:'flex',alignItems:'center',color:'#888',fontSize:11,cursor:'default'}}>{new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})} — {new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'})}</div>
                  <div style={{fontSize:10,color:'#444',marginTop:4}}>Logged at current time</div>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button style={C.btn()} onClick={()=>setShowCall(false)}>Cancel</button>
              <button style={C.btn('pur')} onClick={logCall} disabled={callSaving||!callForm.description}>{callSaving?'Saving...':'Save as Billable'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Matter Modal ─────────────────────────────────── */}
      {showMatterForm&&(
        <div style={C.modal} onClick={()=>setShowMatterForm(false)}>
          <div style={C.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>📁 New Client Matter</div>
            <div style={{fontSize:11,color:'#555',marginBottom:20}}>After creating, existing activities are auto-linked by matching their window titles to the matter name and client.</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={C.lbl}>Matter ID <span style={{color:'#E05252'}}>*</span></label>
                <input style={C.inp} placeholder="e.g. L2025/042 or MB/JONES/2025" value={matterForm.id} onChange={e=>setMatterForm(f=>({...f,id:e.target.value.toUpperCase()}))}/>
                <div style={{fontSize:10,color:'#555',marginTop:4}}>Enter your existing matter number exactly as it appears in Ghost Practice</div>
              </div>
              <div><label style={C.lbl}>Matter name <span style={{color:'#E05252'}}>*</span></label><input style={C.inp} placeholder="e.g. Smith v Jones — Contract Review" value={matterForm.name} onChange={e=>setMatterForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={C.lbl}>Client name <span style={{color:'#E05252'}}>*</span></label><input style={C.inp} placeholder="e.g. ABC Corporation" value={matterForm.client} onChange={e=>setMatterForm(f=>({...f,client:e.target.value}))}/></div>
              <div><label style={C.lbl}>Description (optional)</label><input style={C.inp} placeholder="e.g. Acquisition agreement drafting" value={matterForm.description} onChange={e=>setMatterForm(f=>({...f,description:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button style={C.btn()} onClick={()=>setShowMatterForm(false)}>Cancel</button>
              <button style={C.btn('p')} onClick={createMatter} disabled={matterSaving||!matterForm.id||!matterForm.name||!matterForm.client}>{matterSaving?'Creating...':'Create Matter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice view modal ───────────────────────────────── */}
      {viewInv&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 20px'}} onClick={()=>setViewInv(null)}>
          <div style={{background:'#111',border:'1px solid #252525',borderRadius:12,padding:24,maxWidth:780,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div><div style={{fontSize:14,fontWeight:700}}>{viewInv.id}</div><div style={{fontSize:11,color:'#555'}}>{viewInv.client} · {viewInv.matter_name||viewInv.matter} · {viewInv.period_label}</div></div>
              <div style={{display:'flex',gap:8}}>
                <button style={C.btn('g')} onClick={()=>downloadPDF(viewInv,allActs.filter(a=>(viewInv.activity_ids||[]).includes(a.id)))}>⬇ PDF</button>
                <button style={C.btn('r')} onClick={async()=>{
                  if(!confirm(`Delete invoice ${viewInv.id}? This cannot be undone.`)) return;
                  await deleteInvoice(viewInv.id);
                  setViewInv(null); load();
                }}>Delete</button>
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
