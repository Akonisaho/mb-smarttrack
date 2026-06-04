import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from '../lib/supabase';
import { useFirmSettings } from '../lib/useFirmSettings';
import Sidebar from '../components/Sidebar';

const EV_COLORS = { meeting:'#4A90D9', court:'#E05252', deadline:'#EAB308', call:'#A78BFA', other:'#8DC63F' };
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }

export default function Receptionist() {
  const router = useRouter();
  const firm = useFirmSettings();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [clock, setClock] = useState('');
  const [clients, setClients] = useState([]);
  const [matters, setMatters] = useState([]);
  const [events, setEvents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [cur, setCur] = useState(new Date());
  const [showEvForm, setShowEvForm] = useState(false);
  const [editEv, setEditEv] = useState(null);
  const [evForm, setEvForm] = useState({ title:'', event_type:'meeting', start_date:new Date().toLocaleDateString('en-CA'), end_date:'', start_time:'09:00', end_time:'10:00', all_day:false, location:'', matter_id:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ msg:'', type:'' });
  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if (!p) { router.replace('/login'); return; }
      if (p.role !== 'receptionist') { router.replace('/'); return; }
      setProfile(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => { const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    const [cRes, mRes, eRes, bRes] = await Promise.all([
      supabase.from('clients').select('*').eq('is_active', true).order('full_name'),
      supabase.from('matters').select('id,name,client,status,branch_id').order('created_at', { ascending:false }),
      fetchCalendarEvents({ userId: profile.id, isManager: false }),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    setClients(cRes.data || []);
    setMatters(mRes.data || []);
    setEvents(eRes.events || []);
    setBranches(bRes.data || []);
  }, [profile]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  function showMsg(msg, type='success') { setAlert({ msg, type }); setTimeout(() => setAlert({ msg:'', type:'' }), 5000); }

  function openAddEv(date='') { setEditEv(null); setEvForm({ title:'', event_type:'meeting', start_date:date||today, end_date:'', start_time:'09:00', end_time:'10:00', all_day:false, location:'', matter_id:'', description:'' }); setShowEvForm(true); }
  function openEditEv(ev) { setEditEv(ev); setEvForm({ title:ev.title, event_type:ev.event_type||'meeting', start_date:ev.start_date, end_date:ev.end_date||'', start_time:ev.start_time||'09:00', end_time:ev.end_time||'10:00', all_day:ev.all_day||false, location:ev.location||'', matter_id:ev.matter_id||'', description:ev.description||'' }); setShowEvForm(true); }

  async function handleSaveEv() {
    if (!evForm.title || !evForm.start_date) { showMsg('Title and date are required.', 'error'); return; }
    setSaving(true);
    const payload = { ...evForm, color: EV_COLORS[evForm.event_type]||'#8DC63F', user_id: profile.id, branch_id: profile.branch_id||null };
    if (editEv) payload.id = editEv.id;
    const { error } = await saveCalendarEvent(payload, profile.id);
    setSaving(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg(editEv ? '✓ Event updated.' : '✓ Event created.');
    setShowEvForm(false);
    load();
  }

  async function handleDeleteEv(id) {
    if (!confirm('Delete this event?')) return;
    await deleteCalendarEvent(id);
    setShowEvForm(false);
    load();
  }

  const y = cur.getFullYear(), m = cur.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  function dayEvts(day) { const d = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; return events.filter(e => e.start_date === d); }
  const upcomingEvts = events.filter(e => e.start_date >= today).sort((a,b) => a.start_date.localeCompare(b.start_date)).slice(0, 10);
  const filteredClients = clients.filter(c => !search || c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  const C = {
    page:  { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0', display:'flex' },
    content: { flex:1, minWidth:0, display:'flex', flexDirection:'column' },
    hdr:   { background:'#0F0F0F', borderBottom:'1px solid #1A1A1A', padding:'0 24px', height:48, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 },
    main:  { maxWidth:1200, margin:'0 auto', padding:'20px 24px' },
    card:  { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:16, marginBottom:14 },
    stat:  { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:14 },
    btn:   (v='s') => ({ background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent', border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525', color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:v==='p'?700:500 }),
    sel:   { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'5px 10px', borderRadius:6, fontSize:12, fontFamily:'inherit' },
    th:    { fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#444', padding:'9px 10px', borderBottom:'1px solid #181818', textAlign:'left', fontWeight:600 },
    td:    { padding:'9px 10px', fontSize:11, borderBottom:'1px solid #161616', verticalAlign:'middle' },
    ntab:  (on) => ({ background:'transparent', border:`1px solid ${on?'#2A2A2A':'transparent'}`, color:on?'#F0F0F0':'#555', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:on?600:400 }),
    pill:  { display:'flex', alignItems:'center', gap:6, background:'rgba(141,198,63,0.08)', border:'1px solid rgba(141,198,63,0.2)', borderRadius:20, padding:'4px 12px', fontSize:11, color:'#8DC63F' },
    dot:   { width:7, height:7, borderRadius:'50%', background:'#8DC63F', boxShadow:'0 0 6px rgba(141,198,63,0.8)' },
  };
  const inp = { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'9px 12px', borderRadius:6, fontSize:12, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box' };
  const lbl = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, display:'block' };

  if (loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return (<>
    <Head><title>{firm.firm_name} — Reception</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}select option{background:#1A1A1A;color:#F0F0F0}input[type=date],input[type=time]{color-scheme:dark}button:hover{opacity:.85}textarea{resize:vertical}`}</style>
    <div style={C.page}>
      <Sidebar
        role="receptionist"
        tab={tab}
        setTab={setTab}
        profile={profile}
        onSignOut={async()=>{await signOut();router.replace('/login');}}
      />
      <div style={C.content}>
      <div style={C.hdr}>
        <div style={{fontSize:12,color:'#555',fontWeight:500,paddingLeft:48}}>Reception — {profile?.full_name}</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}><div style={C.pill}><div style={C.dot}/>{clock}</div></div>
      </div>

      {alert.msg&&<div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>✕</button></div>}

      <div style={C.main}>

        {/* DASHBOARD */}
        {tab==='dashboard'&&(<>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, {profile?.full_name?.split(' ')[0]}</div>
          <div style={{fontSize:11,color:'#444',marginBottom:16}}>{new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[{l:'Total Clients',v:clients.length,s:'active'},{l:'Open Matters',v:matters.filter(m=>m.status==='open'||!m.status).length,s:'in progress'},{l:"Today's Events",v:events.filter(e=>e.start_date===today).length,s:'scheduled'},{l:'Upcoming Events',v:upcomingEvts.length,s:'next 30 days'}].map(({l,v,s})=>(<div key={l} style={C.stat}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Upcoming Events</div>
              {!upcomingEvts.length?<div style={{textAlign:'center',padding:20,color:'#555',fontSize:12}}>No upcoming events</div>:upcomingEvts.map(ev=>(
                <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #161616',cursor:'pointer'}} onClick={()=>openEditEv(ev)}>
                  <div style={{width:4,height:36,borderRadius:2,background:ev.color||'#8DC63F',flexShrink:0}}/>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:'#D0D0D0'}}>{ev.title}</div><div style={{fontSize:10,color:'#555'}}>{fdate(ev.start_date)}{!ev.all_day&&ev.start_time?` · ${ev.start_time.substring(0,5)}`:''}{ev.location?` · ${ev.location}`:''}</div></div>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:`${ev.color||'#8DC63F'}22`,color:ev.color||'#8DC63F',textTransform:'capitalize'}}>{ev.event_type}</span>
                </div>
              ))}
              <button style={{...C.btn('p'),marginTop:12,width:'100%'}} onClick={()=>openAddEv()}>+ Add Event</button>
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Recent Clients</div>
              {clients.slice(0,8).map(c=>(<div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #161616'}}>
                <div><div style={{fontSize:12,fontWeight:500,color:'#D0D0D0'}}>{c.full_name}</div><div style={{fontSize:10,color:'#555'}}>{c.email||c.phone||'—'}</div></div>
                <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(74,144,217,0.1)',color:'#4A90D9',textTransform:'capitalize'}}>{c.client_type||'individual'}</span>
              </div>))}
              <button style={{...C.btn(),marginTop:12,width:'100%',fontSize:11}} onClick={()=>setTab('clients')}>View all clients →</button>
            </div>
          </div>
        </>)}

        {/* CLIENTS */}
        {tab==='clients'&&(<>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700}}>Clients ({clients.length})</div>
          </div>
          <div style={{marginBottom:12}}>
            <input type="text" placeholder="Search by name, email or phone..." value={search} onChange={e=>setSearch(e.target.value)} style={{...C.sel,padding:'8px 14px',width:'100%',maxWidth:400}}/>
          </div>
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Ref','Name','Type','Email','Phone','Branch'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!filteredClients.length&&<tr><td colSpan={6} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No clients found.</td></tr>}
                {filteredClients.map(c=>{const br=branches.find(b=>b.id===c.branch_id);return(<tr key={c.id}>
                  <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{c.client_no||'—'}</td>
                  <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{c.full_name}<div style={{fontSize:9,color:'#444'}}>{c.id_number||''}</div></td>
                  <td style={{...C.td,fontSize:10,textTransform:'capitalize',color:'#777'}}>{c.client_type||'individual'}</td>
                  <td style={{...C.td,fontSize:10,color:'#555'}}>{c.email||'—'}</td>
                  <td style={{...C.td,fontSize:10,color:'#555'}}>{c.phone||'—'}</td>
                  <td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        </>)}

        {/* CALENDAR */}
        {tab==='calendar'&&(<>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button style={C.btn()} onClick={()=>setCur(new Date(y,m-1,1))}>‹</button>
              <div style={{fontSize:16,fontWeight:700,minWidth:190,textAlign:'center'}}>{new Date(y,m,1).toLocaleDateString('en-ZA',{month:'long',year:'numeric'})}</div>
              <button style={C.btn()} onClick={()=>setCur(new Date(y,m+1,1))}>›</button>
              <button style={{...C.btn(),fontSize:11}} onClick={()=>setCur(new Date())}>Today</button>
            </div>
            <button style={C.btn('p')} onClick={()=>openAddEv()}>+ Add Event</button>
          </div>
          <div style={C.card}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1}}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{padding:'6px 4px',fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:'.05em',fontWeight:600,textAlign:'center'}}>{d}</div>)}
              {Array.from({length:firstDay},(_,i)=><div key={'b'+i}/>)}
              {Array.from({length:daysInMonth},(_,i)=>{
                const day=i+1;
                const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const de=dayEvts(day);
                const isToday=ds===today;
                return(<div key={day} style={{minHeight:80,padding:4,border:'1px solid #161616',borderRadius:4,background:isToday?'rgba(141,198,63,0.04)':'transparent',cursor:'pointer'}} onClick={()=>openAddEv(ds)}>
                  <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'#8DC63F':'#555',width:22,height:22,borderRadius:'50%',background:isToday?'rgba(141,198,63,0.15)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:3}}>{day}</div>
                  {de.slice(0,3).map(ev=>(<div key={ev.id} style={{background:ev.color||'#8DC63F',borderRadius:3,padding:'2px 5px',fontSize:9,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#000',fontWeight:600,cursor:'pointer'}} onClick={e=>{e.stopPropagation();openEditEv(ev);}}>{ev.title}</div>))}
                  {de.length>3&&<div style={{fontSize:9,color:'#555'}}>+{de.length-3}</div>}
                </div>);
              })}
            </div>
          </div>
        </>)}

        {/* MATTERS */}
        {tab==='matters'&&(<>
          <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>Matters (read only)</div>
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Matter ID','Name','Client','Status','Branch'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!matters.length&&<tr><td colSpan={5} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>No matters yet.</td></tr>}
                {matters.map(m=>{const br=branches.find(b=>b.id===m.branch_id);return(<tr key={m.id}>
                  <td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td>
                  <td style={{...C.td,fontWeight:500,color:'#D0D0D0'}}>{m.name}</td>
                  <td style={{...C.td,color:'#888'}}>{m.client}</td>
                  <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:m.status==='open'||!m.status?'rgba(141,198,63,0.1)':'rgba(74,144,217,0.1)',color:m.status==='open'||!m.status?'#8DC63F':'#4A90D9'}}>{m.status||'open'}</span></td>
                  <td style={{...C.td,fontSize:10,color:'#555'}}>{br?.name||'—'}</td>
                </tr>);})}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {/* EVENT FORM */}
      {showEvForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowEvForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>{editEv?'Edit Event':'New Event'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={lbl}>Event Type</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {Object.entries(EV_COLORS).map(([type,color])=>(<button key={type} style={{background:evForm.event_type===type?color:'transparent',border:`1px solid ${evForm.event_type===type?color:'#252525'}`,color:evForm.event_type===type?'#000':'#888',padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:11,fontFamily:'inherit',textTransform:'capitalize'}} onClick={()=>setEvForm(f=>({...f,event_type:type}))}>{type}</button>))}
              </div>
            </div>
            <div><label style={lbl}>Title *</label><input style={inp} type="text" value={evForm.title} onChange={e=>setEvForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Start Date *</label><input style={inp} type="date" value={evForm.start_date} onChange={e=>setEvForm(f=>({...f,start_date:e.target.value}))}/></div>
              <div><label style={lbl}>End Date</label><input style={inp} type="date" value={evForm.end_date} onChange={e=>setEvForm(f=>({...f,end_date:e.target.value}))}/></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888',cursor:'pointer'}}><input type="checkbox" checked={evForm.all_day} onChange={e=>setEvForm(f=>({...f,all_day:e.target.checked}))}/> All-day event</label>
            {!evForm.all_day&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Start Time</label><input style={inp} type="time" value={evForm.start_time} onChange={e=>setEvForm(f=>({...f,start_time:e.target.value}))}/></div>
              <div><label style={lbl}>End Time</label><input style={inp} type="time" value={evForm.end_time} onChange={e=>setEvForm(f=>({...f,end_time:e.target.value}))}/></div>
            </div>)}
            <div><label style={lbl}>Location</label><input style={inp} type="text" placeholder="Courtroom, meeting room..." value={evForm.location} onChange={e=>setEvForm(f=>({...f,location:e.target.value}))}/></div>
            <div><label style={lbl}>Matter (optional)</label>
              <select style={inp} value={evForm.matter_id} onChange={e=>setEvForm(f=>({...f,matter_id:e.target.value}))}>
                <option value="">— No matter —</option>
                {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:60}} value={evForm.description} onChange={e=>setEvForm(f=>({...f,description:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:18}}>
            <div>{editEv&&<button style={C.btn('r')} onClick={()=>handleDeleteEv(editEv.id)}>Delete</button>}</div>
            <div style={{display:'flex',gap:8}}>
              <button style={C.btn()} onClick={()=>setShowEvForm(false)}>Cancel</button>
              <button style={{...C.btn('p'),opacity:saving?.6:1}} disabled={saving} onClick={handleSaveEv}>{saving?'Saving…':(editEv?'Update':'Create')}</button>
            </div>
          </div>
        </div>
      </div>)}

      </div>{/* end C.content */}
    </div>
  </>);
}
