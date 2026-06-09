import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchPerformanceFeedback, savePerformanceFeedback, fetchPerformanceReviews, openPerformanceReview, closePerformanceReview } from '../lib/supabase';
import NavBar from '../components/NavBar';
import { SkeletonDashboard } from '../components/Skeleton';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

function BarChart({ data, height=130 }) {
  if (!data||!data.length) return <div style={{fontSize:11,color:'#333',textAlign:'center',padding:20}}>No data</div>;
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:3,height,padding:'0 2px'}}>
      {data.map((d,i)=>(
        <div key={i} title={`${d.label}: ${d.value}`} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
          <div style={{fontSize:8,color:'#777',fontWeight:600}}>{d.value>999?(d.value/1000).toFixed(1)+'k':d.value}</div>
          <div style={{width:'100%',background:d.color||'#8DC63F',borderRadius:'2px 2px 0 0',height:Math.max(Math.round((d.value/max)*(height-36)),2)}}/>
          <div style={{fontSize:7,color:'#444',textAlign:'center',width:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingTop:2}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

const TITLES = ['','Partner','Senior Attorney','Attorney','Associate Attorney','Candidate Attorney','Conveyancer','Bookkeeper','Receptionist','HR Manager','Other'];
const PERIODS = [
  { label: 'H1 2026 (Jan–Jun)', months: ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'] },
  { label: 'H2 2025 (Jul–Dec)', months: ['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'] },
  { label: 'H1 2025 (Jan–Jun)', months: ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06'] },
];

export default function HRDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('staff');
  const [profiles, setProfiles] = useState([]);
  const [allTime, setAllTime] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [satisfaction, setSatisfaction] = useState([]);
  const [selPeriod, setSelPeriod] = useState(0);
  const [selAtty, setSelAtty] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [fbForm, setFbForm] = useState({ subject_id:'', billing_score:0, client_score:0, teamwork_score:0, knowledge_score:0, overall_score:0, comments:'', is_anonymous:false });
  const [savingFb, setSavingFb] = useState(false);
  const [alert, setAlert] = useState({ msg:'', type:'' });
  const [editingTitle, setEditingTitle] = useState({});
  // Leave management
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ staff_id:'', type:'annual', from_date:'', to_date:'', reason:'' });
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState('all');
  // Payroll
  const [payMonth, setPayMonth] = useState(new Date().toLocaleDateString('en-CA').substring(0,7));
  // Performance feedback thread
  const [pfeedback, setPfeedback] = useState([]);
  const [selAttyDetail, setSelAttyDetail] = useState(null);
  const [pfMsg, setPfMsg] = useState('');
  const [pfType, setPfType] = useState('general');
  const [sendingPf, setSendingPf] = useState(false);
  // Review cycles
  const [reviews, setReviews] = useState([]);
  const [showOpenReview, setShowOpenReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ period:'', due_date:'', instructions:'' });
  const [savingReview, setSavingReview] = useState(false);

  function showMsg(msg, type='success') { setAlert({ msg, type }); setTimeout(() => setAlert({ msg:'', type:'' }), 5000); }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if (!p || !['hr','manager','national_manager'].includes(p.role)) { router.replace('/'); return; }
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    const [profRes, brRes] = await Promise.all([
      fetchAllProfiles(),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    setProfiles(profRes.profiles || []);
    setBranches(brRes.data || []);

    const { data: acts } = await supabase.from('activities').select('user_id,billing_units,duration_seconds,is_billable,date').neq('agent_id','demo');
    setAllTime(acts || []);

    const { data: invs } = await supabase.from('invoices').select('user_id,total_units,rate,created_at');
    setInvoices(invs || []);

    const { data: fb } = await supabase.from('feedback_360').select('*, profiles!feedback_360_reviewer_id_fkey(full_name,role)').order('created_at', { ascending: false });
    setFeedback(fb || []);

    const { data: sat } = await supabase.from('client_satisfaction').select('*').eq('submitted', true);
    setSatisfaction(sat || []);

    const { data: lv } = await supabase.from('leave_requests').select('*, profiles!leave_requests_staff_id_fkey(full_name,role,branch_id)').order('created_at', { ascending:false });
    setLeaveRequests(lv || []);

    const { feedback: pf } = await fetchPerformanceFeedback({});
    setPfeedback(pf || []);

    const { reviews: rv } = await fetchPerformanceReviews();
    setReviews(rv || []);
  }, []);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  const attorneys = profiles.filter(p => ['attorney','branch_manager','manager','national_manager'].includes(p.role));
  const period = PERIODS[selPeriod];

  function getAttyStats(atty) {
    const acts = allTime.filter(a => a.user_id === atty.id && a.is_billable && period.months.some(m => a.date?.startsWith(m)));
    const allActs = allTime.filter(a => a.user_id === atty.id && period.months.some(m => a.date?.startsWith(m)));
    const units = acts.reduce((s, a) => s + (a.billing_units || 0), 0);
    const billSec = acts.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const totalSec = allActs.reduce((s, a) => s + (a.duration_seconds || 0), 0);
    const invAmt = invoices.filter(i => i.user_id === atty.id && period.months.some(m => i.created_at?.startsWith(m))).reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
    const tgt = (atty.monthly_target || 0) * 6;
    const pct = tgt > 0 ? Math.round(units / tgt * 100) : null;
    const util = totalSec > 0 ? Math.round(billSec / totalSec * 100) : 0;
    const allFb = feedback.filter(f => f.subject_id === atty.id && f.period === period.label);
    const hrFb   = allFb.filter(f => f.reviewer_type === 'hr' || !f.reviewer_type);
    const selfFb = allFb.filter(f => f.reviewer_type === 'self');
    const peerFb = allFb.filter(f => f.reviewer_type === 'peer');
    const attyRatings = satisfaction.filter(s => s.attorney_id === atty.id);
    const avgOverall = hrFb.length   ? (hrFb.reduce((s,f)   => s + (f.overall_score||0), 0) / hrFb.length).toFixed(1)   : null;
    const avgPeer    = peerFb.length ? (peerFb.reduce((s,f) => s + (f.overall_score||0), 0) / peerFb.length).toFixed(1) : null;
    const selfAssess = selfFb[0] || null;
    const avgSat = attyRatings.length ? (attyRatings.reduce((s, r) => s + r.rating, 0) / attyRatings.length).toFixed(1) : null;
    return { units, billSec, totalSec, invAmt, tgt, pct, util, attyFb: allFb, hrFb, selfFb, peerFb, avgOverall, avgPeer, selfAssess, avgSat, attyRatings };
  }

  async function handleSaveLeave() {
    if (!leaveForm.staff_id || !leaveForm.from_date || !leaveForm.to_date) { showMsg('Fill in all required fields.', 'error'); return; }
    const days = Math.max(1, Math.round((new Date(leaveForm.to_date) - new Date(leaveForm.from_date)) / 86400000) + 1);
    setSavingLeave(true);
    const { error } = await supabase.from('leave_requests').insert([{ ...leaveForm, days, status:'pending', submitted_by: profile.id }]);
    setSavingLeave(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ Leave request submitted.');
    setShowLeaveForm(false);
    setLeaveForm({ staff_id:'', type:'annual', from_date:'', to_date:'', reason:'' });
    load();
  }

  async function handleLeaveAction(id, action) {
    const { error } = await supabase.from('leave_requests').update({ status: action, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg(`✓ Leave request ${action}.`);
    load();
  }

  function exportPayrollCSV(rows) {
    const hdr = 'Name,Role,Branch,Rate,Units,Billable Time,Gross Pay (excl VAT)';
    const lines = rows.map(r => `"${r.name}","${r.role}","${r.branch}",${r.rate},${r.units},"${r.time}",${r.gross.toFixed(2)}`);
    const blob = new Blob([hdr + '\n' + lines.join('\n')], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `payroll_${payMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function saveTitle(userId, title) {
    await supabase.from('profiles').update({ title }).eq('id', userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, title } : p));
    setEditingTitle(prev => ({ ...prev, [userId]: false }));
    showMsg('✓ Title updated.');
  }

  async function handleSaveFeedback() {
    if (!fbForm.subject_id || !fbForm.overall_score) { showMsg('Select attorney and overall score.', 'error'); return; }
    setSavingFb(true);
    const { error } = await supabase.from('feedback_360').insert([{
      ...fbForm, reviewer_id: fbForm.is_anonymous ? null : profile.id,
      reviewer_type: 'hr', period: period.label,
    }]);
    setSavingFb(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ Feedback submitted.');
    setShowFeedbackForm(false);
    setFbForm({ subject_id:'', billing_score:0, client_score:0, teamwork_score:0, knowledge_score:0, overall_score:0, comments:'', is_anonymous:false });
    load();
  }

  async function handleOpenReview() {
    if (!reviewForm.period) { showMsg('Select a period.', 'error'); return; }
    setSavingReview(true);
    const { error } = await openPerformanceReview({ ...reviewForm, opened_by: profile.id, status: 'open' });
    setSavingReview(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ Review cycle opened — attorneys will be notified.');
    setShowOpenReview(false);
    load();
  }

  async function handleCloseReview(id) {
    if (!confirm('Close this review cycle? Attorneys will no longer see the self-assessment prompt.')) return;
    const { error } = await closePerformanceReview(id);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ Review cycle closed.');
    load();
  }

  async function handleSendPf(toUserId) {
    if (!pfMsg.trim()) return;
    setSendingPf(true);
    const { error } = await savePerformanceFeedback({
      from_user_id: profile.id,
      to_user_id: toUserId,
      message: pfMsg.trim(),
      type: pfType,
      period: period.label,
      from_name: profile.full_name,
      is_read: false,
    });
    setSendingPf(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ Feedback sent.');
    setPfMsg('');
    const { feedback: pf } = await fetchPerformanceFeedback({});
    setPfeedback(pf || []);
  }

  function copyReview(atty, stats) {
    const txt = `360 PERFORMANCE REVIEW\n${period.label}\nAttorney: ${atty.full_name}\nTitle: ${atty.title||'Attorney'}\n\nBILLING PERFORMANCE\nUnits: ${stats.units}${stats.tgt>0?` / ${stats.tgt} target (${stats.pct}%)`:''}
Billable Time: ${toHm(stats.billSec)}\nUtilisation: ${stats.util}%\nRevenue: ${fmtR(stats.invAmt)}\n\n360 FEEDBACK (HR Assessment)\n${stats.attyFb.length?`Overall: ${stats.avgOverall}/5 (${stats.attyFb.length} reviews)\n${stats.attyFb.map(f=>`- ${f.is_anonymous?'Anonymous':f.profiles?.full_name||'Reviewer'}: Overall ${f.overall_score}/5 — ${f.comments||'No comment'}`).join('\n')}`:' No HR feedback yet'}\n\nCLIENT SATISFACTION\n${stats.avgSat?`Average: ${stats.avgSat}/5 (${stats.attyRatings.length} client ratings)`:'No client ratings yet'}`;
    navigator.clipboard.writeText(txt);
    showMsg('✓ Review copied to clipboard.');
  }

  const C = {
    page: { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0' },
    main: { maxWidth:1300, margin:'0 auto', padding:'20px 24px' },
    card: { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:16, marginBottom:14 },
    stat: (a,w) => ({ background:a?'rgba(141,198,63,0.05)':w?'rgba(234,179,8,0.05)':'#111', border:`1px solid ${a?'rgba(141,198,63,0.25)':w?'rgba(234,179,8,0.25)':'#1A1A1A'}`, borderRadius:8, padding:14 }),
    btn:  (v='s') => ({ background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent', border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525', color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:v==='p'?700:500 }),
    sel:  { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'5px 10px', borderRadius:6, fontSize:12, fontFamily:'inherit' },
    th:   { fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#444', padding:'9px 10px', borderBottom:'1px solid #181818', textAlign:'left', fontWeight:600 },
    td:   { padding:'9px 10px', fontSize:11, borderBottom:'1px solid #161616', verticalAlign:'middle' },
    inp:  { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'8px 12px', borderRadius:6, fontSize:12, fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
    lbl:  { fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, display:'block' },
  };

  const roleColor = r => r==='manager'||r==='national_manager'?'#A78BFA':r==='branch_manager'?'#4A90D9':r==='bookkeeper'?'#EAB308':r==='hr'?'#F472B6':'#8DC63F';

  if (loading) return <div style={C.page}><SkeletonDashboard /></div>;

  return (<>
    <Head><title>HR Dashboard — MB SmartTrack</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}select option{background:#1A1A1A;color:#F0F0F0}button:hover{opacity:.85}textarea{resize:vertical}`}</style>
    <div style={C.page}>
      <NavBar role="hr" tab={tab} setTab={setTab} profile={profile} onSignOut={async()=>{await signOut();router.replace('/login');}} />

      {alert.msg && <div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>✕</button></div>}

      {/* ── STAFF TAB ── */}
      {tab==='staff' && (<div style={C.main}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Staff Directory</div><div style={{fontSize:11,color:'#444'}}>{profiles.length} staff members · {branches.length} branches</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[{l:'Total Staff',v:profiles.length},{l:'Attorneys',v:attorneys.length,a:true},{l:'Branches',v:branches.length},{l:'Roles',v:[...new Set(profiles.map(p=>p.role))].length}].map(({l,v,a})=>(<div key={l} style={C.stat(a,false)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:a?'#8DC63F':'#F0F0F0'}}>{v}</div></div>))}
        </div>
        <div style={C.card}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Name','Title','Role','Branch','Rate','Target','Email'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {profiles.map(p => {
                const br = branches.find(b => b.id === p.branch_id);
                return (<tr key={p.id}>
                  <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{p.full_name}</td>
                  <td style={C.td}>
                    {editingTitle[p.id] ? (
                      <input autoFocus type="text" defaultValue={p.title||''} placeholder="e.g. Senior Attorney"
                        style={{...C.sel,fontSize:10,width:160}}
                        onBlur={e=>saveTitle(p.id,e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTitle(prev=>({...prev,[p.id]:false}));}}
                      />
                    ) : (
                      <span style={{fontSize:10,color:p.title?'#C8C8C8':'#4A90D9',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted'}} onClick={()=>setEditingTitle(prev=>({...prev,[p.id]:true}))}>{p.title||'Click to set'}</span>
                    )}
                  </td>
                  <td style={C.td}><span style={{fontSize:9,padding:'1px 8px',borderRadius:20,background:'rgba(141,198,63,0.08)',color:roleColor(p.role),fontWeight:600}}>{p.role}</span></td>
                  <td style={{...C.td,fontSize:10,color:'#4A90D9'}}>{br?.name||'—'}</td>
                  <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F'}}>R{p.rate||150}</td>
                  <td style={{...C.td,fontFamily:'monospace',color:'#555'}}>{p.monthly_target||'—'}</td>
                  <td style={{...C.td,fontSize:10,color:'#555'}}>{p.email||'—'}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>)}

      {/* ── PERFORMANCE TAB ── */}
      {tab==='performance' && (<div style={C.main}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Performance Review</div><div style={{fontSize:11,color:'#444'}}>Bi-annual performance with 360 feedback</div></div>
          <div style={{display:'flex',gap:8}}>
            <select style={C.sel} value={selPeriod} onChange={e=>setSelPeriod(Number(e.target.value))}>
              {PERIODS.map((p,i)=><option key={i} value={i}>{p.label}</option>)}
            </select>
            <button style={C.btn('p')} onClick={()=>{setFbForm({subject_id:'',billing_score:0,client_score:0,teamwork_score:0,knowledge_score:0,overall_score:0,comments:'',is_anonymous:false});setShowFeedbackForm(true);}}>+ Add HR Feedback</button>
          </div>
        </div>

        {/* ── Review Cycle Status ── */}
        {(()=>{
          const active = reviews.find(r=>r.status==='open');
          const selfSubmissions = feedback.filter(f=>f.reviewer_type==='self'&&f.period===(active?.period||period.label));
          const submittedIds = new Set(selfSubmissions.map(f=>f.subject_id));
          return(<div style={{...C.card,marginBottom:16}}>
            {active ? (<>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#D0D0D0',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:'#8DC63F',display:'inline-block',boxShadow:'0 0 6px #8DC63F'}}/>
                    Review Open — {active.period}
                  </div>
                  <div style={{fontSize:11,color:'#555',marginTop:4}}>
                    Due: <strong style={{color:'#EAB308'}}>{active.due_date ? new Date(active.due_date+'T12:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'}) : 'No deadline'}</strong>
                    {active.instructions&&<span style={{marginLeft:12,color:'#444',fontStyle:'italic'}}>"{active.instructions}"</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:11,color:'#555'}}>{submittedIds.size} / {attorneys.length} self-assessments</span>
                  <button style={{...C.btn('r'),fontSize:11}} onClick={()=>handleCloseReview(active.id)}>Close Review</button>
                </div>
              </div>
              {attorneys.length>0&&(<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
                {attorneys.map(a=>{
                  const done=submittedIds.has(a.id);
                  return(<span key={a.id} style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:done?'rgba(141,198,63,0.1)':'rgba(234,179,8,0.07)',color:done?'#8DC63F':'#EAB308',border:`1px solid ${done?'rgba(141,198,63,0.25)':'rgba(234,179,8,0.18)'}`}}>
                    {done?'✓':'⏳'} {a.full_name.split(' ')[0]}
                  </span>);
                })}
              </div>)}
              {/* Peer review progress by branch */}
              {branches.filter(b=>attorneys.filter(a=>a.branch_id===b.id).length>1).map(b=>{
                const bAttys=attorneys.filter(a=>a.branch_id===b.id);
                const peerForBranch=feedback.filter(f=>f.reviewer_type==='peer'&&f.period===active.period&&bAttys.some(a=>a.id===f.subject_id));
                const pairs=new Set(peerForBranch.map(f=>`${f.reviewer_id}-${f.subject_id}`)).size;
                const expected=bAttys.length*(bAttys.length-1);
                const pp=expected>0?Math.round(pairs/expected*100):0;
                const pc=pp>=100?'#8DC63F':pp>=50?'#EAB308':'#E05252';
                return(<div key={b.id} style={{marginTop:8,padding:'8px 12px',background:'#0D0D0D',borderRadius:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:11,color:'#888',fontWeight:600}}>{b.name} — Peer Reviews</span>
                    <span style={{fontSize:11,color:pc,fontWeight:700}}>{pairs}/{expected} pairs · {pp}%</span>
                  </div>
                  <div style={{height:4,background:'#1A1A1A',borderRadius:2}}><div style={{width:`${Math.min(pp,100)}%`,height:'100%',background:pc,borderRadius:2,transition:'width .4s'}}/></div>
                </div>);
              })}
            </>) : (<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'#888'}}>No active review cycle</div>
                <div style={{fontSize:11,color:'#444',marginTop:2}}>Open a cycle to request self-assessments from all attorneys</div>
              </div>
              <button style={C.btn('p')} onClick={()=>{setReviewForm({period:period.label,due_date:'',instructions:''});setShowOpenReview(true);}}>Open Review Cycle</button>
            </div>)}
          </div>);
        })()}

        {attorneys.map(atty => {
          const stats = getAttyStats(atty);
          const br = branches.find(b => b.id === atty.branch_id);
          const gc = stats.pct===null?'#444':stats.pct>=100?'#8DC63F':stats.pct>=70?'#EAB308':'#E05252';
          return (<div key={atty.id} style={C.card}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'#D0D0D0'}}>{atty.full_name}</div>
                <div style={{fontSize:11,color:'#555'}}>{atty.title||'Attorney'} · {br?.name||'—'} · Target: {atty.monthly_target||0} units/month</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button style={{...C.btn(),fontSize:11}} onClick={()=>copyReview(atty,stats)}>📋 Copy Review</button>
                <button style={{...C.btn('p'),fontSize:11}} onClick={()=>{setFbForm(f=>({...f,subject_id:atty.id}));setShowFeedbackForm(true);}}>+ Feedback</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* Billing performance */}
              <div style={{background:'#0D0D0D',borderRadius:8,padding:14}}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:10}}>Billing Performance</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                  {[{l:'Units',v:stats.units+(stats.tgt>0?` / ${stats.tgt}`:''),c:gc},{l:'Time',v:toHm(stats.billSec),c:'#4A90D9'},{l:'Utilisation',v:stats.util+'%',c:stats.util>=70?'#8DC63F':'#EAB308'},{l:'Revenue',v:fmtR(stats.invAmt),c:'#8DC63F'}].map(({l,v,c})=>(<div key={l}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div></div>))}
                </div>
                {stats.pct!==null&&(<><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:10,color:'#555'}}>Target</span><span style={{fontSize:10,fontWeight:700,color:gc}}>{stats.pct}%</span></div><div style={{height:6,background:'#1A1A1A',borderRadius:3}}><div style={{width:`${Math.min(stats.pct,100)}%`,height:'100%',background:gc,borderRadius:3}}/></div></>)}
              </div>
              {/* 360 feedback */}
              <div style={{background:'#0D0D0D',borderRadius:8,padding:14}}>
                <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:10}}>360° Feedback — {period.label}</div>
                {stats.attyFb.length===0&&stats.attyRatings.length===0?(<div style={{fontSize:11,color:'#333',textAlign:'center',padding:'10px 0'}}>No feedback yet for this period</div>):(<>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
                    {stats.avgOverall&&<div style={{background:'#111',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>HR Assessment</div><div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:18,fontWeight:800,color:'#A78BFA'}}>{stats.avgOverall}</span><span style={{fontSize:10,color:'#555'}}>/5 · {stats.hrFb.length}</span></div></div>}
                    {stats.avgPeer&&<div style={{background:'#111',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Peer Reviews</div><div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:18,fontWeight:800,color:'#4A90D9'}}>{stats.avgPeer}</span><span style={{fontSize:10,color:'#555'}}>/5 · {stats.peerFb.length} peer{stats.peerFb.length!==1?'s':''}</span></div></div>}
                    {stats.selfAssess&&<div style={{background:'#111',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Self-Assessment</div><div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:18,fontWeight:800,color:'#8DC63F'}}>{stats.selfAssess.overall_score}</span><span style={{fontSize:10,color:'#555'}}>/5 self</span></div></div>}
                    {stats.avgSat&&<div style={{background:'#111',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Client Satisfaction</div><div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:18,fontWeight:800,color:'#F59E0B'}}>{stats.avgSat}</span><span style={{fontSize:10,color:'#555'}}>/5 · {stats.attyRatings.length}</span></div></div>}
                  </div>
                  {stats.hrFb.map(f=>(<div key={f.id} style={{marginTop:6,padding:'7px 10px',background:'#111',borderRadius:6,fontSize:11}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:'#555',fontSize:10}}>{f.is_anonymous?'Anonymous (HR)':f.profiles?.full_name}</span><span style={{color:'#A78BFA',fontWeight:700}}>Overall: {f.overall_score}/5</span></div>{f.comments&&<div style={{color:'#777',fontStyle:'italic',fontSize:10}}>"{f.comments}"</div>}</div>))}
                </>)}
              </div>
            </div>
            {/* Detail & Feedback Thread */}
            <div style={{borderTop:'1px solid #1A1A1A',marginTop:12,paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button style={{...C.btn(),fontSize:11}} onClick={()=>setSelAttyDetail(selAttyDetail===atty.id?null:atty.id)}>{selAttyDetail===atty.id?'▲ Hide Detail':'▼ View Detail & Feedback'}</button>
              {pfeedback.filter(f=>f.to_user_id===atty.id).length>0&&<span style={{fontSize:10,color:'#A78BFA'}}>{pfeedback.filter(f=>f.to_user_id===atty.id).length} message(s) in thread</span>}
            </div>
            {selAttyDetail===atty.id&&(()=>{
              const attyPf=pfeedback.filter(f=>f.to_user_id===atty.id);
              const TC={commendation:'#8DC63F',concern:'#E05252',action_required:'#EAB308',general:'#555'};
              const leaveDays=(type)=>leaveRequests.filter(l=>l.staff_id===atty.id&&l.status==='approved'&&l.type===type).reduce((s,l)=>s+(l.days||0),0);
              return(<div style={{marginTop:12,background:'#0A0A0A',borderRadius:8,padding:16}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                  {[{l:'Annual leave taken',v:leaveDays('annual')+' days',c:'#8DC63F'},{l:'Sick leave taken',v:leaveDays('sick')+' days',c:'#E05252'},{l:'Client ratings',v:stats.attyRatings.length,c:'#F59E0B'}].map(({l,v,c})=>(<div key={l} style={{background:'#111',borderRadius:6,padding:'10px 12px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:4}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div></div>))}
                </div>
                {stats.peerFb.length>0&&(<div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:6}}>Peer Reviews — {stats.peerFb.length} received</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:8}}>
                    {[
                      {l:'Overall',v:stats.avgPeer+'/5',c:'#4A90D9'},
                      {l:'Billing',v:stats.peerFb.length?(stats.peerFb.reduce((s,f)=>s+(f.billing_score||0),0)/stats.peerFb.length).toFixed(1)+'/5':'—',c:'#888'},
                      {l:'Client',v:stats.peerFb.length?(stats.peerFb.reduce((s,f)=>s+(f.client_score||0),0)/stats.peerFb.length).toFixed(1)+'/5':'—',c:'#888'},
                      {l:'Teamwork',v:stats.peerFb.length?(stats.peerFb.reduce((s,f)=>s+(f.teamwork_score||0),0)/stats.peerFb.length).toFixed(1)+'/5':'—',c:'#888'},
                    ].map(({l,v,c})=>(<div key={l} style={{background:'#111',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:3}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div></div>))}
                  </div>
                  {stats.peerFb.map(f=>(<div key={f.id} style={{marginBottom:4,padding:'7px 10px',background:'#111',borderRadius:6}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:10,color:'#555'}}>{f.is_anonymous||!f.profiles?'Anonymous Peer':f.profiles?.full_name}</span><span style={{fontSize:10,color:'#4A90D9',fontWeight:700}}>Overall: {f.overall_score}/5</span></div>{f.comments&&<div style={{fontSize:10,color:'#777',fontStyle:'italic'}}>"{f.comments}"</div>}</div>))}
                </div>)}
                <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:8}}>HR Feedback Thread</div>
                {attyPf.length===0
                  ?<div style={{fontSize:11,color:'#333',textAlign:'center',padding:14,borderRadius:6,background:'#111',marginBottom:12}}>No messages yet — start the conversation below</div>
                  :<div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12,maxHeight:240,overflowY:'auto',paddingRight:4}}>
                    {attyPf.map(msg=>{
                      const isHr=msg.from_user_id!==atty.id;
                      const tc=TC[msg.type]||'#555';
                      return(<div key={msg.id} style={{display:'flex',justifyContent:isHr?'flex-start':'flex-end'}}>
                        <div style={{background:isHr?'#1A1A1A':'rgba(141,198,63,0.08)',border:`1px solid ${isHr?'#252525':'rgba(141,198,63,0.2)'}`,borderRadius:8,padding:'8px 12px',maxWidth:'78%'}}>
                          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                            <span style={{fontSize:9,fontWeight:700,color:isHr?'#F472B6':'#8DC63F'}}>{msg.sender?.full_name||'HR'}</span>
                            <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,background:`${tc}20`,color:tc,textTransform:'capitalize'}}>{msg.type?.replace(/_/g,' ')}</span>
                            <span style={{fontSize:9,color:'#333',marginLeft:'auto'}}>{new Date(msg.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})}</span>
                          </div>
                          <div style={{fontSize:11,color:'#C0C0C0',lineHeight:1.5}}>{msg.message}</div>
                          {!msg.is_read&&isHr&&<div style={{fontSize:8,color:'#EAB308',marginTop:2}}>• Unread by attorney</div>}
                        </div>
                      </div>);
                    })}
                  </div>
                }
                <div style={{background:'#111',borderRadius:8,padding:12}}>
                  <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{fontSize:11,color:'#888',fontWeight:600}}>Send to {atty.full_name.split(' ')[0]}</div>
                    <select style={{...C.sel,marginLeft:'auto',fontSize:11}} value={pfType} onChange={e=>setPfType(e.target.value)}>
                      {[['general','General'],['commendation','Commendation ★'],['concern','Concern ⚠'],['action_required','Action Required !']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <textarea style={{...C.inp,minHeight:66,marginBottom:8}} value={pfMsg} onChange={e=>setPfMsg(e.target.value)} placeholder="Write feedback, commendation, or action item for this attorney…"/>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <button style={C.btn('p')} disabled={sendingPf||!pfMsg.trim()} onClick={()=>handleSendPf(atty.id)}>{sendingPf?'Sending…':'Send Feedback'}</button>
                  </div>
                </div>
              </div>);
            })()}
          </div>);
        })}
      </div>)}

      {/* ── ANALYTICS TAB ── */}
      {tab==='analytics' && (()=>{
        const attyStats = attorneys.map(atty => {
          const stats = getAttyStats(atty);
          const br = branches.find(b=>b.id===atty.branch_id);
          return { atty, stats, br };
        });
        const sortedByUnits = [...attyStats].sort((a,b)=>b.stats.units-a.stats.units);
        const sortedByRev   = [...attyStats].sort((a,b)=>b.stats.invAmt-a.stats.invAmt);
        const totalUnits    = attyStats.reduce((s,x)=>s+x.stats.units, 0);
        const totalRevenue  = attyStats.reduce((s,x)=>s+x.stats.invAmt, 0);
        const avgUtil       = attyStats.length ? Math.round(attyStats.reduce((s,x)=>s+x.stats.util,0)/attyStats.length) : 0;
        const onTargetN     = attyStats.filter(x=>x.stats.pct!==null&&x.stats.pct>=100).length;
        const withTarget    = attyStats.filter(x=>x.stats.tgt>0).length;
        const unitsBars     = sortedByUnits.slice(0,8).map(x=>({ label:x.atty.full_name.split(' ')[0], value:x.stats.units, color:x.stats.pct===null?'#555':x.stats.pct>=100?'#8DC63F':x.stats.pct>=70?'#EAB308':'#E05252' }));
        const revBars       = sortedByRev.slice(0,8).map(x=>({ label:x.atty.full_name.split(' ')[0], value:Math.round(x.stats.invAmt/1000)*1000, color:'#4A90D9' }));
        return (<div style={C.main}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>HR Analytics</div>
            <div style={{fontSize:11,color:'#444'}}>Performance overview · {period.label}</div>
          </div>
          {/* Period selector */}
          <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
            <select style={C.sel} value={selPeriod} onChange={e=>setSelPeriod(Number(e.target.value))}>
              {PERIODS.map((p,i)=><option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>
          {/* Summary cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            {[
              {l:'Total Attorneys',v:attorneys.length,c:'#F0F0F0'},
              {l:'Total Billing Units',v:totalUnits.toLocaleString(),c:'#8DC63F'},
              {l:'Avg Utilisation',v:avgUtil+'%',c:avgUtil>=70?'#8DC63F':avgUtil>=50?'#EAB308':'#E05252'},
              {l:'On Target',v:`${onTargetN} / ${withTarget}`,c:'#4A90D9'},
            ].map(({l,v,c})=>(<div key={l} style={C.stat(false,false)}>
              <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div>
              <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
            </div>))}
          </div>
          {/* Charts row */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Billing Units — Top Attorneys</div>
              <BarChart data={unitsBars} height={140}/>
              <div style={{display:'flex',gap:10,marginTop:10,fontSize:9,color:'#555',flexWrap:'wrap'}}>
                <span style={{color:'#8DC63F'}}>■ On target</span>
                <span style={{color:'#EAB308'}}>■ 70%+ target</span>
                <span style={{color:'#E05252'}}>■ Below 70%</span>
                <span style={{color:'#555'}}>■ No target set</span>
              </div>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Revenue (incl. VAT)</div>
              <BarChart data={revBars} height={140}/>
              <div style={{fontSize:10,color:'#555',marginTop:10,textAlign:'right'}}>Total: {fmtR(totalRevenue)}</div>
            </div>
          </div>
          {/* Rankings table */}
          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Attorney Rankings · {period.label}</div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['#','Attorney','Branch','Units','Target%','Util%','Revenue','360 Score','Client Sat','Signal'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {sortedByUnits.map(({atty,stats,br},i)=>{
                  const gc=stats.pct===null?'#444':stats.pct>=100?'#8DC63F':stats.pct>=70?'#EAB308':'#E05252';
                  const medal=i===0?'#EAB308':i===1?'#888':i===2?'#CD7F32':'#333';
                  return(<tr key={atty.id} style={{cursor:'pointer'}} onClick={()=>{setSelAttyDetail(atty.id);setTab('performance');}}>
                    <td style={{...C.td,fontWeight:800,color:medal,textAlign:'center'}}>#{i+1}</td>
                    <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{atty.full_name}</td>
                    <td style={{...C.td,color:'#4A90D9',fontSize:10}}>{br?.name||'—'}</td>
                    <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:gc}}>{stats.units.toLocaleString()}</td>
                    <td style={{...C.td,fontWeight:700,color:gc}}>{stats.pct!==null?stats.pct+'%':'—'}</td>
                    <td style={{...C.td,color:stats.util>=70?'#8DC63F':stats.util>=50?'#EAB308':'#E05252'}}>{stats.util}%</td>
                    <td style={{...C.td,fontFamily:'monospace',color:'#8DC63F',fontSize:10}}>{fmtR(stats.invAmt)}</td>
                    <td style={{...C.td,color:'#A78BFA',fontWeight:700}}>{stats.avgOverall||'—'}</td>
                    <td style={{...C.td,color:'#F59E0B',fontWeight:700}}>{stats.avgSat||'—'}</td>
                    <td style={{...C.td,fontSize:16,textAlign:'center'}}>{stats.pct===null?'—':stats.pct>=100?'↑':stats.pct>=70?'→':'↓'}</td>
                  </tr>);
                })}
              </tbody>
            </table>
            <div style={{fontSize:10,color:'#333',marginTop:8}}>Click any row to open the attorney's detail view in the Performance tab.</div>
          </div>
        </div>);
      })()}

      {/* ── LEAVE TAB ── */}
      {tab==='leave' && (() => {
        const LEAVE_TYPES = ['annual','sick','unpaid','study','maternity','paternity','family_responsibility'];
        const LEAVE_COLORS = { annual:'#8DC63F', sick:'#E05252', unpaid:'#555', study:'#4A90D9', maternity:'#F472B6', paternity:'#A78BFA', family_responsibility:'#EAB308' };
        const filtered = leaveFilter==='all' ? leaveRequests : leaveRequests.filter(l=>l.status===leaveFilter);
        const summary = profiles.map(p => {
          const taken = leaveRequests.filter(l=>l.staff_id===p.id&&l.status==='approved');
          return { ...p, annual: taken.filter(l=>l.type==='annual').reduce((s,l)=>s+(l.days||0),0), sick: taken.filter(l=>l.type==='sick').reduce((s,l)=>s+(l.days||0),0) };
        }).filter(p=>p.annual>0||p.sick>0);
        return (<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Leave Management</div><div style={{fontSize:11,color:'#444'}}>{leaveRequests.filter(l=>l.status==='pending').length} pending · {leaveRequests.filter(l=>l.status==='approved').length} approved</div></div>
            <div style={{display:'flex',gap:8}}>
              {['all','pending','approved','rejected'].map(s=><button key={s} style={{...C.btn(),fontSize:11,background:leaveFilter===s?'#1A1A1A':'transparent',color:leaveFilter===s?'#F0F0F0':'#555',textTransform:'capitalize'}} onClick={()=>setLeaveFilter(s)}>{s}</button>)}
              <button style={C.btn('p')} onClick={()=>setShowLeaveForm(true)}>+ Request Leave</button>
            </div>
          </div>
          {summary.length>0&&(<div style={{...C.card,marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:10}}>Days Taken (approved)</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{summary.map(p=>(<div key={p.id} style={{background:'#0D0D0D',borderRadius:6,padding:'8px 12px',fontSize:11}}><div style={{fontWeight:600,color:'#D0D0D0',marginBottom:4}}>{p.full_name}</div><div style={{display:'flex',gap:12}}><span style={{color:'#8DC63F'}}>Annual: {p.annual}d</span><span style={{color:'#E05252'}}>Sick: {p.sick}d</span></div></div>))}</div></div>)}
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Staff Member','Type','From','To','Days','Reason','Status','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!filtered.length&&<tr><td colSpan={8} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No leave requests{leaveFilter!=='all'?` with status "${leaveFilter}"`:''}</td></tr>}
                {filtered.map(l=>{
                  const typeColor=LEAVE_COLORS[l.type]||'#555';
                  return(<tr key={l.id}>
                    <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{l.profiles?.full_name||'—'}</td>
                    <td style={C.td}><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:`${typeColor}15`,color:typeColor,textTransform:'capitalize'}}>{l.type?.replace(/_/g,' ')}</span></td>
                    <td style={{...C.td,fontFamily:'monospace',fontSize:10}}>{l.from_date}</td>
                    <td style={{...C.td,fontFamily:'monospace',fontSize:10}}>{l.to_date}</td>
                    <td style={{...C.td,fontWeight:700,color:'#EAB308'}}>{l.days}d</td>
                    <td style={{...C.td,color:'#666',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.reason||'—'}</td>
                    <td style={C.td}><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:l.status==='approved'?'rgba(141,198,63,0.1)':l.status==='rejected'?'rgba(220,80,80,0.1)':'rgba(234,179,8,0.1)',color:l.status==='approved'?'#8DC63F':l.status==='rejected'?'#E05252':'#EAB308',textTransform:'capitalize'}}>{l.status}</span></td>
                    <td style={C.td}>{l.status==='pending'&&(<div style={{display:'flex',gap:4}}><button style={{...C.btn('p'),fontSize:10,padding:'3px 10px'}} onClick={()=>handleLeaveAction(l.id,'approved')}>Approve</button><button style={{...C.btn('r'),fontSize:10,padding:'3px 10px'}} onClick={()=>handleLeaveAction(l.id,'rejected')}>Reject</button></div>)}</td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>);
      })()}

      {/* ── PAYROLL TAB ── */}
      {tab==='payroll' && (() => {
        const payActs = allTime.filter(a => a.date?.startsWith(payMonth) && a.is_billable);
        const rows = profiles.map(p => {
          const acts = payActs.filter(a => a.user_id === p.id);
          const units = acts.reduce((s,a) => s+(a.billing_units||0), 0);
          const secs = acts.reduce((s,a) => s+(a.duration_seconds||0), 0);
          const rate = p.rate || 150;
          const gross = units * rate;
          const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60);
          const br = branches.find(b=>b.id===p.branch_id);
          return { id:p.id, name:p.full_name, role:p.role, branch:br?.name||'—', rate, units, time: h>0?`${h}h ${m}m`:`${m}m`, gross };
        }).filter(r => r.units > 0 || true);
        const totalGross = rows.reduce((s,r)=>s+r.gross, 0);
        return (<div style={C.main}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.03em'}}>Payroll Summary</div><div style={{fontSize:11,color:'#444'}}>{rows.filter(r=>r.units>0).length} billing staff · {payMonth}</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="month" style={{...C.sel,padding:'6px 10px'}} value={payMonth} onChange={e=>setPayMonth(e.target.value)}/>
              <button style={C.btn('p')} onClick={()=>exportPayrollCSV(rows)}>↓ Export CSV</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            {[{l:'Total Staff',v:rows.length},{l:'Active Billers',v:rows.filter(r=>r.units>0).length,a:true},{l:'Total Units',v:rows.reduce((s,r)=>s+r.units,0),a:true},{l:'Gross Billing',v:fmtR(totalGross),a:true}].map(({l,v,a})=>(<div key={l} style={C.stat(a,false)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:a?'#8DC63F':'#F0F0F0'}}>{v}</div></div>))}
          </div>
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Name','Role','Branch','Rate/unit','Units','Billable Time','Gross (excl VAT)'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(r=>(<tr key={r.id} style={{opacity:r.units===0?0.4:1}}>
                  <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{r.name}</td>
                  <td style={C.td}><span style={{fontSize:10,padding:'1px 8px',borderRadius:20,background:'rgba(141,198,63,0.08)',color:roleColor(r.role)}}>{r.role}</span></td>
                  <td style={{...C.td,color:'#4A90D9',fontSize:10}}>{r.branch}</td>
                  <td style={{...C.td,fontFamily:'monospace',color:'#555'}}>R{r.rate}</td>
                  <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:r.units>0?'#F0F0F0':'#333'}}>{r.units}</td>
                  <td style={{...C.td,color:'#555'}}>{r.time}</td>
                  <td style={{...C.td,fontFamily:'monospace',fontWeight:700,color:'#8DC63F'}}>{fmtR(r.gross)}</td>
                </tr>))}
                <tr style={{borderTop:'2px solid #1A1A1A'}}><td colSpan={6} style={{...C.td,fontWeight:700,color:'#D0D0D0',textAlign:'right'}}>Total</td><td style={{...C.td,fontFamily:'monospace',fontWeight:800,color:'#8DC63F',fontSize:13}}>{fmtR(totalGross)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{fontSize:10,color:'#333',marginTop:8}}>* Gross billing = units × hourly rate. Does not include fixed-fee matters or disbursements. Export to CSV for further processing.</div>
        </div>);
      })()}

      {/* ── FEEDBACK FORM MODAL ── */}
      {showFeedbackForm && (<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowFeedbackForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:500}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>HR Assessment — {period.label}</div>
          <div style={{fontSize:11,color:'#555',marginBottom:16}}>Rate the attorney across key performance areas</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={C.lbl}>Attorney *</label><select style={C.inp} value={fbForm.subject_id} onChange={e=>setFbForm(f=>({...f,subject_id:e.target.value}))}><option value="">— Select attorney —</option>{attorneys.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select></div>
            {[['billing_score','Billing & Targets'],['client_score','Client Service'],['teamwork_score','Teamwork & Attitude'],['knowledge_score','Legal Knowledge'],['overall_score','Overall Rating']].map(([key,label])=>(
              <div key={key}><label style={C.lbl}>{label} *</label>
                <div style={{display:'flex',gap:8}}>
                  {[1,2,3,4,5].map(n=><button key={n} style={{flex:1,padding:'8px',borderRadius:6,border:`1px solid ${fbForm[key]===n?'#8DC63F':'#252525'}`,background:fbForm[key]===n?'rgba(141,198,63,0.15)':'#1A1A1A',color:fbForm[key]===n?'#8DC63F':'#555',cursor:'pointer',fontSize:14,fontFamily:'inherit',fontWeight:fbForm[key]===n?700:400}} onClick={()=>setFbForm(f=>({...f,[key]:n}))}>{n}{'★'.repeat(n)}</button>)}
                </div>
              </div>
            ))}
            <div><label style={C.lbl}>Comments</label><textarea style={{...C.inp,minHeight:70}} value={fbForm.comments} onChange={e=>setFbForm(f=>({...f,comments:e.target.value}))} placeholder="Narrative assessment, strengths, areas for improvement..."/></div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888',cursor:'pointer'}}><input type="checkbox" checked={fbForm.is_anonymous} onChange={e=>setFbForm(f=>({...f,is_anonymous:e.target.checked}))}/>Submit anonymously</label>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
            <button style={C.btn()} onClick={()=>setShowFeedbackForm(false)}>Cancel</button>
            <button style={C.btn('p')} disabled={savingFb||!fbForm.subject_id||!fbForm.overall_score} onClick={handleSaveFeedback}>{savingFb?'Saving…':'Submit Feedback'}</button>
          </div>
        </div>
      </div>)}

      {/* ── OPEN REVIEW MODAL ── */}
      {showOpenReview&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowOpenReview(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Open Performance Review Cycle</div>
          <div style={{fontSize:11,color:'#555',marginBottom:18}}>Attorneys will be notified to complete their self-assessment</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={C.lbl}>Review Period *</label>
              <select style={C.inp} value={reviewForm.period} onChange={e=>setReviewForm(f=>({...f,period:e.target.value}))}>
                <option value="">— Select period —</option>
                {PERIODS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={C.lbl}>Self-Assessment Due Date</label>
              <input type="date" style={C.inp} value={reviewForm.due_date} onChange={e=>setReviewForm(f=>({...f,due_date:e.target.value}))}/>
            </div>
            <div>
              <label style={C.lbl}>Instructions for Attorneys (optional)</label>
              <textarea style={{...C.inp,minHeight:64}} value={reviewForm.instructions} onChange={e=>setReviewForm(f=>({...f,instructions:e.target.value}))} placeholder="e.g. Please reflect honestly on your performance this half-year…"/>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:18,justifyContent:'flex-end'}}>
            <button style={C.btn()} onClick={()=>setShowOpenReview(false)}>Cancel</button>
            <button style={C.btn('p')} disabled={savingReview||!reviewForm.period} onClick={handleOpenReview}>{savingReview?'Opening…':'Open Review'}</button>
          </div>
        </div>
      </div>)}

      {/* ── LEAVE REQUEST FORM MODAL ── */}
      {showLeaveForm && (<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowLeaveForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:440}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Submit Leave Request</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={C.lbl}>Staff Member *</label><select style={C.inp} value={leaveForm.staff_id} onChange={e=>setLeaveForm(f=>({...f,staff_id:e.target.value}))}><option value="">— Select staff —</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
            <div><label style={C.lbl}>Leave Type *</label><select style={C.inp} value={leaveForm.type} onChange={e=>setLeaveForm(f=>({...f,type:e.target.value}))}>{['annual','sick','unpaid','study','maternity','paternity','family_responsibility'].map(t=><option key={t} value={t} style={{textTransform:'capitalize'}}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><label style={C.lbl}>From Date *</label><input type="date" style={C.inp} value={leaveForm.from_date} onChange={e=>setLeaveForm(f=>({...f,from_date:e.target.value}))}/></div>
              <div><label style={C.lbl}>To Date *</label><input type="date" style={C.inp} value={leaveForm.to_date} onChange={e=>setLeaveForm(f=>({...f,to_date:e.target.value}))}/></div>
            </div>
            {leaveForm.from_date&&leaveForm.to_date&&<div style={{fontSize:11,color:'#EAB308',textAlign:'center'}}>Duration: {Math.max(1,Math.round((new Date(leaveForm.to_date)-new Date(leaveForm.from_date))/86400000)+1)} day(s)</div>}
            <div><label style={C.lbl}>Reason / Notes</label><textarea style={{...C.inp,minHeight:60}} value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} placeholder="Optional reason or medical reference..."/></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
            <button style={C.btn()} onClick={()=>setShowLeaveForm(false)}>Cancel</button>
            <button style={C.btn('p')} disabled={savingLeave} onClick={handleSaveLeave}>{savingLeave?'Submitting…':'Submit'}</button>
          </div>
        </div>
      </div>)}
    </div>
  </>);
}
