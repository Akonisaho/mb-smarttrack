import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles } from '../lib/supabase';
import NavBar from '../components/NavBar';

function toHm(s){ s=Number(s)||0; if(s<=0)return'0m'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

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
    const attyFb = feedback.filter(f => f.subject_id === atty.id && f.period === period.label);
    const attyRatings = satisfaction.filter(s => s.attorney_id === atty.id);
    const avgOverall = attyFb.length ? (attyFb.reduce((s, f) => s + (f.overall_score || 0), 0) / attyFb.length).toFixed(1) : null;
    const avgSat = attyRatings.length ? (attyRatings.reduce((s, r) => s + r.rating, 0) / attyRatings.length).toFixed(1) : null;
    return { units, billSec, totalSec, invAmt, tgt, pct, util, attyFb, avgOverall, avgSat, attyRatings };
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

  if (loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

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
                      <select style={{...C.sel,fontSize:10}} defaultValue={p.title||''} onBlur={e=>saveTitle(p.id,e.target.value)} autoFocus>
                        {TITLES.map(t=><option key={t} value={t}>{t||'— Set title —'}</option>)}
                      </select>
                    ) : (
                      <span style={{fontSize:10,color:p.title?'#C8C8C8':'#333',cursor:'pointer'}} onClick={()=>setEditingTitle(prev=>({...prev,[p.id]:true}))}>{p.title||'Click to set'}</span>
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
                  {stats.avgOverall&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>HR Assessment</div><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{fontSize:20,fontWeight:800,color:'#A78BFA'}}>{stats.avgOverall}</div><div style={{fontSize:11,color:'#555'}}>/5 · {stats.attyFb.length} review{stats.attyFb.length!==1?'s':''}</div></div></div>}
                  {stats.avgSat&&<div><div style={{fontSize:9,color:'#555',textTransform:'uppercase',marginBottom:2}}>Client Satisfaction</div><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{fontSize:20,fontWeight:800,color:'#F59E0B'}}>{stats.avgSat}</div><div style={{fontSize:11,color:'#555'}}>/5 · {stats.attyRatings.length} client{stats.attyRatings.length!==1?'s':''}</div><div>{'★'.repeat(Math.round(Number(stats.avgSat)))}</div></div></div>}
                  {stats.attyFb.map(f=>(<div key={f.id} style={{marginTop:8,padding:'8px 10px',background:'#111',borderRadius:6,fontSize:11}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{color:'#555'}}>{f.is_anonymous?'Anonymous (HR)':f.profiles?.full_name}</span><span style={{color:'#A78BFA',fontWeight:700}}>Overall: {f.overall_score}/5</span></div>{f.comments&&<div style={{color:'#888',fontStyle:'italic'}}>"{f.comments}"</div>}</div>))}
                </>)}
              </div>
            </div>
          </div>);
        })}
      </div>)}

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
    </div>
  </>);
}
