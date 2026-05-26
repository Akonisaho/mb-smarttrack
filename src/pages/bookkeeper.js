import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchInvoices } from '../lib/supabase';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fmtDate(d){ if(!d)return''; try{ const p=d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }catch{return d;} }
function nextReceiptNo(transactions){ const nos=transactions.filter(t=>t.type==='receipt'&&t.receipt_no).map(t=>parseInt((t.receipt_no||'').replace('TRR-',''))||0); const max=nos.length?Math.max(...nos):0; return 'TRR-'+String(max+1).padStart(3,'0'); }

export default function Bookkeeper() {
  const router = useRouter();
  const today = new Date().toLocaleDateString('en-CA');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('trust');
  const [clock, setClock] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [allTime, setAllTime] = useState([]);
  const [matters, setMatters] = useState([]);
  const [branches, setBranches] = useState([]);
  const [trustTransactions, setTrustTransactions] = useState([]);
  const [trustAccounts, setTrustAccounts] = useState([]);
  const [trustBalances, setTrustBalances] = useState({});
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustTab, setTrustTab] = useState('ledger');
  const [trustAlert, setTrustAlert] = useState({msg:'',type:''});
  const [trustSaving, setTrustSaving] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [lockedPeriods, setLockedPeriods] = useState([]);
  const [balanceAlerts, setBalanceAlerts] = useState([]);
  const [selectedTrustMatter, setSelectedTrustMatter] = useState('');
  const [bankLines, setBankLines] = useState([]);
  const [matched, setMatched] = useState({});
  const [reconPeriod, setReconPeriod] = useState(today.substring(0,7));
  const [reportType, setReportType] = useState('trial');
  const [reportFrom, setReportFrom] = useState(today.substring(0,7)+'-01');
  const [reportTo, setReportTo] = useState(today);
  const [reportBranch, setReportBranch] = useState('');
  const [selBranch, setSelBranch] = useState('all');
  const [allMatters, setAllMatters] = useState([]);
  const [rForm, setRForm] = useState({date:today,amount:'',matterId:'',accountId:'',reference:'',receivedFrom:'',narration:'',branchId:''});
  const [pForm, setPForm] = useState({date:today,amount:'',matterId:'',accountId:'',payee:'',reference:'',narration:'',branchId:''});
  const [pBalanceCheck, setPBalanceCheck] = useState(null);
  const [tForm, setTForm] = useState({date:today,amount:'',matterId:'',fromAccountId:'',toAccount:'FNB Business',invoiceId:'',narration:'',branchId:''});
  const [tBalanceCheck, setTBalanceCheck] = useState(null);
  const [csvError, setCsvError] = useState('');
  const [newBankLine, setNewBankLine] = useState({date:today,description:'',amount:'',isCredit:true});
  const [alertMatterId, setAlertMatterId] = useState('');
  const [alertMinBal, setAlertMinBal] = useState(5000);
  const APPROVAL_THRESHOLD = 50000;

  useEffect(()=>{ const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})),1000); return()=>clearInterval(t); },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){ router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if(p?.role !== 'bookkeeper'){ router.replace('/'); return; }
      setProfile(p);
      setLoading(false);
    });
  },[]);

  const loadData = useCallback(async()=>{
    const [profRes, invRes, branchRes] = await Promise.all([
      fetchAllProfiles(),
      fetchInvoices(null),
      supabase.from('branches').select('*').eq('is_active',true).order('name'),
    ]);
    if(profRes.profiles) setProfiles(profRes.profiles);
    if(invRes.invoices) setInvoices(invRes.invoices||[]);
    setBranches(branchRes.data||[]);

    // Load all activities for WIP
    const {data:acts} = await supabase.from('activities')
      .select('user_id,billing_units,is_billable,duration_seconds,date,matter')
      .neq('agent_id','demo');
    setAllTime(acts||[]);

    // Load matters
    const {data:mats} = await supabase.from('matters').select('*').order('created_at',{ascending:false});
    setMatters(mats||[]);
  },[]);

  const loadTrust = useCallback(async()=>{
    setTrustLoading(true);
    try{
      const [accsRes,txnsRes,branchRes,locksRes,alertsRes] = await Promise.all([
        supabase.from('trust_accounts').select('*').eq('is_active',true).order('name'),
        supabase.from('trust_transactions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}),
        supabase.from('branches').select('*').eq('is_active',true).order('name'),
        supabase.from('trust_period_locks').select('*').order('period',{ascending:false}),
        supabase.from('trust_balance_alerts').select('*'),
      ]);
      setTrustAccounts(accsRes.data||[]);
      setBranches(branchRes.data||[]);
      setLockedPeriods((locksRes.data||[]).map(l=>l.period));
      setBalanceAlerts(alertsRes.data||[]);
      const {data:mats} = await supabase.from('matters').select('*');
      setAllMatters(mats||[]);
      if(accsRes.data?.length){
        setRForm(f=>f.accountId?f:{...f,accountId:accsRes.data[0].id});
        setPForm(f=>f.accountId?f:{...f,accountId:accsRes.data[0].id});
        setTForm(f=>f.fromAccountId?f:{...f,fromAccountId:accsRes.data[0].id});
      }
      const txns = txnsRes.data||[];
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
  },[]);

  useEffect(()=>{ if(!loading){ loadData(); loadTrust(); } },[loading]);

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
  function checkPaymentBalance(matterId,amount){ if(!matterId||!amount){setPBalanceCheck(null);return;} const bal=getMatterBalance(matterId),amt=parseFloat(amount); if(isNaN(amt)||amt<=0){setPBalanceCheck(null);return;} setPBalanceCheck({bal,amt,ok:amt<=bal,needsApproval:amt>=APPROVAL_THRESHOLD}); }
  function checkTransferBalance(matterId,amount){ if(!matterId||!amount){setTBalanceCheck(null);return;} const bal=getMatterBalance(matterId),amt=parseFloat(amount); if(isNaN(amt)||amt<=0){setTBalanceCheck(null);return;} setTBalanceCheck({bal,amt,ok:amt<=bal}); }

  async function postReceipt(){
    if(!rForm.date||!rForm.amount||!rForm.matterId||!rForm.narration){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(rForm.date)){ showTrustAlert(`Period ${rForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amount=parseFloat(rForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    setTrustSaving(true);
    const receiptNo=nextReceiptNo(trustTransactions);
    const {error}=await supabase.from('trust_transactions').insert([{type:'receipt',matter_id:rForm.matterId,user_id:profile?.id,date:rForm.date,amount,receipt_no:receiptNo,received_from:rForm.receivedFrom,trust_account_id:rForm.accountId||null,reference:rForm.reference,narration:rForm.narration,captured_by:profile?.id,branch_id:rForm.branchId||null,status:'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Receipt ${receiptNo} posted — ${fmtR(amount)}`,'success');
    setRForm(f=>({...f,amount:'',matterId:'',reference:'',receivedFrom:'',narration:''}));
    setTrustSaving(false); loadTrust();
  }

  async function postPayment(){
    if(!pForm.date||!pForm.amount||!pForm.matterId||!pForm.payee||!pForm.narration){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(pForm.date)){ showTrustAlert(`Period ${pForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amount=parseFloat(pForm.amount);
    if(isNaN(amount)||amount<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const bal=getMatterBalance(pForm.matterId);
    if(amount>bal){ showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)}.`,'error'); return; }
    setTrustSaving(true);
    const needsApproval=amount>=APPROVAL_THRESHOLD;
    const {error}=await supabase.from('trust_transactions').insert([{type:'payment',matter_id:pForm.matterId,user_id:profile?.id,date:pForm.date,amount,payee:pForm.payee,trust_account_id:pForm.accountId||null,reference:pForm.reference,narration:pForm.narration,captured_by:profile?.id,branch_id:pForm.branchId||null,status:needsApproval?'pending':'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(needsApproval?`⏳ Payment of ${fmtR(amount)} submitted for approval.`:`✓ Payment of ${fmtR(amount)} to ${pForm.payee} posted.`,'success');
    setPForm(f=>({...f,amount:'',matterId:'',payee:'',reference:'',narration:''}));
    setPBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  async function postTransfer(){
    if(!tForm.date||!tForm.amount||!tForm.matterId){ showTrustAlert('Please fill in all required fields.','error'); return; }
    if(isLocked(tForm.date)){ showTrustAlert(`Period ${tForm.date.substring(0,7)} is locked.`,'error'); return; }
    const amountExclVAT=parseFloat(tForm.amount);
    if(isNaN(amountExclVAT)||amountExclVAT<=0){ showTrustAlert('Enter a valid amount.','error'); return; }
    const vatAmount=parseFloat((amountExclVAT*0.15).toFixed(2));
    const totalAmount=parseFloat((amountExclVAT+vatAmount).toFixed(2));
    const bal=getMatterBalance(tForm.matterId);
    if(totalAmount>bal){ showTrustAlert(`✗ Insufficient balance. Available: ${fmtR(bal)} — Required incl. VAT: ${fmtR(totalAmount)}.`,'error'); return; }
    setTrustSaving(true);
    const {error}=await supabase.from('trust_transactions').insert([{type:'transfer',matter_id:tForm.matterId,user_id:profile?.id,date:tForm.date,amount:totalAmount,amount_excl_vat:amountExclVAT,vat_amount:vatAmount,trust_account_id:tForm.fromAccountId||null,to_account:tForm.toAccount,invoice_id:tForm.invoiceId,narration:tForm.narration||`Transfer of fees — ${tForm.matterId}`,captured_by:profile?.id,branch_id:tForm.branchId||null,status:'posted'}]);
    if(error){ showTrustAlert('Error: '+error.message,'error'); setTrustSaving(false); return; }
    showTrustAlert(`✓ Transfer posted — Fees: ${fmtR(amountExclVAT)} + VAT: ${fmtR(vatAmount)} = Total: ${fmtR(totalAmount)}`,'success');
    setTForm(f=>({...f,amount:'',matterId:'',invoiceId:'',narration:''}));
    setTBalanceCheck(null); setTrustSaving(false); loadTrust();
  }

  async function lockPeriod(period){ if(!confirm(`Lock period ${period}?`)) return; const {error}=await supabase.from('trust_period_locks').insert([{period,locked_by:profile?.id}]); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert(`✓ Period ${period} locked.`,'success'); loadTrust(); }
  async function unlockPeriod(period){ if(!confirm(`Unlock period ${period}? Only do this with partner authorisation.`)) return; const {error}=await supabase.from('trust_period_locks').delete().eq('period',period); if(error){ showTrustAlert('Error: '+error.message,'error'); return; } showTrustAlert(`Period ${period} unlocked.`,'success'); loadTrust(); }

  function printTrustStatement(matter, transactions) {
    let running=0;
    const rows=transactions.map(t=>{ const isR=t.type==='receipt'; if(isR) running+=Number(t.amount); else running-=Number(t.amount); return `<tr><td>${fmtDate(t.date)}</td><td style="text-transform:capitalize">${t.type}</td><td>${t.receipt_no||t.reference||'—'}</td><td>${t.narration||''}</td><td align="right" style="color:#dc2626">${!isR?fmtR(t.amount):''}</td><td align="right" style="color:#16a34a">${isR?fmtR(t.amount):''}</td><td align="right" style="font-weight:700;color:${running>=0?'#16a34a':'#dc2626'}">${fmtR(running)}</td></tr>`; }).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trust Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:auto}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;color:#aaa;border-bottom:2px solid #eee;text-align:left}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center}</style></head><body><h2 style="color:#8DC63F;margin-bottom:4px">Motsoeneng Bill Attorneys</h2><h3>Trust Account Statement — ${matter?.id}</h3><p style="color:#888;font-size:12px;margin-bottom:16px">Client: ${matter?.client} · Balance: ${fmtR(running)}</p><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th align="right">Debit</th><th align="right">Credit</th><th align="right">Balance</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">Motsoeneng Bill Attorneys · VAT: 4100000000 · accounts@mb.co.za</div><script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w=window.open('','_blank','width=920,height=720'); w.document.write(html); w.document.close();
  }

  const C = {
    page: {background:'#0A0A0A',minHeight:'100vh',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#F0F0F0'},
    hdr: {background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    main: {maxWidth:1300,margin:'0 auto',padding:'20px 24px'},
    card: {background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    stat: (acc,warn)=>({background:acc?'rgba(141,198,63,0.05)':warn?'rgba(234,179,8,0.05)':'#111',border:`1px solid ${acc?'rgba(141,198,63,0.25)':warn?'rgba(234,179,8,0.25)':'#1A1A1A'}`,borderRadius:8,padding:14}),
    sel: {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
    th: {fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:'#444',padding:'9px 10px',borderBottom:'1px solid #181818',textAlign:'left',fontWeight:600},
    td: {padding:'9px 10px',fontSize:11,borderBottom:'1px solid #161616',verticalAlign:'middle'},
    btn: (v='s')=>({background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':v==='trust'?'rgba(74,144,217,0.15)':v==='warn'?'rgba(234,179,8,0.15)':'transparent',border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':v==='trust'?'1px solid rgba(74,144,217,0.4)':v==='warn'?'1px solid rgba(234,179,8,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='r'?'#E05252':v==='trust'?'#4A90D9':v==='warn'?'#EAB308':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'?700:500}),
    pill: {display:'flex',alignItems:'center',gap:6,background:'rgba(141,198,63,0.08)',border:'1px solid rgba(141,198,63,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#8DC63F'},
    dot: {width:7,height:7,borderRadius:'50%',background:'#8DC63F',boxShadow:'0 0 6px rgba(141,198,63,0.8)'},
    ntab: (on)=>({background:'transparent',border:`1px solid ${on?'#2A2A2A':'transparent'}`,color:on?'#F0F0F0':'#555',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
    ttab: (on)=>({background:on?'rgba(74,144,217,0.15)':'transparent',border:`1px solid ${on?'rgba(74,144,217,0.4)':'#252525'}`,color:on?'#4A90D9':'#555',padding:'6px 16px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:on?600:400}),
    lbl: {fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'},
    tinp: {background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'7px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',marginTop:4},
  };

  if(loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  const total = totalTrustHeld();
  const ledger = selectedTrustMatter ? getMatterLedger(selectedTrustMatter) : [];
  const systemTotal = trustTransactions.filter(t=>t.status==='posted').reduce((s,t)=>t.type==='receipt'?s+Number(t.amount):s-Number(t.amount),0);
  const bankTotal = bankLines.reduce((s,l)=>l.isCredit?s+Number(l.amount||0):s-Number(l.amount||0),0);
  const diff = Math.abs(systemTotal-bankTotal);

  // WIP data
  const wipData = profiles.map(p=>{
    const attyActs = allTime.filter(a=>a.user_id===p.id&&a.is_billable);
    const attyInvs = invoices.filter(i=>i.user_id===p.id);
    const earnedUnits = attyActs.reduce((s,a)=>s+(a.billing_units||0),0);
    const billedUnits = attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
    const unbilledUnits = Math.max(0,earnedUnits-billedUnits);
    const attyRate = p.rate||150;
    const matterMap={};
    attyActs.forEach(a=>{ if(!a.matter) return; if(!matterMap[a.matter]) matterMap[a.matter]={matterId:a.matter,units:0,billedUnits:0}; matterMap[a.matter].units+=a.billing_units||0; });
    attyInvs.forEach(i=>{ if(!i.matter_id) return; if(!matterMap[i.matter_id]) matterMap[i.matter_id]={matterId:i.matter_id,units:0,billedUnits:0}; matterMap[i.matter_id].billedUnits+=i.total_units||0; });
    const wipMatters = Object.values(matterMap).map(m=>({...m,unbilled:Math.max(0,m.units-m.billedUnits),matter:matters.find(x=>x.id===m.matterId)})).filter(m=>m.unbilled>0);
    return{...p,earnedUnits,billedUnits,unbilledUnits,estValue:unbilledUnits*attyRate,attyRate,wipMatters};
  }).filter(p=>p.unbilledUnits>0).sort((a,b)=>b.estValue-a.estValue);

  return(
    <>
      <Head><title>MB SmartTrack — Bookkeeper</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(141,198,63,0.025)}select option{background:#1A1A1A;color:#F0F0F0}input[type=date],input[type=month]{color-scheme:dark}button:hover{opacity:.85}`}</style>
      <div style={C.page}>
        <div style={C.hdr}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/logo.png" alt="MB" style={{width:34,height:34,objectFit:'contain',borderRadius:6}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
            <div style={{display:'none',background:'#8DC63F',borderRadius:6,width:34,height:34,alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#0A0A0A'}}>MB</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Bookkeeper</div>
              <div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill · {profile?.full_name}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['trust','🏦 Trust'],['wip','📋 WIP Report'],['invoices','🧾 Invoices']].map(([v,l])=>(
              <button key={v} style={{...C.ntab(tab===v),color:v==='trust'?'#4A90D9':tab===v?'#F0F0F0':'#555',border:v==='trust'?`1px solid ${tab===v?'rgba(74,144,217,0.5)':'rgba(74,144,217,0.2)'}`:tab===v?'1px solid #2A2A2A':'1px solid transparent',position:'relative'}} onClick={()=>setTab(v)}>
                {l}{v==='trust'&&pendingPayments.length>0&&<span style={{position:'absolute',top:-4,right:-4,background:'#EAB308',color:'#000',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingPayments.length}</span>}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={C.pill}><div style={C.dot}/>{clock}</div>
            <button style={{...C.btn('r')}} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
          </div>
        </div>

        {trustAlert.msg&&(<div style={{background:trustAlert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${trustAlert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'14px 24px',fontSize:12,color:trustAlert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{trustAlert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setTrustAlert({msg:'',type:''})}>✕</button></div>)}
        {pendingPayments.length>0&&tab!=='trust'&&(<div style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.3)',padding:'10px 24px',fontSize:12,color:'#EAB308',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>⏳ {pendingPayments.length} payment{pendingPayments.length>1?'s':''} pending approval — {fmtR(pendingPayments.reduce((s,t)=>s+Number(t.amount),0))}</span><button style={C.btn('warn')} onClick={()=>setTab('trust')}>Review →</button></div>)}

        {tab==='trust'&&(<div style={C.main}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>🏦 Trust Accounting</div>
          <div style={{fontSize:11,color:'#444',marginBottom:16}}>All branches · Legal Practice Act compliant</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[{l:'Total trust held',v:fmtR(total),a:true},{l:'Total receipts',v:fmtR(trustTransactions.filter(t=>t.type==='receipt'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false},{l:'Total payments',v:fmtR(trustTransactions.filter(t=>t.type==='payment'&&t.status==='posted').reduce((s,t)=>s+Number(t.amount),0)),a:false},{l:'Pending approvals',v:pendingPayments.length,a:false,w:pendingPayments.length>0}].map(({l,v,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div></div>))}
          </div>
          <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
            {[['ledger','📊 Ledger'],['receipt','⬇ Receipt'],['payment','⬆ Payment'],['transfer','↔ Transfer'],['recon','🔁 Reconciliation'],['reports','📋 Reports']].map(([v,l])=>(
              <button key={v} style={{...C.ttab(trustTab===v)}} onClick={()=>setTrustTab(v)}>{l}</button>
            ))}
            {trustLoading&&<span style={{fontSize:11,color:'#555',alignSelf:'center'}}>Loading...</span>}
          </div>

          {trustTab==='ledger'&&(<div>
            <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}><span style={{fontSize:11,color:'#555'}}>Branch:</span>{[{id:'',name:'All branches'},...branches].map(b=>(<button key={b.id} style={{...C.btn(reportBranch===b.id?'trust':'s'),fontSize:11,padding:'4px 12px'}} onClick={()=>setReportBranch(b.id)}>{b.name}</button>))}</div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All matters — trust balances</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Description','Branch','Balance','Actions'].map(h=><th key={h} style={{...C.th,textAlign:h==='Balance'?'right':'left'}}>{h}</th>)}</tr></thead><tbody>{!allMatters.length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No matters found.</td></tr>}{allMatters.map(m=>{ const bal=getMatterBalance(m.id),br=branches.find(b=>b.id===m.branch_id); return(<tr key={m.id} style={{opacity:bal===0?0.4:1}}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td><td style={{...C.td,fontWeight:500,color:'#C8C8C8'}}>{m.client}</td><td style={{...C.td,color:'#555',fontSize:10}}>{m.name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:bal>0?'#8DC63F':bal<0?'#E05252':'#555',textAlign:'right',whiteSpace:'nowrap'}}>{fmtR(bal)}</td><td style={C.td}><div style={{display:'flex',gap:4}}><button style={{...C.btn('trust'),fontSize:10,padding:'3px 8px'}} onClick={()=>setSelectedTrustMatter(selectedTrustMatter===m.id?'':m.id)}>{selectedTrustMatter===m.id?'Hide':'Ledger'}</button><button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={()=>printTrustStatement(m,getMatterLedger(m.id))}>Statement</button></div></td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={4} style={{...C.th,paddingTop:12}}>Grand total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#8DC63F',textAlign:'right',paddingTop:12}}>{fmtR(total)}</td><td></td></tr></tbody></table></div></div>
            {selectedTrustMatter&&(<div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:'#4A90D9'}}>{selectedTrustMatter} — Running ledger</div><button style={{...C.btn(),fontSize:11}} onClick={()=>printTrustStatement(allMatters.find(m=>m.id===selectedTrustMatter),ledger)}>Print statement</button></div>{!ledger.length?<div style={{color:'#333',fontSize:12,textAlign:'center',padding:20}}>No transactions yet.</div>:(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Type','Receipt No','Narration','Debit','Credit','Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{ledger.map((t,i)=>{ const isR=t.type==='receipt'; return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10}}>{fmtDate(t.date)}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:isR?'rgba(141,198,63,0.1)':t.type==='payment'?'rgba(220,80,80,0.1)':'rgba(74,144,217,0.1)',color:isR?'#8DC63F':t.type==='payment'?'#E05252':'#4A90D9'}}>{t.type}</span></td><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#555'}}>{t.receipt_no||'—'}</td><td style={{...C.td,fontSize:11}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{!isR?fmtR(t.amount):''}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',textAlign:'right'}}>{isR?fmtR(t.amount):''}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:t.runningBalance>=0?'#8DC63F':'#E05252',textAlign:'right'}}>{fmtR(t.runningBalance)}</td></tr>); })}</tbody></table>)}</div>)}
          </div>)}

          {trustTab==='receipt'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust receipt</div><span style={{fontSize:10,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'2px 10px',borderRadius:20}}>Next: {nextReceiptNo(trustTransactions)}</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={rForm.date} onChange={e=>setRForm(f=>({...f,date:e.target.value}))}/></div><div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="e.g. 10000.00" defaultValue={rForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setRForm(f=>({...f,amount:v})); }}/></div></div>
                <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={rForm.matterId} onChange={e=>setRForm(f=>({...f,matterId:e.target.value}))}><option value="">Select matter...</option>{allMatters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client}</option>)}</select></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Trust account</label><select style={C.tinp} value={rForm.accountId} onChange={e=>setRForm(f=>({...f,accountId:e.target.value}))}>{trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div><label style={C.lbl}>Branch</label><select style={C.tinp} value={rForm.branchId} onChange={e=>setRForm(f=>({...f,branchId:e.target.value}))}><option value="">Select branch...</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="EFT ref" defaultValue={rForm.reference} onBlur={e=>setRForm(f=>({...f,reference:e.target.value}))}/></div><div><label style={C.lbl}>Received from</label><input style={C.tinp} placeholder="Payer name" defaultValue={rForm.receivedFrom} onBlur={e=>setRForm(f=>({...f,receivedFrom:e.target.value}))}/></div></div>
                <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Description" defaultValue={rForm.narration} onBlur={e=>setRForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button style={C.btn()} onClick={()=>setRForm(f=>({...f,amount:'',matterId:'',reference:'',receivedFrom:'',narration:''}))}>Clear</button><button style={C.btn('p')} onClick={postReceipt} disabled={trustSaving}>{trustSaving?'Posting...':'Post receipt'}</button></div>
              </div>
            </div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent receipts</div><div style={{overflowY:'auto',maxHeight:420}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Receipt','Date','Matter','Client','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{trustTransactions.filter(t=>t.type==='receipt').map((t,i)=>{ const m=allMatters.find(x=>x.id===t.matter_id); return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}</tbody></table></div></div>
          </div>)}

          {trustTab==='payment'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>New trust payment</div><span style={{fontSize:10,color:'#EAB308',border:'1px solid rgba(234,179,8,0.3)',padding:'2px 10px',borderRadius:20}}>≥ {fmtR(APPROVAL_THRESHOLD)} needs approval</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={pForm.date} onChange={e=>setPForm(f=>({...f,date:e.target.value}))}/></div><div><label style={C.lbl}>Amount (ZAR) *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={pForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setPForm(f=>({...f,amount:v})); checkPaymentBalance(pForm.matterId,v); }}/></div></div>
                <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={pForm.matterId} onChange={e=>{ setPForm(f=>({...f,matterId:e.target.value})); checkPaymentBalance(e.target.value,pForm.amount); }}><option value="">Select matter...</option>{allMatters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
                {pBalanceCheck&&(<div style={{background:pBalanceCheck.ok?'rgba(141,198,63,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${pBalanceCheck.ok?'rgba(141,198,63,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:pBalanceCheck.ok?'#8DC63F':'#E05252'}}>{pBalanceCheck.ok?`✓ Available: ${fmtR(pBalanceCheck.bal)} · After: ${fmtR(pBalanceCheck.bal-pBalanceCheck.amt)}${pBalanceCheck.needsApproval?' · ⏳ Needs approval':''}`:`✗ Insufficient — available: ${fmtR(pBalanceCheck.bal)}`}</div>)}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Payee *</label><input style={C.tinp} placeholder="Sheriff, advocate..." defaultValue={pForm.payee} onBlur={e=>setPForm(f=>({...f,payee:e.target.value}))}/></div><div><label style={C.lbl}>Reference</label><input style={C.tinp} placeholder="Cheque or EFT ref" defaultValue={pForm.reference} onBlur={e=>setPForm(f=>({...f,reference:e.target.value}))}/></div></div>
                <div><label style={C.lbl}>Narration *</label><input style={C.tinp} placeholder="Payment description" defaultValue={pForm.narration} onBlur={e=>setPForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button style={C.btn()} onClick={()=>{ setPForm(f=>({...f,amount:'',matterId:'',payee:'',reference:'',narration:''})); setPBalanceCheck(null); }}>Clear</button><button style={C.btn('p')} onClick={postPayment} disabled={trustSaving}>{trustSaving?'Posting...':pBalanceCheck?.needsApproval?'Submit for approval':'Post payment'}</button></div>
              </div>
            </div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent payments</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Payee','Amount','Status'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{trustTransactions.filter(t=>t.type==='payment').map((t,i)=>(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{t.payee}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:t.status==='posted'?'rgba(141,198,63,0.1)':t.status==='pending'?'rgba(234,179,8,0.1)':'rgba(220,80,80,0.1)',color:t.status==='posted'?'#8DC63F':t.status==='pending'?'#EAB308':'#E05252'}}>{t.status}</span></td></tr>))}</tbody></table></div>
          </div>)}

          {trustTab==='transfer'&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:16}}>Trust to business transfer</div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>Date *</label><input type="date" style={C.tinp} value={tForm.date} onChange={e=>setTForm(f=>({...f,date:e.target.value}))}/></div><div><label style={C.lbl}>Amount excl. VAT *</label><input type="text" inputMode="decimal" style={C.tinp} placeholder="0.00" defaultValue={tForm.amount} onBlur={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); e.target.value=v; setTForm(f=>({...f,amount:v})); checkTransferBalance(tForm.matterId,v); }}/></div></div>
                <div><label style={C.lbl}>Matter *</label><select style={C.tinp} value={tForm.matterId} onChange={e=>{ setTForm(f=>({...f,matterId:e.target.value,invoiceId:'',amount:''})); checkTransferBalance(e.target.value,tForm.amount); }}><option value="">Select matter...</option>{allMatters.map(m=><option key={m.id} value={m.id}>{m.id} — {m.client} (bal: {fmtR(getMatterBalance(m.id))})</option>)}</select></div>
                {tBalanceCheck&&(<div style={{background:tBalanceCheck.ok?'rgba(141,198,63,0.08)':'rgba(220,80,80,0.08)',border:`1px solid ${tBalanceCheck.ok?'rgba(141,198,63,0.3)':'rgba(220,80,80,0.3)'}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:tBalanceCheck.ok?'#8DC63F':'#E05252'}}>{tBalanceCheck.ok?<div><div>✓ Available: {fmtR(tBalanceCheck.bal)}</div><div style={{fontSize:11,color:'#888',marginTop:4}}>Excl. VAT: {fmtR(tBalanceCheck.amt)} + VAT 15%: {fmtR(tBalanceCheck.amt*0.15)} = <strong style={{color:'#EAB308'}}>Total: {fmtR(tBalanceCheck.amt*1.15)}</strong></div><div style={{fontSize:11,color:'#555',marginTop:2}}>After: {fmtR(tBalanceCheck.bal-tBalanceCheck.amt*1.15)}</div></div>:`✗ Insufficient — available: ${fmtR(tBalanceCheck.bal)}`}</div>)}
                {tForm.matterId&&getMatterInvoices(tForm.matterId).length>0&&(<div><label style={C.lbl}>Link to invoice</label><select style={C.tinp} value={tForm.invoiceId} onChange={e=>{ const inv=invoices.find(i=>i.id===e.target.value); setTForm(f=>({...f,invoiceId:e.target.value,narration:inv?`Transfer of fees — ${inv.matter_name} — ${inv.id}`:''})); }}><option value="">Select invoice (optional)...</option>{getMatterInvoices(tForm.matterId).map(i=><option key={i.id} value={i.id}>{i.id} — R{((i.total_units||0)*(i.rate||150)*1.15).toFixed(2)} incl. VAT</option>)}</select></div>)}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div><label style={C.lbl}>From trust account</label><select style={C.tinp} value={tForm.fromAccountId} onChange={e=>setTForm(f=>({...f,fromAccountId:e.target.value}))}>{trustAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div><label style={C.lbl}>To business account</label><select style={C.tinp} value={tForm.toAccount} onChange={e=>setTForm(f=>({...f,toAccount:e.target.value}))}><option value="FNB Business">FNB Business Account</option><option value="ABSA Business">ABSA Business Account</option></select></div></div>
                <div><label style={C.lbl}>Narration</label><input style={C.tinp} placeholder="Transfer of professional fees" defaultValue={tForm.narration} onBlur={e=>setTForm(f=>({...f,narration:e.target.value}))}/></div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button style={C.btn()} onClick={()=>{ setTForm(f=>({...f,amount:'',matterId:'',invoiceId:'',narration:''})); setTBalanceCheck(null); }}>Clear</button><button style={C.btn('p')} onClick={postTransfer} disabled={trustSaving}>{trustSaving?'Posting...':'Post transfer'}</button></div>
              </div>
            </div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Transfer history</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','From','To','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{trustTransactions.filter(t=>t.type==='transfer').map((t,i)=>(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{trustAccounts.find(a=>a.id===t.trust_account_id)?.name||'Trust'}</td><td style={{...C.td,fontSize:10,color:'#8DC63F'}}>{t.to_account}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>))}</tbody></table></div>
          </div>)}

          {trustTab==='recon'&&(<div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>{[{l:'System trust balance',v:fmtR(systemTotal),c:'#4A90D9'},{l:'Bank statement total',v:fmtR(bankTotal),c:'#F0F0F0'},{l:'Difference',v:fmtR(diff),c:diff<0.01?'#8DC63F':'#E05252',sub:diff<0.01?'✓ Reconciled':'Unreconciled'}].map(({l,v,c,sub})=>(<div key={l} style={C.stat(diff<0.01&&l==='Difference')}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>{sub&&<div style={{fontSize:10,color:c,marginTop:4}}>{sub}</div>}</div>))}</div>
            <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Period lock</div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><input type="month" style={{...C.sel,width:150}} value={reconPeriod} onChange={e=>setReconPeriod(e.target.value)}/>{isPeriodLocked(reconPeriod)?(<><span style={{fontSize:11,color:'#E05252',border:'1px solid rgba(220,80,80,0.3)',padding:'4px 12px',borderRadius:6}}>🔒 {reconPeriod} LOCKED</span><button style={C.btn('r')} onClick={()=>unlockPeriod(reconPeriod)}>Unlock</button></>):(<><span style={{fontSize:11,color:'#555'}}>{reconPeriod} is open</span><button style={C.btn('warn')} onClick={()=>lockPeriod(reconPeriod)}>🔒 Lock</button></>)}</div></div>
          </div>)}

          {trustTab==='reports'&&(<div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>{[['trial','Trial Balance'],['receipts','Receipts Journal'],['payments','Payments Journal'],['transfers','Transfers Journal']].map(([v,l])=>(<button key={v} style={{...C.btn(reportType===v?'trust':'s'),fontSize:11}} onClick={()=>setReportType(v)}>{l}</button>))}<div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}><select style={{...C.sel,width:130}} value={reportBranch} onChange={e=>setReportBranch(e.target.value)}><option value="">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><input type="date" style={{...C.sel,width:130}} value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/><span style={{fontSize:11,color:'#555'}}>to</span><input type="date" style={{...C.sel,width:130}} value={reportTo} onChange={e=>setReportTo(e.target.value)}/></div></div>
            {reportType==='trial'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Trust trial balance</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Description','Branch','Trust Balance'].map(h=><th key={h} style={{...C.th,textAlign:h==='Trust Balance'?'right':'left'}}>{h}</th>)}</tr></thead><tbody>{allMatters.map(m=>{ const bal=getMatterBalance(m.id),br=branches.find(b=>b.id===m.branch_id); return(<tr key={m.id} style={{opacity:bal===0?0.4:1}}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.id}</td><td style={{...C.td,fontWeight:500}}>{m.client}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{m.name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,textAlign:'right',color:bal>0?'#8DC63F':bal<0?'#E05252':'#555'}}>{fmtR(bal)}</td></tr>); })}<tr style={{background:'#0D0D0D'}}><td colSpan={4} style={{...C.th,paddingTop:12}}>Grand total</td><td style={{...C.th,fontFamily:'monospace',fontSize:12,color:'#8DC63F',textAlign:'right',paddingTop:12}}>{fmtR(total)}</td></tr></tbody></table></div>)}
            {reportType==='receipts'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Receipts journal</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Receipt No','Date','Matter','Client','Received From','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='receipt').map((t,i)=>{ const m=allMatters.find(x=>x.id===t.matter_id); return(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#4A90D9'}}>{t.receipt_no}</td><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.received_from||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}</tbody></table></div>)}
            {reportType==='payments'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Payments journal</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Client','Payee','Status','Narration','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='payment').map((t,i)=>{ const m=allMatters.find(x=>x.id===t.matter_id); return(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={C.td}>{t.payee}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:t.status==='posted'?'rgba(141,198,63,0.1)':'rgba(234,179,8,0.1)',color:t.status==='posted'?'#8DC63F':'#EAB308'}}>{t.status}</span></td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.narration}</td><td style={{...C.td,fontFamily:'monospace',color:'#E05252',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}</tbody></table></div>)}
            {reportType==='transfers'&&(<div style={C.card}><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Transfers journal</div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Matter','Client','From','To','Invoice','Amount'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{getReportTxns().filter(t=>t.type==='transfer').map((t,i)=>{ const m=allMatters.find(x=>x.id===t.matter_id); return(<tr key={i}><td style={{...C.td,fontSize:10}}>{fmtDate(t.date)}</td><td style={{...C.td,fontSize:10,color:'#A78BFA'}}>{t.matter_id}</td><td style={C.td}>{m?.client||'—'}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{trustAccounts.find(a=>a.id===t.trust_account_id)?.name||'Trust'}</td><td style={{...C.td,fontSize:10,color:'#8DC63F'}}>{t.to_account}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{t.invoice_id||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#4A90D9',textAlign:'right'}}>{fmtR(t.amount)}</td></tr>); })}</tbody></table></div>)}
          </div>)}
        </div>)}

        {tab==='wip'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Work In Progress — WIP Report</div><div style={{fontSize:11,color:'#444'}}>Billable work not yet invoiced · {new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div></div>
            <button style={C.btn()} onClick={loadData}>↻ Refresh</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
            {[{l:'Attorneys with unbilled work',v:wipData.length,s:'need to invoice'},{l:'Total unbilled units',v:wipData.reduce((s,p)=>s+p.unbilledUnits,0),s:'across all matters'},{l:'Total unbilled value',v:`R${wipData.reduce((s,p)=>s+p.estValue,0).toLocaleString()}`,s:'excl. VAT',a:true}].map(({l,v,s,a})=>(<div key={l} style={C.stat(false,a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
          </div>
          {!wipData.length?(<div style={{...C.card,textAlign:'center',padding:'40px',color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>✅</div><div style={{fontSize:14}}>All billable work has been invoiced</div></div>):wipData.map(p=>(<div key={p.id} style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}><div><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{p.full_name}</div><div style={{fontSize:10,color:'#555'}}>{branches.find(b=>b.id===p.branch_id)?.name||'—'} · R{p.attyRate}/unit</div></div><div style={{display:'flex',gap:16}}><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Earned</div><div style={{fontSize:16,fontWeight:700,color:'#888'}}>{p.earnedUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Billed</div><div style={{fontSize:16,fontWeight:700,color:'#8DC63F'}}>{p.billedUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Unbilled</div><div style={{fontSize:16,fontWeight:700,color:'#EAB308'}}>{p.unbilledUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Est. Value</div><div style={{fontSize:16,fontWeight:700,color:'#EAB308'}}>R{p.estValue.toLocaleString()}</div></div></div></div>
            {p.wipMatters.length>0&&(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Units Earned','Units Billed','Unbilled','Est. Value'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{p.wipMatters.map((m,i)=>(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.matterId}</td><td style={{...C.td,color:'#C8C8C8'}}>{m.matter?.client||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{m.units}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{m.billedUnits||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#EAB308',fontWeight:700}}>{m.unbilled}</td><td style={{...C.td,fontFamily:'monospace',color:'#EAB308',fontWeight:700}}>R{(m.unbilled*p.attyRate).toLocaleString()}</td></tr>))}</tbody></table>)}
          </div>))}
        </div>)}

        {tab==='invoices'&&(<div style={C.main}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:14}}>All Invoices — Motsoeneng Bill</div>
          <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice ID','Client','Matter ID','Attorney','Period','Units','Rate','Excl. VAT','Incl. VAT 15%'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!invoices.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333'}}>No invoices yet</td></tr>}{invoices.map(inv=>(<tr key={inv.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td><td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td><td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{inv.matter_id}</td><td style={{...C.td,color:'#777'}}>{inv.attorney}</td><td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:600}}>{inv.total_units}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>R{inv.rate}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)).toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td></tr>))}{invoices.length>0&&(<tr style={{background:'rgba(141,198,63,0.05)'}}><td colSpan={7} style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>TOTAL</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{invoices.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0).toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{(invoices.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0)*1.15).toFixed(2)}</td></tr>)}</tbody></table></div>
        </div>)}
      </div>
    </>
  );
}
