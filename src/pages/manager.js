import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchManagerSummary, fetchInvoices, fetchInvoicePayments, saveInvoicePayment, deleteInvoicePayment, fetchClients, fetchAllFicaRecords, fetchDisbursements, saveDisbursement, deleteDisbursement, fetchFeeSchedules, saveFeeSchedule, saveInvoice, fetchCreditNotes, saveCreditNote, writeOffInvoice, undoWriteOff, fetchMatterNotes, saveMatterNote, deleteMatterNote, fetchUndertakings, saveUndertaking, fulfillUndertaking, deleteUndertaking, fetchClientCommunications, saveClientCommunication, deleteClientCommunication, fetchAuditLog, logAudit, saveInterestCharge, updateMatter } from '../lib/supabase';
import NavBar from '../components/NavBar';

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
  const [histLoading,setHistLoading]     = useState(false);
  const [histData,setHistData]           = useState(()=>{
    const y=new Date().getFullYear();
    return Array.from({length:12},(_,i)=>({month:`${y}-${String(i+1).padStart(2,'0')}`,sessions:0,total_seconds:0,billable_seconds:0,billable_units:0}));
  });
  const [selMonth,setSelMonth]           = useState(null);
  const [monthActs,setMonthActs]         = useState([]);
  const [trustTxns,setTrustTxns]         = useState([]);
  const [trustBalances,setTrustBalances] = useState({});
  const [pendingPayments,setPendingPayments] = useState([]);
  const [trustAlert,setTrustAlert]       = useState({msg:'',type:''});
  const [matters,setMatters]             = useState([]);
  const [invoicePayments,setInvoicePayments] = useState([]);
  const [payForm,setPayForm]             = useState({invoiceId:'',amount:'',paymentDate:todayStr,reference:'',narration:''});
  const [showPayForm,setShowPayForm]     = useState(false);
  const [clients,setClients]             = useState([]);
  const [ficaRecords,setFicaRecords]     = useState([]);
  const [disbursements,setDisbursements] = useState([]);
  const [feeSchedules,setFeeSchedules]   = useState([]);
  const [disbForm,setDisbForm]           = useState({matter_id:'',date:todayStr,category:'copies',description:'',amount:'',quantity:1,vat_applicable:false,reference:''});
  const [showDisbForm,setShowDisbForm]   = useState(false);
  const [bulkSelAtty,setBulkSelAtty]     = useState([]);
  const [bulkProgress,setBulkProgress]   = useState('');
  const [schedForm,setSchedForm]         = useState({name:'',unit_rate:150,description:'',is_default:false});
  const [showSchedForm,setShowSchedForm] = useState(false);
  const [showInvite,setShowInvite]       = useState(false);
  const [inviteForm,setInviteForm]       = useState({fullName:'',email:'',role:'attorney',branchId:''});
  const [inviting,setInviting]           = useState(false);
  const [inviteMsg,setInviteMsg]         = useState({msg:'',type:''});
  const rate = 150;
  const [overviewPeriod, setOverviewPeriod] = useState('day');
  const [creditNotes,setCreditNotes]       = useState([]);
  const [showCNForm,setShowCNForm]         = useState(false);
  const [cnInvoice,setCnInvoice]           = useState(null);
  const [cnForm,setCnForm]                 = useState({amount:'',reason:''});
  const [savingCN,setSavingCN]             = useState(false);
  const [emailingInv,setEmailingInv]       = useState(null);
  const [undertakings,setUndertakings]     = useState([]);
  const [showUTForm,setShowUTForm]         = useState(false);
  const [utForm,setUtForm]                 = useState({matter_id:'',direction:'given',description:'',given_to:'',due_date:'',notes:''});
  const [communications,setCommunications] = useState([]);
  const [showCommForm,setShowCommForm]     = useState(false);
  const [commForm,setCommForm]             = useState({client_id:'',matter_id:'',comm_type:'call',direction:'outbound',subject:'',body:'',comm_date:new Date().toLocaleDateString('en-CA')});
  const [auditLogs,setAuditLogs]           = useState([]);
  const [auditLoading,setAuditLoading]     = useState(false);
  const [mgrNotesMatter,setMgrNotesMatter] = useState(null);
  const [mgrNotesMap,setMgrNotesMap]       = useState({});
  const [mgrNoteText,setMgrNoteText]       = useState('');
  const [mgrNoteType,setMgrNoteType]       = useState('general');
  const [savingMgrNote,setSavingMgrNote]   = useState(false);
  const [vatPeriod,setVatPeriod]           = useState(new Date().toLocaleDateString('en-CA').substring(0,7));
  const [closingMatter,setClosingMatter]   = useState(null);
  const [closureForm,setClosureForm]       = useState({closure_notes:''});
  const [perfAtty,setPerfAtty]             = useState('all');
  const [perfYear,setPerfYear]             = useState(new Date().getFullYear());
  const [courtFilter,setCourtFilter]       = useState('');
  const [selTemplate,setSelTemplate]       = useState('');

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
    const [sumRes,profRes,invRes,branchRes,trustRes,matRes,payRes,cliRes,ficaRes,disbRes,schedRes] = await Promise.all([
      fetchManagerSummary(selDate),
      fetchAllProfiles(),
      fetchInvoices(null),
      supabase.from('branches').select('*').eq('is_active',true).order('name'),
      supabase.from('trust_transactions').select('*').order('date',{ascending:false}),
      supabase.from('matters').select('*').order('created_at',{ascending:false}),
      fetchInvoicePayments(),
      fetchClients({}),
      fetchAllFicaRecords(),
      fetchDisbursements({ all:true }),
      fetchFeeSchedules(),
    ]);
    if(sumRes.summary)   setSummary(sumRes.summary);
    if(sumRes.allTime)   setAllTime(sumRes.allTime);
    if(profRes.profiles) setProfiles(profRes.profiles);
    if(invRes.invoices)  setInvoices(invRes.invoices||[]);
    setInvoicePayments(payRes.payments||[]);
    setClients(cliRes.clients||[]);
    setFicaRecords(ficaRes.records||[]);
    setDisbursements(disbRes.disbursements||[]);
    setFeeSchedules(schedRes.schedules||[]);
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
    if(tab==='undertakings'&&!loading) fetchUndertakings({}).then(r=>setUndertakings(r.undertakings||[]));
    if(tab==='communications'&&!loading) fetchClientCommunications({}).then(r=>setCommunications(r.communications||[]));
    if(tab==='audit'&&!loading){ setAuditLoading(true); fetchAuditLog({}).then(r=>{setAuditLogs(r.logs||[]);setAuditLoading(false);}); }
  },[tab,loading]);


  useEffect(()=>{
    if(tab!=='history') return;
    const fetchHist=async()=>{
      setHistLoading(true);
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
      setHistLoading(false);
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
  async function handleSaveCreditNote(){ if(!cnForm.amount||!cnForm.reason.trim()||!cnInvoice) return; setSavingCN(true); const{error}=await saveCreditNote({invoiceId:cnInvoice.id,client:cnInvoice.client,matterId:cnInvoice.matter_id,amount:cnForm.amount,reason:cnForm.reason},profile?.id); setSavingCN(false); if(error){showAlert('Error: '+error.message,'error');return;} const{creditNotes:cn}=await fetchCreditNotes(null); setCreditNotes(cn); setShowCNForm(false);setCnInvoice(null);setCnForm({amount:'',reason:''});showAlert('✓ Credit note issued.'); await logAudit('credit_note_issued','invoice',cnInvoice.id,{amount:cnForm.amount,reason:cnForm.reason},profile?.id); }
  async function handleEmailInvoice(inv,customEmail){ setEmailingInv(inv.id); const res=await fetch('/api/send-invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:inv.id,recipientEmail:customEmail||''})}); const data=await res.json(); setEmailingInv(null); if(!res.ok){showAlert('Could not send: '+(data.error||'Unknown error'),'error');return;} showAlert(data.warning||`✓ Invoice emailed to ${data.sentTo}`); await logAudit('invoice_emailed','invoice',inv.id,{sentTo:customEmail},profile?.id); }

  async function loadMgrNotes(matterId){ const{notes}=await fetchMatterNotes(matterId); setMgrNotesMap(m=>({...m,[matterId]:notes})); }
  async function handleSaveMgrNote(matterId){ if(!mgrNoteText.trim()) return; setSavingMgrNote(true); const{data,error}=await saveMatterNote({matterId,note:mgrNoteText.trim(),noteType:mgrNoteType},profile?.id); setSavingMgrNote(false); if(error) return; setMgrNoteText(''); setMgrNotesMap(m=>({...m,[matterId]:[data,...(m[matterId]||[])]})); }
  async function handleSaveUndertaking(){ if(!utForm.description.trim()||!utForm.matter_id) return; const{error}=await saveUndertaking({...utForm},profile?.id); if(error){showAlert('Error: '+error.message,'error');return;} showAlert('✓ Undertaking saved.'); setShowUTForm(false); setUtForm({matter_id:'',direction:'given',description:'',given_to:'',due_date:'',notes:''}); const{undertakings:ut}=await fetchUndertakings({}); setUndertakings(ut); await logAudit('undertaking_created','matter',utForm.matter_id,{description:utForm.description},profile?.id); }
  async function handleSaveComm(){ if(!commForm.body.trim()) return; const{error}=await saveClientCommunication({...commForm},profile?.id); if(error){showAlert('Error: '+error.message,'error');return;} showAlert('✓ Communication logged.'); setShowCommForm(false); setCommForm({client_id:'',matter_id:'',comm_type:'call',direction:'outbound',subject:'',body:'',comm_date:new Date().toLocaleDateString('en-CA')}); const{communications:co}=await fetchClientCommunications({}); setCommunications(co); await logAudit('communication_logged','client',commForm.client_id,{type:commForm.comm_type},profile?.id); }
  async function handleCloseMatter(m){ if(!closureForm.closure_notes.trim()){showAlert('Please add closure notes.','error');return;} const{error}=await updateMatter(m.id,{status:'closed',closure_notes:closureForm.closure_notes,closed_at:new Date().toISOString(),closed_by:profile?.id}); if(error){showAlert('Error: '+error.message,'error');return;} showAlert(`✓ Matter ${m.id} closed.`); setClosingMatter(null); setClosureForm({closure_notes:''}); load(); await logAudit('matter_closed','matter',m.id,{notes:closureForm.closure_notes},profile?.id); }
  async function handleAddInterest(inv){ const age=Math.floor((new Date()-new Date(inv.created_at||0))/86400000); const rate=10.5; const outstanding=Math.max(0,(inv.total_units||0)*(inv.rate||150)*1.15-invoicePayments.filter(p=>p.invoice_id===inv.id).reduce((s,p)=>s+Number(p.amount),0)); const interest=parseFloat((outstanding*(rate/100)*(age/365)).toFixed(2)); if(interest<=0){showAlert('No interest due — invoice is not overdue.','error');return;} if(!confirm(`Add R${interest} interest charge (${rate}% p.a. × ${age} days) to invoice ${inv.id}?`)) return; const{error}=await saveInterestCharge({invoiceId:inv.id,amount:interest,ratePercent:rate,daysOverdue:age},profile?.id); if(error){showAlert('Error: '+error.message,'error');return;} showAlert(`✓ Interest charge of R${interest} added.`); await logAudit('interest_charged','invoice',inv.id,{amount:interest,days:age},profile?.id); }
  async function sendOverdueReminders(){ const now=new Date(); const overdue=invoices.filter(inv=>{ const age=Math.floor((now-new Date(inv.created_at||0))/86400000); const paid=invoicePayments.filter(p=>p.invoice_id===inv.id).reduce((s,p)=>s+Number(p.amount),0); return age>30&&Math.max(0,(inv.total_units||0)*(inv.rate||150)*1.15-paid)>0&&!inv.written_off; }); if(!overdue.length){showAlert('No overdue invoices to remind.','error');return;} let sent=0; for(const inv of overdue){ const res=await fetch('/api/send-invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:inv.id,type:'reminder'})}); if(res.ok) sent++; } showAlert(`✓ Sent ${sent} overdue reminders.`); }
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
    const periodBill=periodP.filter(a=>a.is_billable);
    const attyInvs=getPeriodInvoices(invoices).filter(i=>i.user_id===p.id);
    const billedU=attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
    const allUnits=periodBill.reduce((s,a)=>s+(a.billing_units||0),0);
    const mMap={};
    periodBill.forEach(a=>{if(!a.matter)return;if(!mMap[a.matter])mMap[a.matter]={units:0,billedUnits:0};mMap[a.matter].units+=a.billing_units||0;});
    attyInvs.forEach(i=>{if(!i.matter_id)return;if(!mMap[i.matter_id])mMap[i.matter_id]={units:0,billedUnits:0};mMap[i.matter_id].billedUnits+=i.total_units||0;});
    const unbilledU=Object.values(mMap).reduce((s,m)=>s+Math.max(0,m.units-m.billedUnits),0)+periodBill.filter(a=>!a.matter).reduce((s,a)=>s+(a.billing_units||0),0);
    const br=branches.find(b=>b.id===p.branch_id);
    return{...p,branch_name:br?.name||'—',total_sec:periodP.reduce((s,a)=>s+(a.duration_seconds||0),0),bill_sec:periodBill.reduce((s,a)=>s+(a.duration_seconds||0),0),all_units:allUnits,billed_units:billedU,unbilled_units:unbilledU,invoiceCount:attyInvs.length};
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
        <NavBar
          role={isBranchManager?'branch_manager':'manager'}
          tab={tab}
          setTab={setTab}
          profile={profile}
          clock={clock}
          onSignOut={async()=>{await signOut();router.replace('/login');}}
          pendingCount={pendingPayments.length}
          ficaCount={(()=>{const fm=Object.fromEntries(ficaRecords.map(r=>[r.client_id,r]));return clients.filter(c=>{const r=fm[c.id];return!r||r.fica_status==='pending'||r.fica_status==='expired';}).length;})()}
        />

{trustAlert.msg&&(<div style={{background:trustAlert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${trustAlert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'14px 24px',fontSize:12,color:trustAlert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
  <span style={{flex:1}}>{trustAlert.msg}</span>
  {trustAlert.type==='success'&&trustAlert.msg.includes('Temporary password:')&&(
    <button style={{background:'rgba(141,198,63,0.2)',border:'1px solid rgba(141,198,63,0.4)',color:'#8DC63F',padding:'4px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={()=>{ const pwd=trustAlert.msg.match(/Temporary password: ([^\s—]+)/)?.[1]; if(pwd){navigator.clipboard.writeText(pwd);} }}>📋 Copy Password</button>
  )}
  <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',flexShrink:0}} onClick={()=>setTrustAlert({msg:'',type:''})}>✕</button>
</div>)}
        {pendingPayments.length>0&&tab!=='trust'&&(<div style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.3)',padding:'10px 24px',fontSize:12,color:'#EAB308',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>⏳ {pendingPayments.length} trust payment{pendingPayments.length>1?'s':''} pending your approval — {fmtR(pendingPayments.reduce((s,t)=>s+Number(t.amount),0))}</span><button style={C.btn('warn')} onClick={()=>setTab('trust')}>Review approvals →</button></div>)}
        {(()=>{ const ficaMap=Object.fromEntries(ficaRecords.map(r=>[r.client_id,r])); const pending=clients.filter(c=>{ const r=ficaMap[c.id]; return !r||r.fica_status==='pending'||r.fica_status==='expired'; }).length; return pending>0&&tab!=='clients'?(<div style={{background:'rgba(220,80,80,0.08)',border:'1px solid rgba(220,80,80,0.25)',padding:'10px 24px',fontSize:12,color:'#E05252',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>🪪 {pending} client{pending!==1?'s':''} with FICA pending or expired</span><button style={{...C.btn('r'),fontSize:11}} onClick={()=>setTab('clients')}>Review →</button></div>):null; })()}

        {tab==='overview'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Overview — Motsoeneng Bill</div><div style={{fontSize:11,color:'#444'}}>{overviewPeriod==='day'?fdate(selDate):overviewPeriod==='week'?'This week':overviewPeriod==='month'?new Date(selDate.substring(0,7)+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'}):'All time'} · {profiles.length} staff · {branches.length} branches</div></div>
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
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['#','Attorney','Branch','Billable Time','Units Earned','Target','Performance','Units Billed','Unbilled','Invoices'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!byAtty.length&&<tr><td colSpan={10} style={{padding:'30px',textAlign:'center',color:'#333',fontSize:13}}>No data yet.</td></tr>}{byAtty.map((a,i)=>{const target=a.monthly_target||0;const pct=target>0?Math.round((a.all_units/target)*100):null;const perfColor=pct===null?'#555':pct>=100?'#8DC63F':pct>=70?'#EAB308':'#E05252';return(<tr key={a.id}><td style={{...C.td,color:'#444',fontWeight:600,width:28}}>{i+1}</td><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}<div style={{fontSize:9,color:'#444'}}>{a.email}</div></td><td style={{...C.td,fontSize:10}}><span style={{background:'rgba(74,144,217,0.1)',color:'#4A90D9',padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:600}}>{a.branch_name}</span></td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{toHm(a.bill_sec)||'0m'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.all_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#555'}}>{target>0?target:'—'}</td><td style={C.td}>{pct!==null?(<div style={{display:'flex',alignItems:'center',gap:6}}><div style={{flex:1,height:6,background:'#1A1A1A',borderRadius:3}}><div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:perfColor,borderRadius:3}}/></div><span style={{fontSize:10,color:perfColor,fontWeight:700,minWidth:35}}>{pct}%</span></div>):<span style={{color:'#333',fontSize:10}}>No target</span>}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{a.billed_units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:a.unbilled_units>0?'#EAB308':'#444'}}>{a.unbilled_units>0?a.unbilled_units:'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>{a.invoiceCount}</td></tr>);})}</tbody></table></div>
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
    <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm History</div><div style={{fontSize:11,color:'#444'}}>{histLoading?'Loading…':'Click a month to see attorney billing details'}</div></div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <select style={C.sel} value={histYear} onChange={e=>{setHistYear(Number(e.target.value));setSelMonth(null);setMonthActs([]);}}>{[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
      <select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}><option value="all">All attorneys</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
    </div>
  </div>
  {!histLoading&&histData.every(m=>m.sessions===0)&&(<div style={{...C.card,textAlign:'center',padding:'30px 20px',marginBottom:14}}><div style={{fontSize:22,marginBottom:8}}>📊</div><div style={{fontSize:13,color:'#555',marginBottom:4}}>No activity data for {histYear}</div><div style={{fontSize:11,color:'#333'}}>Activities tracked by the Electron agent will appear here once attorneys start recording time.</div></div>)}
  {monthBars.length>0&&(<div style={{...C.card,marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>Billing units by month — {histYear}</div><BarChart data={monthBars} height={130}/></div>)}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
    {histData.map(m=>{
      const isSelected=selMonth===m.month;
      const hasFuture=new Date(m.month+'-01')>new Date();
      const revenue=(m.billable_units||0)*rate*1.15;
      return(<div key={m.month} style={{background:isSelected?'rgba(141,198,63,0.08)':m.sessions?'#111':'#0D0D0D',border:`1px solid ${isSelected?'rgba(141,198,63,0.4)':m.sessions?'#1A1A1A':'#131313'}`,borderRadius:8,padding:14,cursor:m.sessions?'pointer':'default',opacity:hasFuture?0.4:1}} onClick={()=>m.sessions&&loadMonth(m.month,selAtty==='all'?null:selAtty)}>
        <div style={{fontSize:12,fontWeight:600,color:m.sessions?'#D0D0D0':'#333',marginBottom:6}}>{new Date(m.month+'-01T12:00:00').toLocaleString('en-ZA',{month:'long'})}</div>
        {m.sessions?(<>
          <div style={{fontSize:20,fontWeight:800,color:'#8DC63F',marginBottom:2}}>{m.billable_units||0} units</div>
          <div style={{fontSize:11,color:'#4A90D9',fontWeight:600,marginBottom:2}}>R{revenue.toLocaleString()}</div>
          <div style={{fontSize:10,color:'#555'}}>est. incl. VAT</div>
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
        <thead><tr>{['Attorney','Billable Time','Units Earned','Est. Revenue (incl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>{attyList.map((a,i)=>(<tr key={i}>
          <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.name}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{toHm(a.billSec)}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.units}</td>
          <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>R{(a.units*rate*1.15).toFixed(2)}</td>
        </tr>))}
        <tr style={{background:'#0D0D0D'}}>
          <td style={{...C.th,paddingTop:12}}>Total</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>{toHm(attyList.reduce((s,a)=>s+a.billSec,0))}</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>{attyList.reduce((s,a)=>s+a.units,0)}</td>
          <td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>R{(attyList.reduce((s,a)=>s+a.units,0)*rate*1.15).toFixed(2)}</td>
        </tr></tbody>
      </table>);
    })()}
  </div>)}
</div>)}

        {tab==='wip'&&(<div style={C.main}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
    <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Work In Progress — WIP Report</div><div style={{fontSize:11,color:'#444'}}>Billable work not yet invoiced · {new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div></div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}><select style={C.sel} value={selBranch} onChange={e=>setSelBranch(e.target.value)}><option value="all">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select style={C.sel} value={selAtty} onChange={e=>setSelAtty(e.target.value)}><option value="all">All attorneys</option>{filteredProfiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
  </div>
  {(()=>{
    const wipData=filteredProfiles.map(p=>{
      const attyActs=allTime.filter(a=>a.user_id===p.id&&a.is_billable);
      const attyInvs=invoices.filter(i=>i.user_id===p.id);
      const earnedUnits=attyActs.reduce((s,a)=>s+(a.billing_units||0),0);
      const billedUnits=attyInvs.reduce((s,i)=>s+(i.total_units||0),0);
      const attyRate=p.rate||150;
      const matterMap={};
      attyActs.forEach(a=>{ if(!a.matter) return; if(!matterMap[a.matter]) matterMap[a.matter]={matterId:a.matter,units:0,billedUnits:0}; matterMap[a.matter].units+=a.billing_units||0; });
      attyInvs.forEach(i=>{ if(!i.matter_id) return; if(!matterMap[i.matter_id]) matterMap[i.matter_id]={matterId:i.matter_id,units:0,billedUnits:0}; matterMap[i.matter_id].billedUnits+=i.total_units||0; });
      const wipMatters=Object.values(matterMap).map(m=>({...m,unbilled:Math.max(0,m.units-m.billedUnits),matter:matters.find(x=>x.id===m.matterId)})).filter(m=>m.unbilled>0);
      const unassignedUnits=attyActs.filter(a=>!a.matter).reduce((s,a)=>s+(a.billing_units||0),0);
      if(unassignedUnits>0) wipMatters.push({matterId:'—',units:unassignedUnits,billedUnits:0,unbilled:unassignedUnits,matter:{client:'⚠ No matter assigned — needs attention'}});
      const totalUnbilled=wipMatters.reduce((s,m)=>s+m.unbilled,0);
      return{...p,earnedUnits,billedUnits,unbilledUnits:totalUnbilled,estValue:totalUnbilled*attyRate,attyRate,wipMatters};
    }).filter(p=>p.unbilledUnits>0).sort((a,b)=>b.estValue-a.estValue);
    const totalUnbilled=wipData.reduce((s,p)=>s+p.unbilledUnits,0);
    const totalValue=wipData.reduce((s,p)=>s+p.estValue,0);
    return(<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        {[{l:'Attorneys with unbilled work',v:wipData.length,s:'need to invoice'},{l:'Total unbilled units',v:totalUnbilled,s:'across all matters'},{l:'Total unbilled value',v:`R${totalValue.toLocaleString()}`,s:'excl. VAT',a:true}].map(({l,v,s,a})=>(<div key={l} style={C.stat(false,a)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
      </div>
      {!wipData.length?(<div style={{...C.card,textAlign:'center',padding:'40px',color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>✅</div><div style={{fontSize:14}}>All billable work has been invoiced</div><div style={{fontSize:11,color:'#444',marginTop:6}}>No outstanding WIP</div></div>):wipData.map(p=>(<div key={p.id} style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}><div><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{p.full_name}</div><div style={{fontSize:10,color:'#555'}}>{p.email} · {branches.find(b=>b.id===p.branch_id)?.name||'—'}</div></div><div style={{display:'flex',gap:16,alignItems:'center'}}><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Earned</div><div style={{fontSize:16,fontWeight:700,color:'#888'}}>{p.earnedUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Billed</div><div style={{fontSize:16,fontWeight:700,color:'#8DC63F'}}>{p.billedUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Unbilled</div><div style={{fontSize:16,fontWeight:700,color:'#EAB308'}}>{p.unbilledUnits}</div></div><div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Est. Value</div><div style={{fontSize:16,fontWeight:700,color:'#EAB308'}}>R{p.estValue.toLocaleString()}</div></div></div></div>
        {p.wipMatters.length>0&&(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Client','Units Earned','Units Billed','Unbilled','Est. Value (excl. VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{p.wipMatters.map((m,i)=>(<tr key={i}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{m.matterId}</td><td style={{...C.td,color:'#C8C8C8'}}>{m.matter?.client||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#888'}}>{m.units}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{m.billedUnits||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#EAB308',fontWeight:700}}>{m.unbilled}</td><td style={{...C.td,fontFamily:'monospace',color:'#EAB308',fontWeight:700}}>R{(m.unbilled*p.attyRate).toLocaleString()}</td></tr>))}</tbody></table>)}
      </div>))}
    </>);
  })()}
</div>)}

        {tab==='debtors'&&(<div style={C.main}>
  {(()=>{
    const now=new Date();
    const age=inv=>Math.floor((now-new Date(inv.created_at||0))/86400000);
    const paid=invId=>invoicePayments.filter(p=>p.invoice_id===invId).reduce((s,p)=>s+Number(p.amount),0);
    const outstanding=inv=>Math.max(0,(inv.total_units||0)*(inv.rate||150)*1.15-paid(inv.id));
    const bucket=a=>a<=30?'0-30':a<=60?'31-60':a<=90?'61-90':a<=120?'91-120':'120+';
    const buckets={'0-30':{label:'Current (0–30 days)',color:'#8DC63F',invs:[]},'31-60':{label:'30–60 days',color:'#4A90D9',invs:[]},'61-90':{label:'60–90 days',color:'#EAB308',invs:[]},'91-120':{label:'90–120 days',color:'#E07B30',invs:[]},'120+':{label:'120+ days',color:'#E05252',invs:[]}};
    const unpaidInvs=invoices.filter(inv=>outstanding(inv)>0);
    unpaidInvs.forEach(inv=>{const b=bucket(age(inv));if(buckets[b])buckets[b].invs.push(inv);});
    const totalOut=unpaidInvs.reduce((s,inv)=>s+outstanding(inv),0);
    const clientMap={};
    unpaidInvs.forEach(inv=>{const k=inv.client||'Unknown';if(!clientMap[k])clientMap[k]={client:k,total:0,invs:[]};clientMap[k].total+=outstanding(inv);clientMap[k].invs.push(inv);});
    const clients=Object.values(clientMap).sort((a,b)=>b.total-a.total);
    return(<>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Debtors Age Analysis</div><div style={{fontSize:11,color:'#444'}}>Outstanding invoices · {new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
        <button style={C.btn('p')} onClick={()=>{setPayForm({invoiceId:'',amount:'',paymentDate:todayStr,reference:'',narration:''});setShowPayForm(true);}}>+ Record Payment</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>
        {Object.entries(buckets).map(([k,b])=>{const tot=b.invs.reduce((s,inv)=>s+outstanding(inv),0);return(<div key={k} style={C.stat(false,tot>0)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>{b.label}</div><div style={{fontSize:18,fontWeight:800,color:tot>0?b.color:'#333'}}>{fmtR(tot)}</div><div style={{fontSize:10,color:'#444'}}>{b.invs.length} invoice{b.invs.length!==1?'s':''}</div></div>);})}
      </div>
      <div style={{...C.card,marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>Outstanding by Client</div><div style={{fontSize:13,fontWeight:700,color:'#EAB308'}}>{fmtR(totalOut)} total outstanding</div></div>
        {!clients.length?<div style={{textAlign:'center',padding:30,color:'#555',fontSize:12}}>✅ All invoices paid</div>:
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Client','Invoices','0–30','31–60','61–90','90–120','120+','Total Outstanding'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
          {clients.map(c=>{
            const bkts={'0-30':0,'31-60':0,'61-90':0,'91-120':0,'120+':0};
            c.invs.forEach(inv=>{const b=bucket(age(inv));bkts[b]+=outstanding(inv);});
            return(<tr key={c.client}>
              <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{c.client}</td>
              <td style={{...C.td,fontFamily:'monospace',color:'#777',textAlign:'center'}}>{c.invs.length}</td>
              {Object.entries(bkts).map(([k,v])=><td key={k} style={{...C.td,fontFamily:'monospace',color:v>0?buckets[k].color:'#333',fontWeight:v>0?700:400}}>{v>0?fmtR(v):'—'}</td>)}
              <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#EAB308'}}>{fmtR(c.total)}</td>
            </tr>);
          })}
        </tbody></table>}
      </div>
      <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Invoice Detail</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice','Client','Matter','Date','Age','Invoice Amt','Paid','Outstanding','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
          {!unpaidInvs.length&&<tr><td colSpan={9} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No outstanding invoices</td></tr>}
          {unpaidInvs.sort((a,b)=>age(b)-age(a)).map(inv=>{const a=age(inv),p=paid(inv.id),o=outstanding(inv),amt=(inv.total_units||0)*(inv.rate||150)*1.15;return(<tr key={inv.id} style={{opacity:inv.written_off?0.5:1}}>
            <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}{inv.written_off&&<span style={{marginLeft:6,fontSize:9,color:'#555',border:'1px solid #252525',borderRadius:20,padding:'1px 6px'}}>W/O</span>}</td>
            <td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{inv.matter_id||'—'}</td>
            <td style={{...C.td,fontSize:10,color:'#666'}}>{fmtDate(inv.created_at?.substring(0,10))}</td>
            <td style={{...C.td,fontFamily:'monospace',color:buckets[bucket(a)].color,fontWeight:700}}>{a}d</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{fmtR(amt)}</td>
            <td style={{...C.td,fontFamily:'monospace',color:p>0?'#8DC63F':'#333'}}>{p>0?fmtR(p):'—'}</td>
            <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#EAB308'}}>{fmtR(o)}</td>
            <td style={{...C.td}}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              <button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} disabled={emailingInv===inv.id} onClick={()=>{const em=prompt('Send to email:',inv.client_email||'');if(em===null)return;handleEmailInvoice(inv,em);}}>{emailingInv===inv.id?'…':'✉'}</button>
              <button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={()=>{setCnInvoice(inv);setCnForm({amount:'',reason:''});setShowCNForm(true);}}>CN</button>
              {!inv.written_off?<button style={{...C.btn('warn'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{const r=prompt('Write-off reason:');if(!r)return;await writeOffInvoice(inv.id,r,profile?.id);load();}}>W/O</button>:<button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={async()=>{await undoWriteOff(inv.id);load();}}>Undo</button>}
            </div></td>
          </tr>);})}
        </tbody></table>
      </div>
    </>);
  })()}
  {showPayForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowPayForm(false)}>
    <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:440}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>Record Payment</div>
      {(()=>{const lbl={fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'};const inp={background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'9px 12px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};return(<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div><label style={lbl}>Invoice *</label><select style={inp} value={payForm.invoiceId} onChange={e=>setPayForm(f=>({...f,invoiceId:e.target.value}))}><option value="">— Select invoice —</option>{invoices.filter(inv=>{const p=invoicePayments.filter(x=>x.invoice_id===inv.id).reduce((s,x)=>s+Number(x.amount),0);return Math.max(0,(inv.total_units||0)*(inv.rate||150)*1.15-p)>0;}).map(inv=><option key={inv.id} value={inv.id}>{inv.id} · {inv.client} · {fmtR((inv.total_units||0)*(inv.rate||150)*1.15)}</option>)}</select></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={lbl}>Amount *</label><input style={inp} type="number" placeholder="0.00" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}/></div>
          <div><label style={lbl}>Payment Date *</label><input style={inp} type="date" value={payForm.paymentDate} onChange={e=>setPayForm(f=>({...f,paymentDate:e.target.value}))}/></div>
        </div>
        <div><label style={lbl}>Reference</label><input style={inp} type="text" placeholder="EFT ref, cheque no..." value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))}/></div>
        <div><label style={lbl}>Narration</label><input style={inp} type="text" placeholder="Payment description..." value={payForm.narration} onChange={e=>setPayForm(f=>({...f,narration:e.target.value}))}/></div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:6}}>
          <button style={C.btn()} onClick={()=>setShowPayForm(false)}>Cancel</button>
          <button style={C.btn('p')} onClick={async()=>{if(!payForm.invoiceId||!payForm.amount){showAlert('Select invoice and amount.','error');return;}const{error}=await saveInvoicePayment({invoiceId:payForm.invoiceId,amount:parseFloat(payForm.amount),paymentDate:payForm.paymentDate,reference:payForm.reference,narration:payForm.narration},profile?.id);if(error){showAlert('Error: '+error.message,'error');return;}showAlert('✓ Payment recorded.');setShowPayForm(false);load();}}>Record Payment</button>
        </div>
      </div>);})()}
    </div>
  </div>)}
</div>)}

        {tab==='reports'&&(<div style={C.main}>
  {(()=>{
    const now=new Date();
    const paid=invId=>invoicePayments.filter(p=>p.invoice_id===invId).reduce((s,p)=>s+Number(p.amount),0);
    const monthMap={};
    invoices.forEach(inv=>{
      const month=inv.created_at?.substring(0,7);if(!month)return;
      if(!monthMap[month])monthMap[month]={month,invoiced:0,collected:0,units:0,count:0};
      const amt=(inv.total_units||0)*(inv.rate||150)*1.15;
      monthMap[month].invoiced+=amt;monthMap[month].collected+=paid(inv.id);
      monthMap[month].units+=inv.total_units||0;monthMap[month].count++;
    });
    const months=Object.values(monthMap).sort((a,b)=>b.month.localeCompare(a.month));
    const totalInvoiced=months.reduce((s,m)=>s+m.invoiced,0);
    const totalCollected=months.reduce((s,m)=>s+m.collected,0);
    const totalOutstanding=totalInvoiced-totalCollected;
    const attyRev=filteredProfiles.map(p=>{const inv=invoices.filter(i=>i.user_id===p.id);const invAmt=inv.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150)*1.15,0);const coll=inv.reduce((s,i)=>s+paid(i.id),0);return{...p,invoiced:invAmt,collected:coll,outstanding:invAmt-coll,units:inv.reduce((s,i)=>s+(i.total_units||0),0)};}).sort((a,b)=>b.invoiced-a.invoiced);
    return(<>
      <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>Financial Reports — Motsoeneng Bill</div>
      <div style={{fontSize:11,color:'#444',marginBottom:14}}>Revenue, collections and WIP summary</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        {[{l:'Total Invoiced',v:fmtR(totalInvoiced),a:true},{l:'Total Collected',v:fmtR(totalCollected),a:true},{l:'Outstanding',v:fmtR(totalOutstanding),w:totalOutstanding>0},{l:'Collection Rate',v:`${totalInvoiced>0?Math.round(totalCollected/totalInvoiced*100):0}%`,a:true}].map(({l,v,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div></div>))}
      </div>
      <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Monthly Revenue — All Time</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Month','Invoices','Units','Invoiced (incl. VAT)','Collected','Outstanding','Collection %'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
          {!months.length&&<tr><td colSpan={7} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No invoice data yet</td></tr>}
          {months.map(m=>{const pct=m.invoiced>0?Math.round(m.collected/m.invoiced*100):0;return(<tr key={m.month}>
            <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{fmonth(m.month)}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#777',textAlign:'center'}}>{m.count}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{m.units}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{fmtR(m.invoiced)}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#4A90D9'}}>{m.collected>0?fmtR(m.collected):'—'}</td>
            <td style={{...C.td,fontFamily:'monospace',color:m.invoiced-m.collected>0?'#EAB308':'#555'}}>{m.invoiced-m.collected>0?fmtR(m.invoiced-m.collected):'—'}</td>
            <td style={{...C.td,fontFamily:'monospace'}}><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{flex:1,height:4,background:'#1A1A1A',borderRadius:2}}><div style={{width:`${pct}%`,height:'100%',background:pct>=80?'#8DC63F':pct>=50?'#EAB308':'#E05252',borderRadius:2}}/></div><span style={{fontSize:10,color:'#888',minWidth:30}}>{pct}%</span></div></td>
          </tr>);})}
          {months.length>0&&<tr style={{background:'rgba(141,198,63,0.05)'}}><td style={{...C.th,paddingTop:12}} colSpan={3}>TOTAL</td><td style={{...C.th,fontFamily:'monospace',color:'#8DC63F',paddingTop:12}}>{fmtR(totalInvoiced)}</td><td style={{...C.th,fontFamily:'monospace',color:'#4A90D9',paddingTop:12}}>{fmtR(totalCollected)}</td><td style={{...C.th,fontFamily:'monospace',color:'#EAB308',paddingTop:12}}>{fmtR(totalOutstanding)}</td><td style={{...C.th,paddingTop:12}}>{totalInvoiced>0?Math.round(totalCollected/totalInvoiced*100):0}%</td></tr>}
        </tbody></table>
      </div>
      <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Revenue Summary</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Attorney','Branch','Units Billed','Total Invoiced','Collected','Outstanding'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
          {attyRev.map(a=><tr key={a.id}><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{a.full_name}</td><td style={{...C.td,fontSize:10}}><span style={{background:'rgba(74,144,217,0.1)',color:'#4A90D9',padding:'2px 8px',borderRadius:20,fontSize:9}}>{branches.find(b=>b.id===a.branch_id)?.name||'—'}</span></td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{a.units||'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>{a.invoiced>0?fmtR(a.invoiced):'—'}</td><td style={{...C.td,fontFamily:'monospace',color:'#4A90D9'}}>{a.collected>0?fmtR(a.collected):'—'}</td><td style={{...C.td,fontFamily:'monospace',color:a.outstanding>0?'#EAB308':'#555'}}>{a.outstanding>0?fmtR(a.outstanding):'—'}</td></tr>)}
        </tbody></table>
      </div>
    </>);
  })()}
</div>)}

        {tab==='statements'&&(<div style={C.main}>
  {(()=>{
    const paid=invId=>invoicePayments.filter(p=>p.invoice_id===invId).reduce((s,p)=>s+Number(p.amount),0);
    const clientMap={};
    invoices.forEach(inv=>{
      const k=inv.client||'Unknown';
      if(!clientMap[k])clientMap[k]={client:k,invoices:[],billed:0,paid:0};
      const amt=(inv.total_units||0)*(inv.rate||150)*1.15;
      clientMap[k].invoices.push(inv);clientMap[k].billed+=amt;clientMap[k].paid+=paid(inv.id);
    });
    const clients=Object.values(clientMap).sort((a,b)=>b.billed-a.billed);
    function printStatement(c){
      const rows=c.invoices.map(inv=>{const p=paid(inv.id),amt=(inv.total_units||0)*(inv.rate||150),vat=amt*.15,total=amt*1.15,out=Math.max(0,total-p);return`<tr><td>${fmtDate(inv.created_at?.substring(0,10))}</td><td style="font-family:monospace">${inv.id}</td><td>${inv.matter_name||inv.matter_id||'—'}</td><td align="right">${inv.total_units||0}</td><td align="right">R${amt.toLocaleString()}</td><td align="right">R${vat.toFixed(2)}</td><td align="right">R${total.toFixed(2)}</td><td align="right" style="color:${p>0?'#16a34a':'#666'}">${p>0?'R'+p.toFixed(2):'—'}</td><td align="right" style="font-weight:700;color:${out>0?'#dc2626':'#16a34a'}">${out>0?'R'+out.toFixed(2):'PAID'}</td></tr>`;}).join('');
      const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statement — ${c.client}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;max-width:900px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #8DC63F;padding-bottom:16px;margin-bottom:20px}.logo{font-size:26px;font-weight:900;letter-spacing:-0.04em}.logo span{color:#8DC63F}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f8f8f8;padding:8px;font-size:9px;text-transform:uppercase;color:#999;border-bottom:2px solid #eee;text-align:left}td{padding:7px 8px;font-size:11px;border-bottom:1px solid #f3f3f3}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px}.lbl{font-size:9px;text-transform:uppercase;color:#aaa;margin-bottom:3px}.val{font-size:16px;font-weight:700}.foot{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#ccc;text-align:center}@media print{body{padding:20px}}</style></head><body><div class="top"><div><div class="logo">M<span>B</span></div><div style="font-size:11px;color:#999;margin-top:2px">Motsoeneng Bill Attorneys</div></div><div style="text-align:right"><h2>ACCOUNT STATEMENT</h2><div style="font-size:11px;color:#999">Client: ${c.client} · ${new Date().toLocaleDateString('en-ZA')}</div></div></div><div class="summary"><div><div class="lbl">Total Invoiced</div><div class="val">R${c.billed.toFixed(2)}</div></div><div><div class="lbl">Total Paid</div><div class="val" style="color:#16a34a">R${c.paid.toFixed(2)}</div></div><div><div class="lbl">Balance Due</div><div class="val" style="color:${c.billed-c.paid>0?'#dc2626':'#16a34a'}">${c.billed-c.paid>0?'R'+(c.billed-c.paid).toFixed(2):'PAID IN FULL'}</div></div></div><table><thead><tr><th>Date</th><th>Invoice</th><th>Matter</th><th align="right">Units</th><th align="right">Excl. VAT</th><th align="right">VAT 15%</th><th align="right">Total</th><th align="right">Paid</th><th align="right">Balance</th></tr></thead><tbody>${rows||'<tr><td colspan="9" style="text-align:center;color:#ccc;padding:16px">No invoices</td></tr>'}</tbody></table><div class="foot">Motsoeneng Bill Attorneys · VAT Reg: 4100000000 · accounts@mb.co.za<br><em>This statement was generated on ${new Date().toLocaleDateString('en-ZA')} and is subject to errors and omissions.</em></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
      const w=window.open('','_blank','width=980,height=760');w.document.write(html);w.document.close();
    }
    return(<>
      <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>Billing Statements</div>
      <div style={{fontSize:11,color:'#444',marginBottom:14}}>Per-client account statements · Print or email to clients</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        {[{l:'Total clients',v:clients.length},{l:'Total invoiced',v:fmtR(clients.reduce((s,c)=>s+c.billed,0)),a:true},{l:'Total outstanding',v:fmtR(clients.reduce((s,c)=>s+Math.max(0,c.billed-c.paid),0)),w:true}].map(({l,v,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div></div>))}
      </div>
      {!clients.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>📋</div><div>No invoices yet</div></div>):clients.map(c=>{const out=Math.max(0,c.billed-c.paid);return(<div key={c.client} style={C.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><div><div style={{fontSize:13,fontWeight:600,color:'#D0D0D0'}}>{c.client}</div><div style={{fontSize:10,color:'#555'}}>{c.invoices.length} invoice{c.invoices.length!==1?'s':''}</div></div><div style={{display:'flex',gap:16,alignItems:'center'}}><div style={{textAlign:'right'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Invoiced</div><div style={{fontSize:15,fontWeight:700,color:'#8DC63F'}}>{fmtR(c.billed)}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Paid</div><div style={{fontSize:15,fontWeight:700,color:'#4A90D9'}}>{fmtR(c.paid)}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Balance</div><div style={{fontSize:15,fontWeight:700,color:out>0?'#EAB308':'#8DC63F'}}>{out>0?fmtR(out):'Paid ✓'}</div></div><button style={C.btn('p')} onClick={()=>printStatement(c)}>Print Statement</button></div></div></div>);})}
    </>);
  })()}
</div>)}

        {tab==='clients'&&(<div style={C.main}>
  {(()=>{
    const ficaMap=Object.fromEntries(ficaRecords.map(r=>[r.client_id,r]));
    const ficaStatus=id=>{const r=ficaMap[id];if(!r)return'pending';return r.fica_status||'pending';};
    const FSTA={compliant:{label:'Compliant',color:'#8DC63F',bg:'rgba(141,198,63,0.1)'},partial:{label:'Partial',color:'#EAB308',bg:'rgba(234,179,8,0.1)'},pending:{label:'Pending',color:'#E07B30',bg:'rgba(224,123,48,0.1)'},expired:{label:'Expired',color:'#E05252',bg:'rgba(220,80,80,0.1)'}};
    return(<>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Clients</div><div style={{fontSize:11,color:'#444'}}>{clients.length} clients · Firm-wide</div></div>
        <div style={{display:'flex',gap:8}}><button style={C.btn()} onClick={()=>router.push('/clients')}>Open Full CRM →</button></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        {[{l:'Total Clients',v:clients.length},{l:'FICA Compliant',v:clients.filter(c=>ficaStatus(c.id)==='compliant').length,a:true},{l:'FICA Pending',v:clients.filter(c=>ficaStatus(c.id)==='pending').length,w:true},{l:'FICA Expired',v:clients.filter(c=>ficaStatus(c.id)==='expired').length,w:true}].map(({l,v,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w&&v>0?'#EAB308':'#F0F0F0'}}>{v}</div></div>))}
      </div>
      <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Ref','Client','Type','Email','FICA','Matters'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
        {!clients.length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No clients yet. <button style={{...C.btn('p'),fontSize:11,marginLeft:8}} onClick={()=>router.push('/clients')}>Add first client →</button></td></tr>}
        {clients.slice(0,50).map(c=>{const fs=ficaStatus(c.id);const fst=FSTA[fs]||FSTA.pending;const cm=matters.filter(m=>m.client_id===c.id);return(<tr key={c.id} style={{cursor:'pointer'}} onClick={()=>router.push('/clients')}>
          <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{c.client_no||'—'}</td>
          <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{c.full_name}</td>
          <td style={{...C.td,fontSize:10,textTransform:'capitalize',color:'#777'}}>{c.client_type||'individual'}</td>
          <td style={{...C.td,fontSize:10,color:'#555'}}>{c.email||'—'}</td>
          <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:fst.bg,color:fst.color,border:`1px solid ${fst.color}44`,fontWeight:600}}>{fst.label}</span></td>
          <td style={{...C.td,fontFamily:'monospace',textAlign:'center',color:'#777'}}>{cm.length}</td>
        </tr>);})}
      </tbody></table></div>
    </>);
  })()}
</div>)}

        {tab==='disbursements'&&(<div style={C.main}>
  {(()=>{
    const cats={copies:'📋',filing_fee:'📁',sheriff:'⚖️',travel:'🚗',counsel:'👔',search:'🔍',postage:'📮',other:'📎'};
    const unbilled=disbursements.filter(d=>d.status==='unbilled');
    const totalUnbilled=unbilled.reduce((s,d)=>s+Number(d.amount),0);
    const byMatter={};unbilled.forEach(d=>{if(!byMatter[d.matter_id])byMatter[d.matter_id]={matterId:d.matter_id,items:[],total:0};byMatter[d.matter_id].items.push(d);byMatter[d.matter_id].total+=Number(d.amount);});
    return(<>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Disbursements</div><div style={{fontSize:11,color:'#444'}}>Costs advanced — all attorneys</div></div>
        <button style={C.btn('p')} onClick={()=>{setDisbForm({matter_id:'',date:todayStr,category:'copies',description:'',amount:'',quantity:1,vat_applicable:false,reference:''});setShowDisbForm(true);}}>+ Add Disbursement</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        {[{l:'Unbilled disbursements',v:unbilled.length,s:'items'},{l:'Total unbilled',v:fmtR(totalUnbilled),s:'excl. VAT',w:totalUnbilled>0},{l:'Matters affected',v:Object.keys(byMatter).length,s:'with unbilled costs'}].map(({l,v,s,w})=>(<div key={l} style={C.stat(false,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:w&&totalUnbilled>0?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
      </div>
      <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All Disbursements</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Cat','Date','Matter','Description','Qty','Amount','Status','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
          {!disbursements.length&&<tr><td colSpan={8} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No disbursements yet</td></tr>}
          {disbursements.map(d=>(<tr key={d.id}>
            <td style={{...C.td,width:28,textAlign:'center'}}>{cats[d.category]||'📎'}</td>
            <td style={{...C.td,fontSize:10,color:'#666'}}>{d.date}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{d.matter_id||'—'}</td>
            <td style={{...C.td,color:'#C8C8C8'}}>{d.description}</td>
            <td style={{...C.td,fontFamily:'monospace',textAlign:'center',color:'#777'}}>{d.quantity||1}</td>
            <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:600}}>{fmtR(d.amount)}</td>
            <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:d.status==='billed'?'rgba(141,198,63,0.1)':d.status==='written_off'?'rgba(85,85,85,0.2)':'rgba(234,179,8,0.1)',color:d.status==='billed'?'#8DC63F':d.status==='written_off'?'#555':'#EAB308',fontWeight:600}}>{d.status||'unbilled'}</span></td>
            <td style={C.td}><button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{if(!confirm('Delete?'))return;await deleteDisbursement(d.id);load();}}>Del</button></td>
          </tr>))}
        </tbody></table>
      </div>
      {showDisbForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowDisbForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>Add Disbursement</div>
          {(()=>{const lbl2={fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'};const inp2={background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'9px 12px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};return(<div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={lbl2}>Matter *</label><select style={inp2} value={disbForm.matter_id} onChange={e=>setDisbForm(f=>({...f,matter_id:e.target.value}))}><option value="">— Select matter —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl2}>Date *</label><input style={inp2} type="date" value={disbForm.date} onChange={e=>setDisbForm(f=>({...f,date:e.target.value}))}/></div>
              <div><label style={lbl2}>Category *</label><select style={inp2} value={disbForm.category} onChange={e=>setDisbForm(f=>({...f,category:e.target.value}))}>{Object.keys(cats).map(k=><option key={k} value={k} style={{textTransform:'capitalize'}}>{k.replace('_',' ')}</option>)}</select></div>
            </div>
            <div><label style={lbl2}>Description *</label><input style={inp2} type="text" placeholder="e.g. Copies of affidavit" value={disbForm.description} onChange={e=>setDisbForm(f=>({...f,description:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl2}>Amount (R) *</label><input style={inp2} type="number" placeholder="0.00" value={disbForm.amount} onChange={e=>setDisbForm(f=>({...f,amount:e.target.value}))}/></div>
              <div><label style={lbl2}>Quantity</label><input style={inp2} type="number" min="1" value={disbForm.quantity} onChange={e=>setDisbForm(f=>({...f,quantity:parseInt(e.target.value)||1}))}/></div>
            </div>
            <div><label style={lbl2}>Reference</label><input style={inp2} type="text" value={disbForm.reference} onChange={e=>setDisbForm(f=>({...f,reference:e.target.value}))}/></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:6}}>
              <button style={C.btn()} onClick={()=>setShowDisbForm(false)}>Cancel</button>
              <button style={C.btn('p')} onClick={async()=>{if(!disbForm.matter_id||!disbForm.description||!disbForm.amount){showAlert('Fill in all required fields.','error');return;}const{error}=await saveDisbursement({matter_id:disbForm.matter_id,date:disbForm.date,category:disbForm.category,description:disbForm.description,amount:parseFloat(disbForm.amount)*disbForm.quantity,quantity:disbForm.quantity,reference:disbForm.reference,branch_id:profile?.branch_id||null,status:'unbilled'},profile?.id);if(error){showAlert('Error: '+error.message,'error');return;}showAlert('✓ Disbursement added.');setShowDisbForm(false);load();}}>Add</button>
            </div>
          </div>);})()}
        </div>
      </div>)}
    </>);
  })()}
</div>)}

        {tab==='schedules'&&(<div style={C.main}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
    <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Fee Schedules</div><div style={{fontSize:11,color:'#444'}}>Billing rate cards for the firm</div></div>
    <button style={C.btn('p')} onClick={()=>{setSchedForm({name:'',unit_rate:150,description:'',is_default:false});setShowSchedForm(true);}}>+ New Schedule</button>
  </div>
  <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Rate per Unit (R)','Description','Default','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
    {!feeSchedules.length&&<tr><td colSpan={5} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No fee schedules yet. The default rate is R150/unit.</td></tr>}
    {feeSchedules.map(s=>(<tr key={s.id}>
      <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{s.name}</td>
      <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:700}}>R{s.unit_rate||150}</td>
      <td style={{...C.td,color:'#666'}}>{s.description||'—'}</td>
      <td style={{...C.td,textAlign:'center'}}>{s.is_default?<span style={{color:'#8DC63F',fontWeight:700}}>✓ Default</span>:'—'}</td>
      <td style={C.td}><button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{if(!confirm('Delete?'))return;await supabase.from('fee_schedules').update({is_active:false}).eq('id',s.id);load();}}>Archive</button></td>
    </tr>))}
  </tbody></table></div>
  {showSchedForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowSchedForm(false)}>
    <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>New Fee Schedule</div>
      {(()=>{const lbl2={fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'};const inp2={background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'9px 12px',borderRadius:6,fontSize:12,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};return(<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div><label style={lbl2}>Schedule Name *</label><input style={inp2} type="text" placeholder="e.g. Standard, Litigation Rate" value={schedForm.name} onChange={e=>setSchedForm(f=>({...f,name:e.target.value}))}/></div>
        <div><label style={lbl2}>Rate per Billing Unit (R) *</label><input style={inp2} type="number" value={schedForm.unit_rate} onChange={e=>setSchedForm(f=>({...f,unit_rate:parseFloat(e.target.value)||150}))}/></div>
        <div><label style={lbl2}>Description</label><input style={inp2} type="text" placeholder="When to use this rate..." value={schedForm.description} onChange={e=>setSchedForm(f=>({...f,description:e.target.value}))}/></div>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888',cursor:'pointer'}}><input type="checkbox" checked={schedForm.is_default} onChange={e=>setSchedForm(f=>({...f,is_default:e.target.checked}))}/> Set as firm default rate</label>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:6}}>
          <button style={C.btn()} onClick={()=>setShowSchedForm(false)}>Cancel</button>
          <button style={C.btn('p')} onClick={async()=>{if(!schedForm.name){showAlert('Name is required.','error');return;}const{error}=await saveFeeSchedule({name:schedForm.name,unit_rate:schedForm.unit_rate,description:schedForm.description,is_default:schedForm.is_default,is_active:true},profile?.id);if(error){showAlert('Error: '+error.message,'error');return;}showAlert('✓ Schedule saved.');setShowSchedForm(false);load();}}>Save</button>
        </div>
      </div>);})()}
    </div>
  </div>)}
</div>)}

        {tab==='invoices'&&(<div style={C.main}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em',marginBottom:14}}>All Invoices — Motsoeneng Bill</div>
          <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice ID','Client','Matter ID','Attorney','Period','Units','Rate','Excl. VAT','Incl. VAT 15%'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!filtInvoices.length&&<tr><td colSpan={9} style={{padding:'30px',textAlign:'center',color:'#333'}}>No invoices yet</td></tr>}{filtInvoices.map(inv=>(<tr key={inv.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td><td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td><td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{inv.matter_id}</td><td style={{...C.td,color:'#777'}}>{inv.attorney}</td><td style={{...C.td,color:'#666',fontSize:10}}>{inv.period_label}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontWeight:600}}>{inv.total_units}</td><td style={{...C.td,fontFamily:'monospace',color:'#777'}}>R{inv.rate}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)).toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{((inv.total_units||0)*(inv.rate||150)*1.15).toFixed(2)}</td></tr>))}{filtInvoices.length>0&&(<tr style={{background:'rgba(141,198,63,0.05)'}}><td colSpan={7} style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>TOTAL</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{billedRevenue.toLocaleString()}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>R{(billedRevenue*1.15).toFixed(2)}</td></tr>)}</tbody></table></div>
        </div>)}

        {tab==='settings'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Settings</div><div style={{fontSize:11,color:'#444'}}>Configure your firm details, billing rates and banking information</div></div>
            <button style={C.btn()} onClick={()=>router.push('/settings')}>Open full settings →</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Firm Information</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[['Firm Name','firm_name'],['VAT Number','vat_number'],['Phone','phone'],['Email','email'],['Website','website'],['Address','address']].map(([label,key])=>(
                  <div key={key}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>{label}</div><div style={{fontSize:12,color:'#C8C8C8',background:'#0D0D0D',padding:'8px 10px',borderRadius:5,border:'1px solid #1A1A1A'}}>{profile?.[key]||<span style={{color:'#333'}}>Not set — open full settings to configure</span>}</div></div>
                ))}
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Banking Details</div>
              <div style={{fontSize:11,color:'#555',marginBottom:12}}>Displayed on all invoices sent to clients</div>
              {[['Bank Name','bank_name'],['Account Number','bank_account'],['Branch Code','bank_branch'],['Default Rate (R/unit)','default_rate']].map(([label,key])=>(
                <div key={key} style={{marginBottom:10}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>{label}</div><div style={{fontSize:12,color:'#C8C8C8',background:'#0D0D0D',padding:'8px 10px',borderRadius:5,border:'1px solid #1A1A1A'}}>{profile?.[key]||<span style={{color:'#333'}}>Not set</span>}</div></div>
              ))}
              <button style={{...C.btn('p'),marginTop:8,width:'100%'}} onClick={()=>router.push('/settings')}>Edit all settings →</button>
            </div>
          </div>
        </div>)}

        {tab==='staff'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Staff Management</div><div style={{fontSize:11,color:'#444',marginTop:2}}>{profiles.length} staff members · {branches.length} branches · No IT needed</div></div>
            <button style={C.btn('p')} onClick={()=>{ setShowInvite(true); setInviteForm({fullName:'',email:'',role:'attorney',branchId:branches[0]?.id||''}); setInviteMsg({msg:'',type:''}); }}>+ Add Staff Member</button>
          </div>
          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>All staff</div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Email','Role','Branch','Change Branch','Rate (R)','Monthly Target (units)','Remove'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>{!profiles.length&&<tr><td colSpan={8} style={{padding:'30px',textAlign:'center',color:'#333'}}>No staff yet</td></tr>}{profiles.map(p=>{ const br=branches.find(b=>b.id===p.branch_id); return(<tr key={p.id}><td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{p.full_name}</td><td style={{...C.td,fontSize:10,color:'#555'}}>{p.email||'—'}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:600,background:roleBg(p.role),color:roleColor(p.role)}}>{p.role||'attorney'}</span></td><td style={C.td}>{br?<span style={{fontSize:10,color:'#4A90D9',background:'rgba(74,144,217,0.1)',padding:'2px 8px',borderRadius:20}}>{br.name}</span>:<span style={{fontSize:10,color:'#555'}}>Not assigned</span>}</td><td style={C.td}><select className="mb-inp" style={{padding:'5px 10px',fontSize:11}} value={p.branch_id||''} onChange={e=>assignBranch(p.id,e.target.value)}><option value="">— select —</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></td><td style={C.td}><input type="number" style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'4px 8px',borderRadius:6,fontSize:11,width:80,fontFamily:'inherit'}} defaultValue={p.rate||150} onBlur={async e=>{ const rate=parseFloat(e.target.value)||150; await supabase.from('profiles').update({rate}).eq('id',p.id); showAlert(`✓ Rate updated for ${p.full_name}`,'success'); }}/></td><td style={C.td}><input type="number" min="0" style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'4px 8px',borderRadius:6,fontSize:11,width:80,fontFamily:'inherit'}} defaultValue={p.monthly_target||0} onBlur={async e=>{ const target=parseInt(e.target.value)||0; await supabase.from('profiles').update({monthly_target:target}).eq('id',p.id); showAlert(`✓ Target updated for ${p.full_name}`,'success'); }} placeholder="0"/></td><td style={C.td}><button style={{...C.btn('r'),fontSize:10,padding:'3px 10px'}} onClick={()=>removeStaff(p.id,p.full_name)}>Remove</button></td></tr>); })}</tbody></table></div>
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
                <div><label style={lbl}>Role *</label><select className="mb-inp" value={inviteForm.role} onChange={e=>setInviteForm(f=>({...f,role:e.target.value}))}><option value="attorney">Attorney / Fee Earner</option><option value="branch_manager">Branch Manager</option><option value="manager">National Manager</option><option value="bookkeeper">Bookkeeper</option><option value="receptionist">Receptionist</option><option value="hr">HR</option></select></div>
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

        {/* ── MATTERS TAB ──────────────────────────────────── */}
        {tab==='matters'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>All Matters</div><div style={{fontSize:11,color:'#444'}}>{matters.length} matters · firm-wide</div></div>
            <div style={{display:'flex',gap:8}}><select style={C.sel} value={selBranch} onChange={e=>setSelBranch(e.target.value)}><option value="all">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          </div>
          {!matters.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>📁</div><div>No matters yet</div></div>):matters.filter(m=>selBranch==='all'||profiles.find(p=>p.id===m.user_id)?.branch_id===selBranch).map(m=>{
            const atty=profiles.find(p=>p.id===m.user_id);
            const trustBal=trustBalances[m.id]||0;
            const prescDue=m.prescription_date?Math.floor((new Date(m.prescription_date)-new Date())/86400000):null;
            const prescWarn=prescDue!==null&&prescDue<=30;
            return(<div key={m.id} style={{...C.card,border:prescWarn?'1px solid rgba(220,80,80,0.4)':m.status==='closed'?'1px solid #1A1A1A':'1px solid #1A1A1A',opacity:m.status==='closed'?0.6:1}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:'#A78BFA',fontFamily:'monospace',fontWeight:600}}>{m.id}</span>
                    <span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:m.status==='closed'?'rgba(85,85,85,0.2)':'rgba(141,198,63,0.1)',color:m.status==='closed'?'#555':'#8DC63F',fontWeight:600}}>{m.status||'open'}</span>
                    {prescWarn&&<span style={{fontSize:9,color:'#E05252',border:'1px solid rgba(220,80,80,0.4)',padding:'1px 8px',borderRadius:20}}>⚠ Prescribes in {prescDue}d</span>}
                    {m.budget_units>0&&<span style={{fontSize:9,color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)',padding:'1px 8px',borderRadius:20}}>Budget: {m.budget_units} units</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:'#E0E0E0',marginBottom:2}}>{m.name}</div>
                  <div style={{fontSize:12,color:'#888'}}>Client: <strong style={{color:'#C0C0C0'}}>{m.client}</strong> · Attorney: <span style={{color:'#4A90D9'}}>{atty?.full_name||'—'}</span></div>
                  {m.prescription_date&&<div style={{fontSize:10,color:prescWarn?'#E05252':'#555',marginTop:3}}>Prescription: {fmtDate(m.prescription_date)}</div>}
                  {m.next_action_date&&<div style={{fontSize:10,color:'#EAB308',marginTop:2}}>Next action: {fmtDate(m.next_action_date)}</div>}
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-start'}}>
                  <div style={{textAlign:'center',minWidth:50}}><div style={{fontSize:9,color:'#555',marginBottom:2}}>Trust</div><div style={{fontSize:14,fontWeight:700,color:trustBal>0?'#4A90D9':'#444'}}>{fmtR(trustBal)}</div></div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <button style={{...C.btn(),fontSize:11,padding:'4px 10px'}} onClick={()=>{const nid=mgrNotesMatter===m.id?null:m.id;setMgrNotesMatter(nid);if(nid&&!mgrNotesMap[m.id])loadMgrNotes(m.id);}}>📝 {mgrNotesMap[m.id]?.length>0?`Notes (${mgrNotesMap[m.id].length})`:'Notes'}</button>
                    {m.status!=='closed'&&<button style={{...C.btn('r'),fontSize:11,padding:'4px 10px'}} onClick={()=>{setClosingMatter(m);setClosureForm({closure_notes:''});}}>Close</button>}
                    {m.status==='closed'&&<button style={{...C.btn(),fontSize:11,padding:'4px 10px'}} onClick={async()=>{await updateMatter(m.id,{status:'open',closed_at:null,closed_by:null});load();}}>Reopen</button>}
                  </div>
                </div>
              </div>
              {mgrNotesMatter===m.id&&(<div style={{borderTop:'1px solid #1A1A1A',marginTop:12,paddingTop:12}}>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <select style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 8px',borderRadius:5,fontSize:11,fontFamily:'inherit'}} value={mgrNoteType} onChange={e=>setMgrNoteType(e.target.value)}>{['general','call','email','meeting','instruction','court'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select>
                  <textarea style={{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'8px 10px',borderRadius:5,fontSize:12,fontFamily:'inherit',flex:1,minHeight:48,resize:'vertical'}} placeholder="Add a note..." value={mgrNoteText} onChange={e=>setMgrNoteText(e.target.value)}/>
                  <button style={{...C.btn('p'),padding:'6px 12px',flexShrink:0,alignSelf:'flex-start'}} disabled={savingMgrNote||!mgrNoteText.trim()} onClick={()=>handleSaveMgrNote(m.id)}>{savingMgrNote?'…':'Save'}</button>
                </div>
                {!(mgrNotesMap[m.id]||[]).length&&<div style={{fontSize:11,color:'#333',textAlign:'center',padding:'8px 0'}}>No notes yet.</div>}
                {(mgrNotesMap[m.id]||[]).map(n=>(<div key={n.id} style={{display:'flex',gap:8,marginBottom:6,padding:'8px 10px',background:'#0D0D0D',borderRadius:6}}>
                  <div style={{flex:1}}><div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:3}}><span style={{fontSize:9,padding:'1px 7px',borderRadius:20,background:'rgba(74,144,217,0.1)',color:'#4A90D9',fontWeight:600,textTransform:'capitalize'}}>{n.note_type}</span><span style={{fontSize:10,color:'#555'}}>{n.profiles?.full_name}</span><span style={{fontSize:9,color:'#333'}}>{new Date(n.created_at).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'})}</span></div><div style={{fontSize:12,color:'#C8C8C8',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.note}</div></div>
                  <button style={{background:'none',border:'none',color:'#2A2A2A',cursor:'pointer',fontSize:14,flexShrink:0}} onClick={async()=>{await deleteMatterNote(n.id);loadMgrNotes(m.id);}}>✕</button>
                </div>))}
              </div>)}
            </div>);
          })}
        </div>)}

        {/* ── VAT REPORT TAB ───────────────────────────────── */}
        {tab==='vat'&&(<div style={C.main}>
          {(()=>{
            const [fy,fm]=vatPeriod.split('-').map(Number);
            const periodInvs=invoices.filter(i=>{ const d=i.created_at?.substring(0,7); return d===vatPeriod; });
            const periodDisbs=disbursements.filter(d=>d.date?.substring(0,7)===vatPeriod&&d.vat_applicable);
            const outputExcl=periodInvs.reduce((s,i)=>s+(i.total_units||0)*(i.rate||150),0);
            const outputVat=outputExcl*0.15;
            const inputVat=periodDisbs.reduce((s,d)=>s+Number(d.amount)*0.15,0);
            const vatPayable=outputVat-inputVat;
            return(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
                <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>VAT Report — VAT201 Supporting Schedule</div><div style={{fontSize:11,color:'#444'}}>Output VAT collected minus Input VAT on disbursements</div></div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}><input type="month" style={C.sel} value={vatPeriod} onChange={e=>setVatPeriod(e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                {[{l:'Output VAT (excl.)',v:fmtR(outputExcl),s:'invoiced excl. VAT',a:true},{l:'Output VAT (15%)',v:fmtR(outputVat),s:'VAT collected',a:true},{l:'Input VAT',v:fmtR(inputVat),s:'VAT on disbursements',w:false},{l:'VAT Payable to SARS',v:fmtR(vatPayable),s:vatPayable>0?'Due to SARS':'VAT credit',w:vatPayable>0,a:vatPayable<=0}].map(({l,v,s,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
              </div>
              <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Output VAT — Invoices ({new Date(vatPeriod+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'})})</div>
                {!periodInvs.length?<div style={{textAlign:'center',padding:30,color:'#555',fontSize:12}}>No invoices for this period</div>:
                <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice','Client','Matter','Excl. VAT','VAT 15%','Incl. VAT'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
                  {periodInvs.map(inv=>{const e=(inv.total_units||0)*(inv.rate||150),v=e*0.15;return(<tr key={inv.id}><td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td><td style={C.td}>{inv.client}</td><td style={{...C.td,color:'#A78BFA',fontSize:10}}>{inv.matter_id}</td><td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>{fmtR(e)}</td><td style={{...C.td,fontFamily:'monospace',color:'#EAB308'}}>{fmtR(v)}</td><td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>{fmtR(e+v)}</td></tr>);})}
                  <tr style={{background:'rgba(141,198,63,0.05)'}}><td colSpan={3} style={C.th}>TOTAL</td><td style={{...C.th,fontFamily:'monospace',color:'#8DC63F'}}>{fmtR(outputExcl)}</td><td style={{...C.th,fontFamily:'monospace',color:'#EAB308'}}>{fmtR(outputVat)}</td><td style={{...C.th,fontFamily:'monospace',color:'#8DC63F'}}>{fmtR(outputExcl+outputVat)}</td></tr>
                </tbody></table>}
              </div>
              <div style={{...C.card,marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>VAT201 Summary</div><button style={C.btn('p')} onClick={()=>{ const txt=`VAT RETURN SUMMARY\nPeriod: ${new Date(vatPeriod+'-01T12:00:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric'})}\n\nField 1 - Standard Rated Supplies: R${outputExcl.toFixed(2)}\nField 4 - Output Tax: R${outputVat.toFixed(2)}\nField 15 - Input Tax (Disbursements): R${inputVat.toFixed(2)}\nField 20 - VAT Payable: R${vatPayable.toFixed(2)}\n\nVAT Reg No: ${profile?.vat_number||'[Add VAT number in Settings]'}`; navigator.clipboard.writeText(txt); showAlert('✓ VAT summary copied to clipboard'); }}>📋 Copy for VAT201</button></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[['Field 1','Standard rated supplies (excl. VAT)',fmtR(outputExcl)],['Field 4','Output Tax (VAT collected)',fmtR(outputVat)],['Field 15','Input Tax (VAT on disbursements)',fmtR(inputVat)],['Field 20','VAT payable to SARS',fmtR(vatPayable)]].map(([f,l,v])=>(<div key={f} style={{background:'#0D0D0D',borderRadius:6,padding:'10px 12px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:2}}>{f} — {l}</div><div style={{fontSize:16,fontWeight:700,color:'#8DC63F'}}>{v}</div></div>))}
                </div>
              </div>
            </>);
          })()}
        </div>)}

        {/* ── UNDERTAKINGS TAB ─────────────────────────────── */}
        {tab==='undertakings'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Undertakings Register</div><div style={{fontSize:11,color:'#444'}}>Track undertakings given and received per matter</div></div>
            <button style={C.btn('p')} onClick={()=>{setUtForm({matter_id:matters[0]?.id||'',direction:'given',description:'',given_to:'',due_date:'',notes:''});setShowUTForm(true);}}>+ New Undertaking</button>
          </div>
          {(()=>{
            const pending=undertakings.filter(u=>u.status==='pending');
            const overdue=undertakings.filter(u=>u.due_date&&new Date(u.due_date)<new Date()&&u.status==='pending');
            return(<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                {[{l:'Total',v:undertakings.length,s:'all undertakings'},{l:'Pending',v:pending.length,s:'awaiting fulfilment',w:pending.length>0},{l:'Overdue',v:overdue.length,s:'past due date',w:overdue.length>0}].map(({l,v,s,w})=>(<div key={l} style={C.stat(false,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:w&&v>0?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
              </div>
              {!undertakings.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>🤝</div><div>No undertakings yet</div></div>):
              <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter','Direction','Description','Given To','Due Date','Status','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
                {undertakings.map(u=>{
                  const isOverdue=u.due_date&&new Date(u.due_date)<new Date()&&u.status==='pending';
                  return(<tr key={u.id}>
                    <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{u.matter_id}</td>
                    <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:u.direction==='given'?'rgba(74,144,217,0.1)':'rgba(167,139,250,0.1)',color:u.direction==='given'?'#4A90D9':'#A78BFA',fontWeight:600}}>{u.direction}</span></td>
                    <td style={{...C.td,color:'#C8C8C8',maxWidth:200}}>{u.description}</td>
                    <td style={{...C.td,color:'#777',fontSize:10}}>{u.given_to||'—'}</td>
                    <td style={{...C.td,fontFamily:'monospace',color:isOverdue?'#E05252':'#888',fontWeight:isOverdue?700:400}}>{u.due_date?fmtDate(u.due_date):'—'}{isOverdue&&' ⚠'}</td>
                    <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:u.status==='fulfilled'?'rgba(141,198,63,0.1)':isOverdue?'rgba(220,80,80,0.1)':'rgba(234,179,8,0.1)',color:u.status==='fulfilled'?'#8DC63F':isOverdue?'#E05252':'#EAB308',fontWeight:600}}>{u.status}</span></td>
                    <td style={C.td}><div style={{display:'flex',gap:4}}>{u.status==='pending'&&<button style={{...C.btn('p'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{await fulfillUndertaking(u.id);const{undertakings:ut}=await fetchUndertakings({});setUndertakings(ut);showAlert('✓ Undertaking fulfilled.');}}>✓ Fulfil</button>}<button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{if(!confirm('Delete?'))return;await deleteUndertaking(u.id);const{undertakings:ut}=await fetchUndertakings({});setUndertakings(ut);}}>Del</button></div></td>
                  </tr>);
                })}
              </tbody></table></div>}
            </>);
          })()}
        </div>)}

        {/* ── COMMUNICATIONS TAB ───────────────────────────── */}
        {tab==='communications'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Client Communications</div><div style={{fontSize:11,color:'#444'}}>Log of all client interactions firm-wide</div></div>
            <button style={C.btn('p')} onClick={()=>{setCommForm({client_id:clients[0]?.id||'',matter_id:'',comm_type:'call',direction:'outbound',subject:'',body:'',comm_date:new Date().toLocaleDateString('en-CA')});setShowCommForm(true);}}>+ Log Communication</button>
          </div>
          {!communications.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>💬</div><div>No communications logged yet</div></div>):
          <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Type','Direction','Client','Matter','Subject','Logged By','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
            {communications.map(c=>{
              const cl=clients.find(x=>x.id===c.client_id);
              const typeColors={call:'#4A90D9',email:'#8DC63F',meeting:'#A78BFA',letter:'#EAB308',note:'#888',whatsapp:'#25D366'};
              return(<tr key={c.id}>
                <td style={{...C.td,fontSize:10,color:'#666'}}>{fmtDate(c.comm_date)}</td>
                <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:'rgba(74,144,217,0.08)',color:typeColors[c.comm_type]||'#888',fontWeight:600,textTransform:'capitalize'}}>{c.comm_type}</span></td>
                <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:'rgba(85,85,85,0.15)',color:c.direction==='inbound'?'#8DC63F':'#4A90D9',fontWeight:600}}>{c.direction}</span></td>
                <td style={{...C.td,color:'#C8C8C8'}}>{cl?.full_name||'—'}</td>
                <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{c.matter_id||'—'}</td>
                <td style={{...C.td,color:'#888',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.subject||c.body.substring(0,40)}</td>
                <td style={{...C.td,fontSize:10,color:'#555'}}>{c.profiles?.full_name||'—'}</td>
                <td style={C.td}><button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={async()=>{if(!confirm('Delete?'))return;await deleteClientCommunication(c.id);const{communications:co}=await fetchClientCommunications({});setCommunications(co);}}>Del</button></td>
              </tr>);
            })}
          </tbody></table></div>}
        </div>)}

        {/* ── INTEREST TAB ─────────────────────────────────── */}
        {tab==='interest'&&(<div style={C.main}>
          {(()=>{
            const now=new Date();
            const age=inv=>Math.floor((now-new Date(inv.created_at||0))/86400000);
            const paid=invId=>invoicePayments.filter(p=>p.invoice_id===invId).reduce((s,p)=>s+Number(p.amount),0);
            const outstanding=inv=>Math.max(0,(inv.total_units||0)*(inv.rate||150)*1.15-paid(inv.id));
            const RATE=10.5;
            const overdueInvs=invoices.filter(inv=>age(inv)>30&&outstanding(inv)>0&&!inv.written_off);
            const totalInterest=overdueInvs.reduce((s,inv)=>s+parseFloat((outstanding(inv)*(RATE/100)*(age(inv)/365)).toFixed(2)),0);
            return(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
                <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Interest on Overdue Accounts</div><div style={{fontSize:11,color:'#444'}}>Legal rate: {RATE}% per annum · Invoices overdue &gt;30 days</div></div>
                <button style={C.btn('p')} onClick={()=>overdueInvs.forEach(inv=>handleAddInterest(inv))}>Add Interest to All</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                {[{l:'Overdue invoices',v:overdueInvs.length,s:'>30 days',w:overdueInvs.length>0},{l:'Total outstanding',v:fmtR(overdueInvs.reduce((s,i)=>s+outstanding(i),0)),s:'excl. interest',w:true},{l:'Total interest due',v:fmtR(totalInterest),s:`@ ${RATE}% p.a.`,w:true}].map(({l,v,s,w})=>(<div key={l} style={C.stat(false,w&&overdueInvs.length>0)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:w&&overdueInvs.length>0?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
              </div>
              {!overdueInvs.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>✅</div><div>No overdue invoices</div></div>):
              <div style={C.card}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Overdue Invoice Detail</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Invoice','Client','Age','Outstanding','Interest ({RATE}% p.a.)','Action'].map(h=><th key={h} style={C.th}>{h.replace('{RATE}',RATE)}</th>)}</tr></thead><tbody>
                  {overdueInvs.sort((a,b)=>age(b)-age(a)).map(inv=>{
                    const a=age(inv),o=outstanding(inv),interest=parseFloat((o*(RATE/100)*(a/365)).toFixed(2));
                    return(<tr key={inv.id}>
                      <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#888'}}>{inv.id}</td>
                      <td style={{...C.td,color:'#C8C8C8'}}>{inv.client}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#E05252',fontWeight:700}}>{a} days</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#EAB308',fontWeight:700}}>{fmtR(o)}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#E05252',fontWeight:700}}>{fmtR(interest)}</td>
                      <td style={C.td}><button style={{...C.btn('warn'),fontSize:10,padding:'3px 10px'}} onClick={()=>handleAddInterest(inv)}>Add Interest</button></td>
                    </tr>);
                  })}
                </tbody></table>
              </div>}
            </>);
          })()}
        </div>)}

        {/* ── AUDIT LOG TAB ────────────────────────────────── */}
        {tab==='audit'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Audit Trail</div><div style={{fontSize:11,color:'#444'}}>Full log of all actions taken in the system</div></div>
            <button style={C.btn()} onClick={()=>{ setAuditLoading(true); fetchAuditLog({}).then(r=>{setAuditLogs(r.logs||[]);setAuditLoading(false);}); }}>↻ Refresh</button>
          </div>
          {auditLoading?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}>Loading…</div>):
          !auditLogs.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>📋</div><div>No audit entries yet</div><div style={{fontSize:11,color:'#333',marginTop:6}}>Actions like invoicing, trust transactions and credit notes will appear here</div></div>):
          <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date & Time','User','Action','Entity','Details'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
            {auditLogs.map(l=>(<tr key={l.id}>
              <td style={{...C.td,fontSize:10,color:'#666',whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString('en-ZA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
              <td style={{...C.td,color:'#C8C8C8'}}>{l.profiles?.full_name||'System'}</td>
              <td style={C.td}><span style={{fontSize:10,padding:'1px 8px',borderRadius:20,background:'rgba(141,198,63,0.08)',color:'#8DC63F',fontWeight:600}}>{l.action?.replace(/_/g,' ')}</span></td>
              <td style={{...C.td,fontSize:10,color:'#A78BFA',fontFamily:'monospace'}}>{l.entity_type} {l.entity_id?`· ${l.entity_id.substring(0,12)}…`:''}</td>
              <td style={{...C.td,fontSize:10,color:'#555'}}>{l.details?JSON.stringify(l.details).substring(0,60):'—'}</td>
            </tr>))}
          </tbody></table></div>}
        </div>)}

        {/* ── FIRM PERFORMANCE TAB ─────────────────────────── */}
        {tab==='firmperformance'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Firm Performance</div><div style={{fontSize:11,color:'#444'}}>Attorney performance · bi-annual review reports</div></div>
            <div style={{display:'flex',gap:8}}><select style={C.sel} value={perfYear} onChange={e=>setPerfYear(Number(e.target.value))}>{[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select><select style={C.sel} value={perfAtty} onChange={e=>setPerfAtty(e.target.value)}><option value="all">All attorneys</option>{profiles.filter(p=>p.role==='attorney'||p.role==='branch_manager').map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
          </div>
          {(()=>{
            const attyList=perfAtty==='all'?profiles.filter(p=>p.role==='attorney'||p.role==='branch_manager'):[profiles.find(p=>p.id===perfAtty)].filter(Boolean);
            const h1months=Array.from({length:6},(_,i)=>`${perfYear}-${String(i+1).padStart(2,'0')}`);
            const h2months=Array.from({length:6},(_,i)=>`${perfYear}-${String(i+7).padStart(2,'0')}`);
            const toHm2=(s)=>{s=Number(s)||0;if(s<=0)return'0m';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?`${h}h ${m}m`:`${m}m`;};
            const getStats=(atty,months)=>{
              const acts=allTime.filter(a=>a.user_id===atty.id&&a.is_billable&&months.some(m=>a.date?.startsWith(m)));
              const allA=allTime.filter(a=>a.user_id===atty.id&&months.some(m=>a.date?.startsWith(m)));
              const units=acts.reduce((s,a)=>s+(a.billing_units||0),0);
              const sec=acts.reduce((s,a)=>s+(a.duration_seconds||0),0);
              const totalSec=allA.reduce((s,a)=>s+(a.duration_seconds||0),0);
              const invAmt=invoices.filter(i=>i.user_id===atty.id&&months.some(m=>i.created_at?.startsWith(m))).reduce((s,i)=>s+(i.total_units||0)*(i.rate||atty.rate||150)*1.15,0);
              const tgt=(atty.monthly_target||0)*6;
              const pct=tgt>0?Math.round(units/tgt*100):null;
              const util=totalSec>0?Math.round(sec/totalSec*100):0;
              const monthly=months.map(m=>{const u=allTime.filter(a=>a.user_id===atty.id&&a.is_billable&&a.date?.startsWith(m)).reduce((s,a)=>s+(a.billing_units||0),0);return{m,u,label:new Date(m+'-01T12:00:00').toLocaleString('en-ZA',{month:'short'})};});
              return{units,sec,totalSec,invAmt,pct,util,tgt,monthly};
            };
            return attyList.map(atty=>{
              const s1=getStats(atty,h1months),s2=getStats(atty,h2months);
              const br=branches.find(b=>b.id===atty.branch_id);
              return(<div key={atty.id} style={{...C.card,marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
                  <div><div style={{fontSize:14,fontWeight:700,color:'#D0D0D0'}}>{atty.full_name}</div><div style={{fontSize:11,color:'#555'}}>{atty.email} · {br?.name||'—'} · Target: {atty.monthly_target||0} units/month</div></div>
                  <button style={{...C.btn('p'),fontSize:11}} onClick={()=>{
                    const txt=`PERFORMANCE REVIEW ${perfYear}\nAttorney: ${atty.full_name}\nFirm: ${branches.find(b=>b.id===atty.branch_id)?.name||'—'}\nMonthly Target: ${atty.monthly_target||0} units\n\nH1 (Jan–Jun):\nUnits: ${s1.units}${s1.tgt>0?' / '+s1.tgt+' ('+s1.pct+'%':''}\nBillable Time: ${toHm2(s1.sec)}\nUtilisation: ${s1.util}%\nRevenue: R${s1.invAmt.toFixed(2)}\n\nH2 (Jul–Dec):\nUnits: ${s2.units}${s2.tgt>0?' / '+s2.tgt+' ('+s2.pct+'%':''}\nBillable Time: ${toHm2(s2.sec)}\nUtilisation: ${s2.util}%\nRevenue: R${s2.invAmt.toFixed(2)}\n\nMonthly Detail:\n${[...h1months,...h2months].map(m=>{const u=allTime.filter(a=>a.user_id===atty.id&&a.is_billable&&a.date?.startsWith(m)).reduce((s,a)=>s+(a.billing_units||0),0);return new Date(m+'-01T12:00:00').toLocaleString('en-ZA',{month:'long'})+' '+perfYear+': '+u+' units';}).join('\n')}`;
                    navigator.clipboard.writeText(txt);showAlert('✓ Performance review copied to clipboard');
                  }}>📋 Copy for Review</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  {[{label:'H1 (Jan–Jun)',s:s1,months:h1months},{label:'H2 (Jul–Dec)',s:s2,months:h2months}].map(({label,s,months})=>(
                    <div key={label} style={{background:'#0D0D0D',borderRadius:8,padding:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:10}}>{label}</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                        {[{l:'Units',v:s.units+(s.tgt>0?' / '+s.tgt:''),c:'#8DC63F'},{l:'Time',v:toHm2(s.sec),c:'#4A90D9'},{l:'Utilisation',v:s.util+'%',c:s.util>=70?'#8DC63F':'#EAB308'},{l:'Revenue',v:'R'+s.invAmt.toLocaleString(undefined,{maximumFractionDigits:0}),c:'#8DC63F'}].map(({l,v,c})=>(<div key={l}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>))}
                      </div>
                      {s.pct!==null&&(<><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:10,color:'#555'}}>Target</span><span style={{fontSize:10,fontWeight:700,color:s.pct>=100?'#8DC63F':s.pct>=70?'#EAB308':'#E05252'}}>{s.pct}%</span></div><div style={{height:6,background:'#1A1A1A',borderRadius:3}}><div style={{width:`${Math.min(s.pct,100)}%`,height:'100%',background:s.pct>=100?'#8DC63F':s.pct>=70?'#EAB308':'#E05252',borderRadius:3}}/></div></>)}
                      <div style={{display:'flex',gap:4,marginTop:10,flexWrap:'wrap'}}>
                        {s.monthly.map(({m,u,label:ml})=>{const tgt2=atty.monthly_target||0;const p=tgt2>0?Math.min(100,Math.round(u/tgt2*100)):null;const c=p===null?'#444':p>=100?'#8DC63F':p>=70?'#EAB308':'#E05252';return(<div key={m} style={{flex:1,minWidth:30,textAlign:'center'}}><div style={{fontSize:8,color:'#333',marginBottom:2}}>{ml}</div><div style={{height:30,background:'#111',borderRadius:3,display:'flex',alignItems:'flex-end',overflow:'hidden'}}><div style={{width:'100%',background:c,height:`${u>0?Math.max(15,p||20):0}%`,borderRadius:'2px 2px 0 0'}}/></div><div style={{fontSize:8,color:c,fontWeight:700,marginTop:1}}>{u}</div></div>);})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>);
            });
          })()}
        </div>)}

        {/* ── COURT ROLL TAB ───────────────────────────────── */}
        {tab==='courtroll'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Court Roll</div><div style={{fontSize:11,color:'#444'}}>All upcoming court appearances across all matters</div></div>
            <div style={{display:'flex',gap:8}}><input type="text" style={C.sel} placeholder="Filter by attorney or matter..." value={courtFilter} onChange={e=>setCourtFilter(e.target.value)}/></div>
          </div>
          {(()=>{
            const today=new Date().toLocaleDateString('en-CA');
            const courtEvents=(()=>{
              return [];
            })();
            const upcomingMatters=matters.filter(m=>{
              if(m.status==='closed') return false;
              if(courtFilter){const q=courtFilter.toLowerCase();const atty=profiles.find(p=>p.id===m.user_id);return m.id.toLowerCase().includes(q)||m.client.toLowerCase().includes(q)||atty?.full_name.toLowerCase().includes(q);}
              return true;
            }).filter(m=>m.prescription_date||m.next_action_date);
            const sorted=upcomingMatters.sort((a,b)=>{const da=a.prescription_date||a.next_action_date||'9999';const db=b.prescription_date||b.next_action_date||'9999';return da.localeCompare(db);});
            return(<>
              {!sorted.length?(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>⚖️</div><div style={{fontSize:14}}>No court dates or action dates set</div><div style={{fontSize:11,color:'#333',marginTop:6}}>Set prescription dates and next action dates on matters to see them here</div></div>):
              <div style={C.card}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Date','Type','Matter','Client','Attorney','Days Away','Status'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
                {sorted.map(m=>{
                  const atty=profiles.find(p=>p.id===m.user_id);
                  const dates=[];
                  if(m.prescription_date) dates.push({date:m.prescription_date,type:'Prescription',urgent:Math.floor((new Date(m.prescription_date)-new Date())/86400000)<=30});
                  if(m.next_action_date) dates.push({date:m.next_action_date,type:'Next Action',urgent:Math.floor((new Date(m.next_action_date)-new Date())/86400000)<=7});
                  return dates.map((d,i)=>{
                    const days=Math.floor((new Date(d.date)-new Date())/86400000);
                    return(<tr key={m.id+i} style={{background:d.urgent?'rgba(220,80,80,0.04)':''}}>
                      <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:d.urgent?'#E05252':'#888'}}>{fmtDate(d.date)}</td>
                      <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:d.type==='Prescription'?'rgba(220,80,80,0.1)':'rgba(234,179,8,0.1)',color:d.type==='Prescription'?'#E05252':'#EAB308',fontWeight:600}}>{d.type}</span></td>
                      <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td>
                      <td style={{...C.td,color:'#C8C8C8'}}>{m.client}</td>
                      <td style={{...C.td,color:'#4A90D9',fontSize:11}}>{atty?.full_name||'—'}</td>
                      <td style={{...C.td,fontFamily:'monospace',color:days<=7?'#E05252':days<=30?'#EAB308':'#555',fontWeight:days<=30?700:400}}>{days<0?`${Math.abs(days)}d overdue`:days===0?'TODAY':`${days}d`}</td>
                      <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:m.status==='closed'?'rgba(85,85,85,0.2)':'rgba(141,198,63,0.1)',color:m.status==='closed'?'#555':'#8DC63F',fontWeight:600}}>{m.status||'open'}</span></td>
                    </tr>);
                  });
                })}
              </tbody></table></div>}
            </>);
          })()}
        </div>)}

        {/* ── DOCUMENT TEMPLATES TAB ───────────────────────── */}
        {tab==='templates'&&(<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Document Templates</div><div style={{fontSize:11,color:'#444'}}>Generate standard firm documents — select matter to pre-fill details</div></div>
          </div>
          <div style={{...C.card,marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:10}}>Select Matter (optional — pre-fills client and attorney details)</div>
            <select style={{...C.sel,maxWidth:500}} value={selTemplate} onChange={e=>setSelTemplate(e.target.value)}>
              <option value="">— No matter selected (blank template) —</option>
              {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name} — {m.client}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            {[
              {id:'engagement',label:'Letter of Engagement',icon:'📋',desc:"Formal letter setting out the firm's mandate and fee arrangement"},
              {id:'demand',label:'Letter of Demand',icon:'⚠️',desc:'Formal demand for payment or performance within 7 days'},
              {id:'trust_receipt',label:'Trust Receipt',icon:'🏦',desc:'Acknowledgement of funds received into the trust account'},
              {id:'withdrawal',label:'Notice of Withdrawal',icon:'📄',desc:'Notice of withdrawal as attorney of record'},
            ].map(t=>{
              const m2=selTemplate?matters.find(x=>x.id===selTemplate):null;
              const a2=m2?profiles.find(p=>p.id===m2.user_id):null;
              const d=new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'long',year:'numeric'});
              const hdr=`<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px"><strong style="font-size:18px">MOTSOENENG BILL ATTORNEYS</strong><br/><small>Attorneys · Notaries · Conveyancers</small></div>`;
              const ftr=`<div style="margin-top:40px;border-top:1px solid #ccc;padding-top:12px;font-size:11px;text-align:center">Motsoeneng Bill Attorneys</div>`;
              return(<div key={t.id} style={C.card}>
                <div style={{fontSize:24,marginBottom:8}}>{t.icon}</div>
                <div style={{fontSize:13,fontWeight:600,color:'#D0D0D0',marginBottom:4}}>{t.label}</div>
                <div style={{fontSize:11,color:'#555',marginBottom:12}}>{t.desc}</div>
                <button style={C.btn('p')} onClick={()=>{
                  let html='';
                  if(t.id==='engagement') html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;max-width:800px;margin:40px auto;padding:40px;font-size:13px;line-height:1.6}</style></head><body>${hdr}<p><strong>DATE:</strong> ${d}</p><p><strong>Our Ref:</strong> ${m2?.id||'[MATTER REF]'}</p><br/><p><strong>TO: ${m2?.client||'[CLIENT NAME]'}</strong></p><br/><h3 style="text-transform:uppercase">Letter of Engagement</h3><p>Dear ${m2?.client||'[Client]'},</p><p>We confirm our mandate to act on your behalf in: <strong>${m2?.name||'[MATTER DESCRIPTION]'}</strong></p><p>Attorney responsible: <strong>${a2?.full_name||'[ATTORNEY]'}</strong></p><p>Our fees are charged at R${a2?.rate||150} per billing unit (6 minutes), invoiced monthly and payable within 30 days.</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name||'[ATTORNEY]'}</strong><br/>Motsoeneng Bill Attorneys</p>${ftr}</body></html>`;
                  else if(t.id==='demand') html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;max-width:800px;margin:40px auto;padding:40px;font-size:13px;line-height:1.6}</style></head><body>${hdr}<p><strong>DATE:</strong> ${d}</p><p><strong>Our Ref:</strong> ${m2?.id||'[MATTER REF]'}</p><br/><p><strong>BY EMAIL AND REGISTERED POST</strong></p><br/><p><strong>TO: ${m2?.client||'[RESPONDENT]'}</strong></p><br/><h3 style="text-transform:uppercase">Letter of Demand</h3><p>We hereby demand that you comply with the following within <strong>7 (seven) days</strong>:</p><p>[STATE DEMAND CLEARLY]</p><p>Failure to comply will result in legal proceedings without further notice, in which event you will be liable for all legal costs on an attorney and own client scale.</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name||'[ATTORNEY]'}</strong><br/>Attorneys for ${m2?.client||'[Client]'}</p>${ftr}</body></html>`;
                  else if(t.id==='trust_receipt') html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:40px;font-size:13px}</style></head><body>${hdr}<h3 style="text-align:center;text-transform:uppercase">Trust Receipt</h3><table style="width:100%;border-collapse:collapse;margin-top:20px"><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ccc">${d}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Received from</strong></td><td style="padding:8px;border:1px solid #ccc">${m2?.client||'[CLIENT NAME]'}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Matter</strong></td><td style="padding:8px;border:1px solid #ccc">${m2?.id||'[REF]'} — ${m2?.name||'[MATTER]'}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Amount (R)</strong></td><td style="padding:8px;border:1px solid #ccc">R ___________</td></tr><tr><td style="padding:8px;border:1px solid #ccc;background:#f8f8f8"><strong>Purpose</strong></td><td style="padding:8px;border:1px solid #ccc">___________</td></tr></table><br/><p>Signed: _________________________<br/>${a2?.full_name||'[ATTORNEY]'}<br/>Motsoeneng Bill Attorneys</p>${ftr}</body></html>`;
                  else html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;max-width:800px;margin:40px auto;padding:40px;font-size:13px;line-height:1.6}</style></head><body>${hdr}<p><strong>DATE:</strong> ${d}</p><br/><p><strong>TO: The Registrar / Clerk of the Court</strong></p><br/><h3 style="text-transform:uppercase">Notice of Withdrawal as Attorney of Record</h3><p>Matter: ${m2?.id||'[REF]'} — Client: ${m2?.client||'[CLIENT]'}</p><p>TAKE NOTICE that MOTSOENENG BILL ATTORNEYS hereby withdraws as attorney of record for ${m2?.client||'[CLIENT]'} in the above matter, effective immediately.</p><p>Last known address of client: [CLIENT ADDRESS]</p><br/><p>Yours faithfully,</p><br/><br/><p><strong>${a2?.full_name||'[ATTORNEY]'}</strong><br/>Motsoeneng Bill Attorneys</p>${ftr}</body></html>`;
                  const w=window.open('','_blank','width=900,height=700');
                  w.document.write(html);
                  w.document.close();
                  setTimeout(()=>w.print(),500);
                }}>Generate &amp; Print</button>
              </div>);
            })}
          </div>
        </div>)}

        {/* ── MODALS: Undertaking form ─────────────────────── */}
        {showUTForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowUTForm(false)}>
          <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:500}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>New Undertaking</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={lbl}>Matter *</label><select className="mb-inp" value={utForm.matter_id} onChange={e=>setUtForm(f=>({...f,matter_id:e.target.value}))}><option value="">— Select —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
                <div><label style={lbl}>Direction *</label><select className="mb-inp" value={utForm.direction} onChange={e=>setUtForm(f=>({...f,direction:e.target.value}))}><option value="given">Given (by us)</option><option value="received">Received (from other party)</option></select></div>
              </div>
              <div><label style={lbl}>Description *</label><textarea className="mb-inp" style={{minHeight:60,resize:'vertical'}} placeholder="Describe the undertaking..." value={utForm.description} onChange={e=>setUtForm(f=>({...f,description:e.target.value}))}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={lbl}>Given To / Received From</label><input className="mb-inp" placeholder="Name / firm" value={utForm.given_to} onChange={e=>setUtForm(f=>({...f,given_to:e.target.value}))}/></div>
                <div><label style={lbl}>Due Date</label><input className="mb-inp" type="date" value={utForm.due_date} onChange={e=>setUtForm(f=>({...f,due_date:e.target.value}))}/></div>
              </div>
              <div><label style={lbl}>Notes</label><input className="mb-inp" placeholder="Additional notes..." value={utForm.notes} onChange={e=>setUtForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setShowUTForm(false)}>Cancel</button><button style={C.btn('p')} disabled={!utForm.description.trim()||!utForm.matter_id} onClick={handleSaveUndertaking}>Save Undertaking</button></div>
          </div>
        </div>)}

        {/* ── MODAL: Communication form ─────────────────────── */}
        {showCommForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowCommForm(false)}>
          <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Log Communication</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={lbl}>Client</label><select className="mb-inp" value={commForm.client_id} onChange={e=>setCommForm(f=>({...f,client_id:e.target.value}))}><option value="">— Select client —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
                <div><label style={lbl}>Matter</label><select className="mb-inp" value={commForm.matter_id} onChange={e=>setCommForm(f=>({...f,matter_id:e.target.value}))}><option value="">— Select matter —</option>{matters.filter(m=>!commForm.client_id||clients.find(c=>c.id===commForm.client_id)?.full_name===m.client).map(m=><option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}</select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div><label style={lbl}>Type *</label><select className="mb-inp" value={commForm.comm_type} onChange={e=>setCommForm(f=>({...f,comm_type:e.target.value}))}>{['call','email','meeting','letter','note','whatsapp'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
                <div><label style={lbl}>Direction</label><select className="mb-inp" value={commForm.direction} onChange={e=>setCommForm(f=>({...f,direction:e.target.value}))}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></div>
                <div><label style={lbl}>Date</label><input className="mb-inp" type="date" value={commForm.comm_date} onChange={e=>setCommForm(f=>({...f,comm_date:e.target.value}))}/></div>
              </div>
              <div><label style={lbl}>Subject</label><input className="mb-inp" placeholder="Brief subject..." value={commForm.subject} onChange={e=>setCommForm(f=>({...f,subject:e.target.value}))}/></div>
              <div><label style={lbl}>Notes / Body *</label><textarea className="mb-inp" style={{minHeight:80,resize:'vertical'}} placeholder="What was discussed / communicated..." value={commForm.body} onChange={e=>setCommForm(f=>({...f,body:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setShowCommForm(false)}>Cancel</button><button style={C.btn('p')} disabled={!commForm.body.trim()} onClick={handleSaveComm}>Log Communication</button></div>
          </div>
        </div>)}

        {/* ── MODAL: Matter closure ───────────────────────────── */}
        {closingMatter&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setClosingMatter(null)}>
          <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Close Matter — {closingMatter.id}</div>
            <div style={{fontSize:11,color:'#555',marginBottom:16}}>{closingMatter.name} · {closingMatter.client}</div>
            <div><label style={lbl}>Closure Notes *</label><textarea className="mb-inp" style={{minHeight:80,resize:'vertical'}} placeholder="Reason for closure, final actions taken..." value={closureForm.closure_notes} onChange={e=>setClosureForm(f=>({...f,closure_notes:e.target.value}))}/></div>
            <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setClosingMatter(null)}>Cancel</button><button style={{...C.btn('r')}} disabled={!closureForm.closure_notes.trim()} onClick={()=>handleCloseMatter(closingMatter)}>Close Matter</button></div>
          </div>
        </div>)}

        {showCNForm&&cnInvoice&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowCNForm(false)}><div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:420}} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Issue Credit Note</div><div style={{fontSize:11,color:'#555',marginBottom:16}}>Against invoice <strong style={{color:'#F0F0F0'}}>{cnInvoice.id}</strong> · {cnInvoice.client} · {fmtR((cnInvoice.total_units||0)*(cnInvoice.rate||150)*1.15)} incl. VAT</div><div style={{display:'flex',flexDirection:'column',gap:12}}><div><label style={lbl}>Credit amount (R) *</label><input className="mb-inp" type="number" placeholder="0.00" value={cnForm.amount} onChange={e=>setCnForm(f=>({...f,amount:e.target.value}))}/></div><div><label style={lbl}>Reason *</label><textarea className="mb-inp" style={{minHeight:70,resize:'vertical'}} placeholder="Reason for credit note..." value={cnForm.reason} onChange={e=>setCnForm(f=>({...f,reason:e.target.value}))}/></div></div><div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}><button style={C.btn()} onClick={()=>setShowCNForm(false)}>Cancel</button><button style={C.btn('p')} disabled={savingCN||!cnForm.amount||!cnForm.reason.trim()} onClick={handleSaveCreditNote}>{savingCN?'Saving…':'Issue Credit Note'}</button></div></div></div>)}

      </div>
    </>
  );
}

